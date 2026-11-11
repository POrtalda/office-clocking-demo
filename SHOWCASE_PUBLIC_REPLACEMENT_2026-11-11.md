# Office Clocking — sostituzione della demo pubblica con Showcase

**Stato: piano locale, nessuna pubblicazione.** Questa decisione sostituisce il piano obbligatorio “nuovo Netlify + nuovo Render”. Il sito pubblico resta `https://office-clocking-demo.netlify.app/login`. Render può essere riutilizzato **solo dopo verifica dell'ID e dell'isolamento da Cliente 1**. Atlas deve essere completamente nuovo, con nuovi utenti e segreti.

Branch di lavoro `feature/demo-november-showcase`, HEAD locale `2341fd46ac68c13b4e7166a93d6fe9df5ca373ef`. La policy remota e questo piano sono ancora modifiche locali: non sono contenuti nel solo commit base. Non è stato creato un nuovo commit in questo intervento.

## 1. Riscontri e limiti della verifica

| Elemento | Riscontro | Certezza |
| --- | --- | --- |
| Repository demo da aggiornare | `https://github.com/POrtalda/office-clocking-demo.git` | confermato dall’utente e verificato con GitHub API e git ls-remote |
| Origin locale, da NON pubblicare | `https://github.com/POrtalda/office_clocking.git` | progetto principale: nessun push, cambio remoto o modifica dei metadati |
| main del repository demo dedicato | `ef42d576f49453cf7e798a545c1e790a874be2a9` | GitHub API e ls-remote concordano; non è una prova del deploy live |
| Branch sorgente previsto | `feature/demo-november-showcase` | locale; non compare tra i riferimenti remoti verificati |
| Upstream del branch locale | `origin/demo`, ossia `refs/heads/demo` | verificato nella configurazione Git condivisa; **non cambiato** |
| demo del remoto locale principale (non destinazione) | `3e0e6406a0f7172b78b6f3fd95d5c2bf2c7d038d` | verificato con ls-remote in sola lettura |
| main del remoto locale principale (non destinazione) | `22e04d35e1afd63c29ac3ae39b393eaece36828b` | verificato in sola lettura; non modificare |
| feature/client1-updates del remoto principale (non toccare) | `e1880d2bfa7748f5e713d70ab8fdd0b7fe13a4b0` | verificato in sola lettura; non modificare |
| Frontend da conservare | `https://office-clocking-demo.netlify.app/login` | aperto nel browser: login della vecchia demo visibile, nessun login eseguito |
| API effettiva del frontend attuale | `https://office-clocking-backend-demo.onrender.com` | estratta dall'asset pubblico attuale, concorda col README |
| Collegamenti Netlify | POrtalda/office-clocking-demo, production branch main | verificati dall’utente; site ID e deploy live ancora da acquisire |
| Collegamenti Render | POrtalda/office-clocking-demo, deploy branch main, Auto-Deploy on commit, start npm start | verificati dall’utente; service ID/isolamento ancora da verificare |
| Site ID Netlify, service ID Render, deploy ID precedenti | non disponibili | necessari prima di modificare i servizi |
| Isolamento Render da Cliente 1 | non verificato | blocco obbligatorio prima del riuso |

Asset osservato via DOM: `https://office-clocking-demo.netlify.app/assets/index-BNiyclTc.js`, GET 200, 373810 byte, SHA-256 `964bb261f7ff5ea9e86cbe24d232877b89790511f27cad87fba880f8d1a70769`. È una prova dell'API compilata, **non** dell'ID Render, dell'ownership o del branch collegato al servizio.

Il connettore GitHub non accedeva al repository principale locale (404), che non è la destinazione corretta. Dopo la precisazione dell’utente è stato interrogato in sola lettura il repository demo dedicato: GitHub API e ls-remote confermano main a ef42d576f49453cf7e798a545c1e790a874be2a9, senza branch Showcase remoto. Il tree main non contiene configurazioni Netlify/Render o workflow .github versionati; status e workflow run restituiti per quel commit sono vuoti. Questo non esclude trigger cloud. Nessun token o segreto GitHub letto.

