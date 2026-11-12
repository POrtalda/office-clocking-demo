# Admin Demo con un clic — sola consultazione, 12 novembre 2026

## Risultato preparato localmente

Admin Demo usa ora lo stesso endpoint rapido dei Dipendenti 01–15, senza chiedere password. L’unico account amministratore ammesso è showcase_admin, già esistente e attivo nel database isolato office_clocking_showcase_20261113. Nessun account/ruolo/password/chiave o database creato o modificato per preparare questa patch. Nessuna connessione a database reale o servizio cloud eseguita durante lo sviluppo.

JWT firmato SOLO sul backend con una sottochiave HMAC-SHA256 derivata in memoria dal JWT_SECRET Showcase esistente, con namespace specifico Admin-readonly/DB; nessun segreto persistente nuovo o modificato. Firma HS256, issuer/audience esatti, jti casuale, durata 10 minuti. Il token Admin rapido porta showcaseQuickLogin=true, showcaseReadOnly=true e showcaseDatabase esatto. La risposta utente e /api/auth/me restituiscono readOnly:true; frontend conserva questa proprietà al refresh. Nessuna password, JWT statico o chiave nel bundle. I token Admin rapidi NON sono verificabili con la chiave ordinaria: testano sia il vecchio verifier remoto sia quello di una produzione ordinaria, entrambi devono rifiutare la firma. Il nuovo middleware accetta questa firma soltanto con identità/scope Admin readonly esatti, flag attivi e contesto Showcase valido.

## Due opt-in server, entrambi necessari

```dotenv
SHOWCASE_QUICK_LOGIN_ENABLED=true
SHOWCASE_ADMIN_QUICK_LOGIN_ENABLED=true
```

Il secondo è il nuovo flag dedicato Admin: assente/false disabilita il pulsante Admin nel catalogo e l’emissione dei suoi token. Sul nuovo codice, impostarlo false fa rifiutare anche i token rapidi Admin già emessi alle richieste successive, lasciando invariato l’accesso rapido dipendenti quando il primo flag resta true. I valori ambigui sono rifiutati al bootstrap. Nessun nuovo flag VITE, nessun nuovo segreto o rotazione JWT. File env privati e cloud NON aggiornati: restano validi senza il nuovo flag, ma l’Admin rapido rimane disattivato finché l’operatore lo abilita espressamente.

Rimangono obbligatori tutto il profilo remoto valido, HTTPS/host/origin esatti, DB esatto e modello User associato alla stessa connessione. Prima dell’emissione si verifica marker ready e account attivo col ruolo corretto. Il client invia solo profile, nessun ruolo o privilegio scelto dal browser. Il flag non può attivare questa funzione in produzione ordinaria/Cliente 1/Office Work o altri DB. Rate limit 15 sessioni/min/IP e 60 cataloghi/min/IP e no-store rimangono attivi.

## Autorizzazioni Admin rapido

A ogni richiesta si verificano firma/scadenza/issuer/audience, flag, DB/connessione, identità esatta, ruolo corrente e attività dell’account. Un token rapido Admin senza claim read-only o con identità/scope diverso viene rifiutato. I token rapidi non sono accettati in altri ambienti, anche in caso di riuso errato della stessa chiave.

- Solo GET/HEAD e SOLTANTO una allowlist esplicita delle consultazioni note: /api/auth/me, /api/settings e /api/admin/{only,users,settings,dashboard,records,leaves,leave-requests,approved-leaves,export,summary,summary-all,manual-closure-requests,daily-attendance}. Query/filtri e slash finale ammessi. Nuove route GET sconosciute non sono abilitate automaticamente.
- Tutte le richieste POST/PUT/PATCH/DELETE autenticate con questo token sono rifiutate PRIMA dei controller, anche su timbrature/assenze e altri namespace. Bloccati creazione/modifica/cancellazione utenti, password, GPS/impostazioni, correzioni/cancellazioni timbrature, approvazioni/rifiuti/annullamenti assenze e chiusure manuali. Rimangono i blocchi globali Showcase già presenti per utenti/impostazioni.
- Consultazione dashboard, presenze, storico, audit, riepiloghi, impostazioni e esportazioni CSV resta disponibile. Letture utenti escludono password/hash. Tutti i dati appartengono alla sola istanza sintetica.
- Le due GET impostazioni prima usavano findOneAndUpdate(upsert): per questa sessione ora usano SOLO findOne e, se manca il documento, restituiscono i default applicativi senza crearlo. Nessun upsert né scrittura nascosta tramite tali GET.
- UI mostra Admin Demo in sola consultazione; pulsanti di approvazione/annullamento disabilitati, editor di correzione nascosto. Queste limitazioni UI non sono il controllo di sicurezza: API protette anche da richieste costruite manualmente.
- authFetch mantiene la sessione quando riceve un 403 di sola lettura e mostra l’errore; scadenza/revoca/401 continuano a portare al login. Logout pulisce lo storage; una risposta refresh pendente non può ricreare la sessione. Logout resta locale: token copiati scadono entro 10 minuti o sono rifiutati col flag Admin false sul codice nuovo.

