**STATO ATTUALE: recupero autorizzato COMPLETATO; marker ready, 16 utenti, 284 timbrature, 2 assenze verificati. Non ripetere il recupero. Vedere aggiornamento finale.**

# Showcase — nome database corretto e recupero delle credenziali esistenti

Stato 11 novembre 2026: preparazione locale completata, NESSUN seed o recupero applicato. Nuovo nome autorizzato: `office_clocking_showcase_20261113` (32 byte, sotto il limite 38 rilevato). Host invariato `showcasecluster.xed8r0t.mongodb.net`. Il nome precedente di 39 byte è rifiutato dai validatori ed è conservato soltanto nella diagnosi storica e in un test negativo.

## Modifiche locali e private applicate

- Aggiornati costante DATABASE, URI generate dal configuratore, esempio di riuso servizi, fixture/test e documentazione attiva. Identificativo marker PURPOSE, issuer JWT e utenti rimangono invariati: non sono nomi di database e non richiedono rotazione.
- Nei due file `C:\Office-Clocking-Secrets\showcase-seed.env` e `showcase-runtime.env` cambiato soltanto il percorso database delle URI esistenti. Confronto prima/dopo in memoria: password codificate, username, host, query URI, JWT e ogni altra variabile identici. Nessun valore segreto stampato, nessun backup creato, ACL esistenti mantenute.
- Nessuna lettura, scrittura, cancellazione o rinomina del file password dei 16 account. Verificata soltanto l’esistenza. Il seed ordinario conserva `wx` e continua a non sovrascriverlo.
- Il controllo offline distingue ora validità del profilo e possibilità di seed ordinario: `recoveryRequired:true`, `standardSeedAllowed:false` con file account presente. Un profilo valido non autorizza un nuovo seed.
- Nuovo comando separato `backend/scripts/recoverRemoteShowcase.js`: senza argomenti o con --check resta offline, legge solo la configurazione seed e controlla esistenza del file account. Non carica il driver, non legge password account, non crea file.

## Riscontro effettivo sul nuovo target

Controllo privato PowerShell: ACL e collocazione esterna al repository OK; profili seed/runtime separati validi; bootstrap runtime --check OK senza connessioni. Piano offline: 16 utenti, 284 timbrature, 2 assenze, nessun dato/credenziale creato.

La diagnostica di SOLA LETTURA sul nuovo nome restituisce:

```json
{"category":"PERMISSION_DENIED","errorCode":"MONGO_8000","stage":"list-collections"}
```

La connessione arriva al server, ma manca l’autorizzazione alla lettura delle collezioni del nuovo database. Il limite di lunghezza non è più il blocco osservato. Non è stato possibile verificare lo stato vuoto/inizializzato del database. Nessuna scrittura Atlas eseguita. Il controllo sul solo utente seed non verifica i privilegi runtime.

## Passaggio manuale Atlas necessario — non eseguito dall’agente

Nel solo progetto Atlas Showcase, Database Access, aggiornare gli utenti ESISTENTI senza cambiare password:

| Utente | Ruolo built-in | Database esatto | Collection |
| --- | --- | --- | --- |
| showcase_runtime | readWrite | office_clocking_showcase_20261113 | tutte, soltanto in questo DB |
| showcase_seed | readWrite | office_clocking_showcase_20261113 | tutte, soltanto in questo DB |
| showcase_seed | dbAdmin | office_clocking_showcase_20261113 | tutte, soltanto in questo DB |

È una modifica cloud manuale da effettuare/approvare separatamente. Nessun ruolo su admin, nessun readWriteAnyDatabase, dbAdminAnyDatabase o atlasAdmin. Non usare utenti Cliente 1 o vecchia demo e non cambiarne i ruoli. I ruoli sul vecchio nome non concedono accesso al nuovo. Non serve creare manualmente collezioni o inserire documenti; evitare qualsiasi inizializzazione manuale del database che farebbe bloccare il seed. Non eliminare il vecchio database. Verificare nel pannello che le assegnazioni dei due utenti Showcase siano limitate al nome nuovo senza privilegi globali.

