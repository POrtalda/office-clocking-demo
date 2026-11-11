// Separate, explicit recovery. Default/check mode never reads account passwords or connects.
const fs=require("fs");
const dotenv=require("dotenv");
const {inspectConfig}=require("./diagnoseRemoteShowcase");
const {DATABASE,strongDemoPassword}=require("../utils/remoteShowcase");
const {demoDataset,populateNewDatabase}=require("../utils/remoteShowcaseSeed");
const PRIVATE_SEED="C:/Office-Clocking-Secrets/showcase-seed.env";
function validatePasswords(value,dataset) {
  const expected=dataset.users.map(user=>user.username);
  if(!value || Array.isArray(value) || typeof value!=="object" || Object.keys(value).length!==expected.length || expected.some(name=>!Object.hasOwn(value,name)||!strongDemoPassword(value[name])) || new Set(Object.values(value)).size!==expected.length)throw Error("Invalid existing account file");
  return value;
}
async function recover(args=process.argv.slice(2),deps={}) {
  const fileSystem=deps.fs || fs;
  const required=["--apply","--reuse-existing-credentials","--confirm-new-atlas",`--confirm-database=${DATABASE}`];
  const applying=args.length===required.length && required.every(flag=>args.includes(flag));
  if(!applying && !(args.length===0 || (args.length===1&&args[0]==="--check")))throw Error("Invalid recovery confirmations");
  // Fixed operator file only. No process.env/local dotenv or old demo connections.
  const env=dotenv.parse(fileSystem.readFileSync(PRIVATE_SEED));
  const config=inspectConfig(env,fileSystem);
  if(!config.credentialFileExists)throw Error("Existing account file required");
  if(!applying)return {mode:"recovery-plan-only",database:DATABASE,existingCredentials:true,accountPasswordsRead:false,databaseConnection:false};
  const MongoClient=deps.MongoClient || require("mongoose").mongo.MongoClient;
  const client=new MongoClient(env.SHOWCASE_SEED_URI,{maxPoolSize:2,serverSelectionTimeoutMS:10000,retryWrites:false});
  try {
    await client.connect();const db=client.db(DATABASE);
    // Refuse ALL existing collections, even empty ones, before reading credentials.
    if((await db.listCollections({}, {nameOnly:true}).toArray()).length)throw Error("Database not empty; no recovery");
    const info=fileSystem.lstatSync(env.SHOWCASE_CREDENTIALS_FILE);
    if(info.isSymbolicLink()||!info.isFile()||info.size>65536)throw Error("Invalid existing account file");
    // This branch is future opt-in execution only; no file is ever written/renamed/deleted.
    const dataset=demoDataset();
    const passwords=validatePasswords(JSON.parse(fileSystem.readFileSync(env.SHOWCASE_CREDENTIALS_FILE,"utf8")),dataset);
    const assertTarget=async()=>{
      // Revalidate the exact dedicated host, URI profile and selected DB before EVERY write.
      inspectConfig(env,fileSystem);
      if(db.databaseName!==DATABASE)throw Error("Recovery target mismatch");
    };
    const counts=await populateNewDatabase(db,dataset,passwords,deps.hashPassword || require("bcryptjs").hash,assertTarget);
    return {mode:"recovery-completed",database:DATABASE,...counts};
  } finally {await client.close();}
}
if(require.main===module)recover().then(result=>console.log(JSON.stringify(result))).catch(()=>{console.error("Recupero bloccato o incompleto: nessun reset automatico, nessun segreto stampato. Conservare file account e database.");process.exitCode=1;});
module.exports={recover,validatePasswords};
