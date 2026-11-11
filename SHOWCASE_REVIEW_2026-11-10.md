# Verifica demo Office Clocking — 10 novembre 2026

**Ultimo aggiornamento grafico:** vedere “Grafica e usabilità” in fondo: orologio digitale fisso, sezioni chiuse al primo accesso con memoria isolata, Admin uniforme e icona proposta separata. Verificati 26 test frontend, 319 backend e collaudo browser reale su fixture senza database.

**Aggiornamento 11 novembre:** la sezione finale “Completamento funzionalità” riporta i risultati più recenti (319 test backend e 20 frontend), le nuove funzioni e i limiti del collaudo. Le sezioni precedenti conservano lo storico del lavoro.

**Aggiornamento GPS e avvio:** la sezione finale "Preparazione DEMO locale senza GPS" e README.showcase-local.md descrivono la configurazione pronta e sostituiscono i precedenti blocchi su GPS obbligatorio e configurazione assente. Restano i limiti del collaudo visuale e dello scenario dati del 13 novembre.

**Aggiornamento:** il collaudo finale in fondo al documento sostituisce i precedenti risultati dei test e i limiti relativi alla lettura dei dati reali. Il collaudo browser resta incompleto.

Cartella: `C:\Office-Clocking\office-clocking-demo-showcase`.
Branch verificato prima e dopo il lavoro: `feature/demo-november-showcase`.
Stato iniziale Git non pulito: le modifiche locali preesistenti sono state conservate.
L'eccezione Git safe.directory è stata applicata solo ai singoli comandi, senza modificare la configurazione globale.

## Interventi

Le timbrature chiuse con pause vengono ricalcolate in lettura sottraendo tutti gli intervalli, anche se non ordinati; il documento MongoDB non viene riscritto. I record storici senza pause mantengono la compatibilità con la durata salvata, con ricalcolo quando il valore manca o non è valido. I record aperti e annullati non contribuiscono alle ore lavorate. Date non valide, pause sovrapposte e intervalli fuori sessione vengono rifiutati dal calcolo.

I riepiloghi Admin singolo utente, multiutente e giornaliero, i dettagli, lo storico personale e i CSV utilizzano ora durate nette coerenti. Il pannello Presenze giornaliere conta persone con entrata e assenze, senza calcolare durate: non richiedeva modifiche.

Anche anteprima e approvazione delle chiusure manuali sottraggono le pause. Una pausa ancora aperta viene conteggiata fino all'uscita proposta e chiusa a quell'orario durante l'approvazione. Il limite massimo della chiusura continua a riferirsi all'intervallo lordo. Proposte incompatibili con le pause sono respinte senza salvataggio; l'elenco delle richieste espone breakRangeConflict senza interrompere la risposta.

I CSV conservano le colonne esistenti e aggiungono in coda totale e intervalli delle pause. Le righe assenza nell'export backend hanno lo stesso numero di colonne. Nell'Admin le pause sono consultabili con dettagli espandibili da tastiera; nello storico sono evidenziate le ore nette, con etichette precise anche per pause multiple.

## File modificati da questo intervento

Percorsi relativi alla cartella sopra indicata; le modifiche precedenti in altri file non appartengono a questo intervento.

| File | Intervento |
| --- | --- |
| backend/utils/workDuration.js | Validazione intervallo e normalizzazione delle durate in risposta; file già presente come non tracciato |
| backend/controllers/adminController.js | Riepiloghi, dettagli, CSV e chiusure manuali |
| backend/controllers/recordsController.js | Normalizzazione delle due modalità dello storico personale; conservato il codice pause già presente |
| frontend/src/components/Home-admin/Home-admin.jsx | Dettagli pause nelle tabelle e colonne aggiuntive CSV |
| frontend/src/components/Home-admin/Home-admin.css | Stile dei dettagli pause |
| frontend/src/components/Home-admin/RecordBreakSummary.jsx | Nuovo componente per i dettagli espandibili |
| frontend/src/components/Storico/Storico.jsx | CSV pause, ordinamento, etichette, ore nette e totale coerente col backend |
| frontend/src/components/Storico/Storico.css | Evidenza delle ore nette e leggibilità dei tempi |
| backend/tests/admin/adminExport.test.js | Aggiornamento intestazione CSV attesa |
| backend/tests/admin/breakConsistency.test.js | Nuovi test di coerenza API, export, storico e chiusure manuali |
| backend/tests/records/breaks.test.js | Nuovi test del ciclo inizio/fine pausa e uscita |
| backend/tests/utils/workDuration.test.js | Nuovi test dei calcoli, casi legacy e intervalli incoerenti |
| SHOWCASE_REVIEW_2026-11-10.md | Questo rapporto |

## Verifiche eseguite

- Prima delle modifiche: suite backend completa, 25 suite, 181 test superati e 8 falliti.
- Dopo tutte le modifiche: suite backend completa (`npm test`), 28 suite, 204 test superati e gli stessi 8 falliti. 27 suite superate, una fallita.
- Nuovi test mirati eseguiti anche separatamente: 23/23 superati nelle tre nuove suite. Coprono più pause, ordine degli intervalli, annullamenti, legacy, turni notturni, durata netta zero, intervalli non validi, riepiloghi, CSV, storico, approvazione e ciclo completo entrata/pause/uscita.
- Build frontend finale (`npm run build`): riuscita, inclusa generazione del service worker PWA. La prima esecuzione limitata dalla sandbox era fallita con EPERM sui file temporanei Vite; la build autorizzata sul percorso corretto è riuscita.
- `git diff --check` sui file tracciati modificati da questo intervento: nessun problema. Il controllo generale rileva spazi finali già presenti in seedShowcase.js e Home-user.jsx; non modificati.
- I test usano mock dei modelli: nessun collegamento al database reale né invio di email reali nei nuovi test.

## Problemi preesistenti e limiti

Gli 8 fallimenti sono tutti in backend/tests/leaves/createLeave.test.js, già riprodotti prima delle modifiche. Le richieste dei test usano date di giugno 2026, ora precedenti al preavviso minimo richiesto; ricevono HTTP 400 anziché gli esiti attesi 201/409. Non sono stati modificati controller o test delle assenze. Occorre rendere deterministico l'orologio di quei test in un intervento dedicato.

Non è stato eseguito un collaudo interattivo nel browser né una verifica dei 954 documenti reali: la coerenza è verificata tramite codice, test con dati simulati e build. Intervalli pausa incoerenti nei dati reali possono ancora richiedere una correzione amministrativa; non sono stati modificati dati per risolverli.

Nessuna modifica al database MongoDB, nessun seed o migrazione, nessun push, merge o deploy. Office Work e la produzione Cliente 1 non sono stati toccati. Gli output dist derivano esclusivamente dalle build locali.


## Collaudo finale — aggiornamento del 10 novembre 2026

### Risultati conclusivi

- Backend: `npm test`, **29 suite superate, 219 test superati, zero fallimenti**. Nessuna modifica alle regole applicative sulle assenze.
- Frontend: `node --test tests/workSummary.test.js`, **3 test superati**.
- Frontend: `npm run build`, **riuscita**, inclusa la generazione PWA.
- ESLint su Home-user.jsx, AdminDailyAttendance.jsx e workSummary.js: nessun errore.
- Controllo diff sui file del nuovo intervento: nessun nuovo errore di whitespace; rimane lo spazio finale preesistente in Home-user.jsx descritto sopra.

Gli 8 precedenti errori delle assenze erano dovuti alla data corrente rispetto alle fixture di giugno 2026. Ora la suite fissa l'orologio al 1 giugno 2026, mantiene reali i timer di HTTP/notifiche e ripristina l'orologio dopo ciascun test. Sono stati aggiunti i casi del preavviso esattamente al limite e inferiore al limite. Non sono stati modificati controller, validatori o configurazioni applicative delle assenze.

### Coerenza funzionale e dati reali

È stata eseguita una lettura effettiva di `office_clocking_showcase_v2` su MongoDB locale: 16 account, 954 timbrature, 699 con pause. Zero intervalli chiusi incoerenti e zero differenze tra durata salvata e durata netta ricalcolata. Totale ricalcolato delle timbrature chiuse non annullate: 24.842.400 secondi.

Sono stati inoltre eseguiti direttamente i controller di lettura sul database demo reale, senza avviare server e con creazione automatica di collezioni e indici Mongoose disattivata. Questo è un controllo dei controller e dei dati, non un collaudo browser né un test HTTP dell'autenticazione.

Campione: account `ale`, giornata 12 novembre 2026.

| Punto verificato | Secondi netti |
| --- | ---: |
| Funzione totale Home User, alimentata dalla risposta reale dello storico | 27000 |
| Storico personale | 27000 |
| Riepilogo Admin singolo utente | 27000 |
| Dettagli Admin giornalieri | 27000 |
| Riepilogo Admin multiutente | 27000 |
| Esportazione CSV backend effettivamente generata e analizzata | 27000 |

Tutti i valori equivalgono a **7h 30m nette**, con **30m di pause concluse**. I CSV frontend condividono le stesse durate normalizzate; non è stato effettuato il download tramite browser.

Le presenze giornaliere, eseguite dal controller reale sul 10 novembre, restituiscono 15 dipendenti attivi, 15 entrati, zero non entrati e zero assenti. La somma delle categorie corrisponde al totale. I nuovi test coprono autorizzazioni, prima entrata, pause che non cambiano il conteggio delle persone, priorità assenze, PIR orario rispetto a giornaliero, soglia delle 09:00 e cambio data Europe/Rome.

Home User non aveva un totale ore: è stato aggiunto un riepilogo delle sole sessioni concluse oggi, alimentato dai valori netti già calcolati dal backend, senza sottrarre nuovamente le pause. Le sessioni aperte e annullate sono escluse, come nei riepiloghi Admin; le ore della sessione in corso non sono un contatore live. Con più sessioni concluse nello stesso giorno viene ora mostrata l'ultima negli orari di entrata/uscita. La data delle presenze Admin usa il fuso Europe/Rome e l'istante della risposta backend.

### Desktop e mobile: limite esplicito

È stato tentato un accesso reale alla finestra Chrome Office Clocking. Lo strumento non ha ottenuto lo stato accessibile e ha interrotto Computer Use perché non poteva determinare l'URL corrente con sufficiente certezza per applicare le proprie regole. Dopo il blocco non sono state tentate altre interazioni browser.

