# Office Clocking — preparazione Showcase online


> **Decisione aggiornata — sostituzione della demo pubblica.** Il repository di pubblicazione è **POrtalda/office-clocking-demo**, con main collegato a entrambi i servizi e auto-deploy Render attivo (conferma dell’utente). Il repository principale POrtalda/office_clocking è escluso da modifiche/pubblicazione. Il piano operativo attivo è [SHOWCASE_PUBLIC_REPLACEMENT_2026-11-11.md](SHOWCASE_PUBLIC_REPLACEMENT_2026-11-11.md): mantenere office-clocking-demo.netlify.app e riutilizzare il Render demo solo dopo verifica dell'isolamento da Cliente 1. Atlas rimane nuovo. Le parti qui sotto che prevedono due nuovi servizi sono l'alternativa iniziale, non istruzioni da applicare al sito esistente. Nessuna azione cloud è stata eseguita.

Stato: preparato localmente, **non pubblicato**. Branch `feature/demo-november-showcase`, base `2341fd46ac68c13b4e7166a93d6fe9df5ca373ef`. Destinazione: presentazione del 13 novembre 2026.

Nessun servizio creato, nessuna connessione a database reale, nessun seed eseguito e nessuna email inviata. Nessun push, merge, deploy o nuovo commit effettuato in questo intervento. Le procedure sotto sono per una fase futura autorizzata.

## Separazione effettiva

| Risorsa | Nuovo Showcase | Ambienti esistenti |
| --- | --- | --- |
| Frontend | piano attivo: stesso sito office-clocking-demo.netlify.app; output `frontend/dist-showcase` | `dist`, configurazione Vite normale e icone attive conservati |
| Backend | piano attivo: Render demo esistente solo dopo verifica ID/isolamento; bootstrap `scripts/startRemoteShowcase.js` | `server.js` e launcher locale conservati |
| Database | nuovo progetto e cluster Atlas; nome esatto `office_clocking_showcase_20261113` | nessun import, migrazione o accesso al locale V2 o ad altri DB |
| Credenziali | nuova chiave JWT, nuovi utenti Atlas, password casuali generate al seed | nessuna credenziale di produzione o password locale riutilizzata |
| Configurazione | `deploy/showcase/render.yaml`, `netlify.toml`, `variables.example.txt` | nessun file Netlify/Render esistente trovato nel repository; nessuna impostazione cloud verificata o cambiata |

La destinazione attuale confermata è **POrtalda/office-clocking-demo**, main collegato a Netlify e Render. Non usare o cambiare origin di questo worktree (POrtalda/office_clocking). Il piano attivo prevede un futuro checkout isolato del repository demo e il trasferimento del solo snapshot revisionato, senza la cronologia del progetto principale. Nessun aggiornamento di main prima di backend, nuovo Atlas, configurazioni e collaudo pronti; Render On Commit è attivo secondo verifica dell’utente. Seguire i gate del documento di sostituzione, non il percorso alternativo iniziale riportato sotto.

## Policy remota

