const { Client } = require('pg');
const connectionString = 'postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const client = new Client({ connectionString });

async function seed() {
    try {
        await client.connect();

        // Seed wallets for profile 2 (Business)
        const check = await client.query('SELECT count(*) FROM wallets WHERE profile_id = 2');
        if (parseInt(check.rows[0].count) === 0) {
            await client.query("INSERT INTO wallets (name, balance, color, currency, profile_id) VALUES ('Company Fund', 50000000, 'linear-gradient(135deg, #AF52DE, #5856D6)', 'IDR', 2), ('Business Travel', 500, 'linear-gradient(135deg, #5AC8FA, #007AFF)', 'USD', 2)");
            console.log('Business wallets seeded!');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
seed();