**Nessun collaudo visuale desktop o mobile è stato completato.** Non sono stati simulati risultati browser, screenshot o sessioni utente. Sono stati ispezionati solamente JSX/CSS: i layout esistenti includono breakpoint per User/Storico, scorrimento orizzontale delle tabelle Admin e adattamento delle presenze a 550px. Il nuovo riepilogo User usa colonne flessibili e si dispone su una colonna sotto 380px. Questi controlli statici non certificano assenza di problemi visuali sui dispositivi.

### Problemi che possono influire sulla presentazione del 13 novembre

1. **Configurazione di avvio da verificare in questa checkout.** Non sono presenti backend/.env o frontend/.env, né varianti locali; nella sessione di esecuzione MONGO_URI, JWT_SECRET e VITE_API_URL sono assenti. Le variabili potrebbero essere fornite da un diverso processo di avvio, non ispezionato. La build può riuscire anche senza VITE_API_URL, ma l'API non è configurata per l'uso effettivo se la si avvia senza fornire tali variabili. Gli esempi presenti usano un nome database generico e demo disattivata: non avviarli senza impostare esplicitamente office_clocking_showcase_v2 e la configurazione demo. Nessun file di configurazione è stato creato o sovrascritto.
2. **GPS richiesto dal frontend.** Entrata, uscita e inizio/fine pausa richiamano sempre navigator.geolocation prima della richiesta API. Permesso negato, posizione non disponibile o timeout possono quindi bloccare la dimostrazione, anche quando il controllo della distanza è disattivato nel backend e il banner demo lo dichiara. Comportamento verificato nel codice, non nel browser; non è stato modificato né aggirato.
3. **Scenario del venerdì vuoto.** I dati arrivano al 12 novembre. Al momento della verifica il 13 novembre non ha timbrature né assenze approvate: senza nuove azioni autorizzate, il pannello giornaliero di quel giorno mostrerà 15 non entrati. Per illustrare pause e riepiloghi storici si può selezionare il 12 novembre. Non sono stati aggiunti dati per il venerdì.
4. **Account luca con anomalia intenzionale da considerare.** È presente una sessione del 9 novembre alle 07:45 UTC, in pending_manual_closure, senza pausa aperta. La richiesta pendente può bloccare nuove timbrature di quell'account; resta utile come scenario di revisione Admin. Non è stata approvata o modificata.
5. **Collaudo browser da completare manualmente.** Login, navigazione, download CSV e resa desktop/mobile non sono certificati da questa sessione. In particolare resta da verificare il comportamento GPS nel browser e sul dispositivo scelto per la presentazione.

Valutazione: **calcoli e verifiche automatiche pronti; prontezza commerciale condizionata alla configurazione di avvio, alla disponibilità del GPS e al collaudo visuale reale**. Non ci sono più errori backend preesistenti aperti nella suite.

### File di questo aggiornamento

- backend/tests/leaves/createLeave.test.js — orologio deterministico e due casi sul preavviso.
- backend/tests/admin/dailyAttendance.test.js — nuovo, cinque test presenze/autorizzazioni/fuso.
- frontend/src/components/Home-user/Home-user.jsx — totale netto delle sessioni concluse e selezione dell'ultima sessione.
- frontend/src/components/Home-user/Home-user.css — stile responsive del totale.
- frontend/src/components/Home-admin/AdminDailyAttendance.jsx — data nel fuso ufficiale.
- frontend/src/utils/workSummary.js — nuovo, somma dei valori netti normalizzati.
- frontend/tests/workSummary.test.js — nuovo, tre test di coerenza dei totali.
- SHOWCASE_REVIEW_2026-11-10.md — aggiornamento del rapporto, mantenendo lo storico del lavoro precedente.

Tutte le modifiche sono locali nella cartella e nel branch indicati. Database consultato esclusivamente in lettura; nessun seed, migrazione o salvataggio; nessun server applicativo avviato da questa sessione. Office Work e produzione Cliente 1 non sono stati toccati. Nessun push, merge o deploy.


## Preparazione DEMO locale senza GPS

### Causa e soluzione

Home User richiedeva sempre navigator.geolocation prima di inviare entrata, uscita e pause. La disattivazione del controllo distanza nel backend non evitava quella richiesta nel frontend.

È stato aggiunto un percorso esplicito senza posizione. Il frontend di sviluppo nella modalità demo-local, aperto su loopback e con API loopback, chiede la policy autenticata `/api/records/gps-policy`; i pulsanti attendono il controllo iniziale. Il server autorizza solo NODE_ENV=development, DEMO_MODE=true, DEMO_LOCAL_GPS_BYPASS=true e MONGO_URI locale con database esatto office_clocking_showcase_v2. Anche socket, Host e Origin quando presente devono essere locali; Forwarded e X-Forwarded-* fanno rifiutare l'eccezione.

Quando autorizzato, il payload è `{ demoWithoutGps: true }`, senza location. Nei punti di validazione dei quattro endpoint il backend ricontrolla le condizioni prima di saltare la verifica GPS. Le informazioni di posizione dell'operazione restano nulle; nessuna coordinata viene generata o simulata. Il marker non autorizzato produce HTTP 403 con codice DEMO_GPS_BYPASS_NOT_ALLOWED. Se il marker non è presente resta il flusso GPS preesistente, senza modifiche alle utility GPS, alle impostazioni utente o ai flussi fuori sede.

Una build Vite ha DEV=false: il percorso non si attiva anche se venisse compilata con `--mode demo-local`. Per la presentazione senza GPS usare il server locale con `npm run dev:demo-local`, non la preview della build. Non è previsto l'accesso dalla rete LAN o da uno smartphone esterno al computer locale.

### Configurazione pronta e avvio

Guida dettagliata: **README.showcase-local.md**, nella radice del progetto.

È già stato generato backend/.env.showcase.local con chiave JWT casuale locale, escluso da Git. La generazione è idempotente e non sovrascrive il file esistente; hash verificato invariato alla seconda esecuzione. Il modello pubblico è backend/.env.showcase.example. Nessuna chiave è stata stampata o inserita nella documentazione.

Primo terminale PowerShell:

```powershell
Set-Location -LiteralPath 'C:\Office-Clocking\office-clocking-demo-showcase\backend'
npm run demo:configure
npm run demo:check
npm run demo:local
```

Secondo terminale PowerShell:

```powershell
Set-Location -LiteralPath 'C:\Office-Clocking\office-clocking-demo-showcase\frontend'
npm run dev:demo-local
```

Aprire **http://127.0.0.1:5175**. Backend: **http://127.0.0.1:5055**. MongoDB locale già avviato, con il database esistente office_clocking_showcase_v2 sulla porta 27017. I comandi non eseguono seed o migrazioni e le porte non sostituiscono altri processi.

Il launcher rifiuta configurazioni ereditate incompatibili, compreso NODE_ENV=production o un database diverso, prima di collegarsi al database. Non sovrascrive variabili già impostate nella shell. Auto-creazione collezioni e indici Mongoose disattivata nel launcher. La verifica `demo:check` non apre connessioni.

Il banner DEMO è ora montato nella radice React e compare su tutte le pagine, con testo Modalità Demo locale nel percorso locale. Prima era montato solamente nella pagina funzionalità; la duplicazione lì è stata rimossa. Home User mostra la conferma esplicita che entrata, uscita e pause sono disponibili senza GPS solo dopo autorizzazione del server.

### Test finali

- Backend completo: `npm test`, **32 suite, 264 test superati, zero fallimenti**.
- Nuovi test backend: 45, comprendenti policy, quattro endpoint senza posizione, rifiuto del marker in produzione, database errato, host/origin remoti, header proxy, flag mancanti, mantenimento del rifiuto GPS nelle modalità normali e controlli del launcher prima della connessione.
- Frontend: `node --test tests/demoBanner.test.js tests/localDemoGps.test.js tests/workSummary.test.js`, **17 test superati**. Coperti il rendering SSR del componente banner reale, il blocco nelle build di produzione, i payload senza coordinate e il flusso GPS ordinario.
- ESLint sui file JSX/JS frontend modificati: superato.
- `npm run build`: superato, inclusa generazione PWA.
- `npm run demo:configure` e seconda esecuzione idempotente: superati; `npm run demo:check`: superato.
- Controlli di sintassi Node dei nuovi script e della policy: superati.

Le verifiche del banner sono rendering server e controllo del montaggio comune React, non un collaudo visuale desktop/mobile. Nessuna interazione browser o timbratura reale è stata eseguita in questo intervento; nessun backend applicativo è stato avviato e nessuna connessione MongoDB è stata aperta. Il database non è stato modificato. I test degli endpoint usano modelli simulati.

### File modificati o aggiunti in questo intervento

| File | Modifica |
| --- | --- |
| backend/controllers/recordsController.js | Policy autenticata e controllo server del marker nei quattro endpoint |
| backend/routes/records.js | Nuova GET /gps-policy |
| backend/utils/localDemoGps.js | Nuovo: condizioni di ambiente e richiesta locale |
| backend/tests/utils/localDemoGps.test.js | Nuovo: casi autorizzati e rifiutati |
| backend/tests/records/localDemoGps.test.js | Nuovo: quattro endpoint e protezioni produzione |
| backend/tests/utils/showcaseLauncher.test.js | Nuovo: verifica configurazione e rifiuto ambienti incompatibili |
| backend/scripts/configureShowcaseLocal.js | Nuovo: configurazione locale idempotente senza database |
| backend/scripts/startShowcaseLocal.js | Nuovo: launcher locale e modalità --check |
| backend/.env.showcase.example | Nuovo: modello configurazione senza chiave JWT |
| backend/.env.showcase.local | Nuovo, privato e ignorato: configurazione pronta con chiave locale |
| backend/package.json | Comandi demo:configure, demo:check, demo:local |
| backend/.gitignore | Esclusione del file privato |
| frontend/src/components/Home-user/Home-user.jsx | Consenso policy server, payload senza location, messaggio e attesa iniziale |
| frontend/src/utils/localDemoGps.js | Nuovo: condizioni frontend e payload GPS/demo |
| frontend/tests/localDemoGps.test.js | Nuovo: modalità normali/demo e payload |
| frontend/tests/demoBanner.test.js | Nuovo: rendering SSR del banner reale |
| frontend/src/components/DemoBanner/DemoBanner.jsx | Etichetta DEMO locale |
| frontend/src/components/DemoBanner/DemoBanner.css | Box sizing e wrapping del banner |
| frontend/src/main.jsx | Banner comune a tutte le pagine |
| frontend/src/components/FeaturesPage/FeaturesPage.jsx | Rimozione del solo banner duplicato |
| frontend/.env.demo-local | Nuovo: configurazione pubblica localhost senza segreti |
| frontend/package.json | Comando dev:demo-local con host e porta fissi |
| frontend/.gitignore | Eccezione esplicita per il file pubblico demo-local |
| README.showcase-local.md | Nuovo: guida completa di avvio e limiti |
| SHOWCASE_REVIEW_2026-11-10.md | Questo aggiornamento, conservando lo storico |

