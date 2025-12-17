const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const client = new Client({ connectionString });

async function migrate() {
    try {
        await client.connect();
        console.log('Connected to Neon!');

        // 1. Wallets Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        id BIGINT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL, -- 'bank', 'ewallet', 'cash'
        balance NUMERIC DEFAULT 0,
        number TEXT,
        color TEXT
      );
    `);

        // Seed Wallets if empty
        const checkWallets = await client.query('SELECT count(*) FROM wallets');
        if (parseInt(checkWallets.rows[0].count) === 0) {
            console.log('Seeding Wallets...');
            await client.query(`
            INSERT INTO wallets (id, name, type, balance, number, color) VALUES
            (1, 'BCA', 'bank', 15000000, '**** 8899', '#10439F'),
            (2, 'Gopay', 'ewallet', 250000, '0812 ****', '#00ADD6'),
            (3, 'Cash', 'cash', 500000, '', '#34C759')
        `);
        }

        // 2. Categories Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        type TEXT NOT NULL -- 'income' or 'expense'
      );
    `);

        // Seed Categories
        const checkCats = await client.query('SELECT count(*) FROM categories');
        if (parseInt(checkCats.rows[0].count) === 0) {
            console.log('Seeding Categories...');
            await client.query(`
            INSERT INTO categories (name, icon, type) VALUES
            ('Food', 'ri-restaurant-line', 'expense'),
            ('Transport', 'ri-taxi-line', 'expense'),
            ('Shopping', 'ri-shopping-bag-3-line', 'expense'),
            ('Entertainment', 'ri-movie-line', 'expense'),
            ('Health', 'ri-heart-pulse-line', 'expense'),
            ('Education', 'ri-book-open-line', 'expense'),
            ('Bills', 'ri-bill-line', 'expense'),
            ('Salary', 'ri-briefcase-line', 'income'),
            ('Investment', 'ri-stock-line', 'income'),
            ('Bonus', 'ri-gift-line', 'income')
        `);
        }

        console.log('Migration Complete');
    } catch (err) {
        console.error('Migration Failed:', err);
    } finally {
        await client.end();
    }
}

migrate();
