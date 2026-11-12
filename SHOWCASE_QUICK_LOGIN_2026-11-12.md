# Showcase — accesso con un clic, 12 novembre 2026

## Funzionalità preparata localmente

Il login online mostra 16 profili sintetici: Admin Demo e Dipendenti 01–15. I 15 dipendenti accedono con un clic senza password nel browser; Admin Demo seleziona il normale modulo con username del presentatore e richiede la password privata già esistente. L’Admin NON è pubblico: nessun token Admin viene emesso dall’endpoint rapido, neppure aggiungendo role/id/password al body. Nessun account, ruolo, password, JWT secret o database viene modificato per preparare questa funzionalità.

Scelta di sicurezza: autenticazione separata del presentatore tramite il login ordinario già protetto da password robusta, rate limit e controllo username Admin. Non è stato creato un Admin pubblico limitato nel DB: ciò avrebbe richiesto modifiche a dati/ruoli e nuove verifiche di autorizzazione. La distinzione è esplicita nella pagina Login.

## Opt-in richiesto SOLO sul server

Nuova variabile opzionale `SHOWCASE_QUICK_LOGIN_ENABLED=true`. Assente/false disabilita gli endpoint; qualunque valore diverso da true/false è rifiutato dalla configurazione remota. Nessuna nuova variabile frontend. I file privati attuali restano compatibili senza modificarli; non sono stati letti o aggiornati in questo intervento.

L’abilitazione richiede tutto il profilo remoto valido: APP_ENV showcase, NODE_ENV production, DEMO_MODE true, GPS locale false, geolocalizzazione globale true, email disabled, JWT dedicato, origini HTTPS esatte e URI del DB Showcase esatto. Sono inoltre obbligatori HTTPS, host API e Origin client esatti, connessione Mongoose sul DB `office_clocking_showcase_20261113` e modello User associato alla STESSA connessione. Non basta impostare DEMO_MODE o il flag su una produzione ordinaria.

API:

- GET `/api/demo/showcase/profiles`: 16 etichette fisse senza password, token, nomi reali o email; Admin marcato presenter. Limite 60/minuto/IP.
- POST `/api/demo/showcase/session`: solo body `{profile:"showcase_user01"}` fino a user15. Limite 15/minuto/IP, oltre al limite API preesistente. Rilegge marker ready e account attivo con ruolo user nella connessione Showcase; non legge né confronta password. In errore messaggio fisso senza dettagli Mongo.
- JWT server-side HS256, issuer/audience Showcase esistenti, scadenza 10 minuti, jti casuale per emissione, claim showcaseQuickLogin e showcaseDatabase. Firma e segreto dedicati già esistenti, mai nel bundle.
- Ogni richiesta autenticata riesamina account/ruolo/isActive; per i token rapidi riesamina anche flag, connessione/modello/db, allowlist e ruolo user. Token rapidi rifiutati in ambienti non Showcase anche se qualcuno riutilizzasse erroneamente la chiave JWT. Nessuna esenzione Admin.
- Risposte no-store. Nessun endpoint di seed/reset, nessuna sessione scritta in DB. Il limite IP è in memoria, coerente con l’istanza singola esistente; si azzera al riavvio e non è un limitatore distribuito.

Le protezioni GPS, motivazione Fuori sede, email disabilitate, gestione account/impostazioni bloccata e separazione del database restano invariate. Le sessioni pubbliche user possono usare le funzionalità dipendente della demo e quindi modificare i PROPRI dati sintetici quando l’utente compie un’azione nell’app; nessuna di queste azioni è stata compiuta dall’agente.

## Refresh, scadenza, logout

Le sessioni usano lo stesso AuthProvider e storage per account dell’app esistente: salvataggio del token emesso dal server, verifica con /api/auth/me dopo refresh, pulizia su token scaduto/revocato/errore, rimozione token e utente al logout. Una richiesta di refresh pendente non può ripristinare un token dopo logout o sovrascrivere un nuovo profilo. Nessun login automatico in background dopo logout: serve un nuovo clic.

Il logout è locale, come prima: non revoca server-side un token copiato prima del logout. I token rapidi scadono entro 10 minuti; non è stata aggiunta una denylist o una mutazione del DB. Il flag false revoca i token rapidi alle successive richieste sul NUOVO codice. Il controllo di autenticazione iniziale non considera sufficiente il solo utente memorizzato nel browser.

## Trasferimento controllato e rollback

