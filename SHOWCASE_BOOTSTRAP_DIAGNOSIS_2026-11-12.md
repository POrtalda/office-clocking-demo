# Bootstrap Render — diagnosi e correzione mirata, 12 novembre 2026

## Fatti verificati e limite della diagnosi

Servizio demo indicato dall’utente: srv-d7tn3breo5us738b14ag. Commit pubblicato 86497daf66744395a9185c2881a8bc838ca480ba, branch prepare/showcase-20261113, root backend, npm ci, Node 22.23.5, Start node scripts/startRemoteShowcase.js. L’agente non ha interrogato/modificato Environment Render, non ha eseguito deploy/push/seed.

L’utente ha confermato tutti i 16 nomi di variabili e che i tre OFFICE_* sono valorizzati: NON attribuire il blocco a campi mancanti/vuoti. Valori effettivi e Environment Groups remoti non ispezionati: nomi presenti non provano validità di URI, JWT, origin, flag, sede/raggio o assenza di SMTP ereditate.

Il catch del vecchio bootstrap scarta la causa in QUALSIASI fase. Quel messaggio non identifica la causa remota e non dimostra che fallisca il marker o il GPS. Nessuna correzione di variabili alla cieca. Verifica locale del nuovo --diagnose con runtime privato e senza HTTP: `atlas-connect / TLS_FAILURE`. È una connessione dal PC, NON da Render: non prova che il guasto Render sia TLS. Nessuna verifica TLS disattivata e nessun certificato/URI/segreto stampato. Il precedente ready/populamento rimane un riscontro valido, non una garanzia di raggiungibilità attuale da ogni rete.

Node 22.23.5 soddisfa il vincolo del pacchetto Mongoose installato (>=20.19.0); nessuna prova di incompatibilità con quella versione. Test locali eseguiti con il Node disponibile sul PC, non simulano il runtime Linux/patch esatto di Render.

## Correzione locale

- Bootstrap registra SOLO `{stage,category}` per successi/errore; niente messaggi grezzi, stack, nomi file privati, URI, JWT, valori env o indirizzi.
- Fasi arguments, configuration, port, driver-load, atlas-connect, marker-read, app-load, http-listen, atlas-disconnect e shutdown. Classifica variabile mancante/flag errato, JWT/origini/sede, SMTP non consentite, destinazione Atlas errata, DNS/TLS/timeout/autenticazione/privilegi, marker assente/non ready, import dipendenza e bind porta.
- `--check`: validazione offline incluse PORT e tutte le regole precedenti, prima di caricare MongoDB/app. `--diagnose`: connessione sola lettura, controllo esatto marker e caricamento app, poi disconnessione, NESSUN listen. Mantiene autoIndex/autoCreate false: nessuna creazione collezioni/indici, nessuna modifica marker.
- Errori asincroni di listen vengono intercettati; errori di cleanup non mascherano la causa iniziale. Log di origini disabilitati solo nel profilo Showcase; gli altri ambienti restano invariati.
- Classificatore Mongo sicuro estratto in utils/safeMongoError.js, riutilizzato dal diagnostico esistente senza modificarne l’output o le protezioni. Nessuna nuova dipendenza o variabile obbligatoria.
- Invariati isolamento DB, profilo DEMO remoto, JWT, email bloccate, GPS esplicito e requisiti sede/raggio, origin/HTTPS esatti e marker ready. Nessun fallback di avvio o bypass introdotto.

## Diagnosi immediata sul codice GIÀ pubblicato, senza push/deploy

Se la Shell del SOLO servizio demo è disponibile e l’operatore autorizza la lettura, eseguire dalla root backend il blocco seguente. È autosufficiente per il commit 86497da: legge le variabili del processo, valida la destinazione esatta, connette in sola lettura al runtime, legge solo il marker, carica l’app senza HTTP, disconnette e restituisce soltanto fase/categoria. Non legge file privati Windows e non salva file sul servizio. Non altera i valori cloud o il DB.

**NON usare `startRemoteShowcase.js --diagnose` sul vecchio commit 86497da:** quel codice non supporta il flag e potrebbe tentare l’avvio normale. Usare il blocco seguente oppure, dopo trasferimento/deploy esplicitamente autorizzati, il nuovo flag.

