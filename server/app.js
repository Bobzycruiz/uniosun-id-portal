// server/app.js
//
// WHY EXPRESS:
// Node.js on its own can run a web server, but you'd have to manually
// parse URLs, match methods, read request bodies, and serve static
// files by hand. Express is a thin framework that gives us all of
// that as small, composable pieces (middleware) — app.use(...) adds
// a piece of behaviour that runs on every request before it reaches
// your route handlers.

require('dotenv').config();
const express = require('express');
const path = require('path');
const pool = require('./config/db');
const applicationRoutes = require('./routes/applicationRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Parses incoming JSON bodies (used by the status-update endpoint).
// Form submissions with files go through multer instead — see
// middleware/upload.js — since multipart/form-data isn't JSON.
app.use(express.json());

// Serves the frontend (client/) as plain static files, so the browser
// can load /index.html, /css/style.css, etc. directly by URL.
// Uploaded images are no longer served from here — they live on
// Cloudinary now (see config/cloudinary.js) and the database stores
// their full HTTPS URL directly, so no local /uploads route is needed.
app.use(express.static(path.join(__dirname, '..', 'client')));

app.use('/api/applications', applicationRoutes);

// Centralised error handler. Multer throws errors (file too large,
// wrong file type) that don't go through the normal req/res flow —
// Express routes them here instead, so we catch them in one place
// and always send back clean JSON rather than letting the default
// HTML error page leak through.
app.use((err, req, res, next) => {
  if (err && err.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File is too large. Passport and signature must each be 500KB or smaller.'
      : err.message;
    return res.status(400).json({ success: false, message });
  }
  if (err) {
    console.error('Unhandled error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Unexpected server error.' });
  }
  next();
});

// Confirms the database is reachable before accepting traffic — if the
// credentials in .env are wrong, this fails loudly at startup instead
// of only failing later on the first real request.
async function start() {
  try {
    const connection = await pool.getConnection();
    console.log('Connected to MySQL');
    connection.release();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Could not connect to MySQL:', err.message);
    console.error('Check DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME in your .env file.');
    process.exit(1);
  }
}

start();
