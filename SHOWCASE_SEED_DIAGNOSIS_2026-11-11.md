**STORICO — nome lungo rifiutato, non usare per nuovi comandi.** Destinazione attuale autorizzata: `office_clocking_showcase_20261113`. Consultare SHOWCASE_DATABASE_RECOVERY_2026-11-11.md per il piano attivo. I nomi lunghi e le autorizzazioni mancanti descritti sotto sono riscontri storici precedenti alla correzione.

# Diagnosi seed Showcase — 11 novembre 2026

## Riscontri effettivi offline

Branch verificato: `feature/demo-november-showcase`. Modifiche locali precedenti conservate; seeder originale non modificato.

La configurazione seed privata supera `assertSeedConfig` e `assertCredentialsPath`. Host esatto `showcasecluster.xed8r0t.mongodb.net`, database esatto `office_clocking_showcase_remote_20261113`, utente URI `showcase_seed`. Formato e opzioni URI ammessi; credenziali non mostrate. La validazione sintattica non verifica password, rete o privilegi Atlas. Nella shell diagnostica non risultano MONGO_URI ereditato o bypass locale attivo; non si può ricostruire l’ambiente della shell del tentativo fallito.

Il file privato delle password generate ESISTE: verificata soltanto l’esistenza, contenuto mai aperto/letto. Un nuovo seed nelle condizioni attuali si fermerebbe su `fs.writeFileSync(...,{flag:"wx"})` con EEXIST, prima di connettersi ad Atlas. Non eliminarlo, spostarlo o sovrascriverlo per tentare nuovamente.

Questo è il blocco attuale dimostrabile, non la causa dimostrata del primo fallimento. Il seeder crea quel file PRIMA della connessione, quindi la sua esistenza non dimostra alcuna scrittura riuscita su Atlas. Potrebbe essere un file precedente oppure il risultato del tentativo fallito, interrotto durante connessione, autenticazione, controllo database o popolamento.

## Perché l’errore originale non basta

Il catch finale di `backend/scripts/seedRemoteShowcase.js` scarta l’eccezione e stampa sempre lo stesso messaggio. Le fasi possibili sono: configurazione e conferma, validazione percorso, creazione esclusiva file password, caricamento driver, connessione, controllo database nuovo, creazione collezione/marker initializing, indici e inserimenti, marker ready. Il controllo database rifiuta qualsiasi collezione preesistente, anche vuota. Il seeder non è una procedura di ripresa automatica.

Non è stato rieseguito il seed, neppure per recuperare il codice di errore. Non sono stati effettuati reset, connessioni Atlas o modifiche cloud/database.

## Diagnostico separato

Nuovo `backend/scripts/diagnoseRemoteShowcase.js`: legge soltanto il file seed privato fisso, ignora le connessioni ereditate, impone host/database/utente esatti e non importa il punto di ingresso seed. Senza argomenti resta offline. Non apre mai il file password generate. Nessuna URI, password, JWT o eccezione grezza nei risultati.

Dal terminale PowerShell:

```powershell
Set-Location -LiteralPath 'C:\Office-Clocking\office-clocking-demo-showcase\backend'
node scripts/diagnoseRemoteShowcase.js
# Solo per la successiva diagnosi di rete/Atlas in lettura:
node scripts/diagnoseRemoteShowcase.js --atlas-read-only
```

Il secondo comando è PREPARATO, NON ESEGUITO durante questo intervento. Non richiede --env-file: legge internamente soltanto showcase-seed.env. Usa il MongoClient nativo senza modelli Mongoose, auto-create o indici. Le sole operazioni sul database sono listCollections, findOne del marker con proiezione state, countDocuments delle collezioni Showcase note e connectionStatus per verificare i ruoli dichiarati sull’esatto database. Non elenca database o contenuti utente.

