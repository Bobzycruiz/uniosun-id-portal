// models/applicationModel.js
//
// WHY A "MODEL" FILE:
// This file is the only place in the whole app that writes raw SQL.
// Controllers call functions like createApplication(data) or
// findBySurname(name) without knowing or caring what the SQL looks
// like underneath. That separation means if you ever need to change
// a query, or even swap MySQL for another database, you change it in
// one place instead of hunting through every route handler.

const pool = require('../config/db');

// Generates the human-readable reference number, e.g. "UNIOSUN/2026/00001".
// We call this AFTER the row is inserted, using the real auto-increment id,
// so numbers are always sequential and never collide.
function buildApplicationId(id) {
  const year = new Date().getFullYear();
  const padded = String(id).padStart(5, '0');
  return `UNIOSUN/${year}/${padded}`;
}

// Checks if a staff number is already in use — called before insert so
// we can return a friendly "duplicate staff number" error instead of a
// raw MySQL "unique constraint" error.
async function staffNumberExists(staffNumber) {
  const [rows] = await pool.query(
    'SELECT id FROM applications WHERE staff_number = ? LIMIT 1',
    [staffNumber]
  );
  return rows.length > 0;
}

// Creates one application + its next-of-kin row as a single transaction.
// WHY A TRANSACTION: an application without its next-of-kin record (or
// vice versa) is a broken, half-saved submission. Wrapping both inserts
// in a transaction means either both succeed, or — if anything fails —
// both are rolled back, so the database never ends up half-written.
async function createApplication(data, files) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO applications
        (application_id, title, surname, first_name, middle_name, application_type,
         date_of_birth, telephone_number, email, genotype, blood_group,
         staff_number, designation, department, passport_path, signature_path, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [
        'PENDING', // placeholder, updated just below once we have the real id
        data.title,
        data.surname,
        data.firstName,
        data.middleName || null,
        data.applicationType,
        data.dateOfBirth,
        data.telephoneNumber,
        data.email || null,
        data.genotype,
        data.bloodGroup,
        data.staffNumber,
        data.designation,
        data.department,
        files.passportPath,
        files.signaturePath
      ]
    );

    const insertedId = result.insertId;
    const applicationId = buildApplicationId(insertedId);

    await connection.query(
      'UPDATE applications SET application_id = ? WHERE id = ?',
      [applicationId, insertedId]
    );

    await connection.query(
      `INSERT INTO next_of_kin (application_id, full_name, address, telephone_number)
       VALUES (?, ?, ?, ?)`,
      [insertedId, data.nokFullName, data.nokAddress, data.nokTelephone]
    );

    await connection.commit();
    return { id: insertedId, applicationId };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Admin list view, with optional search filters and pagination.
async function findApplications({ surname, staffNumber, page = 1, limit = 10 }) {
  const conditions = [];
  const params = [];

  if (surname) {
    conditions.push('a.surname LIKE ?');
    params.push(`%${surname}%`);
  }
  if (staffNumber) {
    conditions.push('a.staff_number LIKE ?');
    params.push(`%${staffNumber}%`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT a.id, a.application_id, a.title, a.surname, a.first_name, a.middle_name,
            a.staff_number, a.designation, a.department, a.status, a.submitted_at
     FROM applications a
     ${whereClause}
     ORDER BY a.submitted_at DESC
     LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM applications a ${whereClause}`,
    params
  );

  return {
    data: rows,
    total: countRows[0].total,
    page: Number(page),
    limit: Number(limit),
    totalPages: Math.ceil(countRows[0].total / limit)
  };
}

// Single application, joined with its next-of-kin row — used for both
// the admin detail view and the printable receipt.
async function findApplicationById(id) {
  const [rows] = await pool.query(
    `SELECT a.*, n.full_name AS nok_full_name, n.address AS nok_address,
            n.telephone_number AS nok_telephone
     FROM applications a
     LEFT JOIN next_of_kin n ON n.application_id = a.id
     WHERE a.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function updateStatus(id, status) {
  const [result] = await pool.query(
    'UPDATE applications SET status = ? WHERE id = ?',
    [status, id]
  );
  return result.affectedRows > 0;
}

module.exports = {
  staffNumberExists,
  createApplication,
  findApplications,
  findApplicationById,
  updateStatus
};
