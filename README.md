# Office Clocking Demo

**Office Clocking Demo** is the public portfolio version of a full-stack time tracking web application designed to manage employee clock-ins, clock-outs, absences, manual closure requests, admin reports, and CSV exports.

The project was built as a real-world portfolio application using a modern React + Node.js stack.

It includes:

- user and admin roles;
- daily clock-in / clock-out workflow;
- absence management;
- daily and hourly PIR requests;
- manual closure workflow for anomalous records;
- admin dashboards and reports;
- CSV export;
- public demo environment with ready-to-use test users;
- PWA installation and update support.

---

## Live Demo

Demo frontend:

```txt
https://office-clocking-demo.netlify.app/login
```

Public features page:

```txt
https://office-clocking-demo.netlify.app/funzionalita
```

Demo backend:

```txt
https://office-clocking-backend-demo.onrender.com
```

### Demo Users

All demo users use the same password:

```txt
1234
```

Available demo accounts:

| Username | Role |
| --- | --- |
| admin | Admin |
| mario | User |
| luca | User |
| giulia | User |
| anna | User |
| ale | User |

The login page provides quick-access demo profile buttons, so visitors can select a role without manually looking up credentials.

The Admin account is highlighted as the recommended starting profile.

The demo environment uses safe demo data and is intended for portfolio presentation, testing, and project review.

> The backend is hosted on Render. On a cold start, the demo can take a few seconds to become available. The frontend shows a loading message if the server response takes longer than expected.

---

## Main Features

### User Area

- Login
- Quick demo profile selection
- Clock-in
- Clock-out
- Prevention of double clock-in
- Prevention of double clock-out
- Daily status summary
- Contextual user hints
- Personal time record history
- Open/anomalous record detection
- Manual closure request
- Absence request for:
  - ferie
  - PIR
  - mutua
- Daily PIR request
- Hourly PIR request
- Hourly PIR start-time selection
- Hourly PIR duration from 1 to 8 whole hours
- Automatic PIR end-time calculation
- Hourly PIR can coexist with normal time records on the same day
- Compact leave request history
- Feedback messages after user actions
- CSV export

### Admin Area

- Login
- Quick dashboard summary
- Clickable summary cards
- User management
- Active/inactive user handling
- Per-user geolocation setting
- Single-user summary
- Global multi-user summary
- Daily records detail
- CSV export
- Manual closure requests list
- Approve manual closure requests
- Reject manual closure requests
- Absence request management
- Approve ferie/PIR requests
- Approve hourly PIR requests even when the day already contains normal time records
- Cancel already approved ferie/PIR requests with reason
- Approved ferie/PIR overview
- Configurable minimum advance days for ferie/PIR
- Configurable email recipients for ferie/PIR notifications

---

## Hourly PIR

Office Clocking supports both full-day and hourly PIR requests.

For an hourly PIR request, the user selects:

- the day;
- the PIR start time;
- a duration from 1 to 8 whole hours.

The application calculates the end time automatically.

Hourly PIR is intentionally different from a full-day absence:

- it can coexist with normal clock-in / clock-out records on the same day;
- it does not make the entire day unavailable for time tracking;
- it is not counted as a full-day absence in admin summaries;
- admins can approve it even when a time record already exists for that day.

This allows Office Clocking to represent partial-day leave without blocking the employee's normal working activity.

---

## Demo / Portfolio Improvements

The public demo includes dedicated UX improvements for portfolio presentation:

- quick-access demo login profiles;
- Admin profile shown first;
- role badges for Admin/User;
- “Consigliato per iniziare” badge on the Admin profile;
- automatic username/password filling from demo profile buttons;
- compact guide in the Admin home;
- compact guide in the User home;
- improved `/funzionalita` landing page;
- responsive visual polish for demo usage;
- delayed loading feedback when the demo backend is waking up;
- public PWA installation support;
- dedicated demo PWA branding;
- in-app PWA update notification.

The public demo intentionally does not include production-only features such as the company car booking module.

---

## PWA Support

The demo can be installed as a Progressive Web App.

### Demo-specific branding

The installed demo is visually distinguishable from the production application:

- application name: **Office Clocking Demo**;
- short name: **Clocking Demo**;
- orange demo theme;
- dedicated orange app icons;
- `DEMO` badge in the app icon;
- dedicated favicon and Apple Touch icon.

This makes it easy to keep the demo and production installations separate on the same device.

### PWA Updates

The application uses a prompt-based service worker update flow.

When a new version is available, the application shows:

```txt
Nuova versione disponibile
```

with the actions:

- **Aggiorna**
- **Più tardi**

The service worker also checks for updates when the app is launched, improving the chances that an installed PWA discovers a new deployment promptly.

---

## Demo Server Loading Feedback

The demo backend runs on Render and may need a short warm-up period after being idle.

To avoid making the interface appear frozen, the frontend monitors login/demo-account requests and, after approximately two seconds, displays an animated loading overlay:

```txt
Caricamento...
Connessione al server demo in corso. Attendi qualche secondo...
```

The overlay disappears automatically when the server responds.

---

## Tech Stack

### Frontend

