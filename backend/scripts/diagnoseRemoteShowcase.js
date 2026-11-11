// Diagnostics only. Never imports the seeder entry point or writes credentials/data.
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
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
function safeError(error) {
  const queue=[error],seen=new Set(),matches=[];
  const codes=new Map([[18,"AUTHENTICATION_FAILED"],[13,"PERMISSION_DENIED"],[50,"OPERATION_TIMEOUT"],[89,"NETWORK_FAILURE"],[91,"SERVER_UNAVAILABLE"],[262,"OPERATION_TIMEOUT"],[26,"NAMESPACE_NOT_FOUND"],[59,"COMMAND_UNSUPPORTED"],[115,"COMMAND_UNSUPPORTED"],[303,"COMMAND_UNSUPPORTED"]]);
  const systemCodes=new Map([
    ...["ENOTFOUND","EAI_AGAIN","ENODATA","ESERVFAIL","EREFUSED"].map(code=>[code,"DNS_FAILURE"]),
    ...["ETIMEOUT","ETIMEDOUT"].map(code=>[code,"OPERATION_TIMEOUT"]),
    ...["ECONNREFUSED","ECONNRESET","EHOSTUNREACH","ENETUNREACH","EPIPE"].map(code=>[code,"NETWORK_FAILURE"]),
    ...["CERT_HAS_EXPIRED","CERT_NOT_YET_VALID","DEPTH_ZERO_SELF_SIGNED_CERT","SELF_SIGNED_CERT_IN_CHAIN","UNABLE_TO_VERIFY_LEAF_SIGNATURE","UNABLE_TO_GET_ISSUER_CERT_LOCALLY","ERR_TLS_CERT_ALTNAME_INVALID","ERR_SSL_WRONG_VERSION_NUMBER"].map(code=>[code,"TLS_FAILURE"])
  ]);
  const names=new Map([["MongoServerSelectionError","SERVER_SELECTION_TIMEOUT"],["MongooseServerSelectionError","SERVER_SELECTION_TIMEOUT"],["MongoNetworkTimeoutError","OPERATION_TIMEOUT"],["MongoOperationTimeoutError","OPERATION_TIMEOUT"],["MongoWaitQueueTimeoutError","OPERATION_TIMEOUT"],["MongoNetworkError","NETWORK_FAILURE"],["MongoPoolClearedError","NETWORK_FAILURE"],["MongoTopologyClosedError","CLIENT_STATE_ERROR"],["MongoNotConnectedError","CLIENT_STATE_ERROR"],["MongoParseError","DRIVER_CONFIGURATION_ERROR"],["MongoInvalidArgumentError","DRIVER_CONFIGURATION_ERROR"],["TypeError","DIAGNOSTIC_TYPE_ERROR"],["ReferenceError","DIAGNOSTIC_REFERENCE_ERROR"]]);
  while(queue.length && seen.size<100) {
    const node=queue.shift();if(!node || typeof node!=="object" || seen.has(node))continue;seen.add(node);
    const code=typeof node.code==="string" && /^\d{1,5}$/.test(node.code)?Number(node.code):node.code;
    if(codes.has(code))matches.push({category:codes.get(code),errorCode:`MONGO_${code}`});
    if(typeof code==="string" && /^(ERR_TLS_|ERR_SSL_|CERT_)/.test(code) && !systemCodes.has(code))matches.push({category:"TLS_FAILURE",errorCode:"TLS_ERROR"});
    if(systemCodes.has(code))matches.push({category:systemCodes.get(code),errorCode:code});
    if(node.codeName==="AuthenticationFailed")matches.push({category:"AUTHENTICATION_FAILED",errorCode:"MONGO_18"});
    if(node.codeName==="Unauthorized")matches.push({category:"PERMISSION_DENIED",errorCode:"MONGO_13"});
    // Atlas sometimes wraps auth/authorization failures in code 8000. Inspect fixed
    // patterns in memory only; never return message, codeName, stack or arbitrary codes.
    if(code===8000) {
      const text=[node.message,node.errmsg].filter(value=>typeof value==="string").join(" ");
      const patterns=[
        [/authentication failed|bad auth|unable to authenticate|auth failed/i,"AUTHENTICATION_FAILED"],
        [/not authorized|unauthorized|not allowed to (?:do action|execute)|permission denied|not permitted|requires authentication|insufficient privileges/i,"PERMISSION_DENIED"],
        [/CMD_NOT_ALLOWED|command.*not (?:allowed|supported)|not supported.*(?:tier|atlas)|unsupported command|not allowed.*(?:tier|cluster)/i,"COMMAND_UNSUPPORTED"],
        [/already exists.*different case|different case.*already|database.*case.*conflict/i,"DATABASE_CASE_CONFLICT"],
        [/quota|storage limit|space quota|exceeded.*limit|too many.*(?:database|collection)/i,"ATLAS_QUOTA_LIMIT"],
        [/cluster.*(?:paused|suspended|unavailable)|temporarily unavailable|maintenance/i,"SERVER_UNAVAILABLE"],
        [/database name.*(?:too long|length)|db name.*(?:length|long)|(?:max|maximum).*(?:db|database).*name.*(?:length|bytes)/i,"DATABASE_NAME_TOO_LONG"],
        [/invalid.*database|database.*(?:invalid|not found|does not exist)|empty database name/i,"ATLAS_DATABASE_ERROR"]
      ];
      let category=patterns.find(([pattern])=>pattern.test(text))?.[1] || "ATLAS_SERVER_ERROR";
      if(category==="DATABASE_NAME_TOO_LONG" && /\b38\b/.test(text)) category="DATABASE_NAME_EXCEEDS_38_BYTES";
      matches.push({category,errorCode:"MONGO_8000"});
    }
    if(names.has(node.name))matches.push({category:names.get(node.name),errorCode:node.name==="TypeError"?"TYPE_ERROR":node.name==="ReferenceError"?"REFERENCE_ERROR":node.name});
    for(const key of ["cause","reason","error","originalError","errorResponse","result","response"])queue.push(node[key]);
    for(const value of [node.servers,node.errors,node.writeErrors]) {
      if(value instanceof Map)queue.push(...value.values());else if(Array.isArray(value))queue.push(...value);else if(value && typeof value==="object")queue.push(...Object.values(value));
    }
  }
  const priority=["AUTHENTICATION_FAILED","PERMISSION_DENIED","DNS_FAILURE","TLS_FAILURE","DIAGNOSTIC_TYPE_ERROR","DIAGNOSTIC_REFERENCE_ERROR","NAMESPACE_NOT_FOUND","COMMAND_UNSUPPORTED","DATABASE_CASE_CONFLICT","ATLAS_QUOTA_LIMIT","ATLAS_DATABASE_ERROR","DATABASE_NAME_TOO_LONG","DATABASE_NAME_EXCEEDS_38_BYTES","ATLAS_SERVER_ERROR","DRIVER_CONFIGURATION_ERROR","OPERATION_TIMEOUT","NETWORK_FAILURE","SERVER_UNAVAILABLE","CLIENT_STATE_ERROR","SERVER_SELECTION_TIMEOUT"];
  for(const category of priority){const match=matches.find(item=>item.category===category);if(match)return match;}
  return {category:"UNCLASSIFIED_FAILURE",errorCode:"UNKNOWN"};
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
