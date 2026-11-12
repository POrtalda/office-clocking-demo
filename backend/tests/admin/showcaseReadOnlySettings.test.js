const express=require("express"),request=require("supertest");
jest.mock("../../models/AppSettings",()=>({findOne:jest.fn(),findOneAndUpdate:jest.fn()}));
jest.mock("../../middleware/authMiddleware",()=>({authMiddleware:(req,_res,next)=>{req.user={readOnly:true};next();}}));
const AppSettings=require("../../models/AppSettings");
const {getAppSettings}=require("../../controllers/adminController");
beforeEach(()=>{jest.clearAllMocks();AppSettings.findOne.mockReturnValue({lean:async()=>({leaveMinAdvanceDays:2,leaveNotificationEmails:[]})});});
test("Admin and public settings GET do not upsert for read-only sessions",async()=>{
 const app=express();app.get("/admin",(req,_res,next)=>{req.user={readOnly:true};next();},getAppSettings);app.use("/settings",require("../../routes/settings"));
 expect((await request(app).get("/admin")).status).toBe(200);expect((await request(app).get("/settings")).status).toBe(200);expect(AppSettings.findOne).toHaveBeenCalledTimes(2);expect(AppSettings.findOneAndUpdate).not.toHaveBeenCalled();
});
test("absent settings returns defaults without creating any document",async()=>{
 AppSettings.findOne.mockReturnValue({lean:async()=>null});const app=express();app.get("/",(req,_res,next)=>{req.user={readOnly:true};next();},getAppSettings);const result=await request(app).get("/");expect(result.status).toBe(200);expect(result.body.settings.leaveMinAdvanceDays).toBe(2);expect(AppSettings.findOneAndUpdate).not.toHaveBeenCalled();
});