Configurazione e funzione senza GPS sono pronte per l'avvio locale documentato. Restano da verificare nel browser effettivo login e interfaccia; rimangono invariati i dati non precaricati del 13 novembre e la chiusura pendente di luca. Nessuna modifica a Office Work o alla produzione Cliente 1, nessun push, merge o deploy. Branch confermato feature/demo-november-showcase; modifiche locali precedenti conservate.


## Completamento funzionalità — 11 novembre 2026

Branch confermato `feature/demo-november-showcase`. Stato Git verificato prima degli interventi; modifiche locali precedenti conservate. Nessuna connessione al database reale o invio email reale è stato effettuato in questo aggiornamento.

### Funzionalità completate

1. **Sezioni richiudibili.** Componente riutilizzabile con details/summary nativi, freccia aperto/chiuso, focus da tastiera, heading accessibili e rispetto di reduced-motion. Collegato a sette sezioni User (comprese quelle condizionali) e nove Admin. Le presenze mantengono il proprio pannello espandibile. I contenuti non vengono smontati alla chiusura e i collegamenti rapidi Admin aprono la destinazione prima dello scorrimento. Sono mantenuti gli stili responsive esistenti.
2. **Fuori sede.** Il backend disponeva già di modalità/note e accettava posizione assente per questa modalità; mancava il percorso User. Ora l'utente sceglie esplicitamente la modalità della prossima entrata/uscita e inserisce la motivazione obbligatoria (1–500 caratteri). Il payload non include coordinate né il marker DEMO. Entrata/uscita salvano modalità, motivazione, utente e istante; viene accodata la notifica tramite i destinatari AppSettings.leaveNotificationEmails. Le ragioni sono visibili nei dettagli Admin e Storico. Il server rifiuta richieste che mescolano fuori sede e demoWithoutGps. I controlli della timbratura ordinaria in sede e il limite del percorso DEMO a localhost rimangono attivi. Le pause non vengono implicitamente convertite in fuori sede dal selettore.
3. **Presenze per data.** GET /api/admin/daily-attendance accetta date=YYYY-MM-DD, con default oggi e rifiuto delle date non valide. La UI permette la scelta del giorno e impedisce che una risposta di una ricerca precedente sovrascriva la nuova selezione. Il filtro include solo dipendenti user non disattivati, esclude timbrature annullate e distingue entrati, non entrati senza assenza giornaliera e assenti. Admin e disattivati non rientrano nei conteggi. Il giorno e la soglia delle 09:00 usano Europe/Rome; i giorni storici non sono presentati come ritardi correnti.
4. **Correzione Admin.** Erano presenti schema adminEditHistory e lock per dipendente, ma mancavano endpoint e interfaccia. Ora PATCH /api/admin/records/:recordId è protetto da autenticazione e ruolo Admin. Dal dettaglio giornaliero si possono correggere entrata/uscita di sessioni concluse non annullate, con motivazione obbligatoria (1–1000 caratteri). Le ore nette sono ricalcolate sottraendo tutte le pause concluse. Intervalli invertiti/non validi, pause fuori intervallo, pause aperte, sovrapposizioni con altre sessioni non annullate e form obsoleti sono rifiutati. Si usa il lock condiviso con le timbrature e un aggiornamento condizionato su stato/date/versione per evitare sovrascritture concorrenti del record. Lo storico viene aggiunto con push, registrando prima/dopo, Admin, istante e motivo. Gli orari di pausa e le posizioni originali non vengono inventati, spostati o riscritti. Dopo il salvataggio sono aggiornati dettaglio e riepiloghi già selezionati. Lo storico delle correzioni è consultabile anche nello Storico User.
5. **Malattia.** Il filtro delle notifiche escludeva mutua; ora include malattia/mutua, con dipendente, tipo e periodo. Lo stato della mutua è indicato correttamente come approvato, senza invito ad approvare una richiesta già approvata. Destinatari identici al canale ferie/PIR. La malattia conserva le regole precedenti di registrazione e conflitto con le timbrature.
6. **Ferie e date.** Le email formattano sempre Europe/Rome e non il fuso locale del server. La validazione dell'intervallo viene ora controllata prima del salvataggio. L'helper giornaliero costruisce separatamente la mezzanotte successiva nel fuso corretto, invece di conservare l'offset precedente: sono corrette le giornate di 23 e 25 ore. Gli orari locali inesistenti sono rifiutati; il nuovo modulo correzioni rifiuta anche gli orari doppi/ambigui del cambio d'ora, senza scegliere silenziosamente un istante.

### Verifiche finali

- Backend: `npm test` — **37 suite, 319 test superati, zero fallimenti**.
- Frontend: `npm test` — **20 test superati, zero fallimenti**. È stato aggiunto questo comando al package frontend.
- Frontend: `npm run lint` — **nessun errore e nessun warning**.
- Frontend: `npm run build` — **riuscita**, inclusa generazione PWA.
- Diff check sui file modificati: superato. Rimane fuori da questo intervento il whitespace preesistente dello script seed segnalato nello storico.
- Nuove prove coprono persistenza e notifiche fuori sede, motivazione obbligatoria, distinzione dal marker locale, rifiuto GPS ordinario, autorizzazione Admin, calcoli pause, audit append-only, versioni concorrenti, sovrapposizioni e stati non correggibili.
- Date ferie: singolo giorno con date e con startDate/endDate, intervalli estate/inverno, giorni e intervalli di cambio d'ora, salvataggio UTC corrispondente al giorno Rome e contenuto email. I processi di test email sono stati eseguiti anche con fuso host UTC e Pacific/Honolulu. Verificato inoltre il limite inclusivo dell’ultimo giorno ferie nei due cambi d’ora, coerente con la mezzanotte successiva Europe/Rome.
- Malattia: test estivi/invernali a cavallo della mezzanotte UTC, con controllo di data, dipendente, stato e destinatari. Invio e fallimenti SMTP simulati; nessuna email reale.
- Presenze: test di autorizzazione, classificazione, prima entrata, PIR orario/giornaliero, filtri ruolo/attività, data selezionata, data non valida e intervalli Europe/Rome nei cambi d'ora.
- Regressioni: la suite completa comprende login, login/ruoli demo, GPS ordinario e policy localhost, timbrature, pause, storico, annullamenti, chiusure manuali, riepiloghi ed export CSV.

Il primo test SSR delle nuove pagine presumeva che i dati fossero già caricati: è stato corretto per verificare gli stati iniziali reali (User e caricamento Admin) e i controlli presenze/correzione separatamente. I socket websocket dei test SSR Vite sono ora disattivati per evitare conflitti di porta tra file di test. Le implementazioni applicative non sono state adattate per aggirare questi stati.

### Uso delle nuove funzioni

La guida README.showcase-local.md contiene i comandi di avvio già predisposti e il percorso dei nuovi controlli. In breve:

- User → “Modalità della prossima entrata/uscita” → Fuori sede → motivazione → timbratura.
- Admin → Presenze giornaliere → Mostra → selezionare il giorno.
- Admin → Dettaglio giornaliero → dipendente/data → Correggi sulla sessione conclusa → nuovi orari Rome e motivazione → Salva correzione.
- Storico e tabelle Admin → motivazioni fuori sede e “Correzioni Admin” nei dettagli del record.

### Limiti ancora da verificare

- Il collaudo manuale in browser desktop/mobile non è stato eseguito in questo aggiornamento. Il rendering SSR dei componenti reali verifica struttura e stati iniziali, non clic, focus effettivo, scorrimento, download o resa visuale nei dispositivi. Nessun collaudo browser è stato simulato.
- La consegna SMTP reale non è stata provata e non sono stati modificati destinatari o credenziali: richiede la configurazione SMTP esistente e AppSettings.leaveNotificationEmails valorizzato. Le notifiche sono verificate con mailer simulato; senza SMTP configurato la funzione di invio preesistente segnala lo skip.
- Il modulo correzione riguarda le sessioni concluse non annullate; quelle aperte conservano la chiusura ordinaria/manuale. Le pause restano agli istanti registrati. I tempi doppi di ottobre non sono selezionabili ambiguamente nel nuovo modulo: vengono rifiutati con errore, così come il salto d'ora di marzo.
- Nessun dato del 13 novembre è stato generato; resta lo scenario già descritto e resta pendente l'anomalia demo di luca. Si può usare il selettore date per consultare i dati esistenti.

### File di questo aggiornamento

Backend:

- controllers/adminRecordEditController.js (nuovo)
- controllers/adminDailyAttendanceController.js
- controllers/leaveController.js
- controllers/recordsController.js (solo distinzione marker fuori sede/DEMO)
- routes/admin.js
- utils/dateTime.js
- tests/auth/demoLogin.test.js (nuovo: profili demo, flag e assenza di credenziali nella risposta)
- tests/admin/editTimeRecord.test.js (nuovo)
- tests/admin/dailyAttendance.test.js
- tests/records/offsite.test.js (nuovo)
- tests/utils/timeRecordNotifications.test.js (nuovo)
- tests/leaves/leaveDatesAndSickness.test.js (nuovo)

Frontend:

- components/CollapsibleSection/CollapsibleSection.jsx e .css (nuovi)
- components/TimeRecordDetails/TimeRecordDetails.jsx e .css (nuovi)
- components/Home-admin/AdminRecordEditor.jsx e .css (nuovi)
- components/Home-admin/Home-admin.jsx
- components/Home-admin/AdminDailyAttendance.jsx
- components/Home-admin/RecordBreakSummary.jsx
- components/Home-user/Home-user.jsx e .css
- components/Storico/Storico.jsx
- utils/dateUtils.js
- utils/localDemoGps.js
- tests/showcaseFeatures.test.js (nuovo)
- tests/demoBanner.test.js (socket SSR disabilitato)
- package.json (comando test)

Documentazione: README.showcase-local.md e SHOWCASE_REVIEW_2026-11-10.md. I file backend elencati sono sotto backend/. I componenti e le utility frontend sono sotto frontend/src/; tests/ e package.json sono sotto frontend/. Nessun modello o documento MongoDB è stato migrato o rigenerato.

