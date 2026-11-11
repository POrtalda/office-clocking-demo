// Offline only: no bootstrap, MongoClient, DNS lookup, HTTP call or application import.
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { assertRemoteShowcaseConfig, assertAtlasTarget, DATABASE } = require("../utils/remoteShowcase");
const { assertSeedConfig, assertCredentialsPath, demoDataset } = require("../utils/remoteShowcaseSeed");
const ATLAS_HOST = "showcasecluster.xed8r0t.mongodb.net";
const SECRETS_DIRECTORY = "C:\\Office-Clocking-Secrets";
const SEED_KEYS = ["APP_ENV", "SHOWCASE_ATLAS_HOST", "SHOWCASE_SEED_URI", "SHOWCASE_SEED_CONFIRM", "SHOWCASE_CREDENTIALS_FILE"];
const RUNTIME_KEYS = ["APP_ENV", "NODE_ENV", "DEMO_MODE", "DEMO_LOCAL_GPS_BYPASS", "GEOLOCATION_CLOCK_IN_ENABLED", "SHOWCASE_EMAIL_MODE", "SHOWCASE_ADMIN_USERNAME", "CLIENT_URL", "SHOWCASE_API_URL", "SHOWCASE_ATLAS_HOST", "MONGO_URI", "JWT_SECRET", "OFFICE_LAT", "OFFICE_LNG", "OFFICE_RADIUS_METERS"];
function checkObjects(seed, runtime, repo, fileSystem = fs) {
  const missingSeed = SEED_KEYS.filter(key => !seed[key]);
  const missingRuntime = RUNTIME_KEYS.filter(key => !runtime[key]);
  const result = { offline: true, seed: { valid: false, missing: missingSeed }, runtime: { valid: false, missing: missingRuntime }, separateAccounts: false };
  const allowed = (object, keys) => Object.keys(object).every(key => keys.includes(key));
  if (!allowed(seed,SEED_KEYS) || !allowed(runtime,[...RUNTIME_KEYS,"SHOWCASE_GPS_CHECK_DISABLED"])) { result.code = "UNEXPECTED_CONFIGURATION_KEYS"; return result; }
  try {
    if (seed.SHOWCASE_ATLAS_HOST !== ATLAS_HOST) throw new Error();
    assertSeedConfig(seed); assertCredentialsPath(seed.SHOWCASE_CREDENTIALS_FILE,repo,fileSystem);
    const uri = new URL(seed.SHOWCASE_SEED_URI);
    if (decodeURIComponent(uri.username) !== "showcase_seed") throw new Error();
    result.seed.existingCredentials = fileSystem.existsSync(seed.SHOWCASE_CREDENTIALS_FILE);
    result.seed.standardSeedAllowed = !result.seed.existingCredentials;
    result.seed.recoveryRequired = result.seed.existingCredentials;
    result.seed.valid = true;
  } catch { result.seed.code = missingSeed.length ? "INCOMPLETE" : "INVALID_SEED_PROFILE_OR_OUTPUT"; }
  try {
    if (runtime.SHOWCASE_ATLAS_HOST !== ATLAS_HOST || runtime.CLIENT_URL !== "https://office-clocking-demo.netlify.app" || runtime.SHOWCASE_API_URL !== "https://office-clocking-backend-demo.onrender.com") throw new Error();
    assertRemoteShowcaseConfig(runtime);
    const uri = new URL(runtime.MONGO_URI);
    if (decodeURIComponent(uri.username) !== "showcase_runtime") throw new Error();
    result.runtime.valid = true;
  } catch { result.runtime.code = missingRuntime.length ? "INCOMPLETE" : "INVALID_RUNTIME_PROFILE"; }
  try {
    assertAtlasTarget(seed.SHOWCASE_SEED_URI,ATLAS_HOST);assertAtlasTarget(runtime.MONGO_URI,ATLAS_HOST);
    const seedUri=new URL(seed.SHOWCASE_SEED_URI), runtimeUri=new URL(runtime.MONGO_URI);
    result.separateAccounts = decodeURIComponent(seedUri.username)==="showcase_seed" && decodeURIComponent(runtimeUri.username)==="showcase_runtime" && decodeURIComponent(seedUri.password)!==decodeURIComponent(runtimeUri.password);
  } catch { /* Never echo parser errors or credential values. */ }
  result.valid = result.seed.valid && result.runtime.valid && result.separateAccounts;
  return result;
}
function run(args = process.argv.slice(2)) {
  if (!args.length) {
    const data = demoDataset();
    console.log(JSON.stringify({ offline:true, mode:"plan-only",users:data.users.length,records:data.records.length,leaves:data.leaves.length,database:DATABASE,credentialsCreated:false,databaseConnection:false }));
    return;
  }
  if (args.length !== 1 || args[0] !== "--private-files") throw new Error("Unsupported offline operation");
  if (process.platform !== "win32") throw new Error("Private configuration check requires Windows");
  const repo=path.resolve(__dirname,"../..");
  // Parse only the two explicit files. Never load process.env, .env or old demo connections.
  const seed=dotenv.parse(fs.readFileSync(path.join(SECRETS_DIRECTORY,"showcase-seed.env")));
  const runtime=dotenv.parse(fs.readFileSync(path.join(SECRETS_DIRECTORY,"showcase-runtime.env")));
  const result=checkObjects(seed,runtime,repo);
  console.log(JSON.stringify(result));
  if(!result.valid)process.exitCode=2;
}
if(require.main===module)try{run();}catch{console.error("Controllo offline non completato: verificare file privati e permessi; nessun segreto stampato.");process.exitCode=2;}
module.exports={ATLAS_HOST,SEED_KEYS,RUNTIME_KEYS,checkObjects,run};
