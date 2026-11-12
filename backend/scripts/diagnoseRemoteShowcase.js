// Diagnostics only. Never imports the seeder entry point or writes credentials/data.
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const {safeError}=require("../utils/safeMongoError");
const { assertSeedConfig, assertCredentialsPath } = require("../utils/remoteShowcaseSeed");
const { DATABASE, PURPOSE } = require("../utils/remoteShowcase");
const HOST = "showcasecluster.xed8r0t.mongodb.net";
const PRIVATE_SEED = "C:/Office-Clocking-Secrets/showcase-seed.env";
function inspectConfig(env, fileSystem = fs) {
  assertSeedConfig(env);
  const uri = new URL(env.SHOWCASE_SEED_URI);
  if (env.SHOWCASE_ATLAS_HOST !== HOST || uri.hostname !== HOST || decodeURIComponent(uri.username) !== "showcase_seed") throw new Error("Invalid diagnostic target");
  assertCredentialsPath(env.SHOWCASE_CREDENTIALS_FILE, path.resolve(__dirname,"../.."), fileSystem);
  // Never open/read the generated-password file. Existence is the only check.
  const credentialFileExists = fileSystem.existsSync(env.SHOWCASE_CREDENTIALS_FILE);
  return { configValid:true, targetVerified:true, seedUserVerified:true, credentialFileExists, seedWouldStopBeforeAtlas:credentialFileExists };
}
function classifyError(error) { return safeError(error).category; }
async function inspectDatabase(db, onStage = () => {}) {
  onStage("list-collections");
  const names=(await db.listCollections({}, {nameOnly:true}).toArray()).map(row=>row.name);
  const known=["_showcase_guard","users","timerecords","leaverequests","appsettings","timerecordlocks"];
  onStage("read-marker");
  const marker=names.includes("_showcase_guard")?await db.collection("_showcase_guard").findOne({_id:PURPOSE},{projection:{_id:0,state:1}}):null;
  const state=["ready","initializing"].includes(marker?.state)?marker.state:marker?"unknown":null;
  const counts={};
  for(const name of known.filter(name=>names.includes(name))) { onStage(`count-${name}`); counts[name]=await db.collection(name).countDocuments({}); }
  const status=!names.length?"EMPTY_DATABASE":state==="ready"&&known.every(name=>names.includes(name))?"ALREADY_INITIALIZED":state==="initializing"?"PARTIAL_INITIALIZATION":"EXISTING_DATABASE_REQUIRES_REVIEW";
  let permissions;
  onStage("inspect-roles");
  {
    const result=await db.command({connectionStatus:1,showPrivileges:false});
    const roles=result.authInfo?.authenticatedUserRoles || [];
    permissions={roleInspection:"OK",readWriteOnTarget:roles.some(role=>role.db===DATABASE&&role.role==="readWrite"),dbAdminOnTarget:roles.some(role=>role.db===DATABASE&&role.role==="dbAdmin")};
  }
  return {status,collectionCount:names.length,unknownCollectionCount:names.filter(name=>!known.includes(name)).length,markerState:state,counts,permissions};
}
async function diagnose(args=process.argv.slice(2), fileSystem=fs, loadClient=()=>require("mongoose").mongo.MongoClient) {
  if(args.length>1 || (args.length===1 && args[0]!=="--atlas-read-only"))return {category:"INVALID_ARGUMENTS",errorCode:"INVALID_ARGUMENTS",stage:"arguments"};
  let env;
  try {
    // Fixed private seed file only: never inherit MONGO_URI or load local .env.
    env=dotenv.parse(fileSystem.readFileSync(PRIVATE_SEED));inspectConfig(env,fileSystem);
  } catch {return {category:"OFFLINE_CONFIGURATION_FAILED",errorCode:"CONFIG_INVALID_OR_UNREADABLE",stage:"offline-configuration"};}
  if(!args.length)return {category:"OFFLINE_CHECK_COMPLETE",errorCode:"NONE",stage:"offline-configuration"};
  let client,stage="load-driver";
  try {
    const MongoClient=loadClient();
    stage="create-client";
    client=new MongoClient(env.SHOWCASE_SEED_URI,{maxPoolSize:1,serverSelectionTimeoutMS:8000,connectTimeoutMS:8000,socketTimeoutMS:8000,retryWrites:false});
    stage="connect";await client.connect();stage="select-database";
    const result=await inspectDatabase(client.db(DATABASE),value=>{stage=value;});
    return {category:result.status,errorCode:"NONE",stage:"inspection-complete"};
  } catch(error) {return {...safeError(error),stage};}
  finally {if(client)try{await client.close();}catch{/* Never print driver errors. */}}
}
if(require.main===module)diagnose().then(result=>{
  console.log(JSON.stringify(result));
  if(!["OFFLINE_CHECK_COMPLETE","EMPTY_DATABASE","ALREADY_INITIALIZED","PARTIAL_INITIALIZATION","EXISTING_DATABASE_REQUIRES_REVIEW"].includes(result.category))process.exitCode=1;
}).catch(()=>{console.log(JSON.stringify({category:"DIAGNOSTIC_FAILURE",errorCode:"UNKNOWN",stage:"diagnostic"}));process.exitCode=1;});
module.exports={inspectConfig,classifyError,safeError,inspectDatabase,diagnose};
