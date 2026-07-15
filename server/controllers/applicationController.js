// controllers/applicationController.js
//
// WHY A SEPARATE CONTROLLER (not just code in the route file):
// The route file's job is just "when this URL + method is hit, call
// this function." The controller's job is the actual logic: check for
// duplicates, upload files, talk to the database, decide what to send
// back. Splitting them means routes.js stays a short, readable map of
// "URL -> handler", while all the real work lives here where it's
// easier to test and reason about on its own.

const applicationModel = require('../models/applicationModel');
const { sanitizeForFilename } = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');

// Uploads a Buffer (held in memory by multer) to Cloudinary and returns
// the permanent HTTPS URL. Cloudinary's upload_stream API takes a
// callback-style function, so we wrap it in a Promise to use it with
// async/await like the rest of this file.
function uploadBufferToCloudinary(buffer, publicId, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder,
        overwrite: true,
        resource_type: 'image'
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

// POST /api/applications
async function submitApplication(req, res) {
  try {
    const files = req.files;

    // express-validator already checked the text fields (see
    // middleware/validators.js and routes.js), so by the time we get
    // here we only need to confirm the files actually arrived — multer
    // already rejected anything over 500KB or the wrong file type
    // before this function ever runs.
    if (!files || !files.passport || !files.signature) {
      return res.status(400).json({
        success: false,
        message: 'Both a passport photograph and a signature are required.'
      });
    }

    // Duplicate staff number check happens here, not just at the
    // database level, so we can return a clear message instead of a
    // raw SQL error if someone re-submits with the same staff number.
    // Because uploads now live in memory only (not on disk) until this
    // check passes, a rejected duplicate never touches Cloudinary or
    // overwrites a real applicant's files — nothing to clean up either.
    const alreadyExists = await applicationModel.staffNumberExists(req.body.staffNumber);
    if (alreadyExists) {
      return res.status(409).json({
        success: false,
        message: `Staff number "${req.body.staffNumber}" already has an application on file.`
      });
    }

    const safeStaffNumber = sanitizeForFilename(req.body.staffNumber);

    // Upload both images to Cloudinary now that we know the submission
    // is valid. Each gets a predictable name based on the staff number,
    // e.g. "uniosun-id-portal/passport/UNIOSUN-STAFF-0123-passport".
    const [passportPath, signaturePath] = await Promise.all([
      uploadBufferToCloudinary(
        files.passport[0].buffer,
        `${safeStaffNumber}-passport`,
        'uniosun-id-portal/passport'
      ),
      uploadBufferToCloudinary(
        files.signature[0].buffer,
        `${safeStaffNumber}-signature`,
        'uniosun-id-portal/signature'
      )
    ]);

    const { id, applicationId } = await applicationModel.createApplication(
      req.body,
      { passportPath, signaturePath }
    );

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully.',
      applicationId,
      id
    });
  } catch (err) {
    console.error('Error submitting application:', err);
    res.status(500).json({ success: false, message: 'Server error while saving the application.' });
  }
}

// GET /api/applications  (also used for /api/applications/search — same
// handler, since both just filter the same list by query parameters)
async function listApplications(req, res) {
  try {
    const { surname, staffNumber, page, limit } = req.query;
    const result = await applicationModel.findApplications({
      surname,
      staffNumber,
      page: page || 1,
      limit: limit || 10
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error listing applications:', err);
    res.status(500).json({ success: false, message: 'Server error while fetching applications.' });
  }
}

// GET /api/applications/:id
async function getApplication(req, res) {
  try {
    const record = await applicationModel.findApplicationById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    res.json({ success: true, data: record });
  } catch (err) {
    console.error('Error fetching application:', err);
    res.status(500).json({ success: false, message: 'Server error while fetching the application.' });
  }
}

// PATCH /api/applications/:id/status
async function setStatus(req, res) {
  try {
    const { status } = req.body;
    if (!['Pending', 'Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be Pending, Approved, or Rejected.' });
    }
    const updated = await applicationModel.updateStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }
    res.json({ success: true, message: `Status updated to ${status}.` });
  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({ success: false, message: 'Server error while updating status.' });
  }
}

module.exports = { submitApplication, listApplications, getApplication, setStatus };