Sorgente: C:\Office-Clocking\office-clocking-demo-showcase, feature/demo-november-showcase. Clone di pubblicazione: C:\Office-Clocking\office-clocking-demo-publish-20261111, branch prepare/showcase-20261113, HEAD rilevato 04505b6 (bootstrap già applicato). Il clone contiene una modifica LOCALE preesistente a .gitignore per .netlify: conservarla; non fare reset/checkout forzati o sovrascrivere il file. Nessun file .gitignore è incluso in questa correzione. La patch della funzionalità viene controllata con git apply --check ma non applicata al clone in questa fase.

Procedura futura:

1. Revisionare il singolo commit/patch preparato nella sorgente; verificare origine clone esclusivamente POrtalda/office-clocking-demo e branch preparatorio. Conservare separatamente la modifica .gitignore (eventuale commit locale dedicato, senza segreti) prima di git am; non cancellarla. Se il clone cambia HEAD o i file toccati, rivalutare il delta.
2. Registrare un riferimento rollback locale al commit effettivo pubblicato corrente e i deploy ID Render/Netlify; nessun rollback di DB necessario o previsto per questa feature, che non cambia schema/account.
3. Applicare SOLO la patch rapida con git am, mantenendo la correzione bootstrap già presente; non importare storia office_clocking e non ripetere seed. Rieseguire test backend/frontend, lint e build nel clone. Nessuna nuova dipendenza: lockfile invariati.
4. Solo dopo autorizzazione esplicita: push del solo branch preparatorio nel repository demo, mai main/force. Render Auto-Deploy OFF; verificare ancora trigger e Netlify preview prima di push/PR. Nessun push eseguito dall’agente.
5. Dopo autorizzazione specifica: backend nuovo codice dapprima con flag assente/false, controllo health; quindi impostare manualmente SOLO sul servizio demo `SHOWCASE_QUICK_LOGIN_ENABLED=true`. Non modificare secret/JWT o utenti. Conservare gli altri flag GPS/email e non inserire il flag come VITE.
6. Pubblicare frontend Showcase con endpoint API HTTPS esatto soltanto dopo verifica backend. Eseguire collaudo browser reale desktop/mobile: 16 profili, login user01/user15, refresh, logout, cambio profilo, scadenza, Admin che richiede credenziali del presentatore, richieste Admin pubbliche negate e limite 429. Non presentare i test SSR come collaudo browser.
7. Rollback immediato funzionale: flag false sul NUOVO codice -> nuovi accessi rapidi negati e sessioni rapide respinte alle richieste successive; login con password e account/DB invariati. Ripristino artefatti frontend/backend precedenti solo dopo autorizzazione. Se si ripristina un backend vecchio che non interpreta il nuovo flag/claim, token user già emessi potrebbero restare validi fino alla scadenza massima di 10 minuti: attendere tale scadenza se richiesta revoca completa prima del rollback. Non ruotare JWT automaticamente, non cancellare dati e non riseminare.

Nessun deploy, push, merge o modifica cloud/database/credenziali eseguito in questa preparazione. Il precedente problema di bootstrap/rete non viene dichiarato risolto da questa feature: va diagnosticato separatamente con gli strumenti già preparati. L’accesso rapido non aggira un backend non avviato o un Atlas non raggiungibile.


## Verifiche effettive della preparazione

- Backend completo: **45 suite / 473 test superati** con Jest diretto --testTimeout=15000 per import a freddo su Windows. Una prima esecuzione tramite npm non ha propagato il timeout e il vecchio hook di import ha superato 5s; nessun timeout applicativo cambiato. Dopo l’aggiunta del solo test di emissione per tutti i 15 profili, ulteriori **50 test mirati in 2 suite superati**; il codice applicativo backend non è cambiato dopo la suite completa.
- Frontend finale: **46 test superati**, inclusi SSR del selettore reale e test di storage/API per refresh/logout/cambio profilo/scadenza e race di ripristino dopo logout. ESLint e build Showcase HTTPS/PWA superati, compreso controllo automatico assenza credenziali locali nel bundle.
- git diff --check superato; lockfile invariati, nessuna nuova dipendenza.
- Nessun collaudo browser reale desktop/mobile o HTTPS cloud eseguito: l’SSR e i test di sessione non vengono presentati come collaudo browser. Rimane nella procedura futura dopo backend/frontend pubblicati in modo autorizzato.
- Nessun file privato letto/modificato, nessuna connessione al database reale, nessuna email inviata, nessun account/credenziale modificato. Test API con connessione/utenti/marker mockati.
- Il clone resta al commit 04505b6216de28373e7ad4da376abdb00a79049c con la modifica .gitignore preesistente conservata. La patch viene solo esportata e controllata con git apply --check; non applicata o pubblicata in questa fase.