- React
- React Router
- React Calendar
- Context API
- Vite
- Vite PWA Plugin
- Workbox
- ESLint

### Backend

- Node.js
- Express
- MongoDB Atlas / local MongoDB
- Mongoose
- JWT
- Jest
- Supertest
- Nodemailer

### Deploy

- Frontend: Netlify
- Backend: Render
- Database: MongoDB Atlas

### Application Timezone

```txt
Europe/Rome
```

MongoDB stores timestamps in UTC, while application-level day and range filters are handled using the `Europe/Rome` timezone.

---

## Repository and Branch Strategy

This repository contains the **public demo** version of Office Clocking:

```txt
https://github.com/POrtalda/office-clocking-demo.git
```

The demo repository uses:

- `main` as the deployed public demo branch;
- short-lived feature branches for individual improvements;
- pull requests before changes are merged into `main`.

Recent demo work has been developed through focused branches such as:

```txt
feature/hourly-pir-demo
feature/demo-login-quick-access
feature/demo-loading-feedback
feature/demo-pwa-icon
feature/demo-pwa-update-button
```

Production/client development is maintained separately so demo-specific behavior and branding do not affect the production application.

---

## Security and Configuration

Completed hardening steps:

- real `.env` files are not tracked by Git;
- `.env.example` files are provided;
- no real MongoDB Atlas URI is committed;
- no real `JWT_SECRET` is hardcoded;
- JWT authentication is used for protected routes;
- production and demo environments use separate environment variables;
- SMTP configuration is managed through environment variables;
- the public demo uses dedicated demo data;
- sensitive demo admin operations are protected/limited.

---

## Local Setup

### 1. Clone the public demo repository

```bash
git clone https://github.com/POrtalda/office-clocking-demo.git
cd office-clocking-demo
```

### 2. Configure backend environment variables

Create `backend/.env` starting from `backend/.env.example`.

Example:

```env
MONGO_URI=mongodb://localhost:27017/office_clocking_demo
JWT_SECRET=change_this_with_a_long_random_secret
PORT=5000
CLIENT_URL=http://localhost:5173
DEMO_MODE=true
```

Optional SMTP variables for email notifications:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM=Office Clocking <example@example.com>
SMTP_TIMEOUT_MS=10000
```

### 3. Configure frontend environment variables

Create `frontend/.env` starting from `frontend/.env.example`.

Example:

```env
VITE_API_URL=http://localhost:5000
VITE_DEMO_MODE=true
```

---

## Start the Project Locally

### 1. Start the backend

```bash
cd backend
npm install
npm run dev
```

### 2. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Backend Structure

The backend is separated into `app.js` and `server.js` to improve testability.

### `backend/app.js`

Responsibilities:

- create the Express app;
- configure global middlewares;
- configure CORS;
- apply rate limiting;
- mount routes;
- mount `notFound` and `errorHandler`;
- export the app for tests;
- does not start the server;
- does not connect to MongoDB.

### `backend/server.js`

Responsibilities:

- load environment variables;
- read `PORT`, `MONGO_URI`, `CLIENT_URL`;
- connect to MongoDB;
- start `app.listen(...)`.

This separation allows tests to import the Express app directly without starting a real server.

---

## Running Tests

### Backend tests

```bash
cd backend
npm test
```

Latest validated backend suite for the hourly PIR demo integration:

```txt
Test Suites: 25 passed, 25 total
Tests:       198 passed, 198 total
```

### Frontend lint

```bash
cd frontend
npm run lint
```

### Frontend production build

```bash
cd frontend
npm run build
```

Latest known validation:

```txt
Backend tests: OK
Frontend lint: OK
Frontend build: OK
PWA generation: OK
```

---

## Test Coverage

The backend test suite covers the main business workflows.

### Base

- Smoke test
- Health test on `GET /`

### Auth

- `POST /api/auth/login`
- `GET /api/auth/me`

### User / Records

- `POST /api/records/clock-in`
- `POST /api/records/clock-out`
- `GET /api/records/my`
- `GET /api/records/my-open`
- `POST /api/records/request-manual-clock-out`

### Leaves / Absences

- `POST /api/leaves/:type`
- User absence creation rules
- Minimum advance days for ferie/PIR
- Prevention of overlapping active absences
- Prevention of clock-in / clock-out when a full-day approved absence exists
- Daily PIR requests
- Hourly PIR requests
- Hourly PIR duration validation
- Hourly PIR start-time validation
- Prevention of hourly PIR ranges crossing into the next day
- Coexistence between hourly PIR and normal time records
- Support for:
  - `mutua`
  - `pir`
  - `ferie`

### Admin

- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id/status`
- `PATCH /api/admin/users/:id/password`
- `PATCH /api/admin/users/:id/geolocation`
- `DELETE /api/admin/users/:id`
- `GET /api/admin/records`
- `GET /api/admin/summary`
- `GET /api/admin/summary-all`
- `GET /api/admin/export`
- `GET /api/admin/manual-closure-requests`
- `POST /api/admin/manual-closure-requests/:recordId/approve`
- `POST /api/admin/manual-closure-requests/:recordId/reject`
- `POST /api/admin/leave-requests/:leaveId/approve`
- `POST /api/admin/leave-requests/:leaveId/cancel`
- `GET /api/admin/settings`
- `PATCH /api/admin/settings`
- approval of hourly PIR when a normal time record exists;
- hourly PIR excluded from full-day absence summary counts.

