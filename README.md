# Office Clocking

**Office Clocking** is a full-stack time tracking web application designed to manage employee clock-ins, clock-outs, absences, manual closure requests, admin reports, and CSV exports.

The project was built as a real-world portfolio application using a modern React + Node.js stack.

It includes:

* user and admin roles;
* daily clock-in / clock-out workflow;
* absence management;
* manual closure workflow for anomalous records;
* admin dashboards and reports;
* CSV export;
* demo environment with ready-to-use test users.

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

| Username | Role  |
| -------- | ----- |
| admin    | Admin |
| mario    | User  |
| luca     | User  |
| giulia   | User  |
| anna     | User  |
| ale      | User  |

The demo environment uses safe demo data and is intended for portfolio presentation, testing, and project review.

---

## Main Features

### User Area

* Login
* Clock-in
* Clock-out
* Prevention of double clock-in
* Prevention of double clock-out
* Daily status summary
* Contextual user hints
* Personal time record history
* Open/anomalous record detection
* Manual closure request
* Absence request for:

  * ferie
  * PIR
  * mutua
* Compact leave request history
* Feedback messages after user actions
* CSV export

### Admin Area

* Login
* Quick dashboard summary
* Clickable summary cards
* User management
* Active/inactive user handling
* Per-user geolocation setting
* Single-user summary
* Global multi-user summary
* Daily records detail
* CSV export
* Manual closure requests list
* Approve manual closure requests
* Reject manual closure requests
* Absence request management
* Approve ferie/PIR requests
* Cancel already approved ferie/PIR requests with reason
* Approved ferie/PIR overview
* Configurable minimum advance days for ferie/PIR
* Configurable email recipients for ferie/PIR notifications

---

## Demo / Portfolio Improvements

The demo branch includes dedicated UX improvements for portfolio presentation:

* clearer demo login profiles;
* Admin profile shown first;
* role badges for Admin/User;
* “Consigliato per iniziare” badge on the Admin profile;
* compact guide in the Admin home;
* compact guide in the User home;
* improved `/funzionalita` landing page;
* responsive visual polish for demo usage.

The demo branch intentionally does not include production-only features such as the company car booking module.

---

## Tech Stack

### Frontend

* React
* React Router
* React Calendar
* Context API
* Vite
* ESLint

### Backend

* Node.js
* Express
* MongoDB Atlas / local MongoDB
* Mongoose
* JWT
* Jest
* Supertest
* Nodemailer

### Deploy

* Frontend: Netlify
* Backend: Render
* Database: MongoDB Atlas

### Application Timezone

```txt
Europe/Rome
```

MongoDB stores timestamps in UTC, while application-level day and range filters are handled using the `Europe/Rome` timezone.

---

## Branch Strategy

The repository currently uses three main branches:

| Branch    | Purpose               |
| --------- | --------------------- |
| `main`    | Production branch     |
| `develop` | Development branch    |
| `demo`    | Portfolio/demo branch |

Important notes:

* `main` is the production branch.
* `demo` is dedicated to the public portfolio demo.
* `main` includes the company car booking feature.
* `demo` intentionally does not include the company car booking feature.
* Demo-only features should be developed from `demo` and merged back into `demo`.
* Full merges between `main` and `demo` should be avoided unless carefully reviewed.
* When needed, use targeted cherry-picks or patches to preserve branch-specific differences.

Current validated demo branch:

```txt
demo
```

Latest validated demo commit:

```txt
6e1b321 - Merge pull request #120 from POrtalda/feature/demo-features-landing
```

---

## Security and Configuration

Completed hardening steps:

* Real `.env` files are not tracked by Git
* `.env.example` files are provided
* No real MongoDB Atlas URI is committed
* No real `JWT_SECRET` is hardcoded
* JWT authentication is used for protected routes
* MongoDB Atlas credentials have been rotated during project hardening
* Production and demo environments use environment variables
* SMTP configuration is managed through environment variables

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/POrtalda/office_clocking.git
cd office_clocking
```

### 2. Configure backend environment variables

Create `backend/.env` starting from `backend/.env.example`.

Example:

```env
MONGO_URI=mongodb://localhost:27017/office_clocking
JWT_SECRET=change_this_with_a_long_random_secret
PORT=5000
CLIENT_URL=http://localhost:5173
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

* create the Express app;
* configure global middlewares;
* configure CORS;
* apply rate limiting;
* mount routes;
* mount `notFound` and `errorHandler`;
* export the app for tests;
* does not start the server;
* does not connect to MongoDB.

### `backend/server.js`

Responsibilities:

* load environment variables;
* read `PORT`, `MONGO_URI`, `CLIENT_URL`;
* connect to MongoDB;
* start `app.listen(...)`.

This separation allows tests to import the Express app directly without starting a real server.

---

## Running Tests

### Backend tests