- Attivazione esplicita: `APP_ENV=showcase`, `NODE_ENV=production`, `DEMO_MODE=true`. Il bootstrap dedicato rifiuta profili incompleti prima della connessione. I controlli aggiunti non si applicano agli altri ambienti.
- Atlas: solo `mongodb+srv`, credenziali presenti, host uguale a `SHOWCASE_ATLAS_HOST`, suffisso `.mongodb.net`, DB remoto fisso. Opzioni URI consentite: `retryWrites=true`, `w=majority`, `authSource=admin`. TLS non disattivabile. Nessun fallback a `MONGO_URI` locale nel seeder.
- Avvio API: niente creazione automatica di collezioni/indici. Serve il marker `_showcase_guard` con finalità corretta e stato `ready`, scritto solo al completamento del nuovo seed. Un database vuoto o un seed incompleto non viene servito.
- Browser: due origini HTTPS distinte ed esatte. `CLIENT_URL` è una sola origine, senza wildcard, liste o percorsi. Scritture senza quell'Origin rifiutate; tutte le API richiedono l'host HTTPS previsto dietro il proxy Render. `/healthz` è la sola eccezione di readiness per le sonde interne: nessun dato utente, 503 se Mongoose non è connesso.
- JWT: nuova chiave casuale dedicata, HS256 esplicito, issuer Showcase, audience pari al nuovo frontend, scadenza un'ora. Nessun refresh token. Ogni richiesta autenticata rilegge utente attivo, username e ruolo: disattivazione/cambio ruolo revocano la sessione. Token degli ambienti precedenti non sono accettati.
- Admin: solo `showcase_admin`, password privata al presentatore. Creazione/modifica/cancellazione account, impostazioni e politica GPS bloccate anche lato server, inclusi alias maiuscoli delle route Express. Restano dimostrabili letture, riepiloghi, CSV, approvazioni e correzioni autorizzate. I relativi pulsanti di gestione account/impostazioni sono disabilitati nell'interfaccia remota.
- Login: password remote di almeno 24 caratteri, chiavi generate con 24 byte casuali (32 caratteri base64url) e hash bcrypt costo 12. Il seeder genera una password diversa per ogni account. Il selettore con autofill/password locale è assente dalla build remota e `/api/demo/login-users` restituisce 404 nel remoto. Le credenziali si distribuiscono privatamente, non nel sito o in chat.
- Tentativi: limite username esistente 10/10 minuti; remoto aggiunge 30/10 minuti per IP, oltre al limite API generale. Header Retry-After e risposta 429. Distribuire **una sola istanza**: i contatori sono in memoria e si azzerano al riavvio. Per più istanze o un servizio pubblico duraturo serve uno store condiviso/WAF; non è stato aggiunto Redis.
- GPS: `DEMO_LOCAL_GPS_BYPASS=false` obbligatorio. Per impostazione predefinita, in sede serve posizione reale validata rispetto alla sede, anche se un utente ha `geolocationEnabled=false`. La sola istanza Showcase può autorizzare esplicitamente l’esenzione descritta nella sezione “GPS remoto: autorizzazione esplicita” in fondo al documento. Fuori sede è una scelta esplicita con motivazione obbligatoria, distinta dalla DEMO locale. Nel frontend remoto la scelta vale anche per inizio/fine pausa. Non si generano coordinate: posizione assente resta nulla. Configurare la sede reale della presentazione, raggio massimo 1000 m. Non impostare un raggio enorme per simulare un'esenzione.
- Email: `SHOWCASE_EMAIL_MODE=disabled`; il bootstrap rifiuta qualsiasi variabile SMTP valorizzata. `sendEmail` blocca comunque l'invio remoto prima di creare un trasporto, anche con destinatari esterni o SMTP inserito per errore. I dati sintetici usano solo `@example.invalid`; le impostazioni partono con destinatari vuoti. Nessuna simulazione di consegna email nella UI.
- Frontend: `envDir:false` esclude i `.env` locali dalla build remota. Solo `VITE_API_URL` pubblico; le altre variabili VITE sono limitate ai flag noti. URI Atlas, JWT e SMTP non devono avere prefisso VITE. Output separato e ignorato da Git; controllo automatico di password locale semplice, endpoint API locale e marker di chiavi private nei JS compilati.
- PWA: nel piano iniziale il nuovo origin separava storage e service worker. Nel piano attivo di riuso lo stesso origin conserva cache/sessioni precedenti: seguire la procedura specifica nel documento di sostituzione. Asset attuali conservati, proposta icona non applicata. API NetworkOnly, navigazioni `/api/` senza fallback HTML; `_redirects` impedisce di trattare l'API come SPA sul frontend. `_headers` imposta CSP con il solo backend configurato, no framing, no sniffing, no referrer, worker same-origin e no-cache per service worker/HTML/manifest. Robots/noindex limitano l'indicizzazione, **non** costituiscono autenticazione.
- Il token frontend resta in localStorage come nell'app esistente: su browser condivisi eseguire logout e chiudere la sessione. CSP riduce il rischio XSS, ma non equivale a cookie HttpOnly o MFA. Non presentare questa demo come un portale di produzione per dati personali reali.

## Segreti e configurazione

Usare `deploy/showcase/variables.example.txt` come elenco, non come configurazione pronta. I placeholder sono intenzionalmente invalidi. Nessun file `.env` viene aggiunto a Git.

