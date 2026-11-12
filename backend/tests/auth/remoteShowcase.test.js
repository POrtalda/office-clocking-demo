const request = require("supertest");
jest.mock("../../models/User",()=>({findOne:jest.fn(),findById:jest.fn()}));
jest.mock("../../models/TimeRecord",()=>({findOne:jest.fn(),create:jest.fn()}));
jest.mock("../../models/LeaveRequest",()=>({findOne:jest.fn()}));
jest.mock("../../services/timeRecordLock",()=>({withTimeRecordLock:jest.fn(async(_id,operation)=>operation("fixture",async()=>{}))}));
jest.mock("../../utils/timeRecordNotifications",()=>({scheduleTimeRecordEmail:jest.fn()}));
const User=require("../../models/User"), TimeRecord=require("../../models/TimeRecord"), LeaveRequest=require("../../models/LeaveRequest");
const jwt=require("jsonwebtoken"), bcrypt=require("bcryptjs");
const {DATABASE,ADMIN,jwtOptions,ISSUER}=require("../../utils/remoteShowcase");
const previous={...process.env};let app,current,hash;
const client="https://office-clocking-showcase.netlify.app", host="office-clocking-showcase-api.onrender.com", password="Fixture-only-Strong-Password-9264";
const token=(patch={})=>jwt.sign({id:current._id,username:current.username,role:current.role,...patch},process.env.JWT_SECRET,jwtOptions());
const api=(method,url)=>request(app)[method](url).set("Host",host).set("X-Forwarded-Proto","https").set("Origin",client);
beforeAll(async()=>{
 Object.assign(process.env,{APP_ENV:"showcase",NODE_ENV:"production",DEMO_MODE:"true",DEMO_LOCAL_GPS_BYPASS:"false",GEOLOCATION_CLOCK_IN_ENABLED:"true",SHOWCASE_EMAIL_MODE:"disabled",SHOWCASE_ADMIN_USERNAME:ADMIN,SHOWCASE_API_URL:`https://${host}`,CLIENT_URL:client,SHOWCASE_ATLAS_HOST:"showcase-fixture.mongodb.net",MONGO_URI:`mongodb+srv://fixture:fixture@showcase-fixture.mongodb.net/${DATABASE}`,JWT_SECRET:"0123456789abcdef".repeat(4),OFFICE_LAT:"45",OFFICE_LNG:"7",OFFICE_RADIUS_METERS:"100"});
 for(const key of Object.keys(process.env))if(key.startsWith("SMTP_"))delete process.env[key];
 app=require("../../app");hash=await bcrypt.hash(password,4);
});
afterAll(()=>{for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);});
beforeEach(()=>{
 delete process.env.SHOWCASE_GPS_CHECK_DISABLED;
 jest.clearAllMocks();current={_id:"507f1f77bcf86cd799439011",username:"showcase_user01",role:"user",isActive:true,password:hash,geolocationEnabled:false};
 User.findOne.mockImplementation(async()=>current);User.findById.mockImplementation(()=>({select:()=>({lean:async()=>current})}));
 TimeRecord.findOne.mockReturnValue({sort:async()=>null});TimeRecord.create.mockImplementation(async data=>data);LeaveRequest.findOne.mockResolvedValue(null);
});
test("HTTPS proxy and exact origin are required; CORS preflight is narrow and no-store",async()=>{
 expect((await request(app).get("/").set("Host",host)).status).toBe(400);
 expect((await api("get","/").set("Origin","https://foreign.netlify.app")).status).toBe(403);
 const preflight=await api("options","/api/auth/login").set("Access-Control-Request-Method","POST").set("Access-Control-Request-Headers","authorization,content-type");
 expect(preflight.status).toBe(204);expect(preflight.headers["access-control-allow-origin"]).toBe(client);expect(preflight.headers["access-control-allow-credentials"]).toBeUndefined();expect(preflight.headers["cache-control"]).toBe("no-store");
 expect((await request(app).post("/api/auth/login").set("Host",host).set("X-Forwarded-Proto","https").send({})).status).toBe(403);
});
test("remote login uses real bcrypt, scoped 1h JWT and never serves autofill account list",async()=>{
 const res=await api("post","/api/auth/login").send({username:current.username,password});expect(res.status).toBe(200);
 const decoded=jwt.verify(res.body.token,process.env.JWT_SECRET,{algorithms:["HS256"],issuer:ISSUER,audience:client});expect(decoded.exp-decoded.iat).toBe(3600);
 expect((await api("get","/api/auth/me").set("Authorization",`Bearer ${res.body.token}`)).status).toBe(200);
 expect((await api("get","/api/demo/login-users")).status).toBe(404);
 expect((await api("post","/api/auth/login").send({username:current.username,password:"1234"})).status).toBe(401);
});
test("local/unscoped, wrong audience, expired and tampered JWTs fail",async()=>{
 const payload={id:current._id,username:current.username,role:current.role};
 const bad=[jwt.sign(payload,process.env.JWT_SECRET),jwt.sign(payload,process.env.JWT_SECRET,{...jwtOptions(),audience:"another-app"}),jwt.sign(payload,process.env.JWT_SECRET,{...jwtOptions(),expiresIn:-1}),jwt.sign(payload,"another-test-only-secret",jwtOptions())];
 for(const value of bad)expect((await api("get","/api/auth/me").set("Authorization",`Bearer ${value}`)).status).toBe(401);
});
test("session revocation and presenter-only Admin role are enforced on every API request",async()=>{
 const value=token();current.isActive=false;expect((await api("get","/api/auth/me").set("Authorization",`Bearer ${value}`)).status).toBe(401);
 current.isActive=true;current.role="admin";expect((await api("get","/api/auth/me").set("Authorization",`Bearer ${token()}`)).status).toBe(401);
 current.username=ADMIN;expect((await api("get","/api/admin/only").set("Authorization",`Bearer ${token()}`)).status).toBe(200);
});
test("remote Admin cannot change accounts, GPS policy or notification settings",async()=>{
 for(const [method,url] of [["post","/api/admin/users"],["post","/API/ADMIN/USERS"],["patch","/api/admin/users/id/geolocation"],["patch","/api/admin/settings"],["delete","/api/admin/users/id"]])expect((await api(method,url).send({})).status).toBe(403);
});
test("remote office clocking requires GPS despite per-user exemption; explicit offsite needs reason and invents no coordinates",async()=>{
 const auth=`Bearer ${token()}`;
 expect((await api("get","/api/records/gps-policy").set("Authorization",auth)).body.canSkipGps).toBe(false);
 expect((await api("post","/api/records/clock-in").set("Authorization",auth).send({demoWithoutGps:true})).status).toBe(403);
 expect((await api("post","/api/records/clock-in").set("Authorization",auth).send({})).status).toBe(400);
 expect((await api("post","/api/records/clock-in").set("Authorization",auth).send({workLocation:"offsite"})).status).toBe(400);
 const res=await api("post","/api/records/clock-in").set("Authorization",auth).send({workLocation:"offsite",offsiteReason:"Presentazione esterna dimostrativa"});expect(res.status).toBe(201);
 expect(res.body.record.clockInOffsiteReason).toBe("Presentazione esterna dimostrativa");expect(res.body.record.clockInOffsiteLocation).toBeNull();expect(res.body.record.clockInLocation).toBeNull();
});
test("remote offsite pauses require reason and store null GPS for start/end",async()=>{
 const record={user:current._id,clockIn:new Date(),clockOut:null,status:"open",breaks:[],save:jest.fn()};
 TimeRecord.findOne.mockReturnValue({sort:async()=>record});const auth=`Bearer ${token()}`;
 expect((await api("post","/api/records/break-start").set("Authorization",auth).send({workLocation:"offsite"})).status).toBe(400);
 const body={workLocation:"offsite",offsiteReason:"Pausa durante dimostrazione fuori sede"};
 expect((await api("post","/api/records/break-start").set("Authorization",auth).send(body)).status).toBe(200);
 expect((await api("post","/api/records/break-end").set("Authorization",auth).send(body)).status).toBe(200);
 expect(record.breaks[0]).toMatchObject({startMode:"offsite",endMode:"offsite",startOffsiteReason:body.offsiteReason,endOffsiteReason:body.offsiteReason,startOffsiteLocation:null,endOffsiteLocation:null});
});
test("authorized remote omission covers clock-in, breaks and clock-out without coordinates",async()=>{
 process.env.SHOWCASE_GPS_CHECK_DISABLED="true";
 const auth=`Bearer ${token()}`, body={showcaseWithoutGps:true};
 expect((await api("get","/api/records/gps-policy").set("Authorization",auth)).body).toEqual({canSkipGps:false,canSkipShowcaseGps:true});
 expect((await api("post","/api/records/clock-in").set("Authorization",auth).send({demoWithoutGps:true})).status).toBe(403);
 expect((await api("post","/api/records/clock-in").set("Authorization",auth).send({})).status).toBe(400);
 const entered=await api("post","/api/records/clock-in").set("Authorization",auth).send(body);
 expect(entered.status).toBe(201);expect(entered.body.record.clockInLocation).toBeNull();expect(entered.body.record.clockInOffsiteReason).toBeUndefined();
 const record={...entered.body.record,clockIn:new Date(Date.now()-60000),clockOut:null,status:"open",breaks:[],save:jest.fn()};
 TimeRecord.findOne.mockReturnValue({sort:async()=>record});
 expect((await api("post","/api/records/break-start").set("Authorization",auth).send(body)).status).toBe(200);
 record.breaks[0].startAt=new Date(Date.now()-1000);
 expect((await api("post","/api/records/break-end").set("Authorization",auth).send(body)).status).toBe(200);
 expect(record.breaks[0]).toMatchObject({startMode:"office",endMode:"office",startLocation:null,endLocation:null});
 const out=await api("post","/api/records/clock-out").set("Authorization",auth).send(body);
 expect(out.status).toBe(200);expect(out.body.record.clockOutLocation).toBeNull();expect(record.durationSec).toBeGreaterThan(0);
});
test("remote omission cannot be forged or mixed with offsite or coordinates; offsite still requires reason",async()=>{
 const auth=`Bearer ${token()}`;
 expect((await api("post","/api/records/clock-in").set("Authorization",auth).send({showcaseWithoutGps:true})).status).toBe(403);
 process.env.SHOWCASE_GPS_CHECK_DISABLED="true";
 for(const body of [{showcaseWithoutGps:true,demoWithoutGps:true},{showcaseWithoutGps:true,location:{latitude:45,longitude:7}},{workLocation:"offsite",showcaseWithoutGps:true},{workLocation:"offsite"}])expect((await api("post","/api/records/clock-in").set("Authorization",auth).send(body)).status).toBe(400);
 const res=await api("post","/api/records/clock-in").set("Authorization",auth).send({workLocation:"offsite",offsiteReason:"Visita dimostrativa"});
 expect(res.status).toBe(201);expect(res.body.record.clockInOffsiteReason).toBe("Visita dimostrativa");expect(res.body.record.clockInOffsiteLocation).toBeNull();
 process.env.SHOWCASE_GPS_CHECK_DISABLED="false";
 expect((await api("get","/api/records/gps-policy").set("Authorization",auth)).body.canSkipShowcaseGps).toBe(false);
 expect((await api("post","/api/records/clock-in").set("Authorization",auth).send({showcaseWithoutGps:true})).status).toBe(403);
});

test("Render HTTP health probes and forwarded HTTPS preserve exact host/origin policy",async()=>{
 const mongoose=require("mongoose");const previousState=mongoose.connection._readyState;mongoose.connection._readyState=1;
 try {
  expect((await request(app).get("/healthz")).status).toBe(200);
  mongoose.connection._readyState=0;expect((await request(app).get("/healthz")).status).toBe(503);
 } finally {mongoose.connection._readyState=previousState;}
 expect((await api("get","/")).status).toBe(200);
 expect((await api("get","/").set("X-Forwarded-Proto","http")).status).toBe(400);
 expect((await api("get","/").set("X-Forwarded-Host","foreign.onrender.com")).status).toBe(400);
});

test("per-IP limit stops distributed usernames in addition to existing account limiter",async()=>{
 let result;
 for(let i=0;i<31;i++)result=await api("post","/api/auth/login").send({username:`fixture_${i}`,password:"wrong"});
 expect(result.status).toBe(429);expect(result.headers["retry-after"]).toBeDefined();expect(result.body.code).toBe("SHOWCASE_LOGIN_LIMIT");
});
