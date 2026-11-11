# Office Clocking — configurazione privata PowerShell (solo offline)

Progetto `C:\Office-Clocking\office-clocking-demo-showcase`, branch `feature/demo-november-showcase`.

## Stato verificato

- Nuovo host Atlas e ruoli comunicati dall'utente: `showcasecluster.xed8r0t.mongodb.net`, DB `office_clocking_showcase_20261113`, utenti distinti `showcase_seed` e `showcase_runtime`. Queste informazioni sono dichiarate dall'utente; non è stata aperta una connessione per verificarle.
- Creata soltanto `C:\Office-Clocking-Secrets`, esterna al repository e non collegata tramite junction/symlink, con due modelli privati: `showcase-seed.env` e `showcase-runtime.env`.
- ACL effettivamente controllate: proprietario utente corrente, una sola regola Allow FullControl per il SID corrente; ereditarietà disabilitata sulla cartella. I file ereditano solo quella regola. Nessun accesso aggiunto a Users, Everyone, Administrators o SYSTEM.
- I modelli non contengono password, URI con credenziali o JWT. URI/JWT e coordinate reali sono intenzionalmente vuoti. Non si generano coordinate o credenziali Atlas fittizie per far passare la verifica.
- Il file futuro `C:\Office-Clocking-Secrets\showcase-accounts.json` è soltanto il percorso di destinazione delle password degli account applicativi quando un futuro seed sarà autorizzato: non è stato creato.
- `npm run showcase` è stato aggiunto come comando **offline plan-only**. Non è un alias di start o del seed con --apply. Riporta 16 account, 284 record e 2 assenze pianificati; non li crea.

## Passaggi da eseguire privatamente

Usare **PowerShell 7.2 o superiore** (`pwsh`), non Windows PowerShell 5.1. Sulla postazione sono stati verificati PowerShell 7.6.9 e Node 22.13.0.

1. Aprire un terminale PowerShell locale. Non inserire i segreti in chat, negli argomenti di un comando o in uno script versionato. Non usare Start-Transcript o stampare il contenuto degli .env. La procedura seguente acquisisce le password con Read-Host -AsSecureString; non chiede di incollare un URI completo.
2. Eseguire:

   ```powershell
   Set-Location -LiteralPath 'C:\Office-Clocking\office-clocking-demo-showcase'
   & '.\deploy\showcase\Configure-PrivateShowcase.ps1' -Action Configure
   ```

3. Ai prompt inserire solo le password **già impostate su Atlas** per i due utenti dedicati, poi latitudine e longitudine reali della sede (punto decimale) e il raggio tra 1 e 1000 metri; Invio sul raggio mantiene 100. Le password devono essere distinte. Il comando non cambia le password su Atlas.
4. Lo script compone gli URI usando account e cluster fissati, con codifica percentuale dei caratteri riservati. Genera una nuova JWT di 32 byte casuali/64 caratteri hex direttamente in memoria e la salva soltanto nel file runtime privato. Nessun URI, password, JWT o coordinata viene mostrato nell'output.
5. Lo script compila esclusivamente i modelli vuoti esatti creati da Initialize. Se trova file già compilati/diversi o un file partecipanti già esistente, si ferma senza sovrascriverli. Non rigenera una JWT esistente e non fa backup contenenti segreti. Non eseguire Initialize pensando che azzeri configurazioni: non sovrascrive file esistenti.
6. Per ripetere i controlli, senza modificare i file:

   ```powershell
   & '.\deploy\showcase\Configure-PrivateShowcase.ps1' -Action Check
   ```

   Prima verifica posizione, proprietario e ACL, poi analizza soltanto i due file espliciti senza caricare .env locali o process.env applicativi. Se completi e validi, avvia un processo Node con ambiente ripulito e **soltanto** `--env-file=<runtime> scripts/startRemoteShowcase.js --check`. Il bootstrap ritorna prima di importare Mongoose, connettere il DB o aprire una porta. Se incompleti, ritorna esito non positivo e non avvia il bootstrap. Non mostra eccezioni con possibili valori sensibili.
7. Il piano offline si può ripetere separatamente:

   ```powershell
   Set-Location -LiteralPath 'C:\Office-Clocking\office-clocking-demo-showcase\backend'
   npm --offline --no-update-notifier run showcase
   ```

