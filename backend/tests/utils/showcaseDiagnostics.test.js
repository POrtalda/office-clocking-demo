const path=require("path");
jest.mock("mongoose",()=>{throw Error("Offline diagnostics must not load database drivers");});
const {inspectConfig,classifyError,safeError,inspectDatabase,diagnose}=require("../../scripts/diagnoseRemoteShowcase");
const {DATABASE,PURPOSE}=require("../../utils/remoteShowcase");
const fixtures=()=>({APP_ENV:"showcase",SHOWCASE_SEED_CONFIRM:PURPOSE,SHOWCASE_ATLAS_HOST:"showcasecluster.xed8r0t.mongodb.net",SHOWCASE_SEED_URI:`mongodb+srv://showcase_seed:fixture-only@showcasecluster.xed8r0t.mongodb.net/${DATABASE}?retryWrites=true&w=majority&authSource=admin`,SHOWCASE_CREDENTIALS_FILE:path.join(path.parse(process.cwd()).root,"private-fixture","accounts.json")});
test("offline inspection checks password file existence without reading it or loading drivers",()=>{
 const fsApi={realpathSync:p=>p,existsSync:jest.fn(()=>true),readFileSync:jest.fn(()=>{throw Error("Forbidden");})};
 const result=inspectConfig(fixtures(),fsApi);expect(result.credentialFileExists).toBe(true);expect(result.seedWouldStopBeforeAtlas).toBe(true);expect(fsApi.readFileSync).not.toHaveBeenCalled();expect(JSON.stringify(result)).not.toContain("fixture-only");
});
test.each(["runtime-user","wrong-host","wrong-db","inherited-runtime"])("diagnostic refuses target mismatch: %s",kind=>{
 const env=fixtures();if(kind==="runtime-user")env.SHOWCASE_SEED_URI=env.SHOWCASE_SEED_URI.replace("showcase_seed:","showcase_runtime:");if(kind==="wrong-host")env.SHOWCASE_ATLAS_HOST="other.mongodb.net";if(kind==="wrong-db")env.SHOWCASE_SEED_URI=env.SHOWCASE_SEED_URI.replace(DATABASE,"office_clocking");if(kind==="inherited-runtime")env.MONGO_URI="fixture";
 expect(()=>inspectConfig(env,{realpathSync:p=>p,existsSync:()=>false})).toThrow();
});
test.each([[{code:18},"AUTHENTICATION_FAILED"],[{code:13},"PERMISSION_DENIED"],[{code:"ENOTFOUND"},"DNS_FAILURE"],[{code:"CERT_HAS_EXPIRED"},"TLS_FAILURE"],[{name:"MongoServerSelectionError"},"SERVER_SELECTION_TIMEOUT"],[{message:"mongodb+srv://secret:private@host"},"UNCLASSIFIED_FAILURE"]])("safe error classification %j",(error,result)=>expect(classifyError(error)).toBe(result));
test("nested driver authentication errors take precedence over generic selection failure",()=>expect(classifyError({name:"MongoServerSelectionError",reason:{servers:new Map([["secret-host",{error:{code:18,message:"SECRET"}}]])}})).toBe("AUTHENTICATION_FAILED"));
test.each([[[],null,"EMPTY_DATABASE"],[["_showcase_guard"],"initializing","PARTIAL_INITIALIZATION"],[["users"],null,"EXISTING_DATABASE_REQUIRES_REVIEW"],[["_showcase_guard","users","timerecords","leaverequests","appsettings","timerecordlocks"],"ready","ALREADY_INITIALIZED"]])("only reads target metadata and counts: %j",async(names,state,status)=>{
 const collection={findOne:jest.fn(async()=>({state})),countDocuments:jest.fn(async()=>1)};
 const db={listCollections:jest.fn(()=>({toArray:async()=>names.map(name=>({name}))})),collection:jest.fn(()=>collection),command:jest.fn(async()=>({authInfo:{authenticatedUserRoles:[{db:DATABASE,role:"readWrite"},{db:DATABASE,role:"dbAdmin"}]}}))};
 const result=await inspectDatabase(db);expect(result.status).toBe(status);expect(result.permissions.readWriteOnTarget).toBe(true);expect(result.permissions.dbAdminOnTarget).toBe(true);expect(db.command).toHaveBeenCalledWith({connectionStatus:1,showPrivileges:false});if(state)expect(collection.findOne).toHaveBeenCalledWith({_id:PURPOSE},{projection:{_id:0,state:1}});
});
test("invalid arguments cannot trigger seed or connection",async()=>expect(await diagnose(["--apply"])).toEqual({category:"INVALID_ARGUMENTS",errorCode:"INVALID_ARGUMENTS",stage:"arguments"}));

