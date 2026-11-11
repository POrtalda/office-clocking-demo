# Showcase — preparazione della pubblicazione dal clone isolato

Repository UNICO di destinazione: https://github.com/POrtalda/office-clocking-demo.git. La sorgente resta sul branch feature/demo-november-showcase con origin invariato; non usarne il comando push. Nessun push/merge/deploy o cambiamento cloud è stato eseguito durante la preparazione.

## Stato confermato e riferimenti

- Checkout isolato: `C:\Office-Clocking\office-clocking-demo-publish-20261111`, Git metadata indipendenti, clone del solo repository demo. Branch di preparazione `prepare/showcase-20261113`, senza upstream main e con push.default=nothing.
- main demo acquisita da GitHub: `ef42d576f49453cf7e798a545c1e790a874be2a9`. Nel clone rimane invariata; riferimento locale branch `rollback/public-demo-before-showcase-20261111` e tag `rollback-public-demo-before-showcase-20261111` sullo stesso SHA. Questo è il rollback DEL CODICE; non prova quale deploy cloud sia live. Acquisire privatamente deploy ID Netlify/Render e snapshot configurazioni prima della pubblicazione.
- Render demo `srv-d7tn3breo5us738b14ag`, Auto-Deploy OFF: confermati dall’utente. Nessuna interrogazione/modifica del pannello da parte dell’agente. Isolamento da Cliente 1 ed environment group ancora da verificare prima di cambiare configurazioni cloud.
- Atlas già popolato e verificato ready: `office_clocking_showcase_20261113`, cluster `showcasecluster.xed8r0t.mongodb.net`, 16 utenti, 284 timbrature, 2 assenze. NON eseguire seed/recupero/migrazioni durante installazione o deploy. Nessuna connessione Atlas in questa preparazione.

## Netlify: rischio di automazione prima del push

Configurazione confermata dall’utente: Build status Active; Production branch main; Branch deploys Deploy only the production branch; Deploy Previews Any pull request against your production branch / branch deploy branches.

Il solo push di prepare/showcase-20261113, senza aggiornare main e senza aprire PR, non dovrebbe generare Branch deploy in base a queste impostazioni. Un push main può invece pubblicare produzione; aprire/aggiornare una PR verso main può avviare una Deploy Preview. Non usare gh pr create, sincronizzazioni IDE generiche o push di main. Nessuna PR è stata aperta. Hook, automazioni esterne e impostazioni cloud possono cambiare: riverificarli prima del comando futuro. Status GitHub sul vecchio commit restituiti vuoti non dimostrano assenza di automazioni.

Il nuovo netlify.toml alla radice specifica build Showcase e aggiunge ignore exit 0 nei contesti branch-deploy/deploy-preview, con command exit 1 come ulteriore guardia. Secondo Netlify gli hook ignorano il comando ignore; per questo è presente anche il comando di errore. Queste guardie non sospendono trigger cloud o azioni esterne, non proteggono push main in contesto production e non sostituiscono l’audit. Il file annidato deploy/showcase/netlify.toml è solo riferimento.

Fonti ufficiali: https://docs.netlify.com/build/configure-builds/ignore-builds/ e https://docs.netlify.com/build/configure-builds/file-based-configuration/ .

## Compatibilità da applicare in futuro, non modificata nel cloud

Render esistente: root backend, build `npm ci`, start `node scripts/startRemoteShowcase.js` (oppure npm run showcase:start), health /healthz, Node22, una sola istanza, Auto-Deploy OFF. Il corrente npm start lancia server.js e NON va usato per il nuovo profilo remoto. Configurare soltanto i segreti runtime dedicati del nuovo Atlas, APP_ENV=showcase, NODE_ENV=production, DEMO_MODE=true, DEMO_LOCAL_GPS_BYPASS=false, GEOLOCATION_CLOCK_IN_ENABLED=true, SHOWCASE_EMAIL_MODE=disabled, origin client/API esatti, JWT dedicato. SHOWCASE_GPS_CHECK_DISABLED=true solo per abilitare esplicitamente la demo remota senza GPS. Nessuna variabile seed/SMTP nel servizio. Il bootstrap rifiuta config errata o marker non ready, disabilita autoIndex/autoCreate e non effettua seed. Il Blueprint annidato render.yaml è alternativa per NUOVO servizio: NON applicarlo al servizio esistente.

Netlify esistente: production main invariata, base frontend, build npm run build:showcase, publish dist-showcase relativo alla base, Node22. Variabile pubblica VITE_API_URL=https://office-clocking-backend-demo.onrender.com (anche nel toml). Build remota ignora .env locali e usa mode showcase-remote. Dist-showcase include header CSP/API HTTPS, redirect SPA/API, manifest/service worker e blocco indicizzazione. Bundle senza credenziali locali semplici. Gli asset icona proposti restano in icon-proposals, non applicati.

Nessun file env reale, password account, backup, screenshot, node_modules o output build deve entrare nel commit/snapshot. I soli file .env.example sono modelli pubblici. backend/.env.test preesistente resta sul disco sorgente ma è rimosso dal tracking; Jest usa default pubblici e deterministici nel setup. Root .gitignore aggiunge protezioni autonome per il clone (non dipende dagli exclude del worktree sorgente).

## Procedura futura Git — soltanto dopo autorizzazione al singolo push

I comandi esatti con SHA del commit trasferito sono nel verbale SHOWCASE_TRANSFER_RECEIPT_2026-11-11.md del clone e nel riepilogo dell’intervento. Pubblicare soltanto refs/heads/prepare/showcase-20261113 nel repository demo, mai main, tag o tutti i branch. Nessun --force, --all, --mirror o --tags.

Prima: `git remote get-url origin`, `git branch --show-current`, `git status --short`, `git rev-parse HEAD`, `git ls-remote --heads origin refs/heads/prepare/showcase-20261113`. Se esiste già un branch remoto diverso dal commit revisionato, fermarsi e rivalutare; non sovrascrivere.

Il push futuro NON autorizza deploy, PR o merge. Prima di pubblicare l’app restano autorizzazioni separate per config Render, acquisizione rollback dei deploy/config, collaudo backend HTTPS, pubblicazione Netlify e promozione main. Non ripetere seed.
