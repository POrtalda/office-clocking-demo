const express=require("express");
const rateLimit=require("express-rate-limit");
const jwt=require("jsonwebtoken");
const {randomUUID}=require("crypto");
const mongoose=require("mongoose");
const User=require("../models/User");
const {DATABASE,PURPOSE,jwtOptions}=require("../utils/remoteShowcase");
const {EMPLOYEES,profiles,requestAllowed,boundToShowcase}=require("../utils/showcaseQuickLogin");
const router=express.Router();
router.use((req,res,next)=>{
 if(!requestAllowed(req)||!boundToShowcase(mongoose.connection)||User.db!==mongoose.connection)return res.status(404).json({code:"SHOWCASE_QUICK_LOGIN_UNAVAILABLE",message:"Accesso rapido non disponibile."});
 res.set("Cache-Control","no-store");next();
});
const limiter=limit=>rateLimit({windowMs:60000,limit,standardHeaders:true,legacyHeaders:false,message:{code:"SHOWCASE_QUICK_LOGIN_LIMIT",message:"Troppi tentativi. Attendi un minuto.",retryAfterSeconds:60}});
router.get("/profiles",limiter(60),(_req,res)=>res.json({profiles:profiles()}));
router.post("/session",limiter(15),async(req,res)=>{
 try{
  const profile=req.body?.profile;
  if(typeof profile!=="string"||!EMPLOYEES.includes(profile)||Object.keys(req.body).some(key=>key!=="profile"))return res.status(403).json({code:"SHOWCASE_PROFILE_DENIED",message:"Profilo non disponibile per l’accesso pubblico."});
  const marker=await mongoose.connection.db.collection("_showcase_guard").findOne({_id:PURPOSE,state:"ready"},{projection:{_id:1}});
  if(!marker)return res.status(503).json({code:"SHOWCASE_NOT_READY",message:"Showcase non disponibile."});
  const user=await User.findOne({username:profile,role:"user",isActive:true}).select("_id username role isActive").lean();
  if(!user||user.username!==profile||user.role!=="user"||user.isActive!==true)return res.status(403).json({code:"SHOWCASE_PROFILE_DENIED",message:"Profilo non disponibile per l’accesso pubblico."});
  const token=jwt.sign({id:user._id,username:user.username,role:"user",showcaseQuickLogin:true,showcaseDatabase:DATABASE},process.env.JWT_SECRET,{...jwtOptions(),expiresIn:"10m",jwtid:randomUUID()});
  return res.json({token,user:{id:user._id,username:user.username,role:"user"},expiresInSeconds:600});
 }catch{return res.status(503).json({code:"SHOWCASE_QUICK_LOGIN_FAILED",message:"Accesso rapido temporaneamente non disponibile."});}
});
module.exports=router;
