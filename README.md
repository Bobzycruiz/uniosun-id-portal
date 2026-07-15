# UNIOSUN IMTC — Staff ID Card Application Portal

An online replacement for the paper-based staff ID card application form used by Osun State University's Information Management and Technology Centre (IMTC). Lecturers fill the form, upload a passport photo and signature (500KB max each), and everything is stored in MySQL. Admin staff can search, review, and approve/reject applications from a dashboard.

---

## Project structure

```
uniosun-id-portal/
├── client/                     # Everything the browser loads directly
│   ├── index.html              # The application form (multi-step wizard)
│   ├── receipt.html            # Printable receipt shown after submission
│   ├── admin.html              # Admin dashboard
│   ├── css/style.css
│   └── js/
│       ├── app.js              # Form wizard logic + submission
│       └── admin.js            # Dashboard: search, pagination, status updates
├── server/
│   ├── app.js                  # Express app entry point
│   ├── config/db.js            # MySQL connection pool
│   ├── controllers/
│   │   └── applicationController.js
│   ├── models/
│   │   └── applicationModel.js # All raw SQL lives here
│   ├── routes/
│   │   └── applicationRoutes.js
│   ├── middleware/
│   │   ├── upload.js           # Multer config (file size/type, UUID naming)
│   │   └── validators.js       # express-validator rules
│   └── database/
│       └── schema.sql          # CREATE TABLE statements
├── uploads/
│   ├── passport/                # Uploaded passport photos land here
│   └── signature/                # Uploaded signatures land here
├── .env.example
├── package.json
└── README.md
```

---

## How the pieces connect (read this before you touch the code)

**Express** is the framework running the web server. Every incoming request passes through a chain of "middleware" functions before reaching its final handler — that's what all the `app.use(...)` lines in `server/app.js` are doing: adding a step to that chain (parse JSON, serve static files, etc).

**Routes → Controllers → Models** is the three-layer pattern this project uses:
- **Routes** (`routes/applicationRoutes.js`) only map a URL + HTTP method to a function. Nothing else. E.g. "a POST to `/api/applications` goes to `controller.submitApplication`."
- **Controllers** (`controllers/applicationController.js`) hold the actual logic: check for duplicates, decide what status code to send back, call the model.
- **Models** (`models/applicationModel.js`) are the only files that contain SQL. Controllers never write raw SQL themselves — they just call a named function like `createApplication(data)`.

This separation means if you need to change how something is validated, you know to look in `middleware/validators.js`. If a query is wrong, you know it's in `models/`. Nothing is scattered.

**Why Multer:** an HTML form with `type="file"` sends data as `multipart/form-data`, not JSON. Express can't read that format on its own — Multer is the standard middleware that parses it, saves the files to disk, and hands you `req.files` and `req.body` just like `express.json()` does for JSON requests. See the comments in `middleware/upload.js` for exactly how it names files and enforces the 500KB limit.

**Why mysql2:** it's a MySQL driver for Node.js. We use its **promise** interface (`require('mysql2/promise')`) instead of the older callback-based one, so every database call can use `await` instead of nested callbacks. We also use a **connection pool** rather than one single connection — see the comment at the top of `config/db.js` for why.

**Why express-validator:** it lets us describe validation rules declaratively (one line per field, see `middleware/validators.js`) instead of a long chain of hand-written `if` statements, and it collects every error into one list instead of stopping at the first problem.

---

## Step-by-step setup

### Step 1 — Install Node.js
Download and install Node.js (LTS version) from https://nodejs.org if you don't already have it. Check it worked:
```bash
node -v
npm -v
```

### Step 2 — Install MySQL
Install MySQL Community Server if you don't have it: https://dev.mysql.com/downloads/mysql/
On Windows, MySQL Workbench (bundled with the installer) gives you a GUI for the next step if you'd rather not use the command line.

### Step 3 — Create the database and import the schema
Open a terminal (or MySQL Workbench) and run:
```bash
mysql -u root -p
```
Then, inside the MySQL prompt:
```sql
SOURCE /full/path/to/uniosun-id-portal/server/database/schema.sql;
```
This creates the `uniosun_id_portal` database and both tables (`applications`, `next_of_kin`). You can check it worked:
```sql
USE uniosun_id_portal;
SHOW TABLES;
```

