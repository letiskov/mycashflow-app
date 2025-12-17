const { Client } = require('pg');
const connectionString = 'postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const client = new Client({ connectionString });

async function migrate() {
    try {
        await client.connect();
        console.log('Finalizing Schema for Real App...');

        // Add wallet_id to transactions if missing
        await client.query(`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS wallet_id BIGINT;
    `);

        console.log('Schema Updated Successfully!');
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
migrate();
