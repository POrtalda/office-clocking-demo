// No dotenv or seed. Read only the service environment; all output uses fixed categories.
const {assertRemoteShowcaseConfig,safeConfigCategory,DATABASE,PURPOSE}=require("../utils/remoteShowcase");
const {safeError}=require("../utils/safeMongoError");
function diagnostic(stage,error) {
  if(stage==="configuration")return {stage,category:safeConfigCategory(error)};
  const fixed=new Set(["INVALID_ARGUMENTS","PORT_INVALID","MARKER_MISSING","MARKER_NOT_READY"]);
  if(fixed.has(error?.bootstrapCategory))return {stage,category:error.bootstrapCategory};
  if(stage==="http-listen")return {stage,category:error?.code==="EADDRINUSE"?"PORT_IN_USE":error?.code==="EACCES"?"PORT_PERMISSION_DENIED":"HTTP_LISTEN_FAILED"};
  if(stage==="app-load")return {stage,category:error?.code==="MODULE_NOT_FOUND"?"DEPENDENCY_MISSING":"APP_IMPORT_FAILED"};
  const mongo=safeError(error);
  const tls={CERT_HAS_EXPIRED:"TLS_CERTIFICATE_EXPIRED",CERT_NOT_YET_VALID:"TLS_CERTIFICATE_NOT_YET_VALID",ERR_TLS_CERT_ALTNAME_INVALID:"TLS_HOSTNAME_MISMATCH",DEPTH_ZERO_SELF_SIGNED_CERT:"TLS_UNTRUSTED_CERTIFICATE",SELF_SIGNED_CERT_IN_CHAIN:"TLS_UNTRUSTED_CERTIFICATE",UNABLE_TO_VERIFY_LEAF_SIGNATURE:"TLS_UNTRUSTED_CERTIFICATE",UNABLE_TO_GET_ISSUER_CERT_LOCALLY:"TLS_UNTRUSTED_CERTIFICATE"};
  return {stage,category:tls[mongo.errorCode] || mongo.category};
}
function blocked(category){const error=new Error("Showcase startup blocked");error.bootstrapCategory=category;return error;}
async function start(args=process.argv.slice(2),loadApp=()=>require("../app")) {
  let stage="arguments",mongoose;
  try {
    if(args.length>1 || (args.length===1&&!["--check","--diagnose"].includes(args[0])))throw blocked("INVALID_ARGUMENTS");
    stage="configuration";assertRemoteShowcaseConfig();
    stage="port";const port=Number(process.env.PORT || 10000);
    if(!Number.isInteger(port)||port<1||port>65535)throw blocked("PORT_INVALID");
    if(args[0]==="--check"){console.log(JSON.stringify({stage:"configuration",category:"CONFIGURATION_VALID"}));return;}
    stage="driver-load";mongoose=require("mongoose");
    mongoose.set("autoIndex",false);mongoose.set("autoCreate",false);
    stage="atlas-connect";
    await mongoose.connect(process.env.MONGO_URI,{dbName:DATABASE,autoIndex:false,autoCreate:false,maxPoolSize:10,serverSelectionTimeoutMS:10000});
    stage="marker-read";
    const guard=await mongoose.connection.db.collection("_showcase_guard").findOne({_id:PURPOSE},{projection:{_id:0,state:1}});
    if(!guard)throw blocked("MARKER_MISSING");
    if(guard.state!=="ready")throw blocked("MARKER_NOT_READY");
    stage="app-load";const app=loadApp();
    if(args[0]==="--diagnose"){
      stage="atlas-disconnect";await mongoose.disconnect();
      console.log(JSON.stringify({stage:"diagnostic-complete",category:"READY_TO_LISTEN"}));return;
    }
    stage="http-listen";
    const server=await new Promise((resolve,reject)=>{
      const listener=app.listen(port,"0.0.0.0");
      listener.once("error",reject);
      listener.once("listening",()=>{listener.removeListener("error",reject);resolve(listener);});
    });
    console.log(JSON.stringify({stage:"http-listen",category:"SHOWCASE_STARTED"}));
    process.once("SIGTERM",()=>server.close(()=>{
      mongoose.disconnect().then(()=>process.exit(0)).catch(()=>{console.error(JSON.stringify({stage:"shutdown",category:"DISCONNECT_FAILED"}));process.exit(1);});
    }));
    return server;
  } catch(error) {
    // Never allow cleanup failure to mask the original stage or leak a driver stack.
    if(mongoose)try{await mongoose.disconnect();}catch{}
    const failure=new Error("Showcase startup blocked");failure.diagnostic=diagnostic(stage,error);throw failure;
  }
}
async function run(args=process.argv.slice(2)) {
  try {await start(args);}catch(error){console.error(JSON.stringify(error.diagnostic || {stage:"bootstrap",category:"BOOTSTRAP_FAILED"}));process.exitCode=1;}
}
if(require.main===module)void run();
module.exports={start,run};
