import test from "node:test";
import assert from "node:assert/strict";
import { isRemoteShowcaseGpsCandidate, acceptsRemoteGpsPolicy, getRemoteClockLocationPayload, REMOTE_GPS_NOTICE } from "../src/utils/remoteShowcaseGps.js";
import { getOffsiteClockPayload } from "../src/utils/localDemoGps.js";
const env={MODE:"showcase-remote",VITE_SHOWCASE_REMOTE:"true",VITE_DEMO_MODE:"true",VITE_DEMO_LOCAL_GPS_BYPASS:"false"};
test("only remote Showcase builds over HTTPS query the remote GPS policy",()=>{
 assert.equal(isRemoteShowcaseGpsCandidate(env,"https:"),true);
 for(const patch of [{MODE:"production"},{MODE:"demo-local"},{VITE_SHOWCASE_REMOTE:"false"},{VITE_DEMO_MODE:"false"},{VITE_DEMO_LOCAL_GPS_BYPASS:"true"}])assert.equal(isRemoteShowcaseGpsCandidate({...env,...patch},"https:"),false);
 assert.equal(isRemoteShowcaseGpsCandidate(env,"http:"),false);
});
test("explicit server authorization is necessary; local policy and malformed values fail closed",()=>{
 assert.equal(acceptsRemoteGpsPolicy({canSkipShowcaseGps:true},true),true);
 for(const policy of [undefined,{}, {canSkipGps:true},{canSkipShowcaseGps:false},{canSkipShowcaseGps:"true"}])assert.equal(acceptsRemoteGpsPolicy(policy,true),false);
 assert.equal(acceptsRemoteGpsPolicy({canSkipShowcaseGps:true},false),false);
});
test("authorized online clocking and pauses omit GPS with a distinct remote marker",async()=>{
 assert.deepEqual(await getRemoteClockLocationPayload({authorized:true,requestPosition:()=>{throw Error("Must not request GPS");}}),{showcaseWithoutGps:true});
 assert.match(REMOTE_GPS_NOTICE,/controllo GPS disattivato/);assert.match(REMOTE_GPS_NOTICE,/versione aziendale/);
});
test("denied or unavailable policy requests actual GPS and never silently falls back",async()=>{
 const coords={latitude:45,longitude:7,accuracy:10};
 for(const authorized of [false,undefined,"true"]){
  assert.deepEqual(await getRemoteClockLocationPayload({authorized,requestPosition:async()=>({coords})}),{location:coords});
  await assert.rejects(()=>getRemoteClockLocationPayload({authorized,requestPosition:async()=>{throw Error("GPS denied");}}),/GPS denied/);
 }
});
test("offsite remains distinct and requires a trimmed reason",()=>{
 for(const reason of [undefined,"", "   ","x".repeat(501)])assert.throws(()=>getOffsiteClockPayload(reason));
 assert.deepEqual(getOffsiteClockPayload("  Visita dimostrativa  "),{workLocation:"offsite",offsiteReason:"Visita dimostrativa"});
});
