# Avvio Office Clocking — demo locale senza GPS

Progetto: `C:\Office-Clocking\office-clocking-demo-showcase`.
Branch: `feature/demo-november-showcase`.

## Avvio in due terminali PowerShell

Prerequisiti: Node/npm e dipendenze backend/frontend già installati; MongoDB locale già avviato sulla porta 27017 con il database esistente `office_clocking_showcase_v2`. Nessuno dei comandi seguenti esegue seed o migrazioni.

Primo terminale (configurazione una tantum e backend):

```powershell
Set-Location -LiteralPath 'C:\Office-Clocking\office-clocking-demo-showcase\backend'
npm run demo:configure
npm run demo:check
npm run demo:local
```

`demo:configure` è già stato eseguito durante la preparazione. Se ripetuto conserva il file esistente: non sovrascrive configurazioni locali. Genera una chiave JWT casuale in `backend/.env.showcase.local`, escluso da Git; non legge né modifica MongoDB. Il modello senza segreti è `backend/config/showcase-local.example.txt`.

`demo:check` controlla esclusivamente la configurazione, senza aprire connessioni. Se fallisce, verificare il file locale e le variabili ereditate da PowerShell: il launcher non sovrascrive variabili già presenti. In particolare un NODE_ENV di produzione o un MONGO_URI diverso fanno interrompere l'avvio prima della connessione. Non riutilizzare una shell configurata per una produzione. Non cambiare configurazioni di altri progetti.

Il backend ascolta **solo su 127.0.0.1:5055**. La creazione automatica di collezioni e indici Mongoose è disattivata nel launcher; non vengono ricreati dati. Nessuna configurazione SMTP è fornita dal modello locale.

Secondo terminale (frontend):

```powershell
Set-Location -LiteralPath 'C:\Office-Clocking\office-clocking-demo-showcase\frontend'
if (-not (Test-Path -LiteralPath '.env.demo-local')) {
  Copy-Item -LiteralPath 'config/demo-local.example.txt' -Destination '.env.demo-local'
}
npm run dev:demo-local
```

Aprire esattamente **http://127.0.0.1:5175**. Il frontend usa `frontend/.env.demo-local` con API **http://127.0.0.1:5055**. Le porte sono dedicate a questa demo e non sostituiscono eventuali servizi su 5000/5173. Se una porta è occupata, non viene scelta automaticamente un'altra porta: controllare il processo che la occupa senza arrestare servizi di altri progetti. Ctrl+C nei due terminali arresta i processi avviati qui.

## Riconoscere la modalità e usarla

Il banner globale è stato rimosso dalla visualizzazione. Le dashboard conservano le indicazioni contestuali DEMO e la login mantiene i profili dimostrativi personalizzati. Modalità DEMO e protezioni backend restano attive. Il pulsante luna/sole nelle Home ricorda il tema per account, condiviso tra le pagine; il primo accesso usa il tema chiaro.

Dopo il login utente, il frontend richiede al backend autenticato `/api/records/gps-policy`. Durante il controllo i pulsanti di timbratura/pausa sono temporaneamente disabilitati. Quando autorizzato, la scheda geolocalizzazione di Home User mostra: **Demo locale: entrata, uscita e pause disponibili senza GPS. Nessuna coordinata viene generata.**

Entrata, uscita, inizio pausa e fine pausa inviano `demoWithoutGps: true` senza il campo `location`. Le informazioni GPS salvate da queste operazioni restano nulle: non sono posizioni validate. Nessuna coordinata viene simulata. La modalità esplicitamente fuori sede è separata dal percorso DEMO senza GPS; vedi l’aggiornamento funzionalità dell’11 novembre in fondo alla guida.

Il ciclo di timbratura resta quello esistente: entrata → inizio pausa → fine pausa → uscita. Per più pause ripetere inizio/fine prima dell'uscita. Una pausa aperta continua a bloccare l'uscita. Restano attivi i controlli su assenze, anomalie, sessioni e ore nette.

Le azioni dell'utente nell'app scrivono normalmente nel database demo: durante la preparazione non è stata eseguita alcuna timbratura reale e nessun dato è stato modificato. Per una prova senza scritture usare i test automatizzati, che simulano i modelli del database.

Per consultare dati già disponibili senza timbrare, selezionare il **12 novembre 2026** nei riepiloghi/storico. Il 13 novembre non ha dati precaricati. L'account `luca` conserva la richiesta di chiusura manuale pendente del 9 novembre: considerarlo uno scenario amministrativo, non il profilo da scegliere per una nuova entrata.

## Limiti deliberati del percorso senza GPS

L'eccezione richiede contemporaneamente:

- Backend: NODE_ENV=development, DEMO_MODE=true, DEMO_LOCAL_GPS_BYPASS=true, MongoDB su loopback con nome esatto office_clocking_showcase_v2.
- Richiesta diretta: indirizzo socket e Host locali; Origin locale quando presente; nessun header Forwarded o X-Forwarded-*.
- Frontend: server Vite di sviluppo, modalità demo-local, entrambi i flag VITE demo a true, pagina e URL API su loopback.
- Conferma esplicita del server e richiesta marcata demoWithoutGps.

In produzione, senza i flag, su un host remoto, con un altro database o dietro proxy l'eccezione non si abilita. Il backend rifiuta il marker non autorizzato con HTTP 403 / DEMO_GPS_BYPASS_NOT_ALLOWED. Senza marker si applicano gli stessi controlli GPS precedenti alla modifica, comprese le impostazioni già esistenti per utente e ambiente.

**Usare `dev:demo-local` per la presentazione locale.** Una build Vite, anche compilata con `--mode demo-local`, non abilita questo percorso: DEV è false. `npm run build` serve a verificare la compilazione, non sostituisce il comando di avvio della demo senza GPS. Non usare un indirizzo LAN da smartphone: questa eccezione è intenzionalmente limitata al computer locale; per valutare il layout mobile usare gli strumenti responsive del browser sullo stesso computer.

