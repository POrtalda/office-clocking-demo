export function storeSession(storage,token,user){
 if(typeof token!=="string"||!token||!user||typeof user.username!=="string"||!["user","admin"].includes(user.role))throw Error("Sessione non valida");
 storage.setItem("token",token);storage.setItem("authUser",JSON.stringify(user));
}
export function clearSession(storage){storage.removeItem("token");storage.removeItem("authUser");}
export async function restoreSession(baseUrl,storage,request=fetch){
 const token=storage.getItem("token");if(!token)return {user:null,expired:false};
 try{
  const response=await request(`${baseUrl}/api/auth/me`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
  const data=await response.json();if(storage.getItem("token")!==token)return {user:null,expired:false,stale:true};
  if(!response.ok||!data?.user)throw Error("Sessione non valida");
  storeSession(storage,token,data.user);return {user:data.user,expired:false};
 }catch{if(storage.getItem("token")!==token)return {user:null,expired:false,stale:true};clearSession(storage);return {user:null,expired:true};}
}
