// test-direct.js
const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'gecom',
      password: 'Gecom_2025',
      database: 'gecom_dev'
    });
    const [rows] = await conn.query('SELECT NOW() AS now');
    console.log('OK ->', rows[0].now);
    await conn.end();
  } catch (e) {
    console.error('FAIL ->', e);
  }
})();