## Verifiche ripetibili senza scrivere dati reali

Backend:

```powershell
Set-Location -LiteralPath 'C:\Office-Clocking\office-clocking-demo-showcase\backend'
npm test
npm run demo:check
```

Frontend:

```powershell
Set-Location -LiteralPath 'C:\Office-Clocking\office-clocking-demo-showcase\frontend'
npm test
npm run build
```

I test backend coprono il funzionamento senza coordinate dei quattro endpoint e il rifiuto del marker in produzione, oltre a database errato, host remoti, proxy, flag mancanti e configurazione del launcher. I test frontend verificano che la demo autorizzata non chiami il GPS e non generi coordinate, mentre la modalità normale continua a richiederlo.

Il collaudo visuale/browser desktop e mobile resta da completare: questa preparazione non lo sostituisce e non ne simula l'esito. Nessun push, merge o deploy è stato eseguito.


## Funzionalità completate — 11 novembre 2026

- Le sezioni principali User e Admin hanno un riepilogo con freccia: clic, Invio o Spazio aprono/chiudono i contenuti senza azzerare moduli e dati. I collegamenti del riepilogo rapido riaprono la sezione di destinazione.
- **Fuori sede:** nella Home User, aprire “Modalità della prossima entrata/uscita”, scegliere “Fuori sede”, inserire una motivazione (1–500 caratteri), poi timbrare. Non viene richiesto il GPS e non vengono inviate coordinate. La motivazione è obbligatoria anche sul server. Questa scelta riguarda entrata/uscita; le pause mantengono il proprio flusso GPS/DEMO. Non confondere la scelta esplicita fuori sede con la normale timbratura locale DEMO senza GPS.
- **Presenze:** aprire “Presenze giornaliere” in Admin e selezionare la data. Entrati, non entrati e assenti sono categorie distinte, riferite al giorno Europe/Rome; utenti disattivati e Admin sono esclusi dal gruppo dei dipendenti. Una pausa non equivale a un'assenza o a una mancata entrata.
- **Correzioni:** in Admin → “Dettaglio giornaliero”, cercare dipendente/data e usare “Correggi” su una sessione conclusa non annullata. Compilare entrata/uscita Europe/Rome e motivazione obbligatoria, poi salvare. Le pause restano agli orari registrati: se non rientrano nel nuovo intervallo, il salvataggio è rifiutato. Sono bloccate sovrapposizioni, dati cambiati durante l'operazione, orari inesistenti o doppi al cambio d'ora. Lo storico non viene sostituito e resta visibile nei dettagli Admin e nello Storico personale. Le sessioni aperte conservano il flusso già previsto di chiusura/manuale, non questo modulo di correzione.
- **Email:** fuori sede e malattia (tipo mutua) notificano i destinatari in AppSettings.leaveNotificationEmails. Le date delle assenze sono formattate sempre in Europe/Rome, indipendentemente dal fuso del server. Sono necessarie le configurazioni SMTP già previste dal backend per la consegna effettiva: il modello locale non contiene credenziali SMTP e in questa preparazione non è stata eseguita alcuna consegna reale.

Le operazioni descritte, se eseguite manualmente nell'app, salvano dati nel database demo. Durante lo sviluppo e i test non sono state eseguite sul database reale. Per verifiche senza scritture e senza email reali:

```powershell
Set-Location -LiteralPath 'C:\Office-Clocking\office-clocking-demo-showcase\backend'
npm test
```

```powershell
Set-Location -LiteralPath 'C:\Office-Clocking\office-clocking-demo-showcase\frontend'
npm test
npm run lint
npm run build
```

Il test frontend include rendering server dei componenti reali e dei loro stati iniziali; non sostituisce il collaudo browser desktop/mobile. La consegna SMTP è verificata solo tramite mailer simulato nei test, con controllo di destinatari e contenuto.


## Grafica e preferenze — 11 novembre 2026

L'orologio digitale User non è più richiudibile: rimane in alto durante lo scorrimento, con stato corrente e navigazione rapida. Tutte le altre sezioni User/Admin sono chiuse al primo accesso e ricordano l'ultima apertura/chiusura per account, ruolo e pagina; le preferenze contengono solo booleani e chiavi identità derivate con SHA-256. Eventuali problemi di localStorage non bloccano moduli e operazioni.

Presenze giornaliere usa la stessa intestazione delle altre sezioni Admin. Per aprire una sezione usare clic, Invio o Spazio; i campi non vengono azzerati chiudendola.

La proposta icona è separata in frontend/icon-proposals/digital-check-v1/: aprire preview.html per confrontare le dimensioni. Favicon, icone PWA e configurazione attivi non sono stati cambiati.

Per ripetere soltanto il collaudo grafico senza database o email:

```powershell
Set-Location -LiteralPath 'C:\Office-Clocking\office-clocking-demo-showcase\frontend'
node tests/visual-check/server.mjs
```

Aprire http://127.0.0.1:5176/tests/visual-check/index.html. Questa pagina usa componenti reali con account e API fittizi; ogni scrittura è disabilitata. Non sostituisce un test end-to-end sul backend. Ctrl+C termina il server. Il collaudo corrente è stato concluso e il server arrestato.

I file `.env` e `.env.*` sono esclusi dal commit, anche i precedenti modelli con quel nome. I due modelli pubblici `config/*.example.txt` contengono solo parametri locali e nessuna credenziale. Le configurazioni esistenti non vengono sovrascritte. Screenshot di collaudo e backup rimangono locali; gli asset icona proposti sono invece inclusi, separati dagli asset applicati.