---

## Core Business Rules

### Manual Closure

Manual closure is available for anomalous open records.

Main rules:

- the record must belong to the authenticated user;
- the record must be eligible for manual closure;
- the proposed clock-out must be after the clock-in;
- the proposed clock-out cannot be in the future;
- the maximum allowed duration is 12 hours;
- admin can approve or reject the request.

Constants used:

```txt
MAX_MANUAL_CLOSURE_HOURS
MAX_MANUAL_CLOSURE_SECONDS
```

---

## Absence Management

Office Clocking supports absence handling through a dedicated absence model.

Supported absence types:

- `mutua`
- `pir`
- `ferie`

Main rules:

- users can request absences;
- ferie/PIR can have configurable minimum advance days;
- mutua is excluded from the minimum advance days rule;
- users cannot create overlapping active full-day absences;
- full-day approved absences block normal clock-in / clock-out for that day;
- hourly PIR can coexist with normal clock-in / clock-out records;
- hourly PIR uses a start time and a duration from 1 to 8 hours;
- admins can approve ferie/PIR requests;
- admins can cancel already approved ferie/PIR requests with a mandatory reason;
- approved full-day absences are included in admin summaries and reports;
- hourly PIR is not counted as a full-day absence;
- email notifications can be sent to configured admin recipients for ferie/PIR requests.

---

## Geolocation

Office Clocking supports geolocation validation for clock-in and clock-out.

Rules:

- geolocation can be globally enabled or disabled;
- each user can have geolocation enabled or disabled by the admin;
- if global geolocation is disabled, no user is blocked;
- if global geolocation is enabled and the user has geolocation enabled, the user must be within the configured office radius;
- if global geolocation is enabled but the user has geolocation disabled, the user can clock in/out without GPS validation.

Demo environment note:

- the demo backend keeps geolocation validation disabled to allow public testing from anywhere.

---

## Email Notifications

Office Clocking supports email notifications for ferie/PIR requests.

Main points:

- admin can configure recipient email addresses;
- notifications are sent only for ferie/PIR;
- mutua is excluded;
- email sending is non-blocking;
- if SMTP is slow or fails, the leave request is still created;
- SMTP timeout is configurable through environment variables.

---

## Technical Notes

### Timezone Handling

All day and range logic is based on:

```txt
Europe/Rome
```

MongoDB stores timestamps in UTC.

Application-level filters for single days and date ranges use local `Europe/Rome` day boundaries converted to UTC.

This avoids issues around midnight and keeps reports consistent between frontend, backend, and CSV exports.

### Stable Date/Time Tests

To avoid fragile time-based tests, the project uses:

- fixed dates in sensitive test cases;
- controlled mocking of date helpers where needed;
- timezone-aware helper functions.

Examples of helper concepts used:

```txt
getDayRangeInAppTz
getRangeFromToInAppTz
formatDateInAppTz
```

### Legacy / Defensive Record Handling

Admin-side logic includes defensive helpers for legacy or inconsistent records:

```txt
effectiveStatus
effectiveDurationSec
effectiveDurationHHMMSS
```

This protects the system from:

- legacy records;
- inconsistent data;
- missing durations;
- mismatches between `status`, `clockOut`, and `manualClosureRequest`.

---

## Project Status

Office Clocking Demo is currently:

- working;
- deployed online;
- live tested;
- demo-ready;
- portfolio-ready;
- installable as a PWA;
- visually distinguishable from the production PWA;
- able to detect and prompt for PWA updates;
- equipped with daily and hourly PIR support;
- backed by automated backend tests;
- validated with frontend lint and production build.

Recent public demo improvements include:

1. hourly PIR support;
2. quick-access demo login profiles;
3. loading feedback while the Render backend wakes up;
4. dedicated orange demo PWA branding;
5. PWA update checks and an in-app **Aggiorna** button.

---

## Suggested Next Steps

Possible next improvements:

- update screenshots in the README;
- add screenshots of the demo login and hourly PIR workflow;
- add a short demo video;
- improve public documentation for portfolio use;
- keep backend tests green;
- keep frontend lint/build green;
- keep PWA update behavior tested after deployments;
- maintain `.env.example` files updated.

---

## Final Summary

Office Clocking Demo is a structured, deployed, and portfolio-ready full-stack application.

It demonstrates real-world workflows such as:

- user authentication;
- time tracking;
- full-day and partial-day absence management;
- hourly PIR requests;
- admin approval flows;
- reporting;
- CSV export;
- environment-based configuration;
- automated backend testing;
- frontend validation and production build;
- Progressive Web App installation;
- service worker update handling;
- public-demo UX designed for immediate evaluation.

The project is suitable for:

- technical demo;
- portfolio presentation;
- GitHub showcase;
- LinkedIn profile;
- future development.
