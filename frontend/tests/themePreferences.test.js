import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { themePreferenceKey, readTheme, saveTheme, applyTheme, themeStorage, prepareInitialTheme, loadAccountTheme, rememberTheme } from "../src/utils/themePreferences.js";
const memory = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), data }; };

test("default light, dark/light persist, accounts isolated and role/page share same preference", async () => {
  const storage = memory();
  const a = await themePreferenceKey({ username: "theme-a", role: "user", page: "home-user" }, webcrypto);
  const admin = await themePreferenceKey({ username: "theme-a", role: "admin", page: "home-admin" }, webcrypto);
  const b = await themePreferenceKey({ username: "theme-b" }, webcrypto);
  assert.equal(a, admin); assert.notEqual(a, b); assert.ok(!a.includes("theme-a"));
  assert.equal(readTheme(storage,a), "light"); saveTheme(storage,a,"dark");
  assert.equal(readTheme(storage,admin),"dark"); assert.equal(readTheme(storage,b),"light");
  saveTheme(storage,a,"light"); assert.equal(readTheme(storage,a),"light");
  assert.deepEqual([...storage.data.values()], ['"light"']);
});
test("invalid values, unavailable storage/crypto and absent identity fail safely", async () => {
  for (const value of [null,'dark','true','"DARK"','{}','null','"dark" '.repeat(5000)]) assert.equal(readTheme({getItem:()=>value},"key"),"light");
  const denied = {getItem(){throw Error("denied");},setItem(){throw Error("quota");}};
  assert.equal(readTheme(denied,"key"),"light"); assert.doesNotThrow(()=>saveTheme(denied,"key","dark"));
  assert.equal(readTheme(null,"key"),"light");
  const storage = memory(); saveTheme(storage,null,"dark"); saveTheme(storage,"k","invalid"); assert.equal(storage.data.size,0);
  assert.equal(await themePreferenceKey(null,webcrypto),null); assert.equal(await themePreferenceKey({username:"a"},{}),null);
});
test("bootstrap restores account color before mounting and memory does not leak between users", async () => {
  const oldStorage=Object.getOwnPropertyDescriptor(globalThis,"localStorage");
  const oldDoc=globalThis.document; const storage=memory();
  Object.defineProperty(globalThis,"localStorage",{value:storage,configurable:true});
  const doc={documentElement:{dataset:{},style:{}}}; globalThis.document=doc;
  try {
    const user={username:"bootstrap-test-a"};const key=await themePreferenceKey(user,webcrypto);
    saveTheme(storage,key,"dark"); storage.setItem("authUser",JSON.stringify(user));
    await prepareInitialTheme(); assert.equal(doc.documentElement.dataset.officeTheme,"dark");
    const entry=await loadAccountTheme(user);rememberTheme(user,{...entry,theme:"light"});
    assert.equal((await loadAccountTheme(user)).theme,"light"); assert.equal(readTheme(storage,key),"light");
    assert.equal((await loadAccountTheme({username:"bootstrap-test-b"})).theme,"light");
    storage.setItem("authUser","invalid");await prepareInitialTheme();assert.equal(doc.documentElement.dataset.officeTheme,"light");
    Object.defineProperty(globalThis,"localStorage",{get(){throw Error("denied");},configurable:true});
    assert.equal(themeStorage(),null);await prepareInitialTheme(); assert.equal(doc.documentElement.style.colorScheme,"light");
    applyTheme("invalid",doc);assert.equal(doc.documentElement.dataset.officeTheme,"light");
  } finally {
    if(oldStorage)Object.defineProperty(globalThis,"localStorage",oldStorage);else delete globalThis.localStorage;
    if(oldDoc===undefined)delete globalThis.document;else globalThis.document=oldDoc;
  }
});
test("real toggle has stable accessible name, pressed state, action title and decorative icons", async () => {
  const server=await createServer({optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,ws:false},appType:"custom"});
  try {
    const {default:Toggle}=await server.ssrLoadModule("/src/components/Theme/ThemeToggle.jsx");
    const {ThemeContext}=await server.ssrLoadModule("/src/context/theme-context.js");
    for(const theme of ["light","dark"]) {
      const html=renderToStaticMarkup(React.createElement(ThemeContext.Provider,{value:{theme,toggleTheme(){}}},React.createElement(Toggle)));
      assert.ok(html.includes('type="button"'));assert.ok(html.includes('aria-label="Modalità scura"'));
      assert.ok(html.includes(`aria-pressed="${theme==="dark"}"`));assert.ok(html.includes('aria-hidden="true"'));
      assert.ok(html.includes(theme==="dark"?"Attiva modalità chiara":"Attiva modalità scura"));
    }
  } finally {await server.close();}
});
test("application entry removes only the global banner and initializes theme before render",async()=>{
  const main=await readFile(new URL("../src/main.jsx",import.meta.url),"utf8");
  assert.ok(!main.includes("DemoBanner")); assert.match(main,/prepareInitialTheme\(\)\.then\(/);
  const auth=await readFile(new URL("../src/context/AuthContext.jsx",import.meta.url),"utf8");
  assert.ok(auth.includes('<AccountThemeProvider user={user} authLoading={authLoading}>'));
});
