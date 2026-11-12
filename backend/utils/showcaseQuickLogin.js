const {createHmac}=require("crypto");
const {assertRemoteShowcaseConfig,DATABASE,ADMIN}=require("./remoteShowcase");
const EMPLOYEES=Array.from({length:15},(_,index)=>`showcase_user${String(index+1).padStart(2,"0")}`);
const profiles=()=>[{profile:ADMIN,label:"Admin Demo",access:"admin-readonly"},...EMPLOYEES.map((profile,index)=>({profile,label:`Dipendente ${String(index+1).padStart(2,"0")}`,access:"public"}))];
function enabled(env=process.env) {
 if(env.SHOWCASE_QUICK_LOGIN_ENABLED!=="true")return false;
 try{assertRemoteShowcaseConfig(env);return true;}catch{return false;}
}
function adminSigningKey(env=process.env){return createHmac("sha256",env.JWT_SECRET).update(`office-clocking/showcase-admin-readonly/v1:${DATABASE}`).digest();}
function adminEnabled(env=process.env){return enabled(env)&&env.SHOWCASE_ADMIN_QUICK_LOGIN_ENABLED==="true";}
const READ_PATHS=new Set(["/api/auth/me","/api/settings",...["only","users","settings","dashboard","records","leaves","leave-requests","approved-leaves","export","summary","summary-all","manual-closure-requests","daily-attendance"].map(path=>`/api/admin/${path}`)]);
function canConsultAdmin(url){return READ_PATHS.has(String(url||"").split("?")[0].replace(/\/+$/,"").toLowerCase());}
function boundToShowcase(connection){return connection?.db?.databaseName===DATABASE;}
function requestAllowed(req,env=process.env) {
 if(!enabled(env))return false;
 const {client,api}=assertRemoteShowcaseConfig(env);
 return req.secure===true&&req.hostname===new URL(api).hostname&&req.get("Origin")===client;
}
module.exports={adminSigningKey,canConsultAdmin,adminEnabled,EMPLOYEES,profiles,enabled,boundToShowcase,requestAllowed};