Tutte le modifiche sono locali nella cartella e nel branch indicati. Nessun database reale modificato, nessuna email reale inviata, nessun push, merge o deploy. Office Work e produzione Cliente 1 non toccati.


## Grafica e usabilità — 11 novembre 2026

Branch e stato Git verificati prima delle modifiche: feature/demo-november-showcase, con le modifiche locali precedenti conservate. Letti rapporto e guida di avvio. Riutilizzati Home User/Home Admin, AuthContext, timer già esistente, CollapsibleSection, stili dei moduli e componente Presenze giornaliere. Nessuna modifica a controller, API, conteggi, schema o database in questo intervento.

### Orologio User

Il precedente riquadro richiudibile è sostituito da OfficeClock, sempre visibile e non richiudibile. Display scuro ad alto contrasto, cifre monospaziate grandi con secondi, giorno della settimana e data completa. Tutti i valori usano Intl.DateTimeFormat con Europe/Rome, anche se il browser/server è in un altro fuso.

Il display è sticky nella parte alta durante lo scorrimento. È stato eliminato soltanto il clipping della card User che impediva il funzionamento sticky, mantenendo gli effetti grafici e il raggio del contenitore. La card ha una larghezza massima desktop di 760px e resta fluida su mobile.

Lo stato giornata già calcolato viene riutilizzato nel display, distinguendo esplicitamente la pausa in corso. I secondi non sono una live region, così il lettore di schermo non annuncia ogni tick. Lo stato è invece annunciabile quando cambia. Il timer è quello già presente a 1Hz, senza nuove dipendenze o animazioni pesanti.

Navigazione rapida sempre disponibile nel display: Timbratura (scorrimento al pulsante, non esecuzione di una timbratura), Storico, Esci. Sono riutilizzati i gestori esistenti. Il pulsante di timbratura e la navigazione di pagina restano fuori dai pannelli richiudibili.

### Sezioni con memoria e stile Admin

Le sei sezioni User rimaste richiudibili (alcune condizionali) e le nove Admin, più Presenze giornaliere, usano lo stesso componente. Al primo accesso sono tutte chiuse. Pulsanti nativi con aria-expanded/aria-controls, focus visibile e apertura/chiusura da tastiera; contenuti mantenuti nel DOM con hidden, senza azzerare i moduli. La regola hidden è esplicita anche quando i layout interni usano display:grid.

Le preferenze sono distinte per identità account, ruolo, pagina e ID stabile della sezione. La parte identificativa della chiave è un SHA-256 calcolato con Web Crypto: non viene copiato lo username nella chiave. I valori localStorage sono esclusivamente booleani JSON, mai note, date di assenza, credenziali o token. Il prefisso è versionato office-clocking:sections:v1. JSON corrotto, valori non booleani, valori sovradimensionati, accesso negato o quota esaurita non interrompono l'app: si usa chiuso come default e memoria locale della sessione. In assenza di Web Crypto non si scrivono preferenze anonime condivise. Anche il fallback in memoria è separato per identità/ruolo/pagina.

Durante il brevissimo caricamento della chiave le sole intestazioni attendono, così non viene applicata per errore una preferenza dell'account precedente. I collegamenti rapidi Admin aprono la destinazione attraverso lo stesso pulsante, aggiornando anche la preferenza.

Le intestazioni Admin condividono bordi, raggio 16px, altezza minima 76px, tipografia, padding e freccia. Hover con colore e ombra leggeri, focus da tastiera e transizioni ridotte quando richiesto dal sistema. Presenze giornaliere è ora un pannello comune con il suo contatore nell'intestazione; logica di fetch, selettore data, filtri e API sono invariati.

### Icona: proposta, non applicazione

Cartella separata: frontend/icon-proposals/digital-check-v1/.

Concetto originale vettoriale: timbratore digitale blu, display 09:00, conferma verde; nome Office Clocking conservato. Colori coerenti: #2563eb, #0f172a, #10b981. Nessun font esterno o dipendenza grafica aggiunta.

Asset: SVG normale e maskable; PNG 16, 32, 48, 64, 180, 192 e 512px; PNG maskable 512; favicon-proposal.ico con frame 16/32/48/64; manifest-proposal.webmanifest di esempio non collegato; preview.html e README. Esportatore export-assets.ps1 basato su System.Drawing già disponibile in Windows. Dimensioni PNG e contenitore ICO verificati; controllata visivamente anche la versione 32px.

**Non sono state sostituite le icone attive.** Verificati identici prima/dopo gli hash dei sette file: frontend/index.html, frontend/vite.config.js, favicon-64x64.png, apple-touch-icon.png, pwa-192x192.png, pwa-512x512.png e pwa-maskable-512x512.png sotto frontend/public. La proposta richiede valutazione prima di un'eventuale applicazione separata.

### Collaudo reale nel browser

È stato possibile usare il browser integrato reale. La pagina tests/visual-check/index.html monta le Home e i componenti applicativi reali, ma con account di prova ui-preview-a/b e risposte API in memoria. Il banner dichiara chiaramente la natura delle fixture. Il server di collaudo ascolta solo su 127.0.0.1:5176 e rifiuta tutte le operazioni di scrittura: non usa il backend, MongoDB o SMTP. Non è una simulazione del browser né un collaudo end-to-end sui dati reali.

Verifiche osservate:

- Primo accesso: sezioni User chiuse; sezioni Admin tutte e dieci chiuse, incluse Presenze.
- Apertura con Invio e chiusura con Spazio. aria-expanded cambia coerentemente.
- Campo nota compilato, chiusura e riapertura: valore mantenuto senza invio del modulo. Dopo reload si conserva la preferenza, non la nota.
- Account A User con sezione aperta: reload la ripristina. Account B User non eredita l'apertura. La chiusura di A è stata a sua volta salvata e ripristinata dopo reload.
- Presenze aperte in Admin B: ripristinate dopo reload a caricamento preferenze concluso. Admin A al primo accesso resta chiuso. Tornando a User A si ripristina la sua preferenza User, distinta da Admin.
- Viewport desktop 1280×900 e mobile 375×812 e 320×700. Nessun overflow orizzontale della pagina: scrollWidth pari al clientWidth (al netto della scrollbar del browser).
- Tutte e dieci le intestazioni Admin misurate a 76px anche nei viewport piccoli, con raggio 16px. Focus da tastiera misurato a 3px.
- Orologio fissato a 6px dall'alto sul viewport mobile; navigazione Timbratura porta il pulsante sotto il display, senza coprirlo (misurati fondo display circa 242px e inizio azione circa 290px nel viewport da 375px).

Prove visive salvate in frontend/tests/visual-check/evidence/clock-mobile-320.jpg e admin-desktop-crop.jpg. La seconda è un ritaglio del riquadro visibile del browser, non un'immagine completa dell'intera pagina. Una cattura estesa vuota prodotta dallo strumento è stata scartata. Durante la modifica live dell'entry di collaudo era comparso un avviso HMR di doppia createRoot; la pagina è stata ricaricata prima delle verifiche definitive. I test automatici, lint e build finali non riportano errori o warning.

Il viewport temporaneo è stato ripristinato, la scheda creata per il test chiusa e il server 5176 arrestato; verificata la chiusura della porta.

### Test e verifiche finali

- Frontend npm test: **26/26 superati**, inclusi persistenza, isolamento account/ruolo/pagina/sezione, storage malformato/negato, default chiuso, riapertura tramite navigazione e clock Rome estate/inverno senza sezione richiudibile.
- Backend npm test: **319/319 superati in 37 suite**. Nessun codice backend modificato.
- Frontend npm run lint: nessun errore o warning.
- Frontend npm run build: riuscita, inclusa PWA. La proposta icona e la pagina di collaudo non sono entry point della build applicativa.
- Risolti i messaggi di scansione dipendenze alla chiusura dei server SSR di test disabilitando la discovery automatica, non cambiando la configurazione Vite dell'app.
- Hash asset attivi invariati; nessuna dipendenza aggiunta; diff check dei file modificati.

### File di questo intervento

- frontend/src/components/OfficeClock/OfficeClock.jsx e .css (nuovi).
- frontend/src/components/CollapsibleSection/CollapsibleSection.jsx e .css.
- frontend/src/components/CollapsibleSection/SectionPreferencesProvider.jsx (nuovo).
- frontend/src/context/section-preferences-context.js (nuovo).
- frontend/src/utils/sectionPreferences.js (nuovo).
- frontend/src/components/Home-user/Home-user.jsx e .css.
- frontend/src/components/Home-admin/Home-admin.jsx.
- frontend/src/components/Home-admin/AdminDailyAttendance.jsx.
- frontend/tests/sectionPreferences.test.js e officeClock.test.js (nuovi).
- frontend/tests/showcaseFeatures.test.js e demoBanner.test.js (aspettative aggiornate e scansioni SSR isolate).
- frontend/tests/visual-check/ (harness isolato, documentazione e prove visive).
- frontend/icon-proposals/digital-check-v1/ (solo proposta separata).
- README.showcase-local.md e SHOWCASE_REVIEW_2026-11-10.md.

Restano fuori dal collaudo grafico login reale con backend, operazioni su dati reali, consegna SMTP e dispositivi fisici: non sono stati esercitati per rispettare i vincoli. Su browser con storage/crypto indisponibile le sezioni funzionano in memoria ma non possono ricordare lo stato dopo la chiusura della sessione. Nessuna email reale, modifica MongoDB, push, merge o deploy. Office Work e produzione Cliente 1 non toccati.


## Aggiornamento 11 novembre 2026 — banner globale e Dark Mode

### Intervento e vincoli

Branch verificato: feature/demo-november-showcase. Stato Git già contenente modifiche e file non tracciati: conservati. Letti questo rapporto e README.showcase-local.md. Nessuna modifica backend, database, configurazione DEMO/GPS, login o regole di autorizzazione; nessuna email reale, push, merge o deploy. Office Work e produzione Cliente 1 non toccati. La proposta icona rimane separata e non applicata.

Il banner globale non viene più importato né montato nell'entry applicativa: scompare anche lo spazio che occupava. Restano le indicazioni contestuali nelle Home e il selettore dei profili demo nel login. Il componente DemoBanner e il relativo vecchio test unitario sono conservati; un nuovo test controlla che l'entry reale non lo monti.

### Tema per account

