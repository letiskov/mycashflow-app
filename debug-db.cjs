const { Pool } = require('pg');
const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
});

async function check() {
    const client = await pool.connect();
    try {
        const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        console.log('Tables:', tables.rows.map(r => r.table_name));

        const gateways = await client.query("SELECT * FROM gateways");
        console.log('Gateways Count:', gateways.rows.length);
        console.log('Gateways Samples:', gateways.rows);

    } catch (err) {
        console.error('Check failed:', err.message);
    } finally {
        client.release();
        await pool.end();
    }
}

check();
