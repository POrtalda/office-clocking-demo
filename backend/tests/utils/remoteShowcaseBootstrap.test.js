const {EventEmitter}=require("events");
jest.mock("mongoose",()=>({set:jest.fn(),connect:jest.fn(),disconnect:jest.fn(),connection:{db:{collection:jest.fn()}}}));
jest.mock("../../app",()=>({listen:jest.fn()}));
const mongoose=require("mongoose"),app=require("../../app");
const {start,run}=require("../../scripts/startRemoteShowcase");
const {DATABASE,ADMIN,PURPOSE}=require("../../utils/remoteShowcase");
const previous={...process.env};let log,errorLog;
function fixture(){return {APP_ENV:"showcase",NODE_ENV:"production",DEMO_MODE:"true",DEMO_LOCAL_GPS_BYPASS:"false",GEOLOCATION_CLOCK_IN_ENABLED:"true",SHOWCASE_EMAIL_MODE:"disabled",SHOWCASE_ADMIN_USERNAME:ADMIN,SHOWCASE_API_URL:"https://office-clocking-showcase-api.onrender.com",CLIENT_URL:"https://office-clocking-showcase.netlify.app",SHOWCASE_ATLAS_HOST:"showcase-fixture.mongodb.net",MONGO_URI:`mongodb+srv://fixture:fixture@showcase-fixture.mongodb.net/${DATABASE}`,JWT_SECRET:"0123456789abcdef".repeat(4),OFFICE_LAT:"45",OFFICE_LNG:"7",OFFICE_RADIUS_METERS:"100"};}
beforeEach(()=>{
 jest.resetAllMocks();Object.assign(process.env,fixture());delete process.env.PORT;delete process.env.SHOWCASE_GPS_CHECK_DISABLED;
 for(const key of Object.keys(process.env))if(key.startsWith("SMTP_"))delete process.env[key];
 mongoose.connect.mockResolvedValue(mongoose);mongoose.disconnect.mockResolvedValue();mongoose.connection.db.collection.mockReturnValue({findOne:jest.fn().mockResolvedValue({state:"ready"})});
 log=jest.spyOn(console,"log").mockImplementation(()=>{});errorLog=jest.spyOn(console,"error").mockImplementation(()=>{});
});
afterEach(()=>{jest.restoreAllMocks();});
afterAll(()=>{for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);});
async function failure(args,expected,loadApp){
 try{await start(args,loadApp);throw Error("Expected startup rejection");}catch(error){expect(error.diagnostic).toEqual(expected);expect(Object.keys(error.diagnostic).sort()).toEqual(["category","stage"]);expect(error.message).toBe("Showcase startup blocked");expect(error.cause).toBeUndefined();return error;}
}
test.each(["APP_ENV","NODE_ENV","MONGO_URI","JWT_SECRET","OFFICE_LAT","OFFICE_LNG","OFFICE_RADIUS_METERS"])("missing required variable is safe and stops before connection: %s",async key=>{
 delete process.env[key];await failure([],{stage:"configuration",category:`MISSING_${key}`});expect(mongoose.connect).not.toHaveBeenCalled();expect(app.listen).not.toHaveBeenCalled();
});
test.each([
 [{MONGO_URI:"mongodb://127.0.0.1/office_clocking_showcase_v2"},"ATLAS_TARGET_INVALID"],
 [{SMTP_PASS:"SECRET"},"SMTP_NOT_ALLOWED"],
 [{JWT_SECRET:"SECRET"},"JWT_SECRET_INVALID"],
 [{CLIENT_URL:"https://SECRET@invalid.example.com"},"ORIGINS_INVALID"],
 [{DEMO_LOCAL_GPS_BYPASS:"true"},"INVALID_DEMO_LOCAL_GPS_BYPASS"],
 [{SHOWCASE_GPS_CHECK_DISABLED:"yes"},"GPS_FLAG_INVALID"],
 [{OFFICE_RADIUS_METERS:"200000"},"OFFICE_LOCATION_INVALID"]
])("unsafe config is still rejected without revealing values: %j",async(patch,category)=>{
 Object.assign(process.env,patch);await failure([],{stage:"configuration",category});expect(mongoose.connect).not.toHaveBeenCalled();
});
test.each(["0","65536","NaN"])("invalid port is checked even in offline --check: %s",async port=>{
 process.env.PORT=port;await failure(["--check"],{stage:"port",category:"PORT_INVALID"});expect(mongoose.connect).not.toHaveBeenCalled();
});
test("--check emits only stage/category without loading app or opening MongoDB",async()=>{
 const loader=jest.fn();await start(["--check"],loader);expect(loader).not.toHaveBeenCalled();expect(mongoose.connect).not.toHaveBeenCalled();expect(app.listen).not.toHaveBeenCalled();expect(JSON.parse(log.mock.calls[0][0])).toEqual({stage:"configuration",category:"CONFIGURATION_VALID"});
});
test.each([[{code:18,message:"SECRET"},"AUTHENTICATION_FAILED"],[{name:"MongooseServerSelectionError",reason:{servers:new Map([["SECRET",{error:{code:"ENOTFOUND"}}]])}},"DNS_FAILURE"],[{cause:{code:"CERT_HAS_EXPIRED"}},"TLS_CERTIFICATE_EXPIRED"],[{name:"MongoOperationTimeoutError"},"OPERATION_TIMEOUT"]])("Atlas connection cause is classified: %j",async(error,category)=>{
 mongoose.connect.mockRejectedValue(error);mongoose.disconnect.mockRejectedValue(Error("SECRET cleanup"));await failure([],{stage:"atlas-connect",category});expect(app.listen).not.toHaveBeenCalled();
});
test.each([[null,"MARKER_MISSING"],[{state:"initializing"},"MARKER_NOT_READY"]])("marker not ready refuses listen: %j",async(marker,category)=>{
 mongoose.connection.db.collection.mockReturnValue({findOne:jest.fn().mockResolvedValue(marker)});await failure([],{stage:"marker-read",category});expect(app.listen).not.toHaveBeenCalled();expect(mongoose.disconnect).toHaveBeenCalledTimes(1);
});
test("marker read permission error is distinct from missing marker",async()=>{
 mongoose.connection.db.collection.mockReturnValue({findOne:jest.fn().mockRejectedValue({errorResponse:{code:13,errmsg:"SECRET"}})});await failure([],{stage:"marker-read",category:"PERMISSION_DENIED"});expect(app.listen).not.toHaveBeenCalled();
});
test("--diagnose is read-only and checks exact ready marker, app import and disconnects without listen",async()=>{
 await start(["--diagnose"]);
 expect(mongoose.connect).toHaveBeenCalledWith(process.env.MONGO_URI,expect.objectContaining({dbName:DATABASE,autoIndex:false,autoCreate:false}));
 expect(mongoose.set).toHaveBeenCalledWith("autoIndex",false);expect(mongoose.set).toHaveBeenCalledWith("autoCreate",false);
 expect(mongoose.connection.db.collection).toHaveBeenCalledWith("_showcase_guard");expect(mongoose.connection.db.collection().findOne).toHaveBeenCalledWith({_id:PURPOSE},{projection:{_id:0,state:1}});
 expect(app.listen).not.toHaveBeenCalled();expect(mongoose.disconnect).toHaveBeenCalledTimes(1);expect(JSON.parse(log.mock.calls[0][0])).toEqual({stage:"diagnostic-complete",category:"READY_TO_LISTEN"});
});
test("app dependency import failure is safe and never opens HTTP",async()=>{
 await failure(["--diagnose"],{stage:"app-load",category:"DEPENDENCY_MISSING"},()=>{const error=Error("SECRET module/path");error.code="MODULE_NOT_FOUND";throw error;});expect(app.listen).not.toHaveBeenCalled();
});
test("HTTP bind uses 0.0.0.0 and catches async port errors without unhandled stacks",async()=>{
 app.listen.mockImplementation(()=>{const server=new EventEmitter();process.nextTick(()=>server.emit("error",{code:"EADDRINUSE",message:"SECRET"}));return server;});await failure([],{stage:"http-listen",category:"PORT_IN_USE"});expect(app.listen).toHaveBeenCalledWith(10000,"0.0.0.0");
});
test("successful listen uses Render PORT and emits only fixed startup result",async()=>{
 process.env.PORT="10017";const server=new EventEmitter();server.close=jest.fn();
 app.listen.mockImplementation(()=>{process.nextTick(()=>server.emit("listening"));return server;});
 await expect(start([])).resolves.toBe(server);expect(app.listen).toHaveBeenCalledWith(10017,"0.0.0.0");expect(JSON.parse(log.mock.calls[0][0])).toEqual({stage:"http-listen",category:"SHOWCASE_STARTED"});
 process.removeListener("SIGTERM",process.listeners("SIGTERM").at(-1));
});
test("CLI failure logs exactly two safe fields and exits unsuccessfully",async()=>{
 const oldExit=process.exitCode;try{process.env.JWT_SECRET="SECRET";await run(["--check"]);const value=JSON.parse(errorLog.mock.calls[0][0]);expect(value).toEqual({stage:"configuration",category:"JWT_SECRET_INVALID"});expect(process.exitCode).toBe(1);expect(JSON.stringify(errorLog.mock.calls)).not.toContain("SECRET\"");}finally{process.exitCode=oldExit;}
});