- Pulsante nativo luna/sole nelle intestazioni User e Admin; nome accessibile stabile “Modalità scura”, aria-pressed, titolo con azione e focus visibile. Area interattiva alta almeno 44px; attivazione con mouse, Invio e Spazio.
- Primo accesso chiaro; localStorage contiene solo “light”/“dark” con chiave derivata tramite SHA-256 dall'account. Username prioritario, id come fallback. Ruolo e pagina non entrano nella chiave: Home User, Home Admin e Storico condividono il tema per lo stesso account.
- Valori non validi, storage negato o quota esaurita non interrompono l'interfaccia. Con storage/crypto indisponibili la scelta funziona in memoria ma può non sopravvivere al reload. Nessuna preferenza anonima condivisa.
- Bootstrap del colore prima del mount React e caricamento della preferenza prima della dashboard quando cambia account. Il loader di autenticazione usa i colori del tema. La lettura cosmetica di authUser non autentica l'utente e non sostituisce la verifica /api/auth/me.
- Palette scura per sezioni richiudibili, card, riepiloghi, presenze, azioni pausa, form, tabelle, badge, calendari e modali. Orologio digitale mantenuto, inclusi fuso Europe/Rome e stato della giornata. Nessun modulo viene smontato quando si cambia solo tema.
- Corretto anche il riquadro risultati dello Storico, rimasto inizialmente chiaro, e il dimensionamento di box/input che causava un lieve overflow a 320px. Nessuna modifica a dati, conteggi o API.

### Verifiche

- Frontend npm test: **31/31 superati**. Cinque test nuovi su default, persistenza chiaro/scuro, isolamento account, condivisione ruolo/pagina, valori non validi, storage/crypto indisponibili, bootstrap prima del render, semantica accessibile del pulsante e rimozione del banner dall'entry. Gli altri test includono DEMO/GPS, sezioni, orologio, dettagli e totali netti.
- Frontend npm run lint: nessun errore o warning.
- Frontend npm run build: riuscita, inclusa generazione PWA; nessuna dipendenza aggiunta.
- Backend non rieseguito: nessun file backend modificato in questo intervento, come richiesto. Il risultato storico 319/319 del precedente intervento resta distinto da queste verifiche.
- Collaudo browser reale nel browser integrato, con componenti applicativi e fixture API in memoria sul server 127.0.0.1:5176; tutte le richieste di scrittura bloccate (405), nessuna connessione MongoDB o SMTP.
- Confermati cambio tema con Invio/Spazio, focus 3px, ripristino scuro al reload, condivisione User/Admin/Storico e isolamento Account A/B. Ritorno al chiaro verificato. Nessun errore o warning console nelle verifiche finali.
- Desktop 1280×900 e 900×900, mobile 375×812 e 320×700. Nessun overflow orizzontale di pagina dopo le correzioni; tabelle scorrevoli nel loro contenitore. Tutte le dieci sezioni Admin aperte e controllate; controllati anche i moduli User, il calendario e il solo dialogo di conferma eliminazione (annullato, mai confermato).
- Contrasti campionati sui colori effettivi nel browser: pulsante tema 9,97:1, titolo 13,60:1, testo secondario 11,76:1, input 14,59:1, intestazioni tabella 10,41:1, celle 13,60:1, badge attivo 9,67:1, giorno selezionato 6,70:1. Si tratta di campionamento, non di una certificazione completa WCAG.
- Evidenze frontend/tests/visual-check/evidence/dark-user-mobile.jpg e dark-admin-desktop.jpg. La fascia azzurra è esclusivamente del collaudo isolato, non dell'app. Il viewport è stato ripristinato, la scheda temporanea chiusa e il server arrestato; porta 5176 verificata chiusa.

### File di questo intervento

Nuovi: frontend/src/components/Theme/AccountThemeProvider.jsx, ThemeToggle.jsx e Theme.css; frontend/src/context/theme-context.js; frontend/src/utils/themePreferences.js; frontend/tests/themePreferences.test.js; le due immagini di evidenza sopra indicate.

Aggiornati con modifiche mirate: frontend/src/main.jsx; frontend/src/context/AuthContext.jsx (solo wrapper tema); frontend/src/routes/AppRoutes.jsx (colori loader); frontend/src/components/Home-user/Home-user.jsx e Home-admin/Home-admin.jsx (pulsante); frontend/src/components/Storico/Storico.css (larghezza mobile); frontend/tests/visual-check/PreviewApp.jsx, preview.jsx e README.md; README.showcase-local.md; questo rapporto.

### Limiti e prontezza

Modifiche grafiche pronte per l'uso locale; nessun blocco rilevato nelle verifiche eseguite. Il collaudo con fixture non dimostra il login reale né timbrature, scritture, CSV o consegna SMTP end-to-end. Non sono stati esercitati dispositivi fisici o un audit completo con screen reader. Questi limiti restano espliciti: non è stato simulato un collaudo browser e non sono stati modificati dati per completarlo.

Controllo Git conclusivo: branch ancora feature/demo-november-showcase; diff check dei file frontend interessati pulito. Il diff check dell'intero progetto segnala uno spazio finale già presente in backend/scripts/seedShowcase.js:194, lasciato invariato perché esterno all'intervento, e avvisi LF/CRLF su file backend preesistenti. I test SSR possono mostrare il messaggio informativo Vite “Re-optimizing dependencies because vite config has changed” dopo il collaudo; nessun test fallito. Nessuna modifica dei file backend in questo intervento.


## Preparazione commit locale — 11 novembre 2026

Branch verificato feature/demo-november-showcase. Selezione esplicita di 104 file approvati; non è stato usato git add indiscriminato. Le configurazioni .env/.env.*, backup, appunti analisi responsive, diff di lavoro, screenshot generati, node_modules, dist e coverage sono esclusi e conservati localmente. Gli asset della proposta icona sono una consegna esplicita, inclusa solo sotto frontend/icon-proposals/digital-check-v1; nessuna modifica agli asset favicon/PWA attivi o alla configurazione che li applica.

Per mantenere riproducibile l'avvio senza versionare file .env, i modelli pubblici privi di credenziali sono backend/config/showcase-local.example.txt e frontend/config/demo-local.example.txt. Il configuratore legge il primo e genera la chiave JWT solo localmente; README.showcase-local.md documenta la copia del modello frontend solo quando la configurazione manca. Nessun file .env esistente è stato modificato. Corrette esclusivamente spaziature residue negli script seedShowcase.js/seedShowcaseV2.js; nessuno script seed o avvio database è stato eseguito.

Verifiche finali: backend npm test 319/319 in 37 suite; frontend npm test 31/31; ESLint pulito; build Vite e generazione PWA riuscite. Il configuratore è stato verificato con filesystem simulato: modello risolto, generazione chiave e mancata sovrascrittura di configurazioni esistenti. Sintassi dei due script seed verificata senza esecuzione. Scansione locale dei file candidati per chiavi private, URL con credenziali e token: nessun segreto di servizio individuato; l'unica corrispondenza per JWT è una costante esplicitamente fittizia del test del launcher. Diff check dell'indice dopo la pulizia degli spazi. Gli avvisi di conversione LF/CRLF e l'avviso npm di nuova versione non rappresentano errori; nessun aggiornamento dipendenze eseguito.

Inclusi anche il messaggio di motivazione fuori sede sotto il pulsante e la correzione del contrasto della tabella Richieste chiusura manuale: quest'ultima è limitata a .homeadmin-manual-closures, senza cambi alla logica di approvazione. Il collaudo browser precedente rimane descritto sopra; in questa preparazione commit non è stato ripetuto. Screenshot storici disponibili solo localmente.

Nessun push, merge o deploy, nessuna email reale e nessuna modifica a database, Office Work o produzione Cliente 1. Il commit locale viene creato solo dopo l'esito positivo dei controlli. L'hash viene comunicato nella risposta conclusiva per non autoreferenziare il contenuto del commit.

### Inventario completo dei file inclusi (104)

