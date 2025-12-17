const { Client } = require('pg');
const connectionString = 'postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const client = new Client({ connectionString });

async function upgrade() {
    try {
        await client.connect();
        console.log('Fixing ABA Bank with Type...');

        // 1. Add currency column if not exists
        await client.query(`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'IDR'`);

        // 2. Insert ABA Bank (USD) with correct type
        const checkABA = await client.query("SELECT * FROM wallets WHERE name = 'ABA Bank'");
        if (checkABA.rows.length === 0) {
            await client.query(`
            INSERT INTO wallets (id, name, balance, number, color, currency, type) 
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [101, 'ABA Bank', 1000, '**** 1234', 'linear-gradient(135deg, #005F83, #003B5C)', 'USD', 'bank']);
            console.log('ABA Bank added correctly!');
        }

        console.log('Upgrade Successful!');
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
upgrade();