| Variabile | Dove | Valore richiesto |
| --- | --- | --- |
| `APP_ENV`, `NODE_ENV` | Render | `showcase`, `production` |
| `DEMO_MODE`, `DEMO_LOCAL_GPS_BYPASS` | Render | `true`, `false` |
| `GEOLOCATION_CLOCK_IN_ENABLED` | Render | `true` |
| `SHOWCASE_EMAIL_MODE` | Render | `disabled` |
| `SHOWCASE_ADMIN_USERNAME` | Render | `showcase_admin` |
| `CLIENT_URL` | Render | nuovo origin Netlify HTTPS esatto |
| `SHOWCASE_API_URL` | Render | nuovo origin Render HTTPS esatto |
| `SHOWCASE_ATLAS_HOST` | Render e seed privato | host del solo nuovo cluster, in minuscolo |
| `MONGO_URI` | solo Render / verifica runtime privata | URI del nuovo utente runtime, DB remoto esatto |
| `JWT_SECRET` | solo Render / verifica runtime privata | almeno 32 byte casuali in hex, diversi da ogni altro ambiente |
| `OFFICE_LAT`, `OFFICE_LNG`, `OFFICE_RADIUS_METERS` | Render | sede reale e raggio 1–1000 metri |
| `PORT` | Render | fornita dalla piattaforma; default 10000 |
| `VITE_API_URL` | solo build frontend | origin HTTPS del nuovo Render, niente `/api` finale |
| `SHOWCASE_SEED_URI` | solo file privato operatore | URI di un diverso utente Atlas temporaneo |
| `SHOWCASE_SEED_CONFIRM` | solo seed | `office-clocking-remote-20261113` |
| `SHOWCASE_CREDENTIALS_FILE` | solo seed | percorso assoluto privato esterno al repository |

Generare la chiave JWT nel password manager o con un generatore crittografico di 32 byte; conservarla nel secret manager del **nuovo** servizio. Non stamparla nei log di deploy. Non condividere file runtime con il frontend.

## Procedura iniziale con nuovi servizi — alternativa, non piano attivo di sostituzione