- `README.showcase-local.md`
- `SHOWCASE_REVIEW_2026-11-10.md`
- `backend/.gitignore`
- `backend/config/showcase-local.example.txt`
- `backend/controllers/adminController.js`
- `backend/controllers/adminDailyAttendanceController.js`
- `backend/controllers/adminRecordEditController.js`
- `backend/controllers/leaveController.js`
- `backend/controllers/recordsController.js`
- `backend/models/TimeRecord.js`
- `backend/models/TimeRecordLock.js`
- `backend/package.json`
- `backend/routes/admin.js`
- `backend/routes/records.js`
- `backend/scripts/configureShowcaseLocal.js`
- `backend/scripts/seedShowcase.js`
- `backend/scripts/seedShowcaseV2.js`
- `backend/scripts/startShowcaseLocal.js`
- `backend/services/timeRecordLock.js`
- `backend/tests/admin/adminExport.test.js`
- `backend/tests/admin/breakConsistency.test.js`
- `backend/tests/admin/dailyAttendance.test.js`
- `backend/tests/admin/editTimeRecord.test.js`
- `backend/tests/auth/demoLogin.test.js`
- `backend/tests/leaves/createLeave.test.js`
- `backend/tests/leaves/leaveDatesAndSickness.test.js`
- `backend/tests/records/breaks.test.js`
- `backend/tests/records/clockIn.test.js`
- `backend/tests/records/clockOut.test.js`
- `backend/tests/records/localDemoGps.test.js`
- `backend/tests/records/manualClockOut.test.js`
- `backend/tests/records/offsite.test.js`
- `backend/tests/utils/localDemoGps.test.js`
- `backend/tests/utils/showcaseLauncher.test.js`
- `backend/tests/utils/timeRecordNotifications.test.js`
- `backend/tests/utils/workDuration.test.js`
- `backend/utils/dateTime.js`
- `backend/utils/localDemoGps.js`
- `backend/utils/timeRecordNotifications.js`
- `backend/utils/workDuration.js`
- `frontend/.gitignore`
- `frontend/config/demo-local.example.txt`
- `frontend/icon-proposals/digital-check-v1/README.md`
- `frontend/icon-proposals/digital-check-v1/export-assets.ps1`
- `frontend/icon-proposals/digital-check-v1/favicon-proposal.ico`
- `frontend/icon-proposals/digital-check-v1/manifest-proposal.webmanifest`
- `frontend/icon-proposals/digital-check-v1/office-clocking-16.png`
- `frontend/icon-proposals/digital-check-v1/office-clocking-180.png`
- `frontend/icon-proposals/digital-check-v1/office-clocking-192.png`
- `frontend/icon-proposals/digital-check-v1/office-clocking-32.png`
- `frontend/icon-proposals/digital-check-v1/office-clocking-48.png`
- `frontend/icon-proposals/digital-check-v1/office-clocking-512.png`
- `frontend/icon-proposals/digital-check-v1/office-clocking-64.png`
- `frontend/icon-proposals/digital-check-v1/office-clocking-maskable-512.png`
- `frontend/icon-proposals/digital-check-v1/office-clocking-maskable-proposal.svg`
- `frontend/icon-proposals/digital-check-v1/office-clocking-proposal.svg`
- `frontend/icon-proposals/digital-check-v1/preview.html`
- `frontend/package.json`
- `frontend/src/components/CollapsibleSection/CollapsibleSection.css`
- `frontend/src/components/CollapsibleSection/CollapsibleSection.jsx`
- `frontend/src/components/CollapsibleSection/SectionPreferencesProvider.jsx`
- `frontend/src/components/DemoBanner/DemoBanner.css`
- `frontend/src/components/DemoBanner/DemoBanner.jsx`
- `frontend/src/components/FeaturesPage/FeaturesPage.jsx`
- `frontend/src/components/Home-admin/AdminDailyAttendance.jsx`
- `frontend/src/components/Home-admin/AdminRecordEditor.css`
- `frontend/src/components/Home-admin/AdminRecordEditor.jsx`
- `frontend/src/components/Home-admin/Home-admin.css`
- `frontend/src/components/Home-admin/Home-admin.jsx`
- `frontend/src/components/Home-admin/RecordBreakSummary.jsx`
- `frontend/src/components/Home-user/Home-user.css`
- `frontend/src/components/Home-user/Home-user.jsx`
- `frontend/src/components/OfficeClock/OfficeClock.css`
- `frontend/src/components/OfficeClock/OfficeClock.jsx`
- `frontend/src/components/Storico/Storico.css`
- `frontend/src/components/Storico/Storico.jsx`
- `frontend/src/components/Theme/AccountThemeProvider.jsx`
- `frontend/src/components/Theme/Theme.css`
- `frontend/src/components/Theme/ThemeToggle.jsx`
- `frontend/src/components/TimeRecordDetails/TimeRecordDetails.css`
- `frontend/src/components/TimeRecordDetails/TimeRecordDetails.jsx`
- `frontend/src/context/AuthContext.jsx`
- `frontend/src/context/section-preferences-context.js`
- `frontend/src/context/theme-context.js`
- `frontend/src/main.jsx`
- `frontend/src/routes/AppRoutes.jsx`
- `frontend/src/utils/dateUtils.js`
- `frontend/src/utils/localDemoGps.js`
- `frontend/src/utils/sectionPreferences.js`
- `frontend/src/utils/themePreferences.js`
- `frontend/src/utils/workSummary.js`
- `frontend/tests/demoBanner.test.js`
- `frontend/tests/localDemoGps.test.js`
- `frontend/tests/officeClock.test.js`
- `frontend/tests/sectionPreferences.test.js`
- `frontend/tests/showcaseFeatures.test.js`
- `frontend/tests/themePreferences.test.js`
- `frontend/tests/visual-check/PreviewApp.jsx`
- `frontend/tests/visual-check/README.md`
- `frontend/tests/visual-check/index.html`
- `frontend/tests/visual-check/preview.css`
- `frontend/tests/visual-check/preview.jsx`
- `frontend/tests/visual-check/server.mjs`
- `frontend/tests/workSummary.test.js`


## Preparazione Showcase remoto — 11 novembre 2026

Base verificata 2341fd46ac68c13b4e7166a93d6fe9df5ca373ef, branch feature/demo-november-showcase, stato iniziale pulito. Preparata esclusivamente in locale una nuova configurazione opt-in: frontend Netlify (dist-showcase), backend Render dedicato e database Atlas office_clocking_showcase_20261113. Nessuna risorsa esterna creata o modificata, nessun collegamento al database, nessun seed eseguito, nessuna email reale, push, merge, deploy o nuovo commit.

Procedura completa, tabella variabili/segreti, privilegi Atlas, costi verificati su fonti ufficiali, collaudo e rollback: [SHOWCASE_REMOTE_DEPLOY_2026-11-11.md](SHOWCASE_REMOTE_DEPLOY_2026-11-11.md).

Policy: HTTPS e origin esatti; JWT HS256 separato con issuer/audience e scadenza un'ora; riconsulta utente attivo/ruolo su ogni richiesta; admin riservato a showcase_admin; account, impostazioni e GPS non modificabili dall'app remota. Login con password generate casualmente al seed (24 byte, bcrypt costo 12), senza autofill locale o elenco account pubblico. Rate limit aggiuntivo per IP oltre a quello per account. Contatori in memoria e singola istanza dichiarati come limite.

Nessuna modifica al bypass DEMO locale: in remoto è vietato. In sede serve GPS effettivo, anche con esenzione personale preesistente. Fuori sede senza GPS è un percorso esplicito con motivazione obbligatoria, valido nel frontend remoto anche per le pause; nessuna coordinata viene inventata. Rimangono le correzioni precedenti al messaggio sotto il pulsante e al contrasto della tabella chiusure manuali.

Email: blocco assoluto nel helper remoto prima di creare il trasporto, rifiuto di SMTP al bootstrap, indirizzi sintetici .invalid e destinatari iniziali vuoti. Seeder separato, offline di default; --apply e --confirm-new-atlas più conferma ambiente/host/database esatto richiesti. Rifiuta qualunque collezione esistente, prende un marker atomico e non fa drop/delete/reset. Credenziali soltanto in file privato esterno al repository, creato senza sovrascrittura. Bootstrap senza autoCreate/autoIndex, bloccato fino al marker ready.

Verifiche finali:

- Backend: **358/358 test in 41 suite**, comprese prove reali di firma/verifica JWT e bcrypt con modelli database simulati, CORS/preflight con proxy HTTPS simulato, revoca sessioni, GPS obbligatorio, fuori sede e pause, route case-insensitive, rate limit, blocco SMTP, nuovo seed con filesystem/DB simulati, schema dei dati sintetici e protezioni di bootstrap.
- Frontend: **35/35 test**, inclusi URL HTTPS remoto configurabile, rifiuto variabili VITE sconosciute o endpoint non sicuri, login senza autofill e controlli account disabilitati via SSR. Nessun test SSR è presentato come collaudo browser.
- ESLint riuscito. Aggiunta dist-showcase alle esclusioni perché è output compilato, come dist; i 166 errori iniziali erano esclusivamente nel bundle generato e sono risolti dall'esclusione corretta. Corretti anche i soli problemi di caricamento/fixture del nuovo test SSR prima della verifica finale.
- Build standard e build Showcase separate riuscite, entrambe con generazione PWA. URL HTTPS di esempio usato solo per compilazione, mai contattato. Artifact remoto verificato: URL atteso presente, nessuna password locale di autofill, nessun endpoint 127.0.0.1/localhost:5055, nessuna source map.
- YAML Render e TOML Netlify analizzati localmente; una sola istanza e autoDeployTrigger off. Non effettuata validazione provider-side.
- Tutti i nuovi script passano node --check; git diff --check pulito. Nessuna dipendenza installata o aggiunta. File .env, backup, appunti e screenshot locali precedenti confrontati per hash: invariati. Output build esclusi da Git. Nessuna modifica a server.js, launcher/GPS locali, vite.config.js, index.html o icone attive; proposta icona conservata separata.

Blocchi intenzionali: nuovi servizi/URL e cluster non creati, credenziali/chiave JWT/sede da configurare privatamente, seed non eseguito, collaudo HTTPS pubblico e smartphone fisico non eseguiti. Pronto per revisione e successiva fase esterna autorizzata, non dichiarato già online. Cliente 1, Office Work e demo pubblica esistente non toccati.


## Sostituzione demo pubblica — preparazione locale e conferme dell’utente

Il piano attivo è [SHOWCASE_PUBLIC_REPLACEMENT_2026-11-11.md](SHOWCASE_PUBLIC_REPLACEMENT_2026-11-11.md). Correzione essenziale rispetto all’indagine iniziale: **la destinazione di pubblicazione è POrtalda/office-clocking-demo, non origin di questo worktree**. Il repository principale POrtalda/office_clocking non va aggiornato o riconfigurato. Il worktree conserva branch feature/demo-november-showcase e HEAD 2341fd46ac68c13b4e7166a93d6fe9df5ca373ef, con tutte le modifiche locali precedenti.

Conferme dell’utente: Netlify e Render collegati al repository demo / main; Render Auto-Deploy On Commit attivo e start npm start. Verifica GitHub dedicata e git ls-remote concordano su main ef42d576f49453cf7e798a545c1e790a874be2a9, senza branch Showcase remoto. Il tree del commit non contiene configurazioni Netlify/Render o workflow .github; status/workflow run restituiti sono vuoti, senza dedurre assenza di automazioni cloud. Origin locale rimane invece office_clocking, con upstream feature/demo-november-showcase → origin/demo: metadati condivisi non modificati e destinazione da non usare per pubblicazione.

La pagina pubblica https://office-clocking-demo.netlify.app/login è stata aperta in sola lettura, senza login. Il bundle pubblico index-BNiyclTc.js (GET 200, SHA-256 964bb261f7ff5ea9e86cbe24d232877b89790511f27cad87fba880f8d1a70769) punta a https://office-clocking-backend-demo.onrender.com. Il pannello autenticato Netlify non era ispezionabile e il link Render non è ancora stato recuperato; site ID, service ID, deploy precedenti e indipendenza completa da Cliente 1 restano da verificare. Repository e branch confermati dall’utente non bastano da soli a certificare l’isolamento Render.

Configurazione locale aggiornata: CLIENT_URL pubblico fisso e API demo osservata nel modello; registro manuale reuse-existing.example.json con ID sconosciuti null e demoOnlyConfirmed=false; TOML come riferimento per il sito esistente; YAML marcato soltanto come alternativa nuova risorsa con repository dedicato esplicito. Start proposto node scripts/startRemoteShowcase.js, da applicare solo in un passaggio cloud autorizzato. Il comando attuale npm start sul cloud non è stato cambiato.

