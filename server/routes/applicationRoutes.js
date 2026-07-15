// routes/applicationRoutes.js
//
// WHY ROUTES ARE SEPARATE FROM app.js:
// app.js sets up the whole server (middleware, static files, starting
// the port). If every URL handler lived in that same file, it would
// grow into one giant unreadable file as features are added. Instead,
// this file focuses on ONE thing: "here is every URL this app
// understands, and which function handles each one." app.js just does
// app.use('/api/applications', require('./routes/applicationRoutes'))
// and everything below becomes available under that path.
//
// HOW A REQUEST FLOWS THROUGH HERE:
// request -> multer (reads files off the multipart body)
//         -> express-validator rules (checks the text fields)
//         -> handleValidationErrors (stops here if anything failed)
//         -> controller function (the actual logic)

const express = require('express');
const router = express.Router();

const { uploadApplicationFiles } = require('../middleware/upload');
const { applicationValidationRules, handleValidationErrors } = require('../middleware/validators');
const controller = require('../controllers/applicationController');

// Create a new application. Order matters: multer must run first so
// req.body is populated (multer parses the multipart form), THEN
// validators can check req.body's fields.
router.post(
  '/',
  uploadApplicationFiles,
  applicationValidationRules,
  handleValidationErrors,
  controller.submitApplication
);

// List + search + pagination all share one handler — the difference
// is just which query parameters (?surname=, ?staffNumber=, ?page=)
// are present on the request.
router.get('/', controller.listApplications);
router.get('/search', controller.listApplications);

// Single application detail (admin view + printable receipt use this).
router.get('/:id', controller.getApplication);

// Admin updates an application's status.
router.patch('/:id/status', controller.setStatus);

module.exports = router;
