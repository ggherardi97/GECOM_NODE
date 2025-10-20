// db.js
require('dotenv').config({ override: true });
const mysql = require('mysql2/promise');

console.log('[DB] Using host:', '127.0.0.1'); // debug
console.log('[DB] Using user:', process.env.DB_USER);
console.log('[DB] Using db:', process.env.DB_NAME);

const pool = mysql.createPool({
  host: '127.0.0.1', // force aqui
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONN_LIMIT || 10),
  queueLimit: 0,
});

module.exports = pool;
