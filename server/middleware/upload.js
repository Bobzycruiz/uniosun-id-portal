// middleware/upload.js
//
// WHY MULTER:
// Express doesn't know how to read file uploads on its own — an HTML
// form with type="file" sends data as "multipart/form-data", which is
// a different format from the JSON or plain form data Express parses
// by default. Multer is the standard middleware that reads that
// multipart stream, pulls the files out, and attaches the text fields
// to req.body and the files to req.files, exactly like express.json()
// does for JSON bodies.
//
// WHY MEMORY STORAGE (not disk storage):
// Earlier versions of this project saved uploads straight to the local
// /uploads folder. That works fine on your own computer, but breaks
// the moment you deploy to Render/Railway/etc., because those
// platforms wipe local files on every restart. So instead, multer here
// just holds each file as a Buffer in memory (file.buffer) — nothing
// touches disk at all. The controller then uploads that buffer
// straight to Cloudinary (permanent cloud storage) and only the
// resulting URL gets saved to MySQL. See controllers/applicationController.js.

const multer = require('multer');

const MAX_FILE_SIZE = 500 * 1024; // 500KB, per the spec

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error(`${file.fieldname} must be a JPG or PNG image.`));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
});

// The form sends two files under two different field names, so we use
// .fields() rather than .single() — this tells multer to expect exactly
// one "passport" file and one "signature" file in the same request.
const uploadApplicationFiles = upload.fields([
  { name: 'passport', maxCount: 1 },
  { name: 'signature', maxCount: 1 }
]);

// Staff numbers can contain characters that aren't safe in a Cloudinary
// public_id or filename (e.g. "UNIOSUN/STAFF/0123" has slashes, which
// Cloudinary would read as folder separators). This strips anything
// that isn't a letter, number, or dash/underscore.
function sanitizeForFilename(value) {
  return String(value).trim().replace(/[^a-zA-Z0-9-_]/g, '-');
}

module.exports = { uploadApplicationFiles, MAX_FILE_SIZE, sanitizeForFilename };