## Sequenza esatta per completare il popolamento

1. Completare i ruoli manuali sopra. Nessuna nuova password, JWT o coordinata da generare. Attendere la propagazione e aprire una nuova connessione con il diagnostico.
2. Rieseguire SOLO i controlli sotto. Non includono seed:

```powershell
Set-Location -LiteralPath 'C:\Office-Clocking\office-clocking-demo-showcase'
& .\deploy\showcase\Configure-PrivateShowcase.ps1 -Action Check
Set-Location -LiteralPath 'C:\Office-Clocking\office-clocking-demo-showcase\backend'
node scripts/diagnoseRemoteShowcase.js --atlas-read-only
node scripts/recoverRemoteShowcase.js --check
```

3. Procedere soltanto se la diagnostica conclude `EMPTY_DATABASE`. Se PERMISSION_DENIED: correggere i ruoli, nessun seed. Se ready/parziale/collezioni preesistenti: fermarsi, non cancellare nulla e non usare il recupero. Non dedurre database vuoto da un errore o dal solo accesso al cluster.
4. Ottenere autorizzazione esplicita ad applicare il recupero e a leggere privatamente il file password esistente per riutilizzarle. Non ancora concessa/eseguita in questo intervento. Revisionare il comando seguente prima dell’autorizzazione.

### Comando FUTURO di scrittura — NON ESEGUIRE senza nuova autorizzazione

```powershell
# Solo dopo EMPTY_DATABASE, revisione e autorizzazione esplicita al recupero:
node scripts/recoverRemoteShowcase.js --apply --reuse-existing-credentials --confirm-new-atlas --confirm-database=office_clocking_showcase_20261113
```

Le quattro conferme sono tutte obbligatorie. Il programma legge internamente soltanto showcase-seed.env e impone host/DB/utente esatti, senza ereditare connessioni dalla shell. Prima di leggere il file password verifica che NON esista alcuna collezione. Se non vuoto si arresta. Dopo il controllo, nel SOLO percorso futuro autorizzato, apre in lettura il file password già esistente, valida esattamente i 16 account e password robuste/uniche, e riutilizza le stesse password con hash bcrypt. Nessuna generazione, sovrascrittura, copia o rinomina del file.

`populateNewDatabase` ripete il controllo vuoto e usa la creazione atomica del marker per impedire concorrenza. Nessun reset automatico, drop/delete o ripresa di marker parziali. Se fallisce dopo una scrittura, arrestarsi e diagnosticare: il comando non è ripetibile alla cieca. File account e dati parziali devono restare conservati.

5. Dopo un recupero autorizzato riuscito, attendersi 16 utenti, 284 timbrature e 2 assenze nel riepilogo sicuro del comando, quindi diagnostica `ALREADY_INITIALIZED`. Verificare marker ready e runtime separatamente prima di avviare applicazione/deploy.
6. La pubblicazione Render/Netlify resta una fase separata: le variabili cloud NON sono state aggiornate. Prima di applicarle occorre autorizzazione specifica, verifica dell’isolamento Render e piano di rollback. Non copiare URI/JWT in chat, Git o bundle frontend. Nessun push/merge/deploy.

## Verifiche locali

Recupero provato solo con database/filesystem fittizi nei test, incluso riuso esatto delle password fixture, rifiuto del database non vuoto e conferme mancanti. Il file account reale NON è stato letto neppure dai test. I comandi reali eseguiti sono esclusivamente offline, --check e diagnostica in lettura. Esiti finali di suite e diff nel rapporto Showcase.


Esito finale: **426 test backend superati in 44 suite**, sintassi Node e `git diff --check` superati. Configurazioni private e bootstrap offline validi; blocco residuo reale PERMISSION_DENIED sul nuovo target. Nessun comando applicativo eseguito.


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
