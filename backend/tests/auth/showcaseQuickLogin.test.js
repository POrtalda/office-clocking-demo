const request=require("supertest"),express=require("express"),jwt=require("jsonwebtoken");
jest.mock("mongoose",()=>({connection:{db:{databaseName:"office_clocking_showcase_20261113",collection:jest.fn()}}}));
jest.mock("../../models/User",()=>({findOne:jest.fn(),findById:jest.fn()}));
const mongoose=require("mongoose"),User=require("../../models/User");
const {adminSigningKey}=require("../../utils/showcaseQuickLogin");
const {DATABASE,PURPOSE,jwtVerification}=require("../../utils/remoteShowcase");
const {authMiddleware}=require("../../middleware/authMiddleware");
const previous={...process.env};let app,index=0,ip,current;
const client="https://office-clocking-demo.netlify.app",host="office-clocking-backend-demo.onrender.com";
const api=(method,url)=>request(app)[method](url).set("Host",host).set("X-Forwarded-Proto","https").set("X-Forwarded-For",ip).set("Origin",client);
beforeAll(()=>{
 Object.assign(process.env,{APP_ENV:"showcase",NODE_ENV:"production",DEMO_MODE:"true",DEMO_LOCAL_GPS_BYPASS:"false",GEOLOCATION_CLOCK_IN_ENABLED:"true",SHOWCASE_EMAIL_MODE:"disabled",SHOWCASE_ADMIN_USERNAME:"showcase_admin",SHOWCASE_API_URL:`https://${host}`,CLIENT_URL:client,SHOWCASE_ATLAS_HOST:"showcase-fixture.mongodb.net",MONGO_URI:`mongodb+srv://fixture:fixture@showcase-fixture.mongodb.net/${DATABASE}`,JWT_SECRET:"0123456789abcdef".repeat(4),OFFICE_LAT:"45",OFFICE_LNG:"7",OFFICE_RADIUS_METERS:"100",SHOWCASE_QUICK_LOGIN_ENABLED:"true"});
 for(const key of Object.keys(process.env))if(key.startsWith("SMTP_"))delete process.env[key];
 app=express();app.set("trust proxy",1);app.use(express.json());require("../../middleware/remoteShowcase").installRemoteShowcase(app);app.use("/api/demo/showcase",require("../../routes/showcaseLogin"));app.get("/me",authMiddleware,(req,res)=>res.json({user:req.user}));
 app.get("/api/auth/me",authMiddleware,require("../../controllers/authController").getMe);
 app.get("/api/admin/dashboard",authMiddleware,(req,res)=>res.json({readOnly:req.user.readOnly,role:req.user.role}));
 app.all(/^\/api\/(admin|records|leaves)\/sensitive/,authMiddleware,(_req,res)=>res.status(500).json({error:"Mutation handler must not be reached"}));
 app.get("/api/records/private",authMiddleware,(_req,res)=>res.json({}));app.use(require("../../middleware/errorHandler"));
});
afterAll(()=>{for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);});
beforeEach(()=>{
 jest.clearAllMocks();ip=`198.51.100.${++index}`;process.env.APP_ENV="showcase";process.env.NODE_ENV="production";process.env.DEMO_MODE="true";process.env.DEMO_LOCAL_GPS_BYPASS="false";process.env.SHOWCASE_QUICK_LOGIN_ENABLED="true";delete process.env.SHOWCASE_ADMIN_QUICK_LOGIN_ENABLED;
 mongoose.connection.db.databaseName=DATABASE;User.db=mongoose.connection;
 current={_id:"507f1f77bcf86cd799439011",username:"showcase_user01",role:"user",isActive:true};
 User.findOne.mockImplementation(()=>({select:()=>({lean:async()=>current})}));User.findById.mockImplementation(()=>({select:()=>({lean:async()=>current})}));
 mongoose.connection.db.collection.mockReturnValue({findOne:jest.fn().mockResolvedValue({_id:PURPOSE})});
});
test("lists only 16 fixed synthetic labels, protected presenter Admin, no secrets or real names",async()=>{
 const result=await api("get","/api/demo/showcase/profiles");expect(result.status).toBe(200);expect(result.body.profiles).toHaveLength(16);expect(result.body.profiles[0]).toEqual({profile:"showcase_admin",label:"Admin Demo",access:"admin-readonly"});expect(result.body.profiles.at(-1).label).toBe("Dipendente 15");expect(JSON.stringify(result.body)).not.toMatch(/password|token|email|fullName/i);expect(User.findOne).not.toHaveBeenCalled();expect(result.headers["cache-control"]).toBe("no-store");
});
test("public session has fresh 10m scoped JWT and rehydrates through me without password",async()=>{
 const first=await api("post","/api/demo/showcase/session").send({profile:current.username});expect(first.status).toBe(200);
 const decoded=jwt.verify(first.body.token,process.env.JWT_SECRET,jwtVerification());expect(decoded.exp-decoded.iat).toBe(600);expect(decoded.role).toBe("user");expect(decoded.showcaseDatabase).toBe(DATABASE);expect(decoded.showcaseQuickLogin).toBe(true);expect(decoded.jti).toBeTruthy();
 expect((await api("get","/me").set("Authorization",`Bearer ${first.body.token}`)).status).toBe(200);
 const second=await api("post","/api/demo/showcase/session").send({profile:current.username});expect(jwt.decode(second.body.token).jti).not.toBe(decoded.jti);
 current.isActive=false;expect((await api("get","/me").set("Authorization",`Bearer ${first.body.token}`)).status).toBe(401);
});
test.each(["showcase_admin","admin","showcase_user00","showcase_user16",{"$ne":null},null])("no public Admin or arbitrary profile: %j",async profile=>{
 const response=await api("post","/api/demo/showcase/session").send({profile});expect(response.status).toBe(403);expect(User.findOne).not.toHaveBeenCalled();
});
test("role injection, promoted/inactive account and missing ready marker are denied",async()=>{
 expect((await api("post","/api/demo/showcase/session").send({profile:current.username,role:"admin"})).status).toBe(403);
 current.role="admin";expect((await api("post","/api/demo/showcase/session").send({profile:current.username})).status).toBe(403);
 current.role="user";current.isActive=false;expect((await api("post","/api/demo/showcase/session").send({profile:current.username})).status).toBe(403);
 current.isActive=true;mongoose.connection.db.collection.mockReturnValue({findOne:async()=>null});expect((await api("post","/api/demo/showcase/session").send({profile:current.username})).status).toBe(503);
});
test.each(["disabled","production","wrong-db","wrong-model-connection"])("not available outside explicit isolated Showcase: %s",async kind=>{
 if(kind==="disabled")process.env.SHOWCASE_QUICK_LOGIN_ENABLED="false";
 if(kind==="production")process.env.APP_ENV="production";
 if(kind==="wrong-db")mongoose.connection.db.databaseName="client1";
 if(kind==="wrong-model-connection")User.db={};
 expect((await api("get","/api/demo/showcase/profiles")).status).toBe(404);expect((await api("post","/api/demo/showcase/session").send({profile:current.username})).status).toBe(404);expect(User.findOne).not.toHaveBeenCalled();
});
test("origin/HTTPS guard blocks foreign requests before session issuance",async()=>{
 expect((await api("post","/api/demo/showcase/session").set("Origin","https://foreign.netlify.app").send({profile:current.username})).status).toBe(403);
 expect((await api("get","/api/demo/showcase/profiles").set("X-Forwarded-Proto","http")).status).toBe(400);
});
test("temporary sessions expire and cannot migrate to ordinary production or survive flag revocation",async()=>{
 const response=await api("post","/api/demo/showcase/session").send({profile:current.username});const value=response.body.token;
 process.env.SHOWCASE_QUICK_LOGIN_ENABLED="false";expect((await api("get","/me").set("Authorization",`Bearer ${value}`)).status).toBe(401);
 process.env.SHOWCASE_QUICK_LOGIN_ENABLED="true";process.env.APP_ENV="production";expect((await api("get","/me").set("Authorization",`Bearer ${value}`)).status).toBe(401);
 process.env.APP_ENV="showcase";const expired=jwt.sign({...jwt.decode(value),exp:1},process.env.JWT_SECRET,{algorithm:"HS256"});expect((await api("get","/me").set("Authorization",`Bearer ${expired}`)).status).toBe(401);
});
test("rate limiter caps session creation per IP",async()=>{
 let response;for(let i=0;i<16;i++)response=await api("post","/api/demo/showcase/session").send({profile:"showcase_admin"});expect(response.status).toBe(429);expect(response.headers["retry-after"]).toBeDefined();
});

