const { randomBytes } = require("crypto");
const { dayjs, APP_TZ } = require("./dateTime");
const { calculateWorkDuration } = require("./workDuration");
const { DATABASE, PURPOSE, ADMIN, assertAtlasTarget, strongDemoPassword } = require("./remoteShowcase");
function assertSeedConfig(env) {
  if (env.APP_ENV !== "showcase" || env.SHOWCASE_SEED_CONFIRM !== PURPOSE || env.MONGO_URI || env.DEMO_LOCAL_GPS_BYPASS === "true") throw new Error("Seed riservato al nuovo Atlas, con ambiente e conferma separati; non ereditare MONGO_URI");
  assertAtlasTarget(env.SHOWCASE_SEED_URI, env.SHOWCASE_ATLAS_HOST);
  return DATABASE;
}
function assertCredentialsPath(file, repo, fsApi = require("fs")) {
  const path = require("path");
  const outside = (base,target) => { const relative = path.relative(base,target); return relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative); };
  if (!file || !path.isAbsolute(file) || !outside(path.resolve(repo),path.resolve(file)) || !outside(fsApi.realpathSync(repo),fsApi.realpathSync(path.dirname(file)))) throw new Error("Credenziali: richiesto percorso privato esterno al repository");
}
function randomPassword() {
  let value;
  do { value = randomBytes(24).toString("base64url"); } while (!strongDemoPassword(value));
  return value;
}
function demoDataset() {
  const users = [{ username: ADMIN, fullName: "Presentatore Showcase", role: "admin", isActive: true, geolocationEnabled: true, email: "presentatore@example.invalid" }];
  for (let i=1;i<=15;i++) users.push({ username: `showcase_user${String(i).padStart(2,"0")}`, fullName: `Dipendente Demo ${String(i).padStart(2,"0")}`, role: "user", isActive: true, geolocationEnabled: true, email: `demo${i}@example.invalid` });
  const records = [], leaves = [];
  const at = (date,time) => dayjs.tz(`${date} ${time}`, "YYYY-MM-DD HH:mm", APP_TZ).toDate();
  for (let date="2026-10-19";date<="2026-11-12";date=dayjs.utc(date).add(1,"day").format("YYYY-MM-DD")) {
    if ([0,6].includes(dayjs.utc(date).day())) continue;
    for (const [i,user] of users.slice(1).entries()) {
      if (date === "2026-11-10" && i === 1) {
        leaves.push({ username: user.username, type: "ferie", date: at(date,"00:00"), startDate: at(date,"00:00"), endDate: at(date,"00:00"), status: "approved", note: "Assenza dimostrativa" }); continue;
      }
      const clockIn = at(date,"08:30"), clockOut = at(date,"17:30");
      const breaks = [{ startAt: at(date,"12:30"), endAt: at(date,"13:00"), startMode: "office", endMode: "office" }];
      if (i % 3 === 0) breaks.push({ startAt: at(date,"15:00"), endAt: at(date,"15:15"), startMode: "office", endMode: "office" });
      records.push({ username: user.username, clockIn, clockOut, breaks, status: "closed", durationSec: calculateWorkDuration({clockIn,clockOut,breaks}).durationSec });
    }
  }
  // Keep User01 free for live clocking; one other profile illustrates manual approval.
  const pending = records.find(row => row.username === "showcase_user15" && dayjs(row.clockIn).tz(APP_TZ).format("YYYY-MM-DD") === "2026-11-12");
  pending.manualClosureRequest = { proposedClockOut: pending.clockOut, requestedAt: pending.clockOut, note: "Uscita dimenticata (scenario fittizio)" };
  pending.clockOut = null; pending.status = "pending_manual_closure"; pending.durationSec = 0;
  leaves.push({ username: "showcase_user03", type: "pir", date: at("2026-11-18","00:00"), status: "pending", hours: 3, note: "Richiesta dimostrativa" });
  return { users, records, leaves };
}
async function populateNewDatabase(db, dataset, passwords, hashPassword, assertTarget = async () => {}) {
  // Refuse even empty pre-existing collections. Never drop, delete, update or reset user data.
  if ((await db.listCollections({}, { nameOnly: true }).toArray()).length) throw new Error("Database non nuovo: seed bloccato");
  await assertTarget();
  await db.createCollection("_showcase_guard"); // Atomic claim: concurrent/repeated seeds cannot proceed.
  const collections = await db.listCollections({}, {nameOnly:true}).toArray();
  if (collections.length !== 1 || collections[0].name !== "_showcase_guard") throw new Error("Creazione concorrente rilevata: seed interrotto");
  await assertTarget();
  await db.collection("_showcase_guard").insertOne({ _id: PURPOSE, state: "initializing", createdAt: new Date() });
  const { ObjectId } = require("mongoose").mongo;
  const ids = new Map(dataset.users.map(user => [user.username, new ObjectId()]));
  const users = await Promise.all(dataset.users.map(async user => ({ ...user, _id: ids.get(user.username), password: await hashPassword(passwords[user.username],12) })));
  await assertTarget();
  await db.collection("users").createIndex({ username: 1 }, { unique: true });
  await assertTarget();
  await db.collection("appsettings").createIndex({key:1},{unique:true});
  await assertTarget();
  await db.collection("timerecords").createIndex({user:1,clockIn:-1});
  await assertTarget();
  await db.collection("timerecords").createIndex({user:1,clockOut:1,status:1,clockIn:-1});
  await assertTarget();
  await db.collection("users").insertMany(users);
  const records = dataset.records.map(({username,...row}) => ({...row,user:ids.get(username)}));
  await assertTarget();
  await db.collection("timerecords").insertMany(records);
  await assertTarget();
  await db.collection("leaverequests").insertMany(dataset.leaves.map(({username,...row})=>({...row,user:ids.get(username)})));
  await assertTarget();
  await db.collection("appsettings").insertOne({key:"global",leaveMinAdvanceDays:2,leaveNotificationEmails:[]});
  await assertTarget();
  await db.collection("timerecordlocks").createIndex({lockedUntil:1});
  await assertTarget();
  await db.collection("_showcase_guard").updateOne({_id:PURPOSE,state:"initializing"},{$set:{state:"ready",completedAt:new Date()}});
  return {users:users.length,records:records.length,leaves:dataset.leaves.length};
}
module.exports = { assertCredentialsPath, assertSeedConfig, randomPassword, demoDataset, populateNewDatabase };
