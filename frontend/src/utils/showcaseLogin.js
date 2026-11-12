export const SHOWCASE_PROFILES=[{profile:"showcase_admin",label:"Admin Demo",access:"presenter"},...Array.from({length:15},(_,index)=>({profile:`showcase_user${String(index+1).padStart(2,"0")}`,label:`Dipendente ${String(index+1).padStart(2,"0")}`,access:"public"}))];
export function quickLoginBody(profile){
 if(!SHOWCASE_PROFILES.some(item=>item.profile===profile&&item.access==="public"))throw Error("L’Admin richiede l’accesso del presentatore.");
 return {profile};
}
export function validateQuickSession(data,profile){return typeof data?.token==="string"&&Boolean(data.token)&&data?.user?.username===profile&&data.user.role==="user";}
