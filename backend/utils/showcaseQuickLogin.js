const {assertRemoteShowcaseConfig,DATABASE,ADMIN}=require("./remoteShowcase");
const EMPLOYEES=Array.from({length:15},(_,index)=>`showcase_user${String(index+1).padStart(2,"0")}`);
const profiles=()=>[{profile:ADMIN,label:"Admin Demo",access:"presenter"},...EMPLOYEES.map((profile,index)=>({profile,label:`Dipendente ${String(index+1).padStart(2,"0")}`,access:"public"}))];
function enabled(env=process.env) {
 if(env.SHOWCASE_QUICK_LOGIN_ENABLED!=="true")return false;
 try{assertRemoteShowcaseConfig(env);return true;}catch{return false;}
}
function boundToShowcase(connection){return connection?.db?.databaseName===DATABASE;}
function requestAllowed(req,env=process.env) {
 if(!enabled(env))return false;
 const {client,api}=assertRemoteShowcaseConfig(env);
 return req.secure===true&&req.hostname===new URL(api).hostname&&req.get("Origin")===client;
}
module.exports={EMPLOYEES,profiles,enabled,boundToShowcase,requestAllowed};
