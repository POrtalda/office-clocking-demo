import test from "node:test";
import assert from "node:assert/strict";
import {SHOWCASE_PROFILES,quickLoginBody,validateQuickSession} from "../src/utils/showcaseLogin.js";
import {storeSession,clearSession,restoreSession} from "../src/utils/authSession.js";
function storage(){const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}
test("16 fixed labels with separate presenter Admin and no frontend secrets",()=>{
 assert.equal(SHOWCASE_PROFILES.length,16);assert.equal(SHOWCASE_PROFILES[0].label,"Admin Demo");assert.equal(SHOWCASE_PROFILES[0].access,"presenter");assert.equal(SHOWCASE_PROFILES.at(-1).label,"Dipendente 15");assert.doesNotMatch(JSON.stringify(SHOWCASE_PROFILES),/password|token|secret/i);
 for(const item of SHOWCASE_PROFILES.slice(1))assert.deepEqual(quickLoginBody(item.profile),{profile:item.profile});assert.throws(()=>quickLoginBody("showcase_admin"));assert.throws(()=>quickLoginBody("other"));
});
test("public quick login cannot accept an Admin or wrong-profile response",()=>{
 assert.equal(validateQuickSession({token:"temporary-fixture",user:{username:"showcase_user01",role:"user"}},"showcase_user01"),true);
 for(const user of [{username:"showcase_user01",role:"admin"},{username:"showcase_user02",role:"user"}])assert.equal(validateQuickSession({token:"temporary-fixture",user},"showcase_user01"),false);
});
test("refresh validates saved temporary JWT with me; logout removes it; profile switching replaces session",async()=>{
 const saved=storage(),user={username:"showcase_user01",role:"user"};storeSession(saved,"temporary-one",user);let calls=0;
 const request=async(url,options)=>{calls++;assert.equal(url,"https://api.example.com/api/auth/me");assert.equal(options.headers.Authorization,"Bearer temporary-one");return {ok:true,json:async()=>({user})};};
 assert.deepEqual(await restoreSession("https://api.example.com",saved,request),{user,expired:false});assert.equal(calls,1);
 clearSession(saved);assert.equal(saved.getItem("token"),null);assert.equal(saved.getItem("authUser"),null);assert.deepEqual(await restoreSession("https://api.example.com",saved,request),{user:null,expired:false});assert.equal(calls,1);
 storeSession(saved,"temporary-two",{username:"showcase_user02",role:"user"});assert.equal(saved.getItem("token"),"temporary-two");assert.match(saved.getItem("authUser"),/showcase_user02/);
});
test("expired/revoked/unavailable sessions are cleared after refresh",async()=>{
 for(const mode of ["expired","network","malformed"]){const saved=storage();storeSession(saved,"temporary-fixture",{username:"showcase_user01",role:"user"});const result=await restoreSession("https://api.example.com",saved,async()=>{if(mode==="network")throw Error();return {ok:mode==="malformed",json:async()=>({})};});assert.deepEqual(result,{user:null,expired:true});assert.equal(saved.getItem("token"),null);}
});

test("in-flight refresh cannot resurrect a logged-out session or overwrite a new profile",async()=>{
 for(const action of ["logout","switch"]){const saved=storage(),user={username:"showcase_user01",role:"user"};storeSession(saved,"old-session",user);let finish;const pending=restoreSession("https://api.example.com",saved,()=>new Promise(resolve=>{finish=resolve;}));
  if(action==="logout")clearSession(saved);else storeSession(saved,"new-session",{username:"showcase_user02",role:"user"});
  finish({ok:true,json:async()=>({user})});assert.deepEqual(await pending,{user:null,expired:false,stale:true});assert.equal(saved.getItem("token"),action==="logout"?null:"new-session");
 }
});
