// Default is an offline plan. Never reads local .env or connects without explicit --apply.
const fs = require("fs");
const path = require("path");
const { assertCredentialsPath, demoDataset, assertSeedConfig, randomPassword, populateNewDatabase } = require("../utils/remoteShowcaseSeed");
async function seed(args = process.argv.slice(2), env = process.env) {
  const dataset = demoDataset();
  if (!args.includes("--apply")) { console.log(JSON.stringify({mode:"offline-plan",users:dataset.users.length,records:dataset.records.length,leaves:dataset.leaves.length})); return; }
  assertSeedConfig(env);
  if (!args.includes("--confirm-new-atlas")) throw new Error("Conferma esplicita del nuovo Atlas mancante");
  const file = env.SHOWCASE_CREDENTIALS_FILE;
  const repo = path.resolve(__dirname,"../..");
  assertCredentialsPath(file,repo);
  const passwords = Object.fromEntries(dataset.users.map(user=>[user.username,randomPassword()]));
  // Atomic exclusive file creation; never print passwords or URI, never overwrite existing files.
  fs.writeFileSync(file,JSON.stringify(passwords,null,2),{flag:"wx",mode:0o600});
  const { MongoClient } = require("mongoose").mongo;
  const client = new MongoClient(env.SHOWCASE_SEED_URI,{maxPoolSize:2,serverSelectionTimeoutMS:10000});
  try {
    await client.connect();
    const counts = await populateNewDatabase(client.db(assertSeedConfig(env)),dataset,passwords,require("bcryptjs").hash);
    console.log(JSON.stringify({mode:"seed-completed",...counts}));
  } finally {await client.close();}
}
if (require.main === module) seed().catch(()=>{console.error("Seed bloccato o incompleto. Nessun reset automatico: controllare nuovo Atlas e file privato; nessun segreto stampato.");process.exitCode=1;});
module.exports = { seed };
