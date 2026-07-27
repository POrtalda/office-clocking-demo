# Office Clocking - Demo Mode

Questa guida serve per avviare Office Clocking in modalità demo locale.

## Obiettivo

La modalità demo permette di presentare l'app a clienti o stakeholder usando:

- database separato
- utenti fittizi
- timbrature dimostrative
- assenze dimostrative
- banner "Modalità Demo"
- blocco delle azioni admin sensibili

## Configurazione backend

Nel file `backend/.env` usare un database demo separato:

```env
MONGO_URI=mongodb://localhost:27017/office_clocking_demo
JWT_SECRET=change_this_with_a_long_random_secret
PORT=5000
CLIENT_URL=http://localhost:5173
DEMO_MODE=true