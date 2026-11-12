const path = require("path");
const { DATABASE, PURPOSE, ADMIN, assertAtlasTarget, assertRemoteShowcaseConfig, isRemoteShowcase, strongDemoPassword } = require("../../utils/remoteShowcase");
const { canUseLocalDemoGps } = require("../../utils/localDemoGps");
const { assertCredentialsPath, assertSeedConfig, randomPassword, demoDataset, populateNewDatabase } = require("../../utils/remoteShowcaseSeed");
const { calculateWorkDuration } = require("../../utils/workDuration");
const uri = `mongodb+srv://fixture:fixture@showcase-fixture.mongodb.net/${DATABASE}?retryWrites=true&w=majority`;
const config = () => ({APP_ENV:"showcase",NODE_ENV:"production",DEMO_MODE:"true",DEMO_LOCAL_GPS_BYPASS:"false",GEOLOCATION_CLOCK_IN_ENABLED:"true",SHOWCASE_EMAIL_MODE:"disabled",SHOWCASE_ADMIN_USERNAME:ADMIN,SHOWCASE_API_URL:"https://office-clocking-showcase-api.onrender.com",CLIENT_URL:"https://office-clocking-showcase.netlify.app",SHOWCASE_ATLAS_HOST:"showcase-fixture.mongodb.net",MONGO_URI:uri,JWT_SECRET:"0123456789abcdef".repeat(4),OFFICE_LAT:"45",OFFICE_LNG:"7",OFFICE_RADIUS_METERS:"100"});
test("remote config is explicit and independent of local GPS exception",()=>{
  expect(assertRemoteShowcaseConfig(config()).database).toBe(DATABASE);
  expect(isRemoteShowcase({NODE_ENV:"production",DEMO_MODE:"true"})).toBe(false);
  expect(canUseLocalDemoGps({socket:{remoteAddress:"127.0.0.1"},headers:{host:"localhost"}},config())).toBe(false);
});
test.each([{APP_ENV:"production"},{NODE_ENV:"development"},{DEMO_MODE:"false"},{DEMO_LOCAL_GPS_BYPASS:"true"},{GEOLOCATION_CLOCK_IN_ENABLED:"false"},{SHOWCASE_EMAIL_MODE:"smtp"},{SMTP_PASS:"fixture"},{SHOWCASE_ADMIN_USERNAME:"admin"},{CLIENT_URL:"http://localhost:5175"},{CLIENT_URL:"https://one.netlify.app,https://two.netlify.app"},{SHOWCASE_API_URL:"https://user:pass@api.example.com"},{SHOWCASE_API_URL:"https://api.example.com/path"},{JWT_SECRET:"simple-local-key"},{OFFICE_RADIUS_METERS:"20000000"},{OFFICE_LAT:""}])("remote startup fails closed for unsafe config %j", patch=>{
  expect(()=>assertRemoteShowcaseConfig({...config(),...patch})).toThrow();
});
test.each(["mongodb://127.0.0.1:27017/office_clocking_showcase_v2", uri.replace(DATABASE,"office_clocking"),uri.replace("showcase-fixture.mongodb.net","other.mongodb.net"),uri+"&tls=false",uri+"&authSource=other",uri.replace("fixture:fixture@","")])("seed/runtime refuse wrong cluster, existing DB names and unsafe URI options",value=>expect(()=>assertAtlasTarget(value,"showcase-fixture.mongodb.net")).toThrow());
test("seed needs independent env and explicit new-DB confirmation",()=>{
 const env={APP_ENV:"showcase",SHOWCASE_SEED_CONFIRM:PURPOSE,SHOWCASE_SEED_URI:uri,SHOWCASE_ATLAS_HOST:"showcase-fixture.mongodb.net"};
 expect(assertSeedConfig(env)).toBe(DATABASE);
 for(const patch of [{SHOWCASE_SEED_CONFIRM:""},{MONGO_URI:uri},{SHOWCASE_SEED_URI:""},{APP_ENV:"development"},{DEMO_LOCAL_GPS_BYPASS:"true"}]) expect(()=>assertSeedConfig({...env,...patch})).toThrow();
});
test("credential output cannot resolve inside repo, including a directory starting with two dots",()=>{
 const repo=path.resolve("fixture-repo"), fsApi={realpathSync:p=>p};
 expect(()=>assertCredentialsPath(path.join(repo,"keys.json"),repo,fsApi)).toThrow();
 expect(()=>assertCredentialsPath(path.join(repo,"..private","keys.json"),repo,fsApi)).toThrow();
 expect(()=>assertCredentialsPath(path.join(path.dirname(repo),"private","keys.json"),repo,fsApi)).not.toThrow();
 const junction={realpathSync:p=>p===repo?repo:repo};
 expect(()=>assertCredentialsPath(path.join(path.dirname(repo),"private","keys.json"),repo,junction)).toThrow();
});
test("generated passwords are strong, unique; dataset is synthetic, GPS-null and net hours consistent",()=>{
 const passwords=Array.from({length:16},randomPassword);expect(new Set(passwords).size).toBe(16);passwords.forEach(p=>expect(strongDemoPassword(p)).toBe(true));expect(strongDemoPassword("1234")).toBe(false);
 const data=demoDataset();expect(data.users).toHaveLength(16);expect(data.users.filter(u=>u.role==="admin").map(u=>u.username)).toEqual([ADMIN]);
 data.users.forEach(u=>{expect(u.email).toMatch(/@example\.invalid$/);expect(u.password).toBeUndefined();expect(u.geolocationEnabled).toBe(true);});
 data.records.filter(r=>r.clockOut).forEach(r=>{expect(r.durationSec).toBe(calculateWorkDuration(r).durationSec);expect(r.clockInLocation).toBeUndefined();});
});
test("seed rejects any existing collection before creating or inserting anything",async()=>{
 const db={listCollections:()=>({toArray:async()=>[{name:"users"}]}),createCollection:jest.fn(),collection:jest.fn()};
 await expect(populateNewDatabase(db,demoDataset(),{},jest.fn())).rejects.toThrow("non nuovo");expect(db.createCollection).not.toHaveBeenCalled();expect(db.collection).not.toHaveBeenCalled();
});
test("concurrent creation aborts before any user data is written",async()=>{
 let calls=0;const db={listCollections:()=>({toArray:async()=>calls++? [{name:"_showcase_guard"},{name:"users"}]:[]}),createCollection:jest.fn(),collection:jest.fn()};
 await expect(populateNewDatabase(db,demoDataset(),{},jest.fn())).rejects.toThrow("concorrente");expect(db.collection).not.toHaveBeenCalled();
});