Il login normale con password del presentatore rimane distinto e invariato; non viene trasformato in un login pubblico. Le sue autorizzazioni preesistenti restano soggette ai blocchi globali Showcase. Email, GPS, motivazione Fuori sede, firma JWT e separazione DB non sono stati indeboliti. Un utente può comunque scegliere un dipendente pubblico per operare come quel dipendente, come già previsto dalla demo: non ottiene così capacità di scrittura amministrativa.

## Test e limiti

- Suite backend completa: **46 suite, 486 test superati**, inclusa la separazione crittografica e il rifiuto dei token da parte dei vecchi verifier. Anche **27 test mirati in 2 suite superati** su login/scope/autorizzazioni e impostazioni senza upsert.
- Frontend completo: **49 test superati**, poi **11 test mirati superati** includendo l’editor nascosto in sola lettura. ESLint e build Showcase HTTPS/PWA superati. Test su Admin con un clic/scadenza/me, isolamento, flag e revoca, tutti i verbi di scrittura, deny di route sconosciute, refresh/logout, gestione 403 senza logout.
- Test database/utenti/marker SOLO mockati. Nessun test invia email reali o usa credenziali reali. Nessun file privato letto/modificato o segreto mostrato.
- Nessun collaudo browser o HTTPS Render reale eseguito: SSR/test automatici non vengono dichiarati collaudo browser. Il bootstrap/rete Render va verificato separatamente e non è aggirato da questo login.
- Nessun nuovo pacchetto, lockfile o schema database modificato. git diff --check superato.

## Patch incrementale e trasferimento futuro

Sorgente: C:\Office-Clocking\office-clocking-demo-showcase (feature/demo-november-showcase), base funzionalità dipendenti 2dc5738eaadc6631016a092d252c226e86e93711. Preparare un singolo commit e git format-patch SOLO di questa estensione.

Clone pubblicazione rilevato durante la preparazione: C:\Office-Clocking\office-clocking-demo-publish-20261111, branch prepare/showcase-20261113, commit d5c848659a0ca3b9e5007e55eb99e9a2ee5b6377 (il login rapido dipendenti è già presente). Modifica locale preesistente .gitignore (.netlify): conservarla, non includerla o sovrascriverla con questa patch. La patch non tocca .gitignore. Prima di applicarla verificare nuovamente origin dedicato POrtalda/office-clocking-demo, HEAD/branch e modifiche locali; se la base cambia rivalutare il delta.

Procedura futura, non eseguita:

1. Conservare la modifica .gitignore con un commit separato revisionato se serve un indice pulito. Nessun reset/stash distruttivo. Registrare il riferimento rollback al commit effettivo precedente e i deploy ID cloud; i riferimenti locali salvano il codice, non lo stato dei servizi.
2. git apply --check PATCH_ADMIN poi git am -- PATCH_ADMIN nel SOLO clone. Se il login rapido dipendenti non è ancora presente su un altro checkout, applicare prima la patch precedente: questa è incrementale, non sostituisce la funzionalità base.
3. Rieseguire backend/frontend/lint/build, verificare differenze solo previste e nessun file env/build/credenziale incluso. Pubblicare il SOLO branch preparatorio soltanto dopo autorizzazione separata al push, senza main/PR/force. Render Auto-Deploy OFF e trigger Netlify da riverificare.
4. Dopo autorizzazione di deploy: backend nuovo con flag Admin inizialmente false, poi abilitarlo esplicitamente sul SOLO servizio Showcase con i due flag sopra. Nessuna modifica al DB o alle credenziali. Pubblicare frontend corretto dopo verifica API. Nessuna operazione cloud eseguita dall’agente.
5. Collaudo reale: Admin Demo un clic -> dashboard; refresh conserva consultazione; CSV/presenze consultabili; approvazioni/utenti/password/impostazioni/correzioni negate e senza mutazioni; logout -> login; scadenza -> login; flag Admin false -> emissione negata e token esistenti rifiutati; dipendenti continuano a funzionare.

## Rollback

Primo intervento sul NUOVO codice: SHOWCASE_ADMIN_QUICK_LOGIN_ENABLED=false. Disabilita il solo Admin rapido e ne revoca le sessioni ai controlli successivi; gli utenti e il database rimangono invariati. Flag generale false disabilita tutti gli accessi rapidi se necessario. Nessuna rotazione JWT automatica. Il valore del flag deve essere reso effettivo nel processo tramite un aggiornamento Render separatamente autorizzato: salvarlo senza applicarlo al processo non cambia l’ambiente già in esecuzione.

I token Admin rapidi hanno una firma separata tramite sottochiave derivata: un backend precedente che verifica solo JWT_SECRET ordinario li rifiuta per firma non valida, senza interpretarli come normali Admin. Questa proprietà è verificata nei test e rende sicuro il ripristino del codice precedente rispetto a questa escalation. Il codice nuovo rifiuta anche un token con claim Admin readonly firmato con la chiave ordinaria. Nessuna rotazione JWT o modifica delle credenziali è richiesta per il rollback.
Poi, solo dopo autorizzazione, ripristinare gli artefatti frontend/backend e le configurazioni precedenti documentate. Nessun seed/reset/drop/delete o modifica ad altri ambienti. Patch e riferimento rollback locali vengono predisposti senza push, merge, applicazione della patch o deploy.