test.each([
 [{errorResponse:{code:8000,errmsg:"not authorized on SECRET to execute command"}},"PERMISSION_DENIED","MONGO_8000"],
 [{cause:{code:8000,message:"bad auth : authentication failed SECRET"}},"AUTHENTICATION_FAILED","MONGO_8000"],
 [{errors:[{reason:{code:"ETIMEDOUT"}}]},"OPERATION_TIMEOUT","ETIMEDOUT"],
 [{reason:{servers:new Map([["SECRET",{error:{cause:{code:"ENOTFOUND"}}}]])}},"DNS_FAILURE","ENOTFOUND"],
 [{originalError:{code:"ERR_TLS_CERT_ALTNAME_INVALID"}},"TLS_FAILURE","ERR_TLS_CERT_ALTNAME_INVALID"],
 [{errorResponse:{code:"13"}},"PERMISSION_DENIED","MONGO_13"],
 [new TypeError("SECRET"),"DIAGNOSTIC_TYPE_ERROR","TYPE_ERROR"],
 [{name:"MongoOperationTimeoutError"},"OPERATION_TIMEOUT","MongoOperationTimeoutError"],
 [{response:{code:59}},"COMMAND_UNSUPPORTED","MONGO_59"],
 [{code:8000,message:"SECRET"},"ATLAS_SERVER_ERROR","MONGO_8000"],
 [{code:"SECRET",name:"SECRET",stack:"SECRET",message:"SECRET"},"UNCLASSIFIED_FAILURE","UNKNOWN"]
])("nested classification only emits allowlisted fields: %j",(error,category,errorCode)=>{
 const result=safeError(error);expect(result).toEqual({category,errorCode});expect(JSON.stringify(result)).not.toContain("SECRET");
});
test("cyclic error causes are bounded",()=>{const error={};error.cause=error;expect(safeError(error)).toEqual({category:"UNCLASSIFIED_FAILURE",errorCode:"UNKNOWN"});});
test("stage identifies exact failed read without logging the error",async()=>{
 const stage=jest.fn();const error={code:13};const db={listCollections:()=>({toArray:async()=>{throw error;}})};
 await expect(inspectDatabase(db,stage)).rejects.toBe(error);expect(stage).toHaveBeenLastCalledWith("list-collections");
});

test.each([
 ["Database name is too long. Max db name length is 38 bytes.","DATABASE_NAME_EXCEEDS_38_BYTES"],
 ["Database name is too long","DATABASE_NAME_TOO_LONG"],
 ["CMD_NOT_ALLOWED: command unavailable","COMMAND_UNSUPPORTED"],
 ["db already exists with different case","DATABASE_CASE_CONFLICT"],
 ["storage limit exceeded","ATLAS_QUOTA_LIMIT"]
])("Atlas 8000 constraints have specific categories: %s",(message,category)=>expect(safeError({errorResponse:{code:8000,errmsg:message}})).toEqual({category,errorCode:"MONGO_8000"}));
test("unknown TLS codes cannot expose arbitrary strings",()=>expect(safeError({code:"ERR_TLS_SECRET_VALUE"})).toEqual({category:"TLS_FAILURE",errorCode:"TLS_ERROR"}));
test.each(["connect","list-collections","empty"])("end-to-end diagnostics only return category/code/stage and never write: %s",async failure=>{
 const env=fixtures(),reads=[];
 const fsApi={readFileSync:file=>{reads.push(file);return Object.entries(env).map(([k,v])=>`${k}=${v}`).join("\n");},existsSync:()=>true,realpathSync:p=>p};
 const db={listCollections:()=>({toArray:async()=>{if(failure==="list-collections")throw {errorResponse:{code:8000,errmsg:"Database name is too long. Max db name length is 38 bytes. SECRET"}};return [];}}),command:async()=>({authInfo:{authenticatedUserRoles:[]}})};
 const client={connect:jest.fn(async()=>{if(failure==="connect")throw {cause:{code:18,message:"SECRET"}};}),db:jest.fn(()=>db),close:jest.fn()};
 const Client=jest.fn(function(){return client;});
 const result=await diagnose(["--atlas-read-only"],fsApi,()=>Client);
 expect(Object.keys(result).sort()).toEqual(["category","errorCode","stage"]);expect(JSON.stringify(result)).not.toContain("SECRET");expect(client.close).toHaveBeenCalled();expect(reads).toEqual(["C:/Office-Clocking-Secrets/showcase-seed.env"]);
 if(failure==="connect")expect(result).toEqual({category:"AUTHENTICATION_FAILED",errorCode:"MONGO_18",stage:"connect"});
 if(failure==="list-collections")expect(result).toEqual({category:"DATABASE_NAME_EXCEEDS_38_BYTES",errorCode:"MONGO_8000",stage:"list-collections"});
 if(failure==="empty")expect(result).toEqual({category:"EMPTY_DATABASE",errorCode:"NONE",stage:"inspection-complete"});
 expect(Client).toHaveBeenCalledWith(env.SHOWCASE_SEED_URI,expect.objectContaining({retryWrites:false,maxPoolSize:1}));if(failure!=="connect")expect(client.db).toHaveBeenCalledWith(DATABASE);
});

test("role inspection failure is classified at its exact stage instead of swallowed",async()=>{
 const stages=[];const error={code:13};const db={listCollections:()=>({toArray:async()=>[]}),command:async()=>{throw error;}};
 await expect(inspectDatabase(db,stage=>stages.push(stage))).rejects.toBe(error);expect(stages.at(-1)).toBe("inspect-roles");
});