Sequenza: inventario e rollback privato → autorizzazione al congelamento dei soli trigger demo → autorizzazioni distinte per nuovo Atlas e seed → snapshot revisionato in futuro checkout isolato del repository demo, su branch di preparazione → autorizzazione al cambio temporaneo branch/avvio Render e al deploy SHA preciso → pubblicazione manuale dello Showcase sul medesimo site ID Netlify → collaudo HTTPS/PWA → soltanto dopo readiness/collaudo, eventuale promozione main del repository demo con consenso distinto, auto-deploy ancora congelati. Nessun trasferimento della storia del repository principale, nessun force push. Lo stesso origin conserva service worker/localStorage vecchi: documentato l’aggiornamento mirato e il rifiuto dei vecchi JWT/password.

Rollback coordinato frontend+backend con deploy ID precedenti, vecchia configurazione privata verificata e vecchio DB demo conservato; vietato invertire coppie codice/DB o ripristinare SMTP/gruppi Cliente 1 alla cieca. Nessun reset/copia inversa. Ogni ripristino e riattivazione trigger richiede un’autorizzazione.

Verifiche in questa preparazione: **359 test backend in 41 suite**, **36 frontend**, ESLint, build standard e Showcase/PWA riuscite. JSON/TOML e diff check puliti; bundle della build puntato all’API esistente con HTTPS/CSP. Codice runtime/policy, messaggio fuori sede e tema invariati per hash, così come .env, backup e screenshot locali precedenti. Non sono stati ripetuti login o scritture sul sito live, né dichiarati funzionanti i servizi Showcase prima del deploy.

Nessun commit, fetch, push, merge, deploy, seed o modifica cloud/database effettuato. Cliente 1 e Office Work non modificati. Non è stata chiesta o ottenuta autorizzazione per operazioni cloud: il lavoro svolto è solo preparazione, verifica e documentazione locale.


## Commit locale — preparazione remota e sostituzione pubblica

Controllati branch feature/demo-november-showcase, HEAD base 2341fd46ac68c13b4e7166a93d6fe9df5ca373ef, stato Git, diff e file non tracciati. Selezionati esplicitamente 33 file di codice, test, configurazione e documentazione approvati, inclusi i due piani di deploy/sostituzione. Non si includono .env, password reali, chiavi, backup, screenshot, temporanei, database o output dist/dist-showcase. Le credenziali nei soli test sono fixture sintetiche; i modelli configurazione hanno placeholder, non segreti operativi.

La destinazione documentata resta POrtalda/office-clocking-demo. Origin locale POrtalda/office_clocking non cambiato e non usato per pubblicazione; nessun push o modifica di main. Il riuso Render non è dichiarato verificato: site/service ID mancanti e demoOnlyConfirmed=false restano gate obbligatori. Nessun bootstrap ordinario, bypass GPS locale o asset attivo modificato. Le nuove restrizioni runtime sono opt-in APP_ENV=showcase e richiedono Atlas remoto dedicato, JWT separato e email bloccate; nessuna configurazione produzione Cliente 1 è applicata o modificata.

Diff check prima dello staging e dopo lo staging; inventario e scansione pattern per segreti/artefatti. Gli esiti funzionali già registrati (359 backend, 36 frontend, lint e build standard/Showcase/PWA) sono del collaudo precedente: nessun codice cambiato in questa preparazione commit. Nessun nuovo seed, avvio API, accesso DB o comando cloud eseguito. La creazione è soltanto un commit locale sul branch indicato, previa verifica dei controlli; hash e stato finale sono comunicati in chat.

### Inventario del commit (33 file)

- `SHOWCASE_PUBLIC_REPLACEMENT_2026-11-11.md`
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
- `deploy/showcase/reuse-existing.example.json`
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


## Predisposizione privata file Showcase — solo offline

L'utente comunica un nuovo progetto Atlas con host showcasecluster.xed8r0t.mongodb.net, database office_clocking_showcase_20261113, utenti distinti showcase_runtime (readWrite) e showcase_seed (readWrite/dbAdmin) sul solo DB; IP dichiarati autorizzati. Non è stata eseguita alcuna verifica di rete, autenticazione o ruolo effettivo sul cluster.

Preparata la procedura deploy/showcase/Configure-PrivateShowcase.ps1 e la guida [SHOWCASE_PRIVATE_SETUP_2026-11-11.md](SHOWCASE_PRIVATE_SETUP_2026-11-11.md). Creata C:/Office-Clocking-Secrets con i soli modelli showcase-seed.env e showcase-runtime.env, esterni al repository. Verificati realmente proprietario SID corrente, singola regola FullControl per tale SID ed ereditarietà della cartella disabilitata; file con sola eredità da quella ACL. Nessun segreto nei modelli: URI, JWT e coordinate reali ancora vuoti. Nessun file partecipanti creato.

Configure, da eseguire privatamente dall'utente in PowerShell 7.2+, acquisisce password Atlas tramite SecureString, compone URI con account/host fissati e caratteri riservati codificati, genera JWT casuale e chiede la sede reale. Scrive solo modelli vuoti esatti, non sovrascrive configurazioni già compilate e non stampa valori. Check usa ambiente Node ripulito e file espliciti; nessuna vecchia .env, URI Cliente 1 o connessione della vecchia demo viene utilizzata.

Aggiunto npm run showcase come comando offline plan-only, distinto da start/seed: eseguito con npm offline e update notifier disabilitato, risultato positivo con 16 account, 284 record e 2 assenze pianificati, zero credenziali/record creati e nessuna connessione DB. Il controllo sui file reali segnala correttamente configurazione INCOMPLETE: SHOWCASE_SEED_URI, MONGO_URI, JWT_SECRET, OFFICE_LAT e OFFICE_LNG mancanti. Bootstrap runtime non avviato con i modelli incompleti. Dopo Configure, lo stesso Check può eseguire startRemoteShowcase.js --check e ritorna prima di Mongoose/listen.

Verifiche: 11 test offline mirati in 2 suite superati, inclusa prova del ramo runtime --check su fixture senza connettere DB o aprire porte. Sintassi PowerShell/Node verificata. Funzioni di codifica URI/modelli/generazione casuale provate solo in memoria, senza scritture di password o GPS fittizi nei file privati. Configurazione completa e autenticazione Atlas reali restano da verificare dopo l'inserimento privato dei valori; nessun esito di connettività viene simulato.

Nessun seed, avvio API, push, commit, merge, deploy o modifica Render/Netlify. Cliente 1, Office Work, vecchio DB e configurazioni locali preesistenti non modificati. Nessuna password, JWT o URI con credenziali stampata o aggiunta a Git.


## 11 novembre 2026 — GPS facoltativo nella sola istanza Showcase remota

Richiesta implementata localmente sul branch `feature/demo-november-showcase`, preservando le modifiche preesistenti (inclusa preparazione privata offline). Nessun commit, push, merge, deploy, seed, modifica cloud o database.

- Stato iniziale: `DEMO_MODE=true` da solo non esentava dal GPS; il frontend consultava la policy soltanto in demo locale e il profilo remoto imponeva la posizione anche agli utenti con esenzione personale.
- Nuovo opt-in server `SHOWCASE_GPS_CHECK_DISABLED=true`: ammesso solo con profilo Showcase completo e valido, HTTPS, host API e origine frontend esatti. Assente/false mantiene i controlli; valori diversi da true/false impediscono l’avvio Showcase. Il bypass locale rimane separato e vietato in remoto. Una produzione ordinaria rifiuta il nuovo marker anche con flag impostato.
- La policy autenticata aggiunge `canSkipShowcaseGps` mantenendo `canSkipGps` per la sola demo locale. Il frontend remoto autorizzato invia `showcaseWithoutGps:true` per entrata, uscita e pause senza richiedere posizione. Coordinate assenti restano nulle; coordinate insieme al marker sono rifiutate. Richieste senza marker mantengono il normale controllo GPS.
- Interfaccia: indicazione “DEMO online — controllo GPS disattivato” e descrizione della disponibilità GPS nella versione aziendale. Policy assente/malformata non abilita l’esenzione; la policy ricevuta non viene ereditata da un altro account. Fuori sede resta distinto, con motivazione obbligatoria. Messaggio di motivazione sotto il pulsante e stili precedenti preservati.
- Nessuna nuova variabile VITE. `DEMO_LOCAL_GPS_BYPASS=false` e `GEOLOCATION_CLOCK_IN_ENABLED=true` restano obbligatori; sede reale/raggio restano configurati per il ripristino dei controlli. Aggiornati esempio variabili e guide deploy/sostituzione/configurazione privata.

Verifiche effettive:

- Backend completo: **42 suite, 376 test superati**, inclusi login/JWT, email bloccate, timbrature/pause e nuove prove su autorizzazione remota, revoca, rifiuto marker locali/contraffatti, conflitti e diniego in produzione ordinaria. Modelli database mockati nei test delle API.
- Frontend completo: **41 test superati**, inclusi 5 nuovi test su profilo remoto, policy esplicita, payload senza coordinate, errore GPS senza fallback e motivazione fuori sede.
- `npm run lint`: superato. `npm run build:showcase` con API HTTPS della demo: superato, output ignorato `frontend/dist-showcase`, nessuna pubblicazione.
- `npm run showcase`: piano esclusivamente offline, nessuna credenziale creata e nessuna connessione DB.
- Controllo privato `Configure-PrivateShowcase.ps1 -Action Check`: percorsi esterni, proprietario/ACL riservati all’utente corrente, profili seed/runtime separati validi, bootstrap runtime `--check` superato senza connessioni o porte aperte. Hash prima/dopo identici, nessun valore riservato stampato.
- Nel runtime privato attuale il nuovo flag è **assente**: file ancora valido, GPS richiesto. Anche la validazione con flag true, eseguita solo su copia in memoria, è superata. Nessun file privato modificato.
- `git diff --check`: superato.

Limiti: nessun collaudo browser/HTTPS remoto eseguito in questo intervento, nessuna verifica di connettività Atlas. L’esenzione è pronta nel codice ma non attiva online. Per attivarla servirà aggiungere privatamente il flag al runtime della sola istanza Showcase e applicarlo sul servizio soltanto dopo verifica dell’isolamento da Cliente 1 e specifica autorizzazione di pubblicazione. Seguire il collaudo e il rollback documentati; non cambiare origin.


## 11 novembre 2026 — nome database corretto e recupero preparato

Autorizzata e applicata localmente la destinazione esatta `office_clocking_showcase_20261113` (32 byte), host invariato `showcasecluster.xed8r0t.mongodb.net`. Aggiornati costante condivisa, generatore URI PowerShell, esempio riuso servizi, fixture/test e documentazione attiva; il nome lungo resta esclusivamente nella diagnosi storica marcata come tale e nel test negativo che ne verifica il rifiuto. Nessun allargamento dei validatori a database arbitrari. PURPOSE e issuer invariati, non richiedono rotazione di JWT.

