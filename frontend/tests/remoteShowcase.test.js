import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {remoteFrontendConfig,securityHeaders} from "../scripts/remoteShowcaseConfig.mjs";
import {isLocalDemoGpsCandidate} from "../src/utils/localDemoGps.js";
test("remote HTTPS API is configurable; remote builds cannot enable local GPS omission",()=>{
 for(const api of ["https://office-clocking-showcase-api.onrender.com","https://showcase-api.example.com"]){
  const env=remoteFrontendConfig({VITE_API_URL:api});assert.equal(env.VITE_API_URL,api);assert.equal(env.VITE_SHOWCASE_REMOTE,"true");assert.equal(env.VITE_DEMO_LOCAL_GPS_BYPASS,"false");assert.equal(isLocalDemoGpsCandidate({...env,DEV:false,MODE:"showcase-remote"},"127.0.0.1"),false);
 }
});
test("insecure or credential-bearing APIs and public-secret variables fail the build",()=>{
 for(const api of [undefined,"http://127.0.0.1:5055","http://remote.example.com","https://a:b@api.example.com","https://api.example.com/path","https://api.example.com?secret=x"] )assert.throws(()=>remoteFrontendConfig({VITE_API_URL:api}));
 assert.throws(()=>remoteFrontendConfig({VITE_API_URL:"https://api.example.com",VITE_JWT_SECRET:"must-never-ship"}));
 assert.throws(()=>remoteFrontendConfig({VITE_API_URL:"https://api.example.com",VITE_DEMO_LOCAL_GPS_BYPASS:"true"}));
});
test("isolated output has HTTPS CSP, no API fallback and no local dotenv loading",async()=>{
 const headers=securityHeaders("https://showcase-api.example.com");assert.ok(headers.includes("connect-src 'self' https://showcase-api.example.com"));assert.ok(headers.includes("frame-ancestors 'none'"));assert.ok(headers.includes("/sw.js\n  Cache-Control: no-cache"));
 const build=await readFile(new URL("../scripts/buildRemoteShowcase.mjs",import.meta.url),"utf8");assert.ok(build.includes("envDir: false"));assert.ok(build.includes('outDir: "dist-showcase"'));assert.ok(build.includes('/api/* /404.html 404'));
 const app=await readFile(new URL("../src/App.jsx",import.meta.url),"utf8");assert.ok(app.includes('import.meta.env.VITE_SHOWCASE_REMOTE !== "true"'));
});

test("remote selector has no passwords, Admin sessions are read-only and account mutations stay disabled (SSR)",async()=>{
 const {createServer}=await import("vite");const React=await import("react");const {renderToStaticMarkup}=await import("react-dom/server");
 const server=await createServer({define:{"import.meta.env.VITE_SHOWCASE_REMOTE":'"true"',"import.meta.env.VITE_DEMO_MODE":'"true"'},optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:"custom"});
 try {
  const {MemoryRouter}=await import("react-router-dom");const {AuthContext}=await server.ssrLoadModule("/src/context/auth-context.js");const {default:Login}=await server.ssrLoadModule("/src/App.jsx");
  const html=renderToStaticMarkup(React.createElement(MemoryRouter,null,React.createElement(AuthContext.Provider,{value:{user:null,login(){},setSessionMessage(){}}},React.createElement(Login))));
  assert.ok(html.includes("Admin Demo in sola consultazione"));assert.ok(!html.includes("1234"));assert.ok(!html.includes("login-demo-accounts"));assert.ok(html.includes("Admin Demo"));assert.ok(html.includes("Dipendente 15"));assert.ok(html.includes("sola consultazione"));
  const {default:Users}=await server.ssrLoadModule("/src/components/Home-admin/AdminUsersSection.jsx");
  const markup=renderToStaticMarkup(React.createElement(Users,{users:[],newUsername:"",newPassword:"",newFullName:"",newEmail:"",newRole:"user",getRoleLabel:role=>role,uiLabels:{fields:{role:"Ruolo",status:"Stato"}}}));
  assert.match(markup,/<button[^>]*disabled=""[^>]*>Crea nuovo utente<\/button>/);assert.ok(markup.includes("sola lettura"));
 }finally{await server.close();}
});

test("replacement build targets the existing demo API with HTTPS CSP and no local GPS bypass",()=>{
 const api="https://office-clocking-backend-demo.onrender.com";const flags=remoteFrontendConfig({VITE_API_URL:api});
 assert.equal(flags.VITE_API_URL,api);assert.equal(flags.VITE_SHOWCASE_REMOTE,"true");assert.equal(flags.VITE_DEMO_LOCAL_GPS_BYPASS,"false");
 assert.ok(securityHeaders(api).includes("connect-src 'self' "+api));
 assert.equal(isLocalDemoGpsCandidate({...flags,DEV:false,MODE:"showcase-remote"},"office-clocking-demo.netlify.app"),false);
});