Il worktree punta a metadati comuni con un altro checkout. Nessun checkout, fetch, merge, cambio upstream, modifica di Git config o comando su altri progetti è stato eseguito. La finestra Netlify già aperta non è risultata ispezionabile perché minimizzata; non è stato letto il pannello autenticato, né quello Render. Non sono disponibili connettori Netlify/Render dedicati nella sessione. Nessuna impostazione cloud è stata inferita come già corretta.

## Conferme dell'utente integrate

L’utente ha verificato che Netlify e Render usano entrambi **POrtalda/office-clocking-demo / main**. Render ha **Auto-Deploy on commit attivo** e **Start Command npm start**. Il repository principale POrtalda/office_clocking non deve essere modificato. Queste informazioni correggono l’identificazione iniziale basata soltanto sull’origin locale: quell’origin è una sorgente di lavoro, non una destinazione di pubblicazione. Il riuso Render resta non approvato finché manca la verifica completa dell’isolamento da Cliente 1.

## 2. Rischi di automazione e verifica necessaria

- **Ogni commit trasferito a main del repository demo può attivare immediatamente Render** (configurazione attiva confermata dall’utente), e può pubblicare anche Netlify. Non aggiornare main prima di backend, nuovo Atlas, configurazioni e collaudo pronti. Il branch locale traccia `origin/demo` del progetto principale, non main del repository demo. Il comportamento di un push dipende da configurazione Git, refspec e strumenti IDE: con il default simple può fallire per il nome diverso; con altre modalità, sincronizzazioni IDE o refspec può aggiornare demo. **Non fare affidamento sul fallimento come protezione.**
- Nessun push semplice, `--all`, `--mirror`, `--force`, sincronizzazione IDE o merge su demo/main. Una futura pubblicazione deve indicare sorgente, destinazione e SHA esatti, dopo autorizzazione. Non modificare l'upstream condiviso per comodità.
- Anche la creazione del solo branch Showcase può avviare branch deploy Netlify, CI o hook che ignorano il branch di produzione. Un deploy bloccato alla pubblicazione può comunque partire come build. Auditare branch deploy, Deploy Previews, build/deploy hook, GitHub Apps, Actions, eventuali Blueprint ed environment group.
- Non sono presenti workflow nel tree locale della demo di riferimento, ma questo non dimostra l'assenza di automazioni configurate nei servizi o nel repository. L'assenza di un netlify.toml/render.yaml alla radice non dimostra assenza di collegamenti cloud.
- Gli hook sono segreti. **Non aprire un deploy hook Render neppure per una GET di prova:** può avviare un deploy. Registrare privatamente soltanto esistenza, proprietario e consumatori; non copiare URL/token nel report.
- Tutti i controlli e le eventuali sospensioni devono riguardare gli ID della **sola demo**. Non intervenire su siti dal nome simile, sulla produzione Cliente 1, sui branch Client 1/main o sugli environment group condivisi.