Le due URI private sono state aggiornate cambiando soltanto il percorso DB; confronto in memoria conferma password, JWT e tutte le altre variabili invariati. ACL/owner e collocazione esterna al repository verificati con configuratore in Check. Nessun segreto stampato, nessuna lettura/scrittura/rinomina/cancellazione del file reale password dei 16 account. Solo controllo di esistenza.

Nuovo `backend/scripts/recoverRemoteShowcase.js`: default/--check offline, nessuna lettura delle password e nessuna connessione. Applicazione futura richiede quattro conferme, host/database/utente esatti, database senza alcuna collezione, con riuso delle password esistenti, nessuna rigenerazione o scrittura del file. Popolamento e claim atomico condivisi col seeder; nuovo controllo vuoto prima del claim, stop su concorrenza/marker parziale, nessun reset. Percorso applicativo eseguito SOLO nei test con filesystem e database mockati. Il seed ordinario resta invariato e continua a rifiutare la sovrascrittura. Il controllo offline distingue ora profilo valido da seed ordinario consentito: file presente implica recupero richiesto, non errore di URI.

Verifiche finali effettive:

- Backend completo: **44 suite e 426 test superati**. Inclusi test di esclusività del nuovo nome e rifiuto del nome storico, nessuna lettura password in default/check, conferme obbligatorie, database non vuoto rifiutato prima della lettura credenziali, riuso esatto delle 16 password fixture nel solo mock.
- Controllo privato `Configure-PrivateShowcase.ps1 -Action Check`: ACL/owner, profili seed/runtime e utenti separati validi; avviso recupero richiesto; bootstrap runtime --check superato senza connessioni/porte aperte.
- `node scripts/recoverRemoteShowcase.js --check`: recovery-plan-only, accountPasswordsRead false, databaseConnection false. `npm run showcase`: piano offline 16 utenti/284 timbrature/2 assenze, nessuna credenziale creata o connessione.
- Sintassi Node di diagnostico e recupero e `git diff --check`: superati. Nessun frontend modificato in questo intervento; restano preservate le modifiche frontend precedenti.
- Diagnostica reale di SOLA LETTURA sul nuovo target: **PERMISSION_DENIED / MONGO_8000 / list-collections**. Lunghezza corretta, ma i ruoli Atlas attuali non consentono ancora la lettura del nuovo DB. Impossibile confermare DB vuoto. Nessuna scrittura Atlas eseguita e nessun documento letto.

Passi rimanenti: aggiornare manualmente sul SOLO nome nuovo `showcase_runtime` con readWrite e `showcase_seed` con readWrite + dbAdmin; mantenere password, nessun ruolo globale. Ripetere diagnostica di sola lettura; soltanto se EMPTY_DATABASE richiedere autorizzazione ad applicare il comando di recupero (che leggerà privatamente il file account per riusarlo). Su qualsiasi collezione/marker o errore fermarsi senza reset. Comandi esatti, ruoli e procedura in `SHOWCASE_DATABASE_RECOVERY_2026-11-11.md`. Nessuna modifica a Render/Netlify, Cliente 1, Office Work o altri database; nessun push/merge/deploy/seed.


## Recupero eseguito e verificato — 11 novembre 2026

L’utente ha autorizzato esplicitamente il recupero esclusivamente su `showcasecluster.xed8r0t.mongodb.net` / `office_clocking_showcase_20261113`, con riuso del file privato password esistente. Questa autorizzazione supera i precedenti punti della procedura che richiedevano un consenso ancora mancante.

- Branch e stato Git verificati, modifiche locali precedenti conservate. Procedura letta prima di operare.
- Configurazioni private, ACL/owner e bootstrap runtime offline verificati: OK, senza mostrare valori riservati.
- Rafforzato `recoverRemoteShowcase.js`: prima di OGNI operazione di scrittura (inclusi creazione collezione/indici e marker ready) viene nuovamente validato host/URI/utente del solo Showcase e il nome del database selezionato. Guard passato alla funzione condivisa di popolamento; il recupero rifiuta qualsiasi database non vuoto prima di leggere le password e ripete il controllo prima del claim atomico.
- Prima del tentativo reale: **42 test mirati superati in 2 suite**, inclusi riuso password fixture, diniego target errato e assenza di mutazioni su destinazione rifiutata. `git diff --check` superato.
- Diagnostica reale immediatamente precedente: `EMPTY_DATABASE / NONE / inspection-complete`.
- Eseguito UN SOLO tentativo del comando autorizzato `recoverRemoteShowcase.js --apply --reuse-existing-credentials --confirm-new-atlas --confirm-database=office_clocking_showcase_20261113`.
- Esito: `recovery-completed`, **16 utenti, 284 timbrature, 2 assenze**, exit code 0.
- Il file password account è stato letto privatamente solo dal percorso applicativo autorizzato per riutilizzare le 16 password. Nessuna rigenerazione, stampa, copia, sovrascrittura, rinomina o cancellazione. Nessuna rotazione JWT o modifica dei file env in questo intervento.
- Verifica successiva con connessione distinta in SOLA LETTURA usando l’utente `showcase_runtime`: `RECOVERY_VERIFIED`, marker **ready**, **16 utenti, 284 timbrature, 2 assenze**, un solo marker e un solo documento appsettings globali. Accesso runtime in lettura e target esatto verificati, exit code 0. Nessun singolo documento utente/password mostrato.

Il precedente blocco PERMISSION_DENIED non si è ripresentato nelle connessioni autorizzate di questo intervento; i ruoli sono stati aggiornati esternamente dall’operatore. L’agente non ha modificato permessi Atlas, Render, Netlify o altre risorse cloud. Le sole scritture Atlas sono quelle del popolamento autorizzato sul nuovo database Showcase. Nessun reset/drop/delete/migrazione, nessun accesso ad altri database, nessun push/merge/deploy e nessuna modifica a Cliente 1/Office Work.

**Il popolamento è completo. NON rieseguire seed o recupero sul database ora inizializzato.** La procedura precedente rimane come traccia delle condizioni e del comando eseguito, non come invito a ripeterlo. Non è stata eseguita una prova reale di login o timbratura nell’app.

Restano separate le attività di pubblicazione: verifica definitiva dell’isolamento del servizio Render demo da Cliente 1, configurazione cloud del runtime e dell’eventuale esenzione GPS remota, bootstrap/deploy e collaudo HTTPS login/API/PWA. Richiedono le autorizzazioni specifiche del piano di sostituzione. Nessun blocco residuo rilevato nel popolamento e nella verifica marker/conteggi/accesso runtime in lettura.


## 11 novembre 2026 — preparazione commit e clone indipendente della demo

Sorgente verificata su feature/demo-november-showcase; origin invariato e non destinazione di push. Clone indipendente del solo POrtalda/office-clocking-demo predisposto in C:\Office-Clocking\office-clocking-demo-publish-20261111. main e riferimento rollback locale/tag conservati a ef42d576f49453cf7e798a545c1e790a874be2a9, branch preparatorio prepare/showcase-20261113 senza upstream main; push.default=nothing nel solo clone.

Conferme dell’utente: Render srv-d7tn3breo5us738b14ag, Auto-Deploy OFF; Netlify build Active, production main, branch deploy solo produzione, PR preview abilitate. Il solo push del branch senza PR non dovrebbe avviare Branch deploy secondo queste impostazioni; hook/automazioni esterne restano da verificare. Root netlify.toml configura build Showcase e annulla contesti branch-deploy/deploy-preview (ignore 0 + command errore), senza cambiare il cloud. Piano in SHOWCASE_PUBLICATION_READY_2026-11-11.md.

Snapshot: root .gitignore, backend/.env.test tolto dal tracking ma conservato fisicamente; Jest usa default pubblici senza leggere file env. Modelli .env.example senza valori privati mantenuti. Proposta icona separata. Scansione candidati: nessun segreto/file escluso rilevato. Password/private env/backup/build/screenshot esclusi; trasferimento solo tramite git archive del commit sorgente.

Verifiche sorgente: **44 suite / 428 test backend superati; 41 test frontend superati; ESLint e build Showcase HTTPS superati**; TOML e guardie preview verificati, git diff --check superato. Nessuna connessione Atlas/credenziali, seed o push/merge/deploy. I riscontri del clone saranno nel suo verbale prima del commit finale.

Il primo comando di commit è stato respinto dall’approvazione automatica perché proponeva un override di hooksPath. Nessuna parte di quel comando è stata eseguita. Verificati hooksPath non configurato e directory hook con soli file .sample: il commit viene eseguito normalmente senza disabilitare hook.


## Collaudo effettivo del clone pulito e completamento preparazione

Commit locale sorgente principale di questa preparazione: 20800edd2ebdd6c1c4cc64bb0db7374be9a5ec00 (32 file, include GPS remoto, diagnostico/recupero, nome DB corretto, documentazione e configurazioni). Copiati esclusivamente i suoi 218 file con git archive, senza storia Git o file privati; l’albero Git prima delle rifiniture coincideva esattamente con 1d7acf6076c9a9e55420c4454091201e3f737048.

Nel clone isolato, npm ci --offline è riuscito per entrambi i lockfile. Avvisi npm di deprecazione preesistenti: inflight/glob; nessun upgrade o modifica lockfile. Il test demoBanner ha evidenziato dipendenza preesistente da .env locale: corretto con envDir:false e flag fixture pubblici espliciti. Corretti inoltre soli whitespace preesistenti in backend/routes/admin.js, backend/scripts/seedShowcase.js e backend/tests/admin/adminSummary.test.js per consentire diff --check rispetto alla vecchia main. Le stesse quattro correzioni sono allineate alla sorgente con un commit aggiuntivo; nessuna modifica funzionale.

Verifiche FINALI del clone senza .env: **44 suite / 428 test backend superati; 41 test frontend superati; ESLint e build Showcase HTTPS/PWA superati**. Guardie Netlify branch/PR eseguite localmente: ignore exit0, command exit1. Stato remoto letto di nuovo: main ef42d576f49453cf7e798a545c1e790a874be2a9, branch prepare/showcase-20261113 non presente. Rollback branch/tag locali e main restano sul vecchio SHA. Nessun push/PR/merge/deploy/cloud/DB/credenziali toccato. Il verbale nel clone registra provenienza finale, integrità dello snapshot, comandi futuri e limiti del rollback; non costituisce un deploy eseguito.