Non usare `npm start`, `showcase:start`, launcher locali o comandi --apply in questa fase. Non trasferire ancora i file su Render. Nessun comando qui esegue seed, push, deploy o modifiche a Render/Netlify.

## Variabili di showcase-seed.env

| Variabile | Come viene valorizzata |
| --- | --- |
| APP_ENV | `showcase`, già predisposta |
| SHOWCASE_ATLAS_HOST | `showcasecluster.xed8r0t.mongodb.net`, già predisposta |
| SHOWCASE_SEED_URI | composta privatamente con username `showcase_seed` e relativa password inserita al prompt |
| SHOWCASE_SEED_CONFIRM | `office-clocking-remote-20261113`, già predisposta; non avvia nulla da sola |
| SHOWCASE_CREDENTIALS_FILE | `C:\Office-Clocking-Secrets\showcase-accounts.json`, già predisposta; deve restare inesistente fino al seed autorizzato |

Non aggiungere MONGO_URI, JWT_SECRET, SMTP_* o credenziali runtime al file seed. I ruoli readWrite/dbAdmin sul solo DB Showcase restano quelli dichiarati dall'utente; non vengono modificati da questa procedura.

## Variabili di showcase-runtime.env

| Variabile | Come viene valorizzata |
| --- | --- |
| APP_ENV | `showcase` |
| NODE_ENV | `production` |
| DEMO_MODE | `true` |
| DEMO_LOCAL_GPS_BYPASS | `false` |
| GEOLOCATION_CLOCK_IN_ENABLED | `true` |
| SHOWCASE_EMAIL_MODE | `disabled` |
| SHOWCASE_ADMIN_USERNAME | `showcase_admin` (account applicativo, distinto dagli utenti Atlas) |
| CLIENT_URL | `https://office-clocking-demo.netlify.app` |
| SHOWCASE_API_URL | `https://office-clocking-backend-demo.onrender.com` |
| SHOWCASE_ATLAS_HOST | `showcasecluster.xed8r0t.mongodb.net` |
| MONGO_URI | composta privatamente con username `showcase_runtime` e relativa password, senza riutilizzare il seed user |
| JWT_SECRET | nuova chiave casuale generata privatamente dallo script, non inserita in chat o stampata |
| OFFICE_LAT | latitudine **reale**, da inserire al prompt |
| OFFICE_LNG | longitudine **reale**, da inserire al prompt |
| OFFICE_RADIUS_METERS | raggio reale 1–1000 m; default 100 |

Non inserire variabili seed o SMTP nel runtime. PORT sarà fornita dal servizio Render quando in futuro sarà autorizzata la pubblicazione; non serve al controllo offline.

Gli URI costruiti contengono soltanto il database esatto richiesto e le opzioni retryWrites=true, w=majority, authSource=admin; non vanno ricopiati o visualizzati per controllo. Non si usano connessioni della vecchia demo o del Cliente 1.

## Verifiche eseguite e limiti

- Initialize: riuscito, senza sovrascritture o segreti generati; ACL/owner e collocazione esterna controllati realmente su cartella e file.
- Check sui modelli reali: correttamente **incompleto**. Mancano SHOWCASE_SEED_URI, MONGO_URI, JWT_SECRET, OFFICE_LAT, OFFICE_LNG. I valori mancanti non sono stati inventati e il bootstrap runtime completo non è stato eseguito con questi modelli.
- npm run showcase: riuscito, offline-plan-only; nessun account, record, credenziale o DB creato.
- 11 test mirati offline superati (checker e bootstrap --check), con database simulato/non importabile. Verificati rifiuto host/account errati, password uguali, variabili inattese e output partecipanti già esistente; output senza valori segreti. Il check runtime valido è provato con fixture in memoria, **non** con password reali Atlas.
- Sintassi PowerShell e Node verificata. Codifica dei caratteri riservati degli URI, modelli e generazione casuale verificate solo in memoria, senza scrivere credenziali simulate nei file privati.

La verifica offline non può confermare autenticazione Atlas, ruoli effettivi, DNS, raggiungibilità o allowlist di rete. Non è stata tentata alcuna connessione. Dopo Configure, Check può verificare localmente la configurazione completa; la connettività richiederà un successivo passaggio esplicitamente autorizzato. L'isolamento del servizio Render da Cliente 1 resta il gate del piano di sostituzione: questi file privati non autorizzano modifiche cloud.


## GPS remoto: autorizzazione esplicita (11 novembre 2026)