1. **Autorizzazione e snapshot.** Revisionare questo diff e fissare una revisione nuova che comprenda queste modifiche. Il commit base del 2341fd4, da solo, non contiene la preparazione remota. Preparare il nuovo repository privato senza pubblicare segreti, backup o build; non usare il vecchio servizio/sito come destinazione. Questa fase non è stata eseguita.
2. **Nuovo Atlas.** Creare un progetto Atlas separato e un nuovo cluster nella regione scelta; non caricare sample dataset e non creare preventivamente collezioni nel database target. Il nome del database è fisso. Creare un utente runtime con `readWrite` **solo** su `office_clocking_showcase_20261113`, senza privilegi su altri DB. Creare un diverso utente seed temporaneo con `readWrite` e `dbAdmin` solo sullo stesso DB, necessari a collezioni e indici. Non usare account Atlas di altri progetti.
3. **Rete Atlas.** Inserire gli intervalli outbound del solo nuovo servizio Render e temporaneamente l'IP della postazione seed. Non usare `0.0.0.0/0` o accesso indiscriminato. Gli intervalli Render sono condivisi per regione: non sostituiscono credenziali uniche e privilegi minimi. Rimuovere IP e utente seed al termine.
4. **Nuovi URL.** Creare un nuovo sito Netlify con nome univoco, ad esempio `office-clocking-showcase-20261113`, e un nuovo servizio Render. I nomi di esempio non sono stati prenotati: usare gli URL realmente assegnati. Per Render selezionare il Blueprint path `deploy/showcase/render.yaml` nel nuovo repository, oppure replicarne manualmente i valori. Non sincronizzare un Blueprint esistente. Controllare piano a pagamento, singola istanza, `autoDeployTrigger: off`, root backend, build `npm ci`, start `node scripts/startRemoteShowcase.js`, health `/healthz`. L'avvio rimarrà bloccato finché non sarà completato il seed; è atteso.
5. **Configurare segreti e GPS.** Compilare soltanto l'ambiente del nuovo Render dalla tabella. Non aggiungere SMTP o variabili seed. Verificare host Atlas, nome DB, i due origin HTTPS, chiave JWT nuova e posizione reale. Per un controllo offline usare da backend un file runtime privato esterno al repository con `node --env-file=C:\Office-Clocking-Secrets\showcase-runtime.env scripts/startRemoteShowcase.js --check`: nessuna connessione DB. Le variabili già ereditate dalla shell prevalgono sui file Node: usare un terminale pulito, non una shell di produzione.
6. **Seed del nuovo Atlas, una sola volta.** Preparare privatamente `C:\Office-Clocking-Secrets\showcase-seed.env` con i cinque valori del seed della tabella e `APP_ENV=showcase`. Non deve esserci `MONGO_URI` nell'ambiente seed; lo script lo rifiuta. Proteggere la directory con ACL riservate all'operatore su Windows: `mode:0600` non sostituisce le ACL Windows. Scegliere un nuovo nome per il file password, non esistente, fuori dal repository e da cartelle sincronizzate. Controllare il piano offline con `npm run showcase:plan` (nessuna connessione o password prodotta). Solo dopo controllo visivo del nuovo cluster/DB e autorizzazione eseguire da backend:

   ```powershell
   node --env-file=C:\Office-Clocking-Secrets\showcase-seed.env scripts/seedRemoteShowcase.js --apply --confirm-new-atlas
   ```

   Questa istruzione **non è stata eseguita**. Il seed genera 16 account, timbrature e assenze sintetiche in Europe/Rome, pause coerenti e destinatari vuoti. Nessuna copia o esportazione dal locale V2. Le password casuali vanno solo nel file privato creato con flag esclusivo `wx`, mai in console o nel DB in chiaro. Rifiuta qualunque collezione già presente, anche vuota; usa una collezione guardia creata atomicamente per fermare doppie esecuzioni. Non fa drop/delete/reset. Se interrotto, lascia il marker incompleto e il backend resta bloccato: non rilanciare sul database parziale e non cancellarlo automaticamente; verificare con l'operatore e predisporre un ulteriore cluster nuovo se serve ripartire da zero. Revocare poi l'utente seed e rimuovere il suo accesso di rete.
7. **Avviare soltanto il nuovo Render.** L'app legge il marker pronto prima di ascoltare. Verificare `/healthz` 200 e `ready:true`; rifiuti HTTPS/CORS non devono essere aggirati modificando i controlli. Le sonde interne possono raggiungere `/healthz` senza headers browser, le API no. Non usare `npm start` o il launcher DEMO locale come comando Render.
8. **Build frontend dedicata.** Nel progetto frontend, in una shell priva di variabili VITE di altri ambienti:

   ```powershell
   $env:VITE_API_URL = 'https://URL-REALE-DEL-NUOVO-SHOWCASE.onrender.com'
   npm ci
   npm test
   npm run lint
   npm run build:showcase
   ```

   Caricare **solo** `frontend/dist-showcase` sul nuovo sito Netlify tramite deploy manuale. Non caricare `dist`, il repository intero o `backend`. Il sito deve leggere `_headers` e `_redirects` generati. `deploy/showcase/netlify.toml` è una configurazione separata di riferimento: Netlify non la scopre automaticamente nella sottocartella. Per un futuro sito Git-based impostare esplicitamente base `frontend`, comando `npm run build:showcase`, publish `dist-showcase`, Node 22 e la sola variabile pubblica `VITE_API_URL`, esclusivamente nelle impostazioni del nuovo sito; disabilitare pubblicazioni automatiche e preview non revisionate. Non spostare il file in una posizione che cambi i siti esistenti.
9. **Collaudo HTTPS vero e inviti.** Eseguire la checklist sotto prima di condividere il link; consegnare a ciascun partecipante soltanto la password del suo profilo. Tenere `showcase_admin` esclusivamente al presentatore. Il frontend statico è raggiungibile pubblicamente ma tutti i dati sono protetti dalle API: se occorre proteggere anche la pagina di login, valutare un access gate separato offerto dal piano, senza mettere segreti nel bundle.

## Collaudo da eseguire dopo il deploy (non simulato)

