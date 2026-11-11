jest.mock("mongoose",()=>({mongo:{ObjectId:jest.fn(function(){return {}; }),MongoClient:jest.fn(()=>{throw Error("No actual database client permitted");})}}));
const path=require("path");
const {recover,validatePasswords}=require("../../scripts/recoverRemoteShowcase");
const {DATABASE,PURPOSE}=require("../../utils/remoteShowcase");
const {demoDataset}=require("../../utils/remoteShowcaseSeed");
const accountFile=path.join(path.parse(process.cwd()).root,"private-fixture","accounts.json");
const config={APP_ENV:"showcase",SHOWCASE_SEED_CONFIRM:PURPOSE,SHOWCASE_ATLAS_HOST:"showcasecluster.xed8r0t.mongodb.net",SHOWCASE_SEED_URI:`mongodb+srv://showcase_seed:fixture-only@showcasecluster.xed8r0t.mongodb.net/${DATABASE}?retryWrites=true&w=majority`,SHOWCASE_CREDENTIALS_FILE:accountFile};
const flags=["--apply","--reuse-existing-credentials","--confirm-new-atlas",`--confirm-database=${DATABASE}`];
function fixtures(){
 const dataset=demoDataset(),passwords=Object.fromEntries(dataset.users.map((user,i)=>[user.username,`Existing-Strong-Fixture-Password-${i}-92854`]));
 const fs={realpathSync:p=>p,existsSync:()=>true,lstatSync:()=>({isSymbolicLink:()=>false,isFile:()=>true,size:2048}),readFileSync:jest.fn(file=>file===accountFile?JSON.stringify(passwords):Object.entries(config).map(([k,v])=>`${k}=${v}`).join("\n"))};
 const collections={};let listed=0;
 const db={databaseName:DATABASE,listCollections:jest.fn(()=>({toArray:async()=>listed++<2?[]:[{name:"_showcase_guard"}]})),createCollection:jest.fn(async()=>{}),collection:jest.fn(name=>(collections[name]??={createIndex:jest.fn(),insertOne:jest.fn(),insertMany:jest.fn(),updateOne:jest.fn()}))};
 const client={connect:jest.fn(),db:jest.fn(()=>db),close:jest.fn()};const MongoClient=jest.fn(function(){return client;});
 return {fs,db,client,MongoClient,passwords,hashPassword:jest.fn(async password=>`HASH-${password}`),collections};
}
test.each([[[]],[["--check"]]])("default/check is offline and never reads account passwords: %j",async args=>{
 const f=fixtures();const result=await recover(args,{fs:f.fs});expect(result.accountPasswordsRead).toBe(false);expect(result.databaseConnection).toBe(false);expect(f.fs.readFileSync).not.toHaveBeenCalledWith(accountFile,expect.anything());
});
test.each(flags.map((_,i)=>[flags.filter((_,j)=>i!==j)]))("every recovery confirmation is required: %j",async args=>{
 const f=fixtures();await expect(recover(args,{fs:f.fs})).rejects.toThrow();expect(f.fs.readFileSync).not.toHaveBeenCalled();
});
test("populated or partial target refuses before reading passwords or creating any collection",async()=>{
 const f=fixtures();f.db.listCollections.mockReturnValue({toArray:async()=>[{name:"_showcase_guard"}]});
 await expect(recover(flags,f)).rejects.toThrow("not empty");expect(f.fs.readFileSync).not.toHaveBeenCalledWith(accountFile,expect.anything());expect(f.db.createCollection).not.toHaveBeenCalled();expect(f.client.close).toHaveBeenCalled();
});
test("mock-only recovery reuses the exact existing passwords and never writes the password file",async()=>{
 const f=fixtures();const result=await recover(flags,f);expect(result.mode).toBe("recovery-completed");expect(result.users).toBe(16);expect(f.client.db).toHaveBeenCalledWith(DATABASE);expect(f.hashPassword).toHaveBeenCalledTimes(16);
 for(const password of Object.values(f.passwords))expect(f.hashPassword).toHaveBeenCalledWith(password,12);
 expect(f.db.createCollection).toHaveBeenCalledWith("_showcase_guard");expect(f.collections._showcase_guard.updateOne).toHaveBeenCalled();expect(f.client.close).toHaveBeenCalled();
});
test("invalid/missing/extra/weak/duplicate passwords are rejected without regeneration",()=>{
 const f=fixtures(),data=demoDataset();expect(validatePasswords(f.passwords,data)).toBe(f.passwords);
 const missing={...f.passwords};delete missing[data.users[0].username];
 for(const value of [null,[],missing,{...f.passwords,extra:"value"},{...f.passwords,[data.users[0].username]:"1234"},Object.fromEntries(data.users.map(user=>[user.username,"Same-Strong-Fixture-Password-12345"]))])expect(()=>validatePasswords(value,data)).toThrow();
});

test("wrong selected database refuses every mutation before creating a marker",async()=>{
 const f=fixtures();f.db.databaseName="forbidden-other-database";
 await expect(recover(flags,f)).rejects.toThrow("target mismatch");expect(f.db.createCollection).not.toHaveBeenCalled();expect(f.client.close).toHaveBeenCalled();
});
