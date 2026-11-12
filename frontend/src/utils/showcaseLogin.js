export const SHOWCASE_PROFILES=[{profile:"showcase_admin",label:"Admin Demo",access:"admin-readonly"},...Array.from({length:15},(_,index)=>({profile:`showcase_user${String(index+1).padStart(2,"0")}`,label:`Dipendente ${String(index+1).padStart(2,"0")}`,access:"public"}))];
export function quickLoginBody(profile){
 if(!SHOWCASE_PROFILES.some(item=>item.profile===profile&&["public","admin-readonly"].includes(item.access)))throw Error("Profilo dimostrativo non valido.");
 return {profile};
}
export function validateQuickSession(data,profile){return typeof data?.token==="string"&&Boolean(data.token)&&data?.user?.username===profile&&(profile==="showcase_admin"?data.user.role==="admin"&&data.user.readOnly===true:data.user.role==="user");}
