-- ============================================================
-- UNIOSUN IMTC — Staff ID Card Application Portal
-- Database schema
-- ============================================================
--
-- WHY TWO TABLES INSTEAD OF ONE:
-- An application has one set of personal/appointment details, and one
-- next of kin record. Technically this is a 1-to-1 relationship right
-- now, so it *could* all live in a single wide table. We split it
-- anyway for two practical reasons:
--   1. It mirrors the real paper form, which has "Personal/Appointment
--      Information" and "Next of Kin Information" as distinct sections
--      — the database structure should read the same way the form does.
--   2. It leaves room to grow: if the school later wants to record
--      more than one next of kin per staff member, you only add rows
--      to next_of_kin, you don't restructure the applications table.
--
-- The link between them is a foreign key: next_of_kin.application_id
-- points back to applications.id. ON DELETE CASCADE means if an
-- application is ever deleted, its next-of-kin row goes with it —
-- you never end up with an orphaned next-of-kin record pointing at
-- nothing.
-- ============================================================

CREATE DATABASE IF NOT EXISTS uniosun_id_portal;
USE uniosun_id_portal;

-- ------------------------------------------------------------
-- Table: applications
-- Holds personal information + appointment information + file
-- paths + status. This is the "main" record for a staff ID
-- application.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Human-readable reference number shown to the applicant,
  -- e.g. "UNIOSUN/2026/00001". Generated AFTER insert, once we
  -- know the auto-increment id, so it's always unique and sequential.
  application_id VARCHAR(30) NOT NULL UNIQUE,

  -- Personal information
  title ENUM('Mr', 'Mrs', 'Dr', 'Prof') NOT NULL,
  surname VARCHAR(60) NOT NULL,
  first_name VARCHAR(60) NOT NULL,
  middle_name VARCHAR(60) NULL,
  application_type ENUM('New', 'Renewal', 'Replacement') NOT NULL,
  date_of_birth DATE NOT NULL,
  telephone_number VARCHAR(20) NOT NULL,
  email VARCHAR(120) NULL,
  genotype ENUM('AA', 'AS', 'SS', 'AC', 'SC') NOT NULL,
  blood_group ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NOT NULL,

  -- Appointment information
  staff_number VARCHAR(30) NOT NULL UNIQUE,
  designation VARCHAR(100) NOT NULL,
  department VARCHAR(100) NOT NULL,

  -- Uploaded files. We store the relative PATH, not the file itself —
  -- the actual image bytes live on disk under /uploads. This keeps
  -- the database small and fast; the filesystem is much better suited
  -- to serving image files than a database column is.
  passport_path VARCHAR(255) NOT NULL,
  signature_path VARCHAR(255) NOT NULL,

  -- Workflow status, so admin staff can process applications instead
  -- of just archiving them.
  status ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',

  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- Table: next_of_kin
-- One row per application, linked by application_id (the FK,
-- an INT pointing at applications.id — not the same thing as
-- the human-readable applications.application_id string above).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS next_of_kin (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  address VARCHAR(255) NOT NULL,
  telephone_number VARCHAR(20) NOT NULL,

  FOREIGN KEY (application_id) REFERENCES applications(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- Helpful indexes for the admin search feature (surname, staff number).
-- MySQL already indexes UNIQUE columns automatically, so staff_number
-- and application_id are covered. We add one for surname since that's
-- searched but not unique.
CREATE INDEX idx_applications_surname ON applications(surname);
