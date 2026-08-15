require('dotenv').config({path: '.env.local'});
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
async function run() {
  const users = await sql`SELECT * FROM "user"`;
  console.log('USERS:', users);
  const accounts = await sql`SELECT * FROM account`;
  console.log('ACCOUNTS:', accounts);
}
run().catch(console.error);