Il solo `DEMO_MODE=true` non disabilita la geolocalizzazione remota. Variabile **opzionale lato server**: `SHOWCASE_GPS_CHECK_DISABLED=true`. Assente o `false` mantiene il comportamento precedente; ogni altro valore impedisce l’avvio Showcase. Nessuna nuova variabile frontend e nessun segreto nel bundle.

L’esenzione richiede l’intero profilo remoto valido (`APP_ENV=showcase`, `NODE_ENV=production`, `DEMO_MODE=true`, Atlas/DB Showcase, JWT dedicato, email disabilitate, origini HTTPS esatte), più HTTPS, host API e Origin client corretti. `DEMO_LOCAL_GPS_BYPASS=false` e `GEOLOCATION_CLOCK_IN_ENABLED=true` restano obbligatori; configurazione sede reale invariata per tornare ai controlli GPS. Una produzione ordinaria non ottiene l’esenzione dal solo nuovo flag.

Il frontend Showcase consulta `/api/records/gps-policy` con autenticazione. Solo `canSkipShowcaseGps:true` autorizza il payload distinto `showcaseWithoutGps:true` per entrata, uscita e pause. Il vecchio `demoWithoutGps` resta esclusivamente locale. Policy mancante/non valida mantiene il flusso GPS; la revoca server rifiuta anche un client con policy precedente. Il frontend limita la policy all’account che l’ha ricevuta.

In demo online autorizzata non si richiede il permesso GPS e non si registrano coordinate. Restano visibili la disponibilità della funzione nella versione aziendale e l’indicazione “controllo GPS disattivato”. “Fuori sede” richiede sempre motivazione e payload separato: non può essere combinato con l’esenzione demo. Il server rifiuta coordinate inviate insieme al marker remoto, evitando posizioni non validate. Nessuna modifica a database, notifiche, approvazioni o JWT.

Per abilitare in futuro: aggiungere privatamente `SHOWCASE_GPS_CHECK_DISABLED=true` **solo** alla configurazione runtime Showcase verificata, poi controllare offline. Il seed non richiede modifiche. I file runtime già validi restano validi senza questa riga, ma mantengono il GPS obbligatorio. Nessuna configurazione privata o cloud è stata cambiata per attivarla in questo intervento.

Collaudo futuro HTTPS: con flag assente/false verificare diniego senza GPS; con true negare il permesso nel browser e completare entrata → pausa → fine pausa → uscita; verificare messaggio demo e posizioni nulle, motivazione fuori sede obbligatoria, rifiuto marker locale e origini estranee. Ripristinando false le nuove richieste senza GPS devono fallire. Prima di applicare variabili o pubblicare, restano necessarie verifica isolamento Render da Cliente 1 e autorizzazioni del piano di sostituzione. Nessun deploy effettuato.


### Ricontrollo effettivo dopo la configurazione privata

Al controllo successivo i due file privati risultano compilati e **validi**: ACL riservate all’utente corrente, profili separati e bootstrap `--check` superati offline. Il precedente riscontro “modelli incompleti” sopra è storico. Il nuovo flag `SHOWCASE_GPS_CHECK_DISABLED` è assente nel runtime: compatibilità confermata e GPS ancora richiesto. Verificato anche il profilo con flag true solo in memoria; file privati invariati per hash. Per scegliere in seguito l’esenzione, aggiungere privatamente `SHOWCASE_GPS_CHECK_DISABLED=true` soltanto a `C:\Office-Clocking-Secrets\showcase-runtime.env`; nessuna modifica al seed o ai segreti, nessun flag VITE. Il comando Check accetta entrambe le configurazioni e non abilita nulla sui servizi cloud.


## Nome database corretto — aggiornamento autorizzato 11 novembre 2026

Target attivo esatto: `office_clocking_showcase_20261113`. URI private aggiornate conservando password/JWT. File password account esistente intatto e non letto; NON usare il seed ordinario per aggirarne il blocco. Diagnostica reale sul nuovo target: PERMISSION_DENIED / MONGO_8000 / list-collections. Servono ruoli Atlas manuali sul nome nuovo. Seguire `SHOWCASE_DATABASE_RECOVERY_2026-11-11.md`: recupero separato preparato, non applicato, con autorizzazione futura obbligatoria. Nessuna modifica a cloud, database o altri ambienti. I riscontri precedenti di configurazione privata vuota/incompleta sono storici.