test("new database population stores hashes, null recipients, audited marker and consistent records only",async()=>{
 const data=demoDataset(), stored={}, operations=[];let listed=0;
 const db={listCollections:()=>({toArray:async()=>listed++?[{name:"_showcase_guard"}]:[]}),createCollection:jest.fn(async name=>operations.push(name)),collection:name=>({
 createIndex:jest.fn(),insertOne:async doc=>{(stored[name]??=[]).push(doc);},insertMany:async docs=>{stored[name]=docs;},updateOne:async(_filter,update)=>{stored[name][0]={...stored[name][0],...update.$set};}
 })};
 const passwords=Object.fromEntries(data.users.map(u=>[u.username,randomPassword()]));const hash=jest.fn(async()=>"fixture-bcrypt-hash");
 const result=await populateNewDatabase(db,data,passwords,hash);expect(result.users).toBe(16);expect(hash).toHaveBeenCalledTimes(16);expect(hash.mock.calls.every(([,cost])=>cost===12)).toBe(true);
 expect(stored.appsettings[0].leaveNotificationEmails).toEqual([]);expect(stored._showcase_guard[0].state).toBe("ready");expect(operations).toEqual(["_showcase_guard"]);
 for(const value of Object.values(passwords))expect(JSON.stringify(stored)).not.toContain(value);
 const User=require("../../models/User"), TimeRecord=require("../../models/TimeRecord");
 for(const user of stored.users)await expect(new User(user).validate()).resolves.toBeUndefined();
 for(const record of stored.timerecords)await expect(new TimeRecord(record).validate()).resolves.toBeUndefined();
});

