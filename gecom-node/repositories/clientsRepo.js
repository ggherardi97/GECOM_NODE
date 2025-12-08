const pool = require('../db/pool');

function toDateOrNull(x) {
  if (!x) return null;
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function listClients({
  page = 1,
  pageSize = 20,
  search = '',
  startDate, // string: 'YYYY-MM-DD'
  endDate,   // string: 'YYYY-MM-DD'
} = {}) {
  const offset = (page - 1) * pageSize;
  const like = `%${search}%`;

  const where = [];
  const argsCount = [];
  const argsData = [];

  // Texto
  where.push('(? = "" OR name LIKE ?)');
  argsCount.push(search, like, like);
  argsData.push(search, like, like);

  // Datas (created_at entre startDate e endDate, ambos opcionais)
  const start = toDateOrNull(startDate);
  const end = toDateOrNull(endDate);

  if (start) {
    where.push('DATE(createdon) >= ?');
    const ymd = start.toISOString().slice(0, 10);
    argsCount.push(ymd);
    argsData.push(ymd);
  }
  if (end) {
    where.push('DATE(createdon) <= ?');
    const ymd = end.toISOString().slice(0, 10);
    argsCount.push(ymd);
    argsData.push(ymd);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countSql = `
    SELECT COUNT(*) AS total
    FROM account
    ${whereSql}
  `;
  const dataSql = `
    SELECT idaccount, name, createdon
    FROM account
    ORDER BY createdon DESC
  `;

  const [[countRow]] = await pool.query(countSql, argsCount);
  const [rows] = await pool.query(dataSql, [...argsData, pageSize, offset]);

  return { rows, total: countRow.total, page, pageSize };
}

async function getClientById(id) {
  const [rows] = await pool.query(
    `SELECT idaccount, name, createdon FROM account WHERE idaccount = ?`,
    [id]
  );
  return rows[0] ?? null;
}

module.exports = { listClients, getClientById };