```sh
node <<'NODE'
const mongoose = require("mongoose");
const { assertRemoteShowcaseConfig, DATABASE, PURPOSE } = require("./utils/remoteShowcase");
const { safeError } = require("./scripts/diagnoseRemoteShowcase");
const print = console.log.bind(console);
console.log = console.warn = console.error = () => {};
const required = ["APP_ENV","NODE_ENV","DEMO_MODE","DEMO_LOCAL_GPS_BYPASS","GEOLOCATION_CLOCK_IN_ENABLED","SHOWCASE_EMAIL_MODE","SHOWCASE_ADMIN_USERNAME","CLIENT_URL","SHOWCASE_API_URL","SHOWCASE_ATLAS_HOST","MONGO_URI","JWT_SECRET","OFFICE_LAT","OFFICE_LNG","OFFICE_RADIUS_METERS"];
const flags = { APP_ENV:"showcase", NODE_ENV:"production", DEMO_MODE:"true", DEMO_LOCAL_GPS_BYPASS:"false", GEOLOCATION_CLOCK_IN_ENABLED:"true", SHOWCASE_EMAIL_MODE:"disabled", SHOWCASE_ADMIN_USERNAME:"showcase_admin" };
const fail = category => { throw { safeCategory:category }; };
(async () => {
  let stage = "configuration", result;
  try {
    for (const key of required) if (!process.env[key]) fail("MISSING_" + key);
    for (const [key,value] of Object.entries(flags)) if (process.env[key] !== value) fail("INVALID_" + key);
    assertRemoteShowcaseConfig();
    if (DATABASE !== "office_clocking_showcase_20261113" || process.env.SHOWCASE_ATLAS_HOST !== "showcasecluster.xed8r0t.mongodb.net") fail("TARGET_MISMATCH");
    const port = Number(process.env.PORT || 10000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) fail("PORT_INVALID");
    mongoose.set("autoIndex", false); mongoose.set("autoCreate", false);
    stage = "atlas-connect";
    await mongoose.connect(process.env.MONGO_URI, { dbName:DATABASE, autoIndex:false, autoCreate:false, maxPoolSize:1, serverSelectionTimeoutMS:10000 });
    stage = "marker-read";
    const marker = await mongoose.connection.db.collection("_showcase_guard").findOne({ _id:PURPOSE }, { projection:{ _id:0, state:1 } });
    if (!marker) fail("MARKER_MISSING");
    if (marker.state !== "ready") fail("MARKER_NOT_READY");
    stage = "app-load"; require("./app");
    result = { stage:"diagnostic-complete", category:"READY_TO_LISTEN" };
  } catch (error) {
    let category = error.safeCategory;
    if (!category && stage === "configuration") {
      // Match fixed old-validator text internally; NEVER print the error message.
      category = [
        [/origini HTTPS/, "ORIGINS_INVALID"], [/chiave JWT/, "JWT_SECRET_INVALID"],
        [/SMTP/, "SMTP_NOT_ALLOWED"], [/Atlas|database remoto/, "ATLAS_TARGET_INVALID"],
        [/sede reale|raggio/, "OFFICE_LOCATION_INVALID"], [/flag GPS/, "GPS_FLAG_INVALID"]
      ].find(([pattern]) => pattern.test(error.message || ""))?.[1] || "CONFIGURATION_INVALID";
    }
    if (!category) category = stage === "app-load" ? (error.code === "MODULE_NOT_FOUND" ? "DEPENDENCY_MISSING" : "APP_IMPORT_FAILED") : safeError(error).category;
    result = { stage, category };
    process.exitCode = 1;
  } finally { try { await mongoose.disconnect(); } catch {} }
  print(JSON.stringify(result));
})().catch(() => { print(JSON.stringify({ stage:"diagnostic", category:"DIAGNOSTIC_FAILED" })); process.exitCode = 1; });
NODE
```

