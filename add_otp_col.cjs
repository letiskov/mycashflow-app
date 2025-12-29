const { Pool } = require('pg');
const connectionString = "postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const pool = new Pool({ connectionString });

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query("ALTER TABLE gateways ADD COLUMN IF NOT EXISTS pending_otp TEXT;");
        console.log('Migration Success: pending_otp column added.');
    } catch (e) {
        console.error('Migration Failed:', e);
    } finally {
        client.release();
        await pool.end();
    }
}
migrate();