- Verificare TLS valido sui due nuovi origin, assenza mixed content, headers CSP/robots/cache e nessuna richiesta a 127.0.0.1, vecchie demo o Cliente 1. Confermare `auto-deploy` disattivato e ID dei soli nuovi servizi.
- Login con un nuovo utente e con il presentatore; rifiuto della password locale semplice. Elenco autofill remoto 404. `/api/auth/me`, refresh, logout, scadenza/revoca token; nessun token in URL o log.
- CORS: preflight dall'origine esatta riuscito; origine diversa e POST senza Origin rifiutati. CORS non è autenticazione: le route protette richiedono sempre Bearer valido. Non indebolire policy per consentire preview arbitrarie.
- Con `SHOWCASE_GPS_CHECK_DISABLED` assente/false: assenza GPS in sede causa errore, senza timbratura. Scelta esplicita fuori sede senza motivazione: errore. Con motivazione: entrata → inizio pausa → fine pausa → uscita, con GPS nullo e motivo nei dettagli. Il profilo User01 parte libero. User15 illustra una chiusura manuale pendente storica: non sceglierlo per una nuova entrata prima della revisione.
- Con esenzione remota disattivata, in sede: posizione vera del dispositivo e autorizzazione GPS, controllo raggio; provare anche fuori raggio. Nessuna coordinata sintetica o esenzione personale deve consentire una timbratura in sede.
- Home User, Storico, Home Admin e CSV: stessa durata netta, pause multiple, giorno Rome, presenze attivi/non Admin. Per gli esempi storici selezionare 12 novembre 2026. Admin: letture e approvazioni consentite, gestione account/impostazioni bloccata.
- Assenze ferie/PIR/malattia salvate solo sul nuovo Atlas; nessuna email consegnata e nessuna configurazione SMTP. Non usare destinatari reali per il collaudo.
- Desktop e mobile reale: login, orologio, sezioni e tema per account. Installazione PWA sul nuovo origin, aggiornamento con consenso, API mai disponibili da cache offline. La PWA non rende possibili timbrature offline.
- Rate limit in una finestra controllata: 429 e Retry-After; attendere lo sblocco. Non stressare IP condivisi dei partecipanti subito prima della presentazione. Con molte persone dietro lo stesso NAT il limite per IP può intervenire.

## Costi e limiti (fonti consultate l'11 novembre 2026)

