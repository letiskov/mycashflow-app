const { Client } = require('pg');
const connectionString = 'postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const client = new Client({ connectionString });

async function migrate() {
    try {
        await client.connect();
        console.log('Final Database Prep...');

        // Drop and Recreate Categories for completeness
        await client.query('DROP TABLE IF EXISTS categories');
        await client.query(`
      CREATE TABLE categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        type TEXT NOT NULL
      )
    `);

        await client.query(`
      INSERT INTO categories (name, icon, type) VALUES
      ('Food', 'ri-restaurant-line', 'expense'),
      ('Transport', 'ri-taxi-line', 'expense'),
      ('Shopping', 'ri-shopping-bag-3-line', 'expense'),
      ('Entertainment', 'ri-movie-line', 'expense'),
      ('Health', 'ri-heart-pulse-line', 'expense'),
      ('Bills', 'ri-bill-line', 'expense'),
      ('Salary', 'ri-briefcase-line', 'income'),
      ('Investment', 'ri-pulse-line', 'income'),
      ('Gift', 'ri-gift-line', 'income')
    `);

        // Ensure Wallets exist
        await client.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id BIGINT PRIMARY KEY,
        name TEXT NOT NULL,
        balance NUMERIC DEFAULT 0,
        number TEXT,
        color TEXT
      )
    `);

        const count = await client.query('SELECT count(*) FROM wallets');
        if (parseInt(count.rows[0].count) === 0) {
            await client.query(`
            INSERT INTO wallets (id, name, balance, number, color) VALUES
            (1, 'BCA Bank', 15200000, '**** 4432', 'linear-gradient(135deg, #10439F, #001F5C)'),
            (2, 'Gopay', 450000, '0812 **** 8888', 'linear-gradient(135deg, #00ADD6, #007A99)'),
            (3, 'Cash', 1500000, '', 'linear-gradient(135deg, #34C759, #248A3D)')
        `);
        }

        console.log('Final Migration Successful!');
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
migrate();
