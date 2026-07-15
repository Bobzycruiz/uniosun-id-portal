// config/db.js
//
// WHY A CONNECTION POOL (not a single connection):
// Every time your app needs to talk to MySQL, opening a brand new
// connection is slow. A "pool" opens a handful of connections up front
// and hands them out to whichever request needs one, then takes them
// back when done. mysql2/promise gives us a Promise-based API, so we
// can use async/await instead of callback functions everywhere.

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