- **Render:** previsto un servizio sempre acceso Starter, alias del piano 0.5c-512mb, circa 7 USD/mese di compute; verificare preventivo, workspace, traffico e imposte in console. Il Free sospende dopo 15 minuti inattivi, con cold start e limiti mensili: per la presentazione è preferibile il piano sempre acceso. [Prezzi](https://render.com/pricing), [piani compute](https://render.com/docs/compute-plans), [limiti Free](https://render.com/docs/free).
- **Netlify:** Free comprende 300 crediti/mese; Personal circa 9 USD/mese e Pro da 20 USD/mese, con soglie/crediti e possibili ricariche. Verificare consumi di deploy, richieste e traffico; evitare ricariche automatiche non deliberate. Il piano gratuito può bastare al volume della demo, senza garanzia che il budget non venga consumato. [Prezzi ufficiali](https://www.netlify.com/pricing/), [crediti](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/).
- **Atlas:** M0 gratuito, 512 MB, risorse condivise; Flex indicativamente 8–30 USD/mese secondo uso. Limiti, backup e disponibilità effettiva dipendono dal tier/regione e possono cambiare: controllare il nuovo progetto prima dell'acquisto, senza assumere che un backup gestito sia disponibile. Nessun piano o servizio è stato acquistato. [Prezzi](https://www.mongodb.com/pricing), [limiti Free](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/).

Budget orientativo minimo per un mese: circa 7 USD con Render sempre acceso, Netlify Free e Atlas M0, prima di imposte/traffico ed eventuali piani workspace. Con Atlas Flex e Netlify Personal, circa 24–46 USD/mese prima degli extra. Sono stime di preparazione, non un preventivo vincolante.

Riferimenti operativi: [Blueprint Render](https://render.com/docs/blueprint-spec), [IP outbound Render](https://render.com/docs/outbound-ip-addresses), [IP access list Atlas](https://www.mongodb.com/docs/atlas/security/ip-access-list/), [configurazione Netlify](https://docs.netlify.com/build/configure-builds/file-based-configuration/).

## Rollback del piano iniziale con nuovi servizi

- Registrare ID e URL dei nuovi sito, servizio, progetto/cluster e revisione distribuita in un registro privato. Non includere password o URI con credenziali nel registro versionato.
- Se una build fallisce, il nuovo sito non va pubblicato. Se dopo il deploy emerge un problema, ripristinare solo l'ultimo deploy valido del nuovo sito o la sua pagina di manutenzione, e sospendere solo il nuovo Render. Un rollback frontend/backend non ripristina automaticamente i dati.
- Non fare rollback del backend remoto al commit locale 2341fd4: non contiene la policy remota. Usare esclusivamente revisioni che includono questo profilo e che siano compatibili con lo schema. Per il piano attivo la sola vecchia demo può essere sostituita dopo i gate di verifica e autorizzazione; Cliente 1 resta escluso.
- In caso di credenziali esposte: sospendere il nuovo backend, ruotare JWT e sole credenziali Atlas Showcase; invalidare utenti compromessi tramite operatore autorizzato. La rotazione JWT invalida tutte le sessioni. Non intervenire sulle chiavi di altri progetti.
- Nessuna procedura automatica elimina, rigenera o ripristina il DB. Conservare il nuovo database per analisi; un eventuale futuro recupero o smantellamento richiede un'operazione separata e autorizzata. Backup, costi di conservazione e retention vanno definiti prima di lasciare il servizio online oltre la presentazione.

## Blocchi e limiti attuali

Per il piano attivo sono noti URL pubblici e repository/branch dichiarati dall’utente; mancano ancora site ID/service ID, verifica isolamento Render da Cliente 1, cluster e utenti Atlas nuovi, JWT dedicata, posizione della sede, seed e credenziali dei partecipanti. Non sono errori da aggirare: richiedono la fase esterna autorizzata. Non è stato effettuato un collaudo browser su HTTPS pubblico, né validazione provider-side del Blueprint, verifica fatturazione reale, IP effettivi o test su smartphone fisico. I test HTTP locali simulano gli header di un reverse proxy HTTPS; non attestano certificati, DNS o comportamento delle piattaforme live.

La policy tecnica rimane valida; il piano operativo aggiornato e i gate di pubblicazione sono nel documento di sostituzione. Le modifiche locali sono pronte per revisione e pubblicazione successiva controllata. Nessun collegamento online viene dichiarato funzionante prima del collaudo effettivo.


## Esiti locali finali e inventario

- Backend: **358/358**, 41 suite.
- Frontend: **35/35**.
- ESLint: superato; output dist-showcase escluso come artefatto generato.
- Build standard e Showcase: superate, PWA comprese.
- YAML/TOML e sintassi script: verificate localmente; nessuna validazione cloud.
- Bundle remoto: endpoint HTTPS configurato, assenza di autofill/password locale e API loopback; nessuna source map.
- Bypass GPS locale, avvii esistenti e icone attive invariati; configurazioni private e backup preservati per hash.
- Git: HEAD resta il commit base, indice non modificato, nessun commit/push/merge/deploy.

I file di questo intervento sono:

- `SHOWCASE_REMOTE_DEPLOY_2026-11-11.md`
- `SHOWCASE_REVIEW_2026-11-10.md`
- `backend/app.js`
- `backend/controllers/authController.js`
- `backend/controllers/recordsController.js`
- `backend/middleware/authMiddleware.js`
- `backend/middleware/remoteShowcase.js`
- `backend/package.json`
- `backend/routes/demo.js`
- `backend/scripts/seedRemoteShowcase.js`
- `backend/scripts/startRemoteShowcase.js`
- `backend/tests/auth/remoteShowcase.test.js`
- `backend/tests/utils/remoteShowcase.test.js`
- `backend/tests/utils/remoteShowcaseBootstrap.test.js`
- `backend/tests/utils/remoteShowcaseEmail.test.js`
- `backend/utils/email.js`
- `backend/utils/remoteShowcase.js`
- `backend/utils/remoteShowcaseSeed.js`
- `deploy/showcase/netlify.toml`
- `deploy/showcase/render.yaml`
- `deploy/showcase/variables.example.txt`
- `frontend/.gitignore`
- `frontend/eslint.config.js`
- `frontend/package.json`
- `frontend/scripts/buildRemoteShowcase.mjs`
- `frontend/scripts/remoteShowcaseConfig.mjs`
- `frontend/src/App.jsx`
- `frontend/src/components/Home-admin/AdminUsersSection.jsx`
- `frontend/src/components/Home-admin/Home-admin.jsx`
- `frontend/src/components/Home-user/Home-user.jsx`
- `frontend/tests/remoteShowcase.test.js`


## GPS remoto: autorizzazione esplicita (11 novembre 2026)

Il solo `DEMO_MODE=true` non disabilita la geolocalizzazione remota. Variabile **opzionale lato server**: `SHOWCASE_GPS_CHECK_DISABLED=true`. Assente o `false` mantiene il comportamento precedente; ogni altro valore impedisce l’avvio Showcase. Nessuna nuova variabile frontend e nessun segreto nel bundle.

L’esenzione richiede l’intero profilo remoto valido (`APP_ENV=showcase`, `NODE_ENV=production`, `DEMO_MODE=true`, Atlas/DB Showcase, JWT dedicato, email disabilitate, origini HTTPS esatte), più HTTPS, host API e Origin client corretti. `DEMO_LOCAL_GPS_BYPASS=false` e `GEOLOCATION_CLOCK_IN_ENABLED=true` restano obbligatori; configurazione sede reale invariata per tornare ai controlli GPS. Una produzione ordinaria non ottiene l’esenzione dal solo nuovo flag.

Il frontend Showcase consulta `/api/records/gps-policy` con autenticazione. Solo `canSkipShowcaseGps:true` autorizza il payload distinto `showcaseWithoutGps:true` per entrata, uscita e pause. Il vecchio `demoWithoutGps` resta esclusivamente locale. Policy mancante/non valida mantiene il flusso GPS; la revoca server rifiuta anche un client con policy precedente. Il frontend limita la policy all’account che l’ha ricevuta.

In demo online autorizzata non si richiede il permesso GPS e non si registrano coordinate. Restano visibili la disponibilità della funzione nella versione aziendale e l’indicazione “controllo GPS disattivato”. “Fuori sede” richiede sempre motivazione e payload separato: non può essere combinato con l’esenzione demo. Il server rifiuta coordinate inviate insieme al marker remoto, evitando posizioni non validate. Nessuna modifica a database, notifiche, approvazioni o JWT.

Per abilitare in futuro: aggiungere privatamente `SHOWCASE_GPS_CHECK_DISABLED=true` **solo** alla configurazione runtime Showcase verificata, poi controllare offline. Il seed non richiede modifiche. I file runtime già validi restano validi senza questa riga, ma mantengono il GPS obbligatorio. Nessuna configurazione privata o cloud è stata cambiata per attivarla in questo intervento.

Collaudo futuro HTTPS: con flag assente/false verificare diniego senza GPS; con true negare il permesso nel browser e completare entrata → pausa → fine pausa → uscita; verificare messaggio demo e posizioni nulle, motivazione fuori sede obbligatoria, rifiuto marker locale e origini estranee. Ripristinando false le nuove richieste senza GPS devono fallire. Prima di applicare variabili o pubblicare, restano necessarie verifica isolamento Render da Cliente 1 e autorizzazioni del piano di sostituzione. Nessun deploy effettuato.


## Nome database corretto — aggiornamento autorizzato 11 novembre 2026

Target attivo esatto: `office_clocking_showcase_20261113`. URI private aggiornate conservando password/JWT. File password account esistente intatto e non letto; NON usare il seed ordinario per aggirarne il blocco. Diagnostica reale sul nuovo target: PERMISSION_DENIED / MONGO_8000 / list-collections. Servono ruoli Atlas manuali sul nome nuovo. Seguire `SHOWCASE_DATABASE_RECOVERY_2026-11-11.md`: recupero separato preparato, non applicato, con autorizzazione futura obbligatoria. Nessuna modifica a cloud, database o altri ambienti. I riscontri precedenti di configurazione privata vuota/incompleta sono storici.
