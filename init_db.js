/**
 * Simple optional initializer that requires mysql2 and .env configured.
 * Usage: node init_db.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
async function init(){
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    multipleStatements: true
  });
  const schema = require('fs').readFileSync(__dirname + '/db/schema.sql','utf8');
  await conn.query(schema);
  console.log('Schema applied.');
  // insert sample if empty
  const [rows] = await conn.query('SELECT COUNT(*) AS c FROM sklad.items');
  await conn.end();
  console.log('Done.');
}
init().catch(e=>{ console.error(e); process.exit(1); });
