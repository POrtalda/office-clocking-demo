# Collaudo UI isolato

Avvio da frontend/: `node tests/visual-check/server.mjs`.
Aprire http://127.0.0.1:5176/tests/visual-check/index.html.

Monta le Home e i componenti reali. Le risposte API sono fixture in memoria; tutte le operazioni di scrittura rispondono 405. Nessun database, SMTP o backend applicativo è utilizzato. Gli account ui-preview-a/b sono esclusivamente di collaudo e le loro preferenze sono isolate da quelle dei profili demo reali.

Serve a controllare layout, tastiera, sticky clock e persistenza locale nel browser. Non dimostra il funzionamento end-to-end di timbrature o conteggi. Ctrl+C arresta il server. La pagina non è inclusa nell'entry point della build e non modifica la configurazione applicativa.

## Tema chiaro/scuro (11 novembre 2026)

La pagina monta anche AccountThemeProvider e lo Storico reali. Il caricamento iniziale usa prepareInitialTheme per il profilo fittizio selezionato; nessun login applicativo o token reale viene usato. Per ripetere: Account A → luna/sole → reload → Home Admin/Storico; il tema rimane condiviso. Account B parte chiaro ed è indipendente. Invio e Spazio attivano il pulsante nativo.

Verificati viewport 1280×900, 900×900, 375×812 e 320×700; nessun overflow orizzontale delle pagine dopo la correzione dello Storico. Le tabelle mantengono il proprio scorrimento orizzontale. Aperte tutte le sezioni Admin e i moduli User; il dialogo di eliminazione è stato solo aperto e annullato. Nessuna operazione di scrittura esercitata.

Prove visive: evidence/dark-user-mobile.jpg e evidence/dark-admin-desktop.jpg. La fascia azzurra identifica esclusivamente la pagina di collaudo: non è il banner DEMO dell'app. La cattura desktop rappresenta il riquadro visibile del browser, non l'intera pagina.
