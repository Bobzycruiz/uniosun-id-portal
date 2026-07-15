// middleware/validators.js
//
// WHY EXPRESS-VALIDATOR:
// Multer gets the files off the request, but it doesn't check whether
// "surname" was left blank or whether "telephoneNumber" actually looks
// like a phone number. express-validator lets us describe those rules
// declaratively (one line per field) instead of writing a long chain
// of if-statements by hand, and it collects every failure into one
// clean list instead of stopping at the first problem.

const { body, validationResult } = require('express-validator');

const applicationValidationRules = [
  body('title')
    .isIn(['Mr', 'Mrs', 'Dr', 'Prof']).withMessage('Please select a valid title.'),
  body('surname')
    .trim().notEmpty().withMessage('Surname is required.'),
  body('firstName')
    .trim().notEmpty().withMessage('First name is required.'),
  body('applicationType')
    .isIn(['New', 'Renewal', 'Replacement']).withMessage('Please select a valid application type.'),
  body('dateOfBirth')
    .isISO8601().withMessage('Please provide a valid date of birth.'),
  body('telephoneNumber')
    .trim()
    .matches(/^[0-9+\-\s]{7,20}$/).withMessage('Please provide a valid phone number.'),
  body('email')
    .optional({ checkFalsy: true })
    .isEmail().withMessage('Please provide a valid email address.'),
  body('genotype')
    .isIn(['AA', 'AS', 'SS', 'AC', 'SC']).withMessage('Please select a valid genotype.'),
  body('bloodGroup')
    .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).withMessage('Please select a valid blood group.'),
  body('staffNumber')
    .trim().notEmpty().withMessage('Staff number is required.'),
  body('designation')
    .trim().notEmpty().withMessage('Designation is required.'),
  body('department')
    .trim().notEmpty().withMessage('Department is required.'),
  body('nokFullName')
    .trim().notEmpty().withMessage("Next of kin's full name is required."),
  body('nokAddress')
    .trim().notEmpty().withMessage("Next of kin's address is required."),
  body('nokTelephone')
    .trim()
    .matches(/^[0-9+\-\s]{7,20}$/).withMessage("Please provide a valid next of kin phone number.")
];

// Runs after applicationValidationRules; if any rule failed, this stops
// the request here with a 422 and a list of readable messages instead
// of letting a bad request reach the database.
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Please correct the highlighted fields.',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
    });
  }
  next();
}

module.exports = { applicationValidationRules, handleValidationErrors };
