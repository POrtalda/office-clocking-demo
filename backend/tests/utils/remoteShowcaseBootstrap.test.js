jest.mock("mongoose",()=>({set:jest.fn(),connect:jest.fn(),disconnect:jest.fn(),connection:{db:{collection:jest.fn()}}}));
jest.mock("../../app",()=>({listen:jest.fn()}));
const mongoose=require("mongoose"), app=require("../../app");
const {start}=require("../../scripts/startRemoteShowcase");
const {DATABASE,ADMIN}=require("../../utils/remoteShowcase");
const previous={...process.env};
beforeEach(()=>{
 jest.clearAllMocks();Object.assign(process.env,{APP_ENV:"showcase",NODE_ENV:"production",DEMO_MODE:"true",DEMO_LOCAL_GPS_BYPASS:"false",GEOLOCATION_CLOCK_IN_ENABLED:"true",SHOWCASE_EMAIL_MODE:"disabled",SHOWCASE_ADMIN_USERNAME:ADMIN,SHOWCASE_API_URL:"https://office-clocking-showcase-api.onrender.com",CLIENT_URL:"https://office-clocking-showcase.netlify.app",SHOWCASE_ATLAS_HOST:"showcase-fixture.mongodb.net",MONGO_URI:`mongodb+srv://fixture:fixture@showcase-fixture.mongodb.net/${DATABASE}`,JWT_SECRET:"0123456789abcdef".repeat(4),OFFICE_LAT:"45",OFFICE_LNG:"7",OFFICE_RADIUS_METERS:"100"});
 for(const key of Object.keys(process.env))if(key.startsWith("SMTP_"))delete process.env[key];
});
afterAll(()=>{for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];Object.assign(process.env,previous);});
test("invalid configuration fails before opening a connection",async()=>{
 process.env.MONGO_URI="mongodb://127.0.0.1:27017/office_clocking_showcase_v2";
 await expect(start()).rejects.toThrow();expect(mongoose.connect).not.toHaveBeenCalled();expect(app.listen).not.toHaveBeenCalled();
});
test("missing/incomplete seed marker prevents serving requests and closes the connection",async()=>{
 mongoose.connection.db.collection.mockReturnValue({findOne:jest.fn().mockResolvedValue(null)});
 await expect(start()).rejects.toThrow("non inizializzato");expect(mongoose.connect).toHaveBeenCalledWith(process.env.MONGO_URI,expect.objectContaining({dbName:DATABASE,autoIndex:false,autoCreate:false}));expect(app.listen).not.toHaveBeenCalled();expect(mongoose.disconnect).toHaveBeenCalled();
});

test("valid runtime --check returns before loading app or opening MongoDB",async()=>{
 const originalArgv=process.argv;const log=jest.spyOn(console,"log").mockImplementation(()=>{});
 try {process.argv=[...originalArgv,"--check"];await expect(start()).resolves.toBeUndefined();expect(mongoose.connect).not.toHaveBeenCalled();expect(app.listen).not.toHaveBeenCalled();expect(log).toHaveBeenCalledWith("Configurazione Showcase remoto valida; nessuna connessione aperta.");}
 finally {process.argv=originalArgv;log.mockRestore();}
});