### Step 4 — Configure environment variables
```bash
cp .env.example .env
```
Edit `.env` and fill in your real MySQL username/password:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_actual_mysql_password
DB_NAME=uniosun_id_portal
PORT=5000
```

### Step 5 — Install project dependencies
```bash
npm install
```
This reads `package.json` and installs express, mysql2, multer, express-validator, dotenv, and uuid into `node_modules/`.

### Step 6 — Run the server
```bash
npm start
```
You should see:
```
Connected to MySQL
Server running on http://localhost:5000
```
If instead you see a MySQL connection error, double-check `DB_USER` and `DB_PASSWORD` in `.env`, and make sure MySQL itself is running.

### Step 7 — Test the API with Postman (optional but recommended while learning)
Open Postman and try:
- `POST http://localhost:5000/api/applications` with `Body → form-data`, adding all the text fields (title, surname, firstName, etc.) plus two file fields named exactly `passport` and `signature`.
- `GET http://localhost:5000/api/applications` — should return the list you just created.
- `GET http://localhost:5000/api/applications/1` — a single record.
- `PATCH http://localhost:5000/api/applications/1/status` with JSON body `{"status": "Approved"}`.

This step matters because it proves the backend works **on its own**, independent of the frontend — if Postman gets a clean response, any issue afterward is in the frontend, not the API.

### Step 8 — Open the frontend
With the server still running, visit:
- `http://localhost:5000/index.html` — the application form
- `http://localhost:5000/admin.html` — the admin dashboard

Do **not** open `index.html` by double-clicking it in your file explorer — it must be loaded through the running server (`http://localhost:5000/...`) so its `fetch()` calls have a server to talk to.

### Step 9 — Try a full submission
Fill out all four steps of the form, upload a small JPG/PNG for both passport and signature (under 500KB each), and submit. You should land on a receipt page showing your generated Application ID (e.g. `UNIOSUN/2026/00001`).

### Step 10 — Check it in the admin dashboard
Go to `/admin.html`, search by the surname or staff number you just used, open the record, and try changing its status to Approved.

---

## Database design — why these tables exist

**`applications`** is the main record: personal information, appointment information, file paths, and status all live here because they belong to exactly one applicant and are read together almost every time (the admin list, the receipt, the detail view all need all of this at once).

**`next_of_kin`** is kept separate, linked by a foreign key (`next_of_kin.application_id → applications.id`), even though today it's a 1-to-1 relationship. Two reasons: it mirrors the paper form's own section structure, and it leaves room to grow — if the school ever wants to store more than one next of kin, you add rows to this table without restructuring `applications`. `ON DELETE CASCADE` means if an application is ever deleted, its next-of-kin row is automatically deleted too, so you can't end up with an orphaned record pointing at nothing.

Full column-by-column reasoning is commented directly in `server/database/schema.sql`.

---

## How the 500KB limit is enforced (two layers, on purpose)

1. **Frontend** (`client/js/app.js`) checks file size the instant a file is chosen and shows an inline message immediately — good user experience, but not trustworthy on its own since a user could bypass it.
2. **Backend** (`server/middleware/upload.js`) configures Multer with `limits: { fileSize: 500 * 1024 }` and only accepts `image/jpeg` and `image/png`. This is the layer that actually matters for security — it rejects oversized or wrong-type files even if someone calls the API directly, skipping the form entirely.

## How duplicate staff numbers are prevented (also two layers)

The `staff_number` column has a `UNIQUE` constraint in MySQL — the database itself will refuse a second row with the same value. But we also check for it explicitly in `applicationController.js` **before** attempting the insert, so we can return a clear message like `Staff number "X" already has an application on file` instead of a raw, unreadable MySQL constraint-violation error.

## Secure file naming

Uploaded files are renamed to a random UUID (e.g. `a1b2c3d4-....jpg`) instead of keeping the original filename — see `middleware/upload.js`. This prevents two different uploads from ever overwriting each other, and avoids exposing whatever the original filename was (which might contain someone's personal details) in a folder that's served publicly.

---

## Extending this later

- **Authentication for the admin dashboard** — right now `/admin.html` has no login, per the brief. If you want to add one, the simplest approach is a small login route that checks a password and sets a signed cookie/session, then a middleware that checks that cookie before allowing access to `/api/applications` routes.
- **Email notifications** — send an email when status changes to Approved/Rejected (would need a mail-sending library like `nodemailer` and real SMTP credentials).
- **Bulk export** — a `GET /api/applications/export` endpoint that streams all records as CSV for the registry.