test("existing public demo origins can be reused without relaxing remote Showcase security",()=>{
 const env={...config(),CLIENT_URL:"https://office-clocking-demo.netlify.app",SHOWCASE_API_URL:"https://office-clocking-backend-demo.onrender.com"};
 expect(assertRemoteShowcaseConfig(env)).toEqual({client:env.CLIENT_URL,api:env.SHOWCASE_API_URL,database:DATABASE});
 expect(canUseLocalDemoGps({socket:{remoteAddress:"127.0.0.1"},headers:{host:"localhost"}},env)).toBe(false);
 for(const patch of [{DEMO_LOCAL_GPS_BYPASS:"true"},{SHOWCASE_EMAIL_MODE:"smtp"},{MONGO_URI:"mongodb://127.0.0.1:27017/office_clocking_showcase_v2"}])expect(()=>assertRemoteShowcaseConfig({...env,...patch})).toThrow();
});


test("remote GPS omission is explicit, HTTPS-bound and fails closed outside the complete Showcase profile",()=>{
 const {canUseRemoteShowcaseGps}=require("../../utils/remoteShowcase");
 const env={...config(),SHOWCASE_GPS_CHECK_DISABLED:"true"};
 const req={secure:true,hostname:new URL(env.SHOWCASE_API_URL).hostname,headers:{origin:env.CLIENT_URL}};
 expect(canUseRemoteShowcaseGps(req,env)).toBe(true);
 for(const patch of [{SHOWCASE_GPS_CHECK_DISABLED:undefined},{SHOWCASE_GPS_CHECK_DISABLED:"false"},{SHOWCASE_GPS_CHECK_DISABLED:"TRUE"},{APP_ENV:"production"},{NODE_ENV:"development"},{DEMO_MODE:"false"},{DEMO_LOCAL_GPS_BYPASS:"true"},{GEOLOCATION_CLOCK_IN_ENABLED:"false"},{SHOWCASE_EMAIL_MODE:"smtp"},{MONGO_URI:"mongodb://localhost/office_clocking"}])expect(canUseRemoteShowcaseGps(req,{...env,...patch})).toBe(false);
 for(const bad of [{...req,secure:false},{...req,hostname:"other.onrender.com"},{...req,headers:{}},{...req,headers:{origin:"https://foreign.netlify.app"}}])expect(canUseRemoteShowcaseGps(bad,env)).toBe(false);
 expect(()=>assertRemoteShowcaseConfig({...env,SHOWCASE_GPS_CHECK_DISABLED:"yes"})).toThrow();
 expect(()=>assertRemoteShowcaseConfig({...env,SHOWCASE_GPS_CHECK_DISABLED:"false"})).not.toThrow();
});

test("only the corrected Atlas database name is allowed; the historical 39-byte name stays forbidden",()=>{
 expect(Buffer.byteLength(DATABASE,"utf8")).toBeLessThanOrEqual(38);
 expect(()=>assertAtlasTarget(uri.replace(DATABASE,"office_clocking_showcase_remote_20261113"),"showcase-fixture.mongodb.net")).toThrow();
});

test("target assertion precedes any database mutation and refuses a changed target",async()=>{
 const createCollection=jest.fn();const db={listCollections:()=>({toArray:async()=>[]}),createCollection};
 const assertTarget=jest.fn(async()=>{throw Error("Wrong target");});
 await expect(populateNewDatabase(db,demoDataset(),{},jest.fn(),assertTarget)).rejects.toThrow("Wrong target");expect(createCollection).not.toHaveBeenCalled();expect(assertTarget).toHaveBeenCalledTimes(1);
});

test("public Showcase login flag is optional and only explicit boolean strings are accepted",()=>{
 for(const value of [undefined,"false","true"]){const env=config();if(value!==undefined)env.SHOWCASE_QUICK_LOGIN_ENABLED=value;expect(()=>assertRemoteShowcaseConfig(env)).not.toThrow();}
 expect(()=>assertRemoteShowcaseConfig({...config(),SHOWCASE_QUICK_LOGIN_ENABLED:"TRUE"})).toThrow();
});