Interpretazione: configuration -> correggere soltanto il requisito indicato dopo verifica privata; atlas-connect -> rete/TLS/auth dal servizio; marker-read/PERMISSION_DENIED -> privilegi runtime sul SOLO DB; MARKER_* -> controllare destinazione/marker senza seed; app-load -> dipendenze/import; READY_TO_LISTEN -> prerequisiti validi, resta da diagnosticare bind/gestione processo o differenza fra env Shell e processo fallito. Non inferire che READY_TO_LISTEN provi il funzionamento del proxy o un bind già eseguito.

Condividere soltanto il JSON safe. Se la Shell non è disponibile, non tentare deploy alla cieca: preparare il singolo commit diagnostico e autorizzare separatamente il suo trasferimento e la pubblicazione. L’agente non ha eseguito questo blocco su Render.

## Proxy HTTPS Render

Il server deve ascoltare HTTP su 0.0.0.0 e PORT fornita dalla piattaforma (default 10000), non creare un server TLS interno. Il codice già lo fa. Express mantiene trust proxy=1; il profilo remoto usa req.secure/hostname e origin esatti. /healthz è montata prima del guard HTTPS e risponde 200 soltanto con Mongoose connesso, 503 altrimenti: non richiede header browser/proxy alle probe interne. Test aggiunti per HTTPS inoltrato, diniego http/host estraneo e probe HTTP. Nessun allargamento trust proxy o CORS.

Un errore del guard HTTPS non può da solo spiegare un fallimento PRECEDENTE al listen: viene eseguito sulle richieste successive. Restano da verificare gli header reali di Render, non simulati come osservazione cloud.

Fonti: https://render.com/docs/web-services , https://render.com/docs/health-checks , https://expressjs.com/en/guide/behind-proxies/ .

## Trasferire SOLO la correzione, senza storia del progetto principale

Il commit locale di questa correzione va trasferito come patch singola nel clone indipendente C:\Office-Clocking\office-clocking-demo-publish-20261111. Non cambiare origin della sorgente. Dopo il commit, creare `git format-patch -1 COMMIT_FIX -o C:\Office-Clocking\showcase-bootstrap-transfer-20261112` e annotare SHA/filename. La patch non contiene env o segreti.

Nel clone verificare origin esatto https://github.com/POrtalda/office-clocking-demo.git, stato pulito, branch prepare/showcase-20261113 e HEAD 86497daf66744395a9185c2881a8bc838ca480ba. Se differente, fermarsi e rivalutare il delta; non resettare main o modifiche locali. Applicare in futuro soltanto quella patch con `git am -- PERCORSO_PATCH`, poi controlli test/build/diff. Non fare cherry-pick di tutti i commit sorgente e non trasferire .env, credenziali o output build.

L’applicazione al clone e ogni push/deploy sono passi separati da autorizzare; nessuno di questi viene eseguito in questo intervento. Render Auto-Deploy deve rimanere OFF; nessun merge main/PR Netlify involontario. La patch fornisce visibilità sulla causa, non autorizza una ripartenza senza revisione dell’esito diagnostico. Seed già completato: non ripeterlo.


## Verifiche finali effettive

- Suite backend completa: **44 suite / 456 test superati** (`--testTimeout=15000` per il caricamento a freddo locale); inclusi diagnostico storico e recupero, config invalida, TLS/DNS/auth annidati, marker e privilegi, app import, listen asincrono e proxy/health.
- Prima esecuzione mirata: corretti difetti dei nuovi mock (isolamento flag opzionale e getter Mongoose non configurabile); un hook a freddo ha superato il timeout Jest predefinito. Nessuna regola o timeout applicativo modificato. La suite finale è interamente verde.
- ESLint frontend e build Showcase HTTPS/PWA superati. Nessun file frontend modificato.
- Runtime privato attuale: nuovo `--check` -> configuration / CONFIGURATION_VALID; file privato invariato. Nuovo `--diagnose` dal PC -> atlas-connect / TLS_FAILURE, nessun listen, scrittura o disabilitazione TLS. Non è una prova del guasto Render.
- Sintassi del blocco Render Shell verificata con `node --check`, senza eseguirlo su Render. `git diff --check` superato.
- Nessun seed, push, merge, deploy, cambio env/credenziali, modifica dati o altri servizi. Il clone di pubblicazione rimane al commit 86497da; verrà eseguito soltanto `git apply --check` della patch per provarne l’applicabilità senza applicarla.
