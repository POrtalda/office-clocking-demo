// These checks must not even load the MongoDB/Mongoose module.
jest.mock("mongoose",()=>{throw new Error("Offline checker must not load database drivers");});
const path=require("path");
const {checkObjects,run,ATLAS_HOST}=require("../../scripts/showcaseOffline");
const repo=path.resolve("fixture-repository");
const fsApi={realpathSync:p=>p,existsSync:()=>false};
const uri=(user,password,host=ATLAS_HOST)=>`mongodb+srv://${user}:${encodeURIComponent(password)}@${host}/office_clocking_showcase_20261113?retryWrites=true&w=majority`;
function fixtures(){return {
 seed:{APP_ENV:"showcase",SHOWCASE_ATLAS_HOST:ATLAS_HOST,SHOWCASE_SEED_URI:uri("showcase_seed","seed-fixture-only"),SHOWCASE_SEED_CONFIRM:"office-clocking-remote-20261113",SHOWCASE_CREDENTIALS_FILE:path.join(path.dirname(repo),"private-fixture","accounts.json")},
 runtime:{APP_ENV:"showcase",NODE_ENV:"production",DEMO_MODE:"true",DEMO_LOCAL_GPS_BYPASS:"false",GEOLOCATION_CLOCK_IN_ENABLED:"true",SHOWCASE_EMAIL_MODE:"disabled",SHOWCASE_ADMIN_USERNAME:"showcase_admin",CLIENT_URL:"https://office-clocking-demo.netlify.app",SHOWCASE_API_URL:"https://office-clocking-backend-demo.onrender.com",SHOWCASE_ATLAS_HOST:ATLAS_HOST,MONGO_URI:uri("showcase_runtime","runtime-fixture-only"),JWT_SECRET:"0123456789abcdef".repeat(4),OFFICE_LAT:"45",OFFICE_LNG:"7",OFFICE_RADIUS_METERS:"100"}
};}
test("npm showcase default only reports an offline plan without credentials or DB driver",()=>{
 const log=jest.spyOn(console,"log").mockImplementation(()=>{});
 try{run([]);const result=JSON.parse(log.mock.calls[0][0]);expect(result.offline).toBe(true);expect(result.mode).toBe("plan-only");expect(result.credentialsCreated).toBe(false);expect(result.databaseConnection).toBe(false);expect(result.users).toBe(16);}finally{log.mockRestore();}
});
test("complete private profiles validate offline and output contains no secret values",()=>{
 const {seed,runtime}=fixtures();const result=checkObjects(seed,runtime,repo,fsApi);expect(result.valid).toBe(true);
 const output=JSON.stringify(result);for(const secret of [seed.SHOWCASE_SEED_URI,runtime.MONGO_URI,runtime.JWT_SECRET,"seed-fixture-only","runtime-fixture-only"])expect(output).not.toContain(secret);
});
test("blank secrets remain incomplete with variable names only, not fake success",()=>{
 const {seed,runtime}=fixtures();seed.SHOWCASE_SEED_URI="";runtime.MONGO_URI="";runtime.JWT_SECRET="";runtime.OFFICE_LAT="";runtime.OFFICE_LNG="";
 const result=checkObjects(seed,runtime,repo,fsApi);expect(result.valid).toBe(false);expect(result.seed.missing).toEqual(["SHOWCASE_SEED_URI"]);expect(result.runtime.missing).toEqual(["MONGO_URI","JWT_SECRET","OFFICE_LAT","OFFICE_LNG"]);
});
test.each(["wrong-host","wrong-runtime-user","same-password","forbidden-env-key"])("rejects unsafe private setup: %s",kind=>{
 const {seed,runtime}=fixtures();let fsMock=fsApi;
 if(kind==="wrong-host")runtime.MONGO_URI=uri("showcase_runtime","runtime-fixture-only","other.mongodb.net");
 if(kind==="wrong-runtime-user")runtime.MONGO_URI=uri("showcase_seed","runtime-fixture-only");
 if(kind==="same-password")runtime.MONGO_URI=uri("showcase_runtime","seed-fixture-only");
 if(kind==="forbidden-env-key")runtime.NODE_OPTIONS="fixture-not-executed";
 expect(checkObjects(seed,runtime,repo,fsMock).valid).not.toBe(true);
});

test("private profiles support the optional remote GPS flag without requiring it",()=>{
 for(const value of [undefined,"false","true","yes"]){const {seed,runtime}=fixtures();if(value!==undefined)runtime.SHOWCASE_GPS_CHECK_DISABLED=value;expect(checkObjects(seed,runtime,repo,fsApi).valid).toBe(value!=="yes");}
});

test("existing account file is a valid profile requiring recovery, never permission to overwrite",()=>{
 const {seed,runtime}=fixtures();const result=checkObjects(seed,runtime,repo,{...fsApi,existsSync:()=>true});
 expect(result.valid).toBe(true);expect(result.seed.existingCredentials).toBe(true);expect(result.seed.standardSeedAllowed).toBe(false);expect(result.seed.recoveryRequired).toBe(true);
});
