const { Client } = require('pg');
const connectionString = 'postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const client = new Client({ connectionString });

async function migrate() {
    try {
        await client.connect();
        console.log('Activating Profiles (Multi-User Support)...');

        // 1. Create Profiles table
        await client.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        avatar TEXT
      )
    `);

        // 2. Add profile_id to wallets and transactions
        await client.query(`ALTER TABLE wallets ADD COLUMN IF NOT EXISTS profile_id INT DEFAULT 1`);
        await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS profile_id INT DEFAULT 1`);

        // 3. Seed initial profiles
        const check = await client.query('SELECT count(*) FROM profiles');
        if (parseInt(check.rows[0].count) === 0) {
            await client.query(`
            INSERT INTO profiles (id, name, email, avatar) VALUES
            (1, 'Personal', 'personal@cashflow.com', 'https://ui-avatars.com/api/?name=P&background=0A84FF&color=fff'),
            (2, 'Business', 'business@corp.com', 'https://ui-avatars.com/api/?name=B&background=AF52DE&color=fff')
        `);
            console.log('Profiles seeded!');
        }

        console.log('Migration Successful!');
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
migrate();
