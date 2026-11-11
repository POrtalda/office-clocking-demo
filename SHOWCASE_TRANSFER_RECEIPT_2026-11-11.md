# Verbale trasferimento Showcase — preparazione locale, nessuna pubblicazione

Repository esclusivo: https://github.com/POrtalda/office-clocking-demo.git

- Sorgente: C:\Office-Clocking\office-clocking-demo-showcase, feature/demo-november-showcase.
- Commit sorgente finale: `5775b97edb591774b5ae807cb5289143ecaf8781`; precedente commit completo preparazione: `20800edd2ebdd6c1c4cc64bb0db7374be9a5ec00`.
- Checkout indipendente: C:\Office-Clocking\office-clocking-demo-publish-20261111.
- Branch destinazione locale: `prepare/showcase-20261113`, senza upstream main; push.default=nothing.
- Padre previsto del commit destinazione: `ef42d576f49453cf7e798a545c1e790a874be2a9` (vecchia main demo).
- Rollback locale: branch `rollback/public-demo-before-showcase-20261111` e tag `rollback-public-demo-before-showcase-20261111`, entrambi sullo SHA padre. main e origin/main non aggiornati.
- Trasferimento: git archive del solo snapshot, NESSUNA storia Git della sorgente importata.
- Prima di aggiungere questo verbale, albero indice destinazione IDENTICO al sorgente: `464e6e25b346456d610e0ef45d8f9c05cb58bbdc`. L’unica differenza finale prevista rispetto allo snapshot sorgente è questo verbale.
- Nessun file .env reale/test, password, backup, screenshot, node_modules o build versionato. Solo due .env.example pubblici. backend/.env.test resta fisicamente nella sola sorgente, ignorato e non esportato. Proposta icona conservata come asset separato.

## Verifiche effettive nel clone privo di env

npm ci --offline riuscito in backend e frontend dai lockfile. **428 test backend in 44 suite, 41 test frontend, ESLint, build Showcase HTTPS/PWA superati**. Le quattro rifiniture di test/whitespace del clone sono ora incluse anche nel commit sorgente finale. Nessuna variazione funzionale dopo i controlli: soltanto rapporto aggiornato e questo verbale. Guardie preview Netlify provate con exit0(ignore)/exit1(command). Diff check superato. Scansione snapshot senza segreti/file esclusi riconosciuti. Avvisi npm preesistenti su inflight/glob deprecati, non modificati i lockfile; nessun audit di sicurezza completo dichiarato.

## Rischio prima di un push futuro

Render srv-d7tn3breo5us738b14ag: Auto-Deploy OFF confermato dall’utente. Netlify: Build Active, produzione main, branch deploy solo produzione; PR preview abilitate per PR verso main/branch deploy branches. Il solo push del branch preparatorio senza PR non dovrebbe avviare Branch deploy secondo queste impostazioni; una PR può avviare preview e main può pubblicare produzione. Hook/Actions/GitHub Apps/consumatori esterni restano da verificare: non dedurre assenza trigger da status GitHub vuoti. Nessun hook cloud è stato invocato.

Root netlify.toml: frontend / npm run build:showcase / dist-showcase / Node22 / API HTTPS pubblica. Contesti branch e deploy-preview annullati con ignore e comando di errore. Hook Netlify possono bypassare ignore; nessuna protezione locale sostituisce audit cloud o autorizzazioni. Fonti: https://docs.netlify.com/build/configure-builds/ignore-builds/ e https://docs.netlify.com/build/configure-builds/file-based-configuration/ .

Render futuro: root backend, npm ci, start node scripts/startRemoteShowcase.js, health /healthz. Il precedente npm start non attiva il bootstrap Showcase. Configurare privatamente solo runtime dedicato, email disabled, GPS locale false, eventuale opt-in server SHOWCASE_GPS_CHECK_DISABLED=true. Seed già ready 16/284/2: NON ripeterlo. Non applicare render.yaml annidato (alternativa per nuovo servizio). Isolamento da Cliente1/environment group e rollback ID dei deploy cloud ancora da verificare. Questi riferimenti Git salvano il codice, non i segreti/configurazioni o gli artefatti cloud live.

## Prossimo passo Git — preparato, NON eseguito

Serve autorizzazione esplicita al singolo push. Confrontare HEAD con il commit destinazione comunicato al termine e ricontrollare i trigger cloud. Da PowerShell:

```powershell
Set-Location -LiteralPath 'C:\Office-Clocking\office-clocking-demo-publish-20261111'
if ((git remote get-url origin) -ne 'https://github.com/POrtalda/office-clocking-demo.git') { throw 'Repository errato' }
if ((git branch --show-current) -ne 'prepare/showcase-20261113') { throw 'Branch errato' }
if (git status --porcelain) { throw 'Checkout non pulito' }
git rev-parse HEAD
$existingShowcaseBranch = git ls-remote --heads origin refs/heads/prepare/showcase-20261113
if ($LASTEXITCODE -ne 0) { throw 'Verifica remoto fallita' }
if ($existingShowcaseBranch) { throw 'Branch remoto esistente: rivalutare, non sovrascrivere' }
# SOLO DOPO autorizzazione e confronto dello SHA finale:
# git push origin SHA_ESATTO_COMMIT_DESTINAZIONE:refs/heads/prepare/showcase-20261113
```

Il riepilogo finale fornisce il comando con SHA concreto. Non aprire PR automaticamente; non spingere main/tag/rollback o usare --all/--mirror/--force. Nessun merge o deploy implicato. Origine sorgente principale invariata e MAI destinazione del push.

Attività restanti per pubblicare l’app: verifica isolamento Render, snapshot privato configurazioni/deploy ID rollback, applicazione autorizzata dei segreti/start command, backend deploy e collaudo HTTPS, pubblicazione frontend e promozione main solo dopo approvazione. Nessun servizio/database/credenziale modificato durante questa preparazione.