| Risultato | Interpretazione e prossimo passo minimo |
| --- | --- |
| AUTHENTICATION_FAILED | Verificare privatamente password/codifica URI, utente showcase_seed e authSource. Non ristampare URI né ritentare il seed. |
| DNS_FAILURE / TLS_FAILURE | Risolvere DNS/TLS locale senza disattivare TLS. |
| NETWORK_OR_SERVER_SELECTION_FAILURE | Verificare rete/IP autorizzato e disponibilità cluster. Il solo timeout non distingue firewall, allowlist, VPN e cluster sospeso. |
| PERMISSION_DENIED | L’operazione di lettura indicata dallo stage è negata; verificare ruoli del solo utente seed sul solo database autorizzato. |
| EMPTY_DATABASE | Nessuna collezione osservata, nessuna scrittura effettuata. Prima di un recupero separato rivedere l’errore di rete/auth e preservare il file password esistente. Non basta per autorizzare un seed nuovo. |
| ALREADY_INITIALIZED | Marker ready e tutte le collezioni previste presenti: nessun nuovo seed. Rivedere conteggi e successivamente il bootstrap runtime. Non è una verifica dell’integrità completa dei dati. |
| PARTIAL_INITIALIZATION | Marker initializing: arrestarsi, conservare file password e collezioni, nessuna ripresa automatica. Serve piano specifico autorizzato. |
| EXISTING_DATABASE_REQUIRES_REVIEW | Collezioni presenti senza marker coerente/completo: arrestarsi, nessuna cancellazione o seed. |
| UNCLASSIFIED_FAILURE | Errore non classificato: non dedurre la causa né pubblicare l’eccezione grezza, che potrebbe contenere segreti. |

I flag di ruolo riportano i ruoli built-in direttamente dichiarati per il database; non provano mediante scritture i privilegi effettivi e non ricostruiscono ruoli personalizzati/ereditati. Nessun tentativo di scrittura per verificare permessi.

## Verifiche

- Eseguita la sola modalità offline del diagnostico: configurazione valida, target/utente corretti, file password presente, nessuna connessione database.
- 2 suite backend mirate, 47 test superati: diagnostico e policy/seeder Showcase, con filesystem/database mockati. Inclusi target errato, errori annidati, database vuoto/parziale/ready e assenza di lettura password/driver offline.
- `git diff --check` superato. Frontend invariato in questo intervento; nessun nuovo lint/build frontend necessario.
- Nessuna modifica a Cliente 1, Office Work, altri database, Render/Netlify; nessun push/deploy/seed.


## Aggiornamento urgente — causa effettiva confermata con lettura Atlas

Il controllo di sola lettura è stato ora eseguito esclusivamente sull’host e database autorizzati. Connessione riuscita; la prima `listCollections` fallisce con MongoDB 8000. La classificazione analizza il messaggio soltanto in memoria tramite pattern fissi, senza stamparlo. Esito finale reale:

```json
{"category":"DATABASE_NAME_EXCEEDS_38_BYTES","errorCode":"MONGO_8000","stage":"list-collections"}
```

Il servizio Atlas usato rifiuta nomi database oltre 38 byte; il nome autorizzato `office_clocking_showcase_remote_20261113` è lungo 39 byte ASCII. Il controllo locale precedente validava host/nome esatto e sintassi URI, ma non questo limite del servizio. È la causa effettiva del fallimento della lettura e coincide con il primo controllo database eseguito dal seeder. Non è stato rieseguito il seed per riprodurlo.

Questo errore non è prova di password errata, IP bloccato o privilegi mancanti. La connessione è riuscita, ma i privilegi di scrittura non sono stati verificati. Il database non è stato dichiarato vuoto: la lettura delle collezioni è rifiutata prima di osservarne lo stato. Nessun marker o dato letto/modificato durante la diagnosi reale. Il file delle password generate non è mai stato letto, cancellato o rinominato; la sua esistenza continua a bloccare un nuovo seed ordinario.

Il diagnostico emette ora ESCLUSIVAMENTE category, errorCode e stage. Codici e categorie provengono da allowlist; messaggi/stack/URI/segreti non vengono restituiti. Distinte fasi load-driver, create-client, connect, select-database, list-collections, read-marker, count delle sole collezioni note e inspect-roles. Classifica errori annidati (cause/reason/errorResponse/originalError/result/response, arrays e server map), timeout, DNS, TLS, autenticazione, autorizzazione, vincoli Atlas 8000 e problemi del diagnostico. Nessuna scrittura, nessun auto-create, nessun accesso ad altri database.