```bash
cd backend
npm test
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

Latest known validation on the demo branch:

```txt
Backend tests: OK
Frontend lint: OK
Frontend build: OK
```

---

## Test Coverage

The backend test suite covers the main business workflows.

### Base

* Smoke test
* Health test on `GET /`

### Auth

* `POST /api/auth/login`
* `GET /api/auth/me`

### User / Records

* `POST /api/records/clock-in`
* `POST /api/records/clock-out`
* `GET /api/records/my`
* `GET /api/records/my-open`
* `POST /api/records/request-manual-clock-out`

### Leaves / Absences

* `POST /api/leaves/:type`
* User absence creation rules
* Minimum advance days for ferie/PIR
* Prevention of overlapping active absences
* Prevention of clock-in / clock-out when an approved absence exists
* Support for:

  * `mutua`
  * `pir`
  * `ferie`

### Admin

* `GET /api/admin/users`
* `POST /api/admin/users`
* `PATCH /api/admin/users/:id/status`
* `PATCH /api/admin/users/:id/password`
* `PATCH /api/admin/users/:id/geolocation`
* `DELETE /api/admin/users/:id`
* `GET /api/admin/records`
* `GET /api/admin/summary`
* `GET /api/admin/summary-all`
* `GET /api/admin/export`
* `GET /api/admin/manual-closure-requests`
* `POST /api/admin/manual-closure-requests/:recordId/approve`
* `POST /api/admin/manual-closure-requests/:recordId/reject`
* `POST /api/admin/leave-requests/:leaveId/approve`
* `POST /api/admin/leave-requests/:leaveId/cancel`
* `GET /api/admin/settings`
* `PATCH /api/admin/settings`

---

## Core Business Rules

### Manual Closure

Manual closure is available for anomalous open records.

Main rules:

* the record must belong to the authenticated user;
* the record must be eligible for manual closure;
* the proposed clock-out must be after the clock-in;
* the proposed clock-out cannot be in the future;
* the maximum allowed duration is 12 hours;
* admin can approve or reject the request.

Constants used:

```txt
MAX_MANUAL_CLOSURE_HOURS
MAX_MANUAL_CLOSURE_SECONDS
```

---

## Absence Management

Office Clocking supports absence handling through a dedicated absence model.

Supported absence types:

* `mutua`
* `pir`
* `ferie`

Main rules:

* users can request absences;
* ferie/PIR can have configurable minimum advance days;
* mutua is excluded from the minimum advance days rule;
* users cannot create overlapping active absences;
* users cannot clock in if an approved absence exists for that day;
* users cannot clock out if an approved absence exists for that day;
* admins can approve ferie/PIR requests;
* admins can cancel already approved ferie/PIR requests with a mandatory reason;
* approved absences are included in admin summaries and reports;
* email notifications can be sent to configured admin recipients for ferie/PIR requests.

---

## Geolocation

Office Clocking supports geolocation validation for clock-in and clock-out.

Rules:

* geolocation can be globally enabled or disabled;
* each user can have geolocation enabled or disabled by the admin;
* if global geolocation is disabled, no user is blocked;
* if global geolocation is enabled and the user has geolocation enabled, the user must be within the configured office radius;
* if global geolocation is enabled but the user has geolocation disabled, the user can clock in/out without GPS validation.

Demo environment note:

* the demo backend keeps geolocation validation disabled to allow public testing from anywhere.

---

## Email Notifications

Office Clocking supports email notifications for ferie/PIR requests.

Main points:

* admin can configure recipient email addresses;
* notifications are sent only for ferie/PIR;
* mutua is excluded;
* email sending is non-blocking;
* if SMTP is slow or fails, the leave request is still created;
* SMTP timeout is configurable through environment variables.

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

* fixed dates in sensitive test cases;
* controlled mocking of date helpers where needed;
* timezone-aware helper functions.

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

* legacy records;
* inconsistent data;
* missing durations;
* mismatches between `status`, `clockOut`, and `manualClosureRequest`.

---

## Project Status

Office Clocking is currently:

* working;
* deployed online;
* live tested;
* demo-ready;
* portfolio-ready;
* hardened at a solid baseline level;
* backed by automated backend tests;
* validated with frontend lint and production build;
* structured around separate production, development, and demo branches.

---

## Suggested Next Steps

Possible next improvements:

* update screenshots in the README;
* add a short demo video;
* improve public documentation for portfolio use;
* keep backend tests green;
* keep frontend lint/build green;
* maintain `.env.example` files updated;
* continue development using branch-specific rules.

---

## Final Summary

Office Clocking is a structured, deployed, and demo-ready full-stack application.

It demonstrates real-world workflows such as:

* user authentication;
* time tracking;
* absence management;
* admin approval flows;
* reporting;
* CSV export;
* environment-based configuration;
* automated backend testing;
* frontend validation and production build.

The project is suitable for:

* technical demo;
* portfolio presentation;
* GitHub showcase;
* LinkedIn profile;
* future development.