Riferimenti: [deploy Render](https://render.com/docs/deploys), [hook Render](https://render.com/docs/deploy-hooks), [Git e Netlify](https://docs.netlify.com/build/git-workflows/overview/), [stop build Netlify](https://docs.netlify.com/build/configure-builds/stop-or-activate-builds/).

### Gate di riuso Render — tutti obbligatori

1. Dal pannello del servizio rilevare service ID, nome, workspace/progetto, URL pubblico e dominio di default; confrontarli con l'API del bundle. Non limitarsi al nome “demo”.
2. Verificare repository e branch esatti, auto-deploy, hook, cron/worker e servizi/client che usano questa API. Se l'API è utilizzata da Cliente 1, **non riutilizzarla**.
3. Controllare privatamente le origini CORS configurate e il target del vecchio DB; non mostrarne credenziali. Non devono indicare un servizio operativo del Cliente 1. Il vecchio DB resta conservato, non migrato o rigenerato.
4. Verificare environment group e credenziali condivise. Non modificare o ruotare un gruppo/segreto usato da Cliente 1. Eventuale distacco della sola associazione demo richiede autorizzazione e verifica che non coinvolga altri servizi; in caso di dubbio, stop.
5. Verificare accesso a un deploy precedente ripristinabile e catturare privatamente configurazione e collegamenti necessari al rollback. Non includere i valori dei segreti nei file versionati.
6. Accertare che le impostazioni Showcase possano essere applicate al solo service ID dimostrativo. Se uno dei punti è sconosciuto o negativo, il riuso non è approvato. Valutare un nuovo Render separato solo con nuova autorizzazione, mantenendo comunque il frontend pubblico richiesto. Non sospendere un servizio condiviso con Cliente 1.

## 3. Configurazione da applicare in futuro

`deploy/showcase/reuse-existing.example.json` è un registro di revisione manuale, **non uno script di deploy**. Gli ID e le prove ancora assenti rimangono null/false: non sono valori da indovinare. `deploy/showcase/render.yaml` resta soltanto l'alternativa per creare un servizio nuovo; non importarlo per aggiornare il Render esistente, perché può creare risorse o cambiare associazioni.

### Netlify — solo site ID verificato di office-clocking-demo

| Impostazione | Valore proposto |
| --- | --- |
| Dominio pubblico | **conservare** office-clocking-demo.netlify.app; non rinominare/eliminare il sito |
| Repository confermato dall’utente | POrtalda/office-clocking-demo |
| Production branch | main, confermato dall’utente; mantenerlo fermo durante preparazione e collaudo |
| Artefatto di preparazione | revisione feature/demo-november-showcase nel repository demo, solo dopo autorizzazione al trasferimento |
| Base | frontend |
| Comando build | npm run build:showcase |
| Publish | dist-showcase |
| Node | 22 |
| Unico parametro pubblico necessario | VITE_API_URL=https://office-clocking-backend-demo.onrender.com, solo se il riuso Render supera il gate |
| Pubblicazione | manuale su revisione/artefatto approvati; niente auto-publish durante il cambio |
| Branch deploy / preview / hook | auditare e fermare soltanto quelli della demo con approvazione |

Preferire per il passaggio un artefatto locale `frontend/dist-showcase` revisionato e una pubblicazione manuale sul **site ID esistente**. Evitare comandi CLI che selezionino automaticamente un progetto da una vecchia cartella `.netlify`. Nessun `netlify link`, creazione sito o cambio dominio è stato eseguito. Il TOML annidato è un riferimento, non viene scoperto automaticamente dal sito.

### Render — solo servizio demo verificato

| Impostazione | Valore proposto |
| --- | --- |
| URL pubblico candidato | conservare https://office-clocking-backend-demo.onrender.com |
| Repository / deploy branch attuali | POrtalda/office-clocking-demo / main, confermati dall’utente |
| Branch temporaneo per collaudo | feature/demo-november-showcase, solo con autorizzazione al cambio branch/deploy; main resta immutato |
| Branch finale | main, soltanto dopo esito positivo e promozione autorizzata |
| Root / build | backend / npm ci |
| Start attuale | npm start, confermato dall’utente; non cambiato sul cloud |
| Start da applicare | node scripts/startRemoteShowcase.js, preparato localmente; il salvataggio/deploy richiede autorizzazione |
| Health | /healthz |
| Auto-deploy attuale / proposto | On Commit / Off durante tutta la sostituzione; controllare separatamente hook, CI e Blueprint |
| Istanze / Node | una / 22; verificare piano effettivo e compatibilità senza cambiare altri servizi |
| CLIENT_URL | https://office-clocking-demo.netlify.app, origine singola esatta |
| SHOWCASE_API_URL | https://office-clocking-backend-demo.onrender.com |
| APP_ENV / NODE_ENV | showcase / production |
| DEMO_MODE / DEMO_LOCAL_GPS_BYPASS | true / **false** |
| GEOLOCATION_CLOCK_IN_ENABLED | true |
| SHOWCASE_EMAIL_MODE | disabled |
| SHOWCASE_ADMIN_USERNAME | showcase_admin |
| MONGO_URI | nuovo utente runtime, nuovo cluster Atlas, solo office_clocking_showcase_20261113 |
| SHOWCASE_ATLAS_HOST | host esatto del nuovo cluster, non quello vecchio |
| JWT_SECRET | nuova chiave casuale dedicata, almeno 32 byte hex; non riusare quella vecchia |
| OFFICE_LAT/LNG/RADIUS | sede reale, raggio 1–1000 metri |
| SMTP_* / seed URI / credenziali seed | assenti dall'ambiente attivo |

La configurazione/segreti vecchi vanno conservati **privatamente per rollback**, non lasciati attivi né copiati nel nuovo DB. Non salvare modifiche ambiente “per prova”: Render può avviare un deploy/restart come effetto del salvataggio. Autorizzare il passaggio sapendo tale conseguenza e solo dentro la finestra concordata.

### Atlas — sempre nuovo

Nuovo progetto/cluster, database `office_clocking_showcase_20261113`, nuovo utente runtime readWrite limitato al solo DB e nuovo utente seed temporaneo readWrite+dbAdmin sul solo DB. Nessun ruolo generale, nessun utilizzo di credenziali Cliente 1 o della vecchia demo. Allowlist di rete per il Render demo verificato e, temporaneamente, per l'operatore seed. Vietato 0.0.0.0/0 come scorciatoia.

Il metodo di seed rimane quello protetto descritto in [SHOWCASE_REMOTE_DEPLOY_2026-11-11.md](SHOWCASE_REMOTE_DEPLOY_2026-11-11.md): offline di default, target esatto, doppia conferma CLI/ambiente, rifiuto di DB con qualsiasi collezione, marker atomico e password casuali solo in un nuovo file privato esterno al repository. **Non eseguito.** Nessuna lettura/copia del vecchio DB è necessaria.

## 4. Sequenza esatta, con autorizzazioni separate

### A. Inventario e salvaguardia — prima di ogni modifica

1. Completare la verifica read-only dei due pannelli e compilare il registro privato con ID corretti, branch osservati, deploy SHA/ID, impostazioni e prove di isolamento. Finché manca un gate, non passare alle modifiche.
2. Verificare conservazione/download dell'artefatto Netlify precedente e disponibilità del rollback Render. Conservare in un password manager i vecchi valori ambiente e i nomi/gruppi applicati. Non eliminare deploy, chiavi o database vecchi finché serve il rollback. Verificare in particolare che lo snapshot legacy non riattivi SMTP o gruppi Cliente 1.
3. Preparare finestra di manutenzione, istruzioni per aggiornamento PWA e criteri di abort. Non promettere una sostituzione senza interruzioni: riusando lo stesso backend e cambiando auth/DB, i vecchi client non saranno compatibili durante il passaggio.

### B. Congelamento della sola demo — richiede autorizzazione B

4. Su ID verificati: bloccare pubblicazioni/build automatiche Netlify e auto-deploy Render; controllare hook/CI e deploy già accodati. La scelta esatta tra stop build e lock del deploy deve tenere conto del successivo deploy manuale. Un lock di pubblicazione non equivale ad assenza di build.
5. Non modificare pipeline condivise o trigger Client 1. Se un trigger non è isolabile, stop. Annotare cosa è stato fermato per il ripristino controllato successivo. Non cambiare il branch demo/main per ottenere una scorciatoia.

### C. Preparazione Atlas — autorizzazioni C1 creazione/configurazione e C2 seed

6. Creare e configurare il nuovo Atlas e i nuovi segreti. La modifica non deve coinvolgere il vecchio DB. Per lo startup check usare il file runtime privato con CLIENT_URL e API_URL sopra e `startRemoteShowcase.js --check`, che non connette MongoDB.
7. Revisionare target, ruoli, allowlist e nuovo percorso privato del file password; soltanto con autorizzazione specifica eseguire una volta `seedRemoteShowcase.js --apply --confirm-new-atlas` nel separato ambiente seed. Non ereditare MONGO_URI. Verificare marker ready e conteggi solo sul nuovo DB; revocare poi utente e rete seed. Non è stato eseguito alcun comando seed in questa preparazione.

### D. Revisione e trasferimento sorgenti — autorizzazione D

8. Non creare commit di pubblicazione né cambiare remoti/upstream di questo worktree condiviso col progetto principale. Preparare in futuro un **checkout nuovo e isolato** di `https://github.com/POrtalda/office-clocking-demo.git`, in una directory di release diversa da Cliente 1/Office Work. Partire dal main demo verificato, ricontrollando che sia ancora ef42d576 o dal nuovo SHA revisionato. Copiare soltanto lo snapshot di sorgenti Showcase approvato: nessuna .git, .env, credenziale, backup, dati DB, node_modules o build. Non trasferire la cronologia del progetto principale e non forzare una storia Git diversa sul main demo.
9. Sul checkout demo isolato creare una revisione su `feature/demo-november-showcase` basata sulla storia del repository demo. Il commit 2341fd4 non è un artefatto remoto pronto né va spinto direttamente sull’altro repository. Dopo audit dei trigger e autorizzazione D, trasferire solo quel branch con destinazione esplicita e verificare lo SHA: `git -C <CHECKOUT_DEMO_ISOLATO> push origin <SHA_DEMO_REVISIONATO>:refs/heads/feature/demo-november-showcase`. È un comando futuro, non eseguito ora. Ricontrollare che origin del checkout isolato sia **office-clocking-demo**, mai office_clocking. Nessun main aggiornato, nessun force, nessun push dal worktree attuale. Anche il branch preparatorio può innescare preview/hook, quindi va prima congelata la sola demo.

### E. Sostituzione backend — autorizzazione E

10. Aprire il solo Render demo verificato e confrontare di nuovo service ID/URL. Mantenendo main demo immutato, applicare temporaneamente il branch di preparazione e la revisione approvati, comando start Showcase, health, variabili servizio e nuovi segreti secondo tabella. Eventuali distacchi da gruppi condivisi devono riguardare solo la demo e avere un'approvazione esplicita; nessuna modifica ai valori del gruppo Cliente 1.
11. Avviare una sola revisione SHA approvata, tenendo conto che salvare la configurazione può già ridistribuire. Non usare una pubblicazione “latest” non verificata. Il nuovo bootstrap deve rifiutare config errata o marker non pronto; non disabilitare i controlli per superare un errore.
12. Prima del frontend pubblico verificare `/healthz`, risposta dello Showcase, CORS esatto e login con nuovi utenti. Per testare POST dalla console/strumento HTTP serve Origin esatto più JWT ove richiesto. Nessun test verso vecchio DB o Client 1. Se fallisce un controllo, non pubblicare il nuovo frontend: richiedere il rollback backend.

### F. Pubblicazione frontend — autorizzazione F

13. Ricompilare localmente l'artefatto dalla stessa revisione del backend:

    ```powershell
    Set-Location -LiteralPath 'C:\Office-Clocking\office-clocking-demo-showcase\frontend'
    $env:VITE_API_URL = 'https://office-clocking-backend-demo.onrender.com'
    npm test
    npm run lint
    npm run build:showcase
    ```

    Questo comando di build non contatta Render e non pubblica. Usare una shell senza variabili VITE di altri ambienti. Verificare bundle, CSP, _redirects e assenza di password semplici; caricare solo `dist-showcase` sul site ID esistente, non `dist` o il repository intero.
14. Verificare la bozza/artefatto senza login a origini di preview non autorizzate: il backend accetta intenzionalmente il solo dominio pubblico. Non allargare CORS per rendere funzionante una preview. Con l'autorizzazione F pubblicare l'artefatto sullo stesso sito e controllare che `/login` e il dominio siano invariati.
15. Eseguire il collaudo sotto sulla coppia backend/artefatto Showcase approvata. L'eventuale cambio branch Render è già un passaggio live della sola demo, dentro manutenzione e autorizzato, non un collaudo innocuo. Registrare SHA e deploy ID. Netlify può pubblicare manualmente l'artefatto del branch preparatorio mentre il production branch configurato resta main; il registro deve rendere esplicita questa situazione temporanea.

### G. Eventuale promozione finale a main — autorizzazione G distinta

16. Soltanto quando backend Showcase, nuovo Atlas, configurazioni e collaudo sono tutti pronti e approvati, predisporre nel **repository demo isolato** la promozione della revisione a main. Verificare che il main remoto non sia avanzato; risolvere e revisionare eventuali differenze localmente. Nessun force push, nessun merge o push al repository principale. La modalità di integrazione (fast-forward o PR) va approvata prima dell'azione.
17. Prima dell'aggiornamento main ricontrollare Auto-Deploy Render Off e pubblicazione/build Netlify congelate: lo stato iniziale On Commit rende questo aggiornamento un possibile deploy, non un semplice salvataggio del codice. Solo con G aggiornare main demo; poi, con autorizzazione separata se produce un riavvio/deploy, riallineare il branch Render finale a main e verificare l'identico contenuto revisionato. Netlify rimane sullo stesso sito/main con comando build Showcase. Controllare di nuovo entrambe le applicazioni.
18. Lasciare disattivate le automazioni finché non viene autorizzata espressamente la loro riattivazione. Aggiornare la documentazione pubblica della vecchia demo per rimuovere le istruzioni password/autofill legacy quando il nuovo sistema è effettivamente online; non pubblicare le nuove password.

## 5. Sessioni e PWA: il dominio non cambia

A differenza del primo piano, qui **localStorage e service worker restano sullo stesso origin**. Non assumere installazione pulita.

- I vecchi token non sono validi con la nuova chiave/issuer/audience. Il controllo `/api/auth/me` deve forzare un nuovo accesso prima della dashboard. Le nuove password non sono quelle del vecchio autofill.
- Un vecchio service worker può servire il vecchio bundle. Chiudere le schede/PWA vecchie, riaprire il sito, accettare l'aggiornamento Office Clocking e ricaricare; verificare che l'autofill legacy sia sparito e che compaia Showcase online. Provare sia un profilo pulito sia uno già utilizzato.
- Se il browser resta bloccato sulla vecchia app, procedura assistita e mirata: rimuovere solo registrazione service worker e cache di `office-clocking-demo.netlify.app` dagli strumenti del browser, poi ricaricare. Per token obsoleti eliminare solo token/authUser di quell'origine oppure usare logout. Non cancellare dati di altri siti e non disattivare protezioni del browser.
- Non è stato introdotto uno script che svuoti indiscriminatamente localStorage/cache. Preferenze di altri account, prodotti e siti restano preservate. La PWA non consente timbrature offline.
- Durante il riuso dello stesso Render, vecchi JWT/password vengono rifiutati anche se resta un vecchio bundle in cache. Se si dovesse scegliere un nuovo backend invece del riuso, occorre un piano separato per impedire che vecchi client continuino a usare il vecchio backend; non sospendere mai un servizio condiviso con Cliente 1.

## 6. Collaudo post-sostituzione

1. `/login` sul dominio pubblico invariato, HTTPS valido, asset revisione giusta, niente mixed content, frontend puntato al Render approvato; nessuna API Client 1/local V2.
2. Profili nuovi User e `showcase_admin`, rifiuto 1234 e vecchio JWT, refresh, logout, revoca utente e blocchi 429 con Retry-After. Admin diverso dal presentatore rifiutato.
3. CORS preflight dalla sola origine pubblica riuscito, origine diversa e scritture senza Origin rifiutate. JWT scaduti/alterati/di altri ambienti rifiutati.
4. Con esenzione remota assente/false, in sede GPS reale e raggio della sede. Con `SHOWCASE_GPS_CHECK_DISABLED=true` nella sola istanza Showcase verificare la policy autenticata e il ciclo entrata/pausa/uscita senza GPS; indicazione di controllo disattivato visibile. Nessun bypass locale e nessuna coordinata inventata. Fuori sede senza motivo rifiutato; con motivo entrata, pause e uscita coerenti con posizione nulla.
5. Home, storico e CSV coerenti su ore nette/pause e fuso Rome; approvazioni/audit dimostrabili. Gestione utenti/GPS/impostazioni bloccata anche lato backend.
6. Destinatari vuoti/solo dati sintetici, nessun SMTP attivo e nessuna email inviata. Vecchio DB non cancellato né popolato; tutto il nuovo traffico punta al solo Atlas nuovo.
7. Desktop, mobile e PWA preesistente aggiornati; API non restituite da cache offline. L'accesso alle preview non viene ottenuto indebolendo CORS.
8. Registrare pubblicamente solo esiti e ID non sensibili. Tenere valori ambiente, URI con password, chiavi JWT, hook e credenziali fuori da Git e dal report.

## 7. Rollback coordinato — autorizzazione R per ogni ripristino

**Rollback frontend da solo non basta:** il vecchio client può non autenticarsi al backend Showcase e un vecchio artefatto può contenere il vecchio URL API.

### Ripristino dell'intera vecchia demo

1. Mantenere congelati i trigger e identificare i due deploy legacy effettivi registrati prima del cambio, non il generico HEAD del repository. Il rollback riguarda soltanto gli ID demo, mai Client 1.
2. Esaminare le configurazioni che Render ripristinerà dal deploy scelto: comando start, health, variabili ambiente e associazioni ai gruppi possono tornare a quelli dello snapshot; i gruppi condivisi hanno regole differenti. Non procedere se il ripristino riattiva SMTP o coinvolge gruppi/credenziali Cliente 1. Se lo snapshot non è sicuro, preparare un rebuild legacy con ambiente della sola demo privo di SMTP e chiedere approvazione specifica, anziché un rollback automatico cieco.
3. Ripristinare backend legacy con la propria configurazione privata verificata e il **vecchio DB demo rimasto conservato**, dopo approvazione R. Non avviare vecchio codice contro il nuovo Atlas, né Showcase contro il vecchio DB. Nuovi e vecchi JWT/DB sono coppie distinte. Non fare seed, reset o copia inversa dei dati.
4. Verificare API/CORS/readiness legacy, poi ripubblicare il precedente deploy Netlify dello stesso site ID (autorizzazione R). Verificare la stessa URL e gestire anche il service worker in rollback: chiudere, aggiornare, ricaricare. Non recuperare dati di sessione da segreti versionati.
5. Lasciare il nuovo Atlas intatto per analisi. Non cancellare vecchio o nuovo DB, utenti o chiavi. Le impostazioni correnti di Render e gli auto-deploy vanno ricontrollati dopo il rollback, perché un successivo deploy normale può riprendere i valori correnti anziché quelli riusati dal rollback.

### Rollback tra revisioni Showcase

Se si ripristina una revisione successiva alla migrazione mantenendo il nuovo Atlas, usare soltanto codice compatibile con la policy remota e con lo schema corrente. Non usare il commit locale 2341fd4 come rollback del profilo remoto: non contiene quella policy. Il ripristino completo della vecchia demo è il caso separato descritto sopra.

Netlify può ripubblicare un artefatto precedente senza una nuova build; gli auto-publish possono sovrascriverlo. Render riusa artefatti disponibili e alcune impostazioni dello snapshot, senza modificare in modo permanente tutte le impostazioni correnti; i gruppi condivisi richiedono attenzione. Verificare in console la retention effettiva prima della sostituzione. [Rollback Netlify](https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/), [rollback Render](https://render.com/docs/rollbacks).

## 8. Operazioni non autorizzate in questa fase

Richiedono consenso distinto, con ID e valori non sensibili già revisionati: congelamento trigger, modifiche a impostazioni/associazioni dei soli servizi demo, creazione Atlas/utenti/allowlist, seed una tantum, futuro commit/push del branch nel solo repository demo isolato, promozione finale di main solo dopo readiness/collaudo, cambio branch dei servizi, deploy backend, pubblicazione Netlify, eventuale manutenzione online, ogni rollback e qualsiasi riattivazione automatica. Anche una modifica ambiente che avvia subito un redeploy fa parte dell'approvazione del deploy, non è una lettura.

In questa preparazione: nessun push/fetch/merge/deploy/seed, nessun login alla vecchia demo, nessuna modifica dei servizi cloud o database, nessuna modifica a Cliente 1 o Office Work. Nessun upstream o metadato Git condiviso modificato. Le impostazioni remote mancanti restano un **blocco alla pubblicazione**, non un motivo per inventare ID o presumere che Render sia dedicato.


## 9. Esiti di questa preparazione locale

- Backend **359/359**, 41 suite; frontend **36/36**. Le nuove prove confermano che gli URL della demo esistente sono compatibili con la policy Showcase, senza permettere bypass locale, SMTP o database locale V2.
- ESLint riuscito; build standard e build Showcase/PWA riuscite. La build Showcase usa https://office-clocking-backend-demo.onrender.com e genera la CSP corrispondente; compilare non contatta l'API e non pubblica.
- Runtime di autenticazione/JWT, email, GPS, seed, bootstrap, timbrature, messaggio fuori sede e tema confrontati per hash con l'inizio del task: nessuna modifica. File .env, backup e screenshot preesistenti invariati.
- JSON di revisione e TOML analizzati; YAML Render resta alternativa per nuovo servizio, con repository dedicato esplicito e auto-deploy off nel file. Ciò non cambia l'Auto-Deploy On Commit attuale del servizio esistente.
- Nessuna modifica di origin/upstream, nessun fetch o push, nessun commit, merge, seed o deploy. Il working tree conserva tutte le modifiche di preparazione remota precedenti.

File aggiornati in questo passaggio: questo piano; SHOWCASE_REMOTE_DEPLOY_2026-11-11.md; SHOWCASE_REVIEW_2026-11-10.md; deploy/showcase/reuse-existing.example.json, netlify.toml, render.yaml, variables.example.txt; backend/tests/utils/remoteShowcase.test.js; frontend/tests/remoteShowcase.test.js.


## GPS remoto: autorizzazione esplicita (11 novembre 2026)

Il solo `DEMO_MODE=true` non disabilita la geolocalizzazione remota. Variabile **opzionale lato server**: `SHOWCASE_GPS_CHECK_DISABLED=true`. Assente o `false` mantiene il comportamento precedente; ogni altro valore impedisce l’avvio Showcase. Nessuna nuova variabile frontend e nessun segreto nel bundle.

L’esenzione richiede l’intero profilo remoto valido (`APP_ENV=showcase`, `NODE_ENV=production`, `DEMO_MODE=true`, Atlas/DB Showcase, JWT dedicato, email disabilitate, origini HTTPS esatte), più HTTPS, host API e Origin client corretti. `DEMO_LOCAL_GPS_BYPASS=false` e `GEOLOCATION_CLOCK_IN_ENABLED=true` restano obbligatori; configurazione sede reale invariata per tornare ai controlli GPS. Una produzione ordinaria non ottiene l’esenzione dal solo nuovo flag.

Il frontend Showcase consulta `/api/records/gps-policy` con autenticazione. Solo `canSkipShowcaseGps:true` autorizza il payload distinto `showcaseWithoutGps:true` per entrata, uscita e pause. Il vecchio `demoWithoutGps` resta esclusivamente locale. Policy mancante/non valida mantiene il flusso GPS; la revoca server rifiuta anche un client con policy precedente. Il frontend limita la policy all’account che l’ha ricevuta.

In demo online autorizzata non si richiede il permesso GPS e non si registrano coordinate. Restano visibili la disponibilità della funzione nella versione aziendale e l’indicazione “controllo GPS disattivato”. “Fuori sede” richiede sempre motivazione e payload separato: non può essere combinato con l’esenzione demo. Il server rifiuta coordinate inviate insieme al marker remoto, evitando posizioni non validate. Nessuna modifica a database, notifiche, approvazioni o JWT.

Per abilitare in futuro: aggiungere privatamente `SHOWCASE_GPS_CHECK_DISABLED=true` **solo** alla configurazione runtime Showcase verificata, poi controllare offline. Il seed non richiede modifiche. I file runtime già validi restano validi senza questa riga, ma mantengono il GPS obbligatorio. Nessuna configurazione privata o cloud è stata cambiata per attivarla in questo intervento.

Collaudo futuro HTTPS: con flag assente/false verificare diniego senza GPS; con true negare il permesso nel browser e completare entrata → pausa → fine pausa → uscita; verificare messaggio demo e posizioni nulle, motivazione fuori sede obbligatoria, rifiuto marker locale e origini estranee. Ripristinando false le nuove richieste senza GPS devono fallire. Prima di applicare variabili o pubblicare, restano necessarie verifica isolamento Render da Cliente 1 e autorizzazioni del piano di sostituzione. Nessun deploy effettuato.


## Nome database corretto — aggiornamento autorizzato 11 novembre 2026

Target attivo esatto: `office_clocking_showcase_20261113`. URI private aggiornate conservando password/JWT. File password account esistente intatto e non letto; NON usare il seed ordinario per aggirarne il blocco. Diagnostica reale sul nuovo target: PERMISSION_DENIED / MONGO_8000 / list-collections. Servono ruoli Atlas manuali sul nome nuovo. Seguire `SHOWCASE_DATABASE_RECOVERY_2026-11-11.md`: recupero separato preparato, non applicato, con autorizzazione futura obbligatoria. Nessuna modifica a cloud, database o altri ambienti. I riscontri precedenti di configurazione privata vuota/incompleta sono storici.