test("every allowed employee 01-15 can receive only its own user session",async()=>{
 for(let number=1;number<=15;number++){
  current.username=`showcase_user${String(number).padStart(2,"0")}`;
  const result=await api("post","/api/demo/showcase/session").send({profile:current.username});
  expect(result.status).toBe(200);const decoded=jwt.verify(result.body.token,process.env.JWT_SECRET,jwtVerification());expect(decoded.username).toBe(current.username);expect(decoded.role).toBe("user");
 }
});

async function adminToken(){
 process.env.SHOWCASE_ADMIN_QUICK_LOGIN_ENABLED="true";current.username="showcase_admin";current.role="admin";
 const response=await api("post","/api/demo/showcase/session").send({profile:"showcase_admin"});expect(response.status).toBe(200);return response.body.token;
}
test("Admin one-click is exact showcase_admin, read-only and expires in 10 minutes",async()=>{
 const token=await adminToken(),decoded=jwt.verify(token,adminSigningKey(),jwtVerification());expect(decoded.username).toBe("showcase_admin");expect(decoded.role).toBe("admin");expect(decoded.showcaseReadOnly).toBe(true);expect(decoded.exp-decoded.iat).toBe(600);
 const me=await api("get","/api/auth/me").set("Authorization",`Bearer ${token}`);expect(me.status).toBe(200);expect(me.body.user.readOnly).toBe(true);
 const report=await api("get","/api/admin/dashboard").set("Authorization",`Bearer ${token}`);expect(report.status).toBe(200);expect(report.body).toEqual({readOnly:true,role:"admin"});
 const catalog=await api("get","/api/demo/showcase/profiles");expect(catalog.body.adminQuickLoginEnabled).toBe(true);
});
test.each(["post","patch","put","delete"])("Admin quick %s denied on every protected namespace",async method=>{
 const token=await adminToken();for(const namespace of ["admin","records","leaves"]){const response=await api(method,`/api/${namespace}/sensitive`).set("Authorization",`Bearer ${token}`).send({role:"admin"});expect(response.status).toBe(403);expect(response.body.code).toBe("SHOWCASE_ADMIN_READ_ONLY");}
});
test("sensitive user/password/settings operations and unsupported reads stay denied",async()=>{
 const token=await adminToken();for(const [method,url] of [["post","/api/admin/users"],["patch","/api/admin/users/any/password"],["patch","/api/admin/settings"],["get","/api/records/private"],["get","/api/admin/sensitive"]])expect((await api(method,url).set("Authorization",`Bearer ${token}`).send({})).status).toBe(403);
});
test("Admin flag revokes existing quick sessions and wrong scope cannot authenticate",async()=>{
 const token=await adminToken();process.env.SHOWCASE_ADMIN_QUICK_LOGIN_ENABLED="false";expect((await api("get","/api/auth/me").set("Authorization",`Bearer ${token}`)).status).toBe(401);expect((await api("post","/api/demo/showcase/session").send({profile:"showcase_admin"})).status).toBe(403);
 process.env.SHOWCASE_ADMIN_QUICK_LOGIN_ENABLED="true";
 const decoded=jwt.decode(token);const badScope=jwt.sign({...decoded,showcaseReadOnly:false},adminSigningKey(),{algorithm:"HS256"});expect((await api("get","/api/auth/me").set("Authorization",`Bearer ${badScope}`)).status).toBe(401);
 const expired=jwt.sign({...decoded,exp:1},adminSigningKey(),{algorithm:"HS256"});expect((await api("get","/api/auth/me").set("Authorization",`Bearer ${expired}`)).status).toBe(401);
});
test("Admin enabled alone cannot escape environment/database or select another Admin",async()=>{
 const token=await adminToken();process.env.APP_ENV="production";expect((await api("post","/api/demo/showcase/session").send({profile:"showcase_admin"})).status).toBe(404);expect((await api("get","/api/auth/me").set("Authorization",`Bearer ${token}`)).status).toBe(401);
 process.env.APP_ENV="showcase";mongoose.connection.db.databaseName="other-db";expect((await api("post","/api/demo/showcase/session").send({profile:"showcase_admin"})).status).toBe(404);
 mongoose.connection.db.databaseName=DATABASE;expect((await api("post","/api/demo/showcase/session").send({profile:"another_admin"})).status).toBe(403);
});

test("Admin quick signature cannot be accepted by old or ordinary JWT verifiers",async()=>{
 const token=await adminToken();expect(()=>jwt.verify(token,process.env.JWT_SECRET,jwtVerification())).toThrow();expect(()=>jwt.verify(token,process.env.JWT_SECRET)).toThrow();
 const decoded=jwt.decode(token);const wrongKey=jwt.sign(decoded,process.env.JWT_SECRET,{algorithm:"HS256"});expect((await api("get","/api/auth/me").set("Authorization",`Bearer ${wrongKey}`)).status).toBe(401);
});
