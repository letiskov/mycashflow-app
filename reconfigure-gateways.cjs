const { Pool } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const pool = new Pool({ connectionString });

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('--- Reconfiguring Gateways ---');

        // 1. Clear existing gateways
        await client.query("DELETE FROM gateways");

        // 2. Insert new targets
        const gateways = [
            { name: 'BCA QRIS', platform: 'BCA', account: { account_name: 'BCA MERCHANT', account_number: '1234567890' } },
            { name: 'BNI Mobile', platform: 'BNI', account: { account_name: 'BNI BUSINESS', account_number: '2345678901' } },
            { name: 'BRI Link', platform: 'BRI', account: { account_name: 'BRI AGENT', account_number: '3456789012' } },
            { name: 'MANDIRI Online', platform: 'MANDIRI', account: { account_name: 'MANDIRI CORP', account_number: '4567890123' } },
            { name: 'DANA Wallet', platform: 'DANA', account: { phone: '08123456789' } }
        ];

        for (const g of gateways) {
            await client.query(
                "INSERT INTO gateways (name, platform, account_info, status, profile_id) VALUES ($1, $2, $3, 'active', 1)",
                [g.name, g.platform, JSON.stringify(g.account)]
            );
            console.log(`Added: ${g.name}`);
        }

        console.log('--- DONE ---');
    } catch (err) {
        console.error(err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