### Correzione minima da autorizzare — NON applicata

La destinazione autorizzata attuale è incompatibile con il limite riscontrato. Non basta cambiare password o rilanciare il seed. Proposta concreta: usare nello STESSO cluster dedicato un nuovo nome Showcase più corto, `office_clocking_showcase_20261113`, mantenendo gli stessi utenti separati e le password già generate. Questo nome NON è ancora autorizzato né è stato interrogato o creato.

Sequenza proposta, ogni modifica esterna da autorizzare prima dell’esecuzione:

1. Approvare esplicitamente il nuovo nome di database; mantenere invariato il vecchio nome e tutti gli altri ambienti.
2. Preparare un diff locale coerente per costante DATABASE, verifiche seed/runtime/diagnostico/configurazione privata, test ed esempi. Conservare obbligo di target esatto; non trasformarlo in un wildcard né rendere liberamente configurabile qualunque database. Il diagnostico vecchio resta bloccato sul solo target attualmente autorizzato finché il cambio non è approvato.
3. Solo dopo autorizzazione cloud specifica, configurare i due utenti Atlas sul solo nuovo nome (runtime readWrite, seed readWrite + dbAdmin). Nessun reset o cancellazione di vecchie risorse. Non presumere che i ruoli attuali sul vecchio nome siano applicabili al nuovo.
4. Solo dopo autorizzazione, aggiornare privatamente i due percorsi DB nelle URI mantenendo host, utenti e password; mantenere JWT e percorso del file password generate. Nessun nuovo segreto necessario per la sola correzione del nome. Controllo offline senza log dei valori.
5. Eseguire sul nuovo target autorizzato una diagnostica di sola lettura. Se esiste qualsiasi collezione o marker: arrestarsi, nessuna ripresa automatica. Se EMPTY_DATABASE: preparare e revisionare il recupero seguente prima di autorizzarlo.

### Recupero che preserva le credenziali — solo piano, NON implementato/eseguito

Il comando seed ordinario rimane inadatto perché il file esiste già e `wx` deve continuare a proteggerlo. Un eventuale comando separato di recupero dovrà richiedere opt-in e conferma del nuovo target esatto, verificare nuovamente che il database non abbia alcuna collezione PRIMA di qualsiasi scrittura, e soltanto dopo autorizzazione leggere privatamente il file password esistente. Deve validare insieme esatto dei 16 account/password senza stamparli, riutilizzare quelle password (hash bcrypt), senza generarle di nuovo né scrivere/copiare/rinominare il file. Deve usare lo stesso claim atomico e marker initializing/ready, arrestarsi su concorrenza e non proseguire automaticamente dopo errori o marker parziali. Nessuna opzione reset/drop/delete. Preparazione e applicazione del recupero sono attività distinte da questa diagnosi e richiedono nuova autorizzazione.

Alternativa che conserva il nome di 39 byte: verificare preventivamente un servizio Atlas che lo supporti, con impatti/costi e autorizzazione separati. Nessun cambio di tier/cluster eseguito o raccomandato senza verifica.

Per ripetere soltanto la diagnosi corrente, senza seed:

```powershell
Set-Location -LiteralPath 'C:\Office-Clocking\office-clocking-demo-showcase\backend'
node scripts/diagnoseRemoteShowcase.js --atlas-read-only
```

Finché resta il nome attuale, è atteso lo stesso rifiuto per lunghezza. Il comando non è una procedura di recupero e non modifica il file password.


Verifica finale dopo l’aggiornamento: **70 test superati in 2 suite backend** (diagnostico + remoteShowcase), `node --check` e `git diff --check` superati. Il punto di ingresso seed e la logica di popolamento non presentano modifiche. I tre file interessati in questa diagnosi sono diagnostico, relativi test e questo rapporto; nessun frontend modificato.
