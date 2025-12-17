const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const client = new Client({
    connectionString: connectionString,
});

async function test() {
    try {
        await client.connect();
        console.log('Connected to Neon!');

        // Cek apakah tabel ada
        const res = await client.query('SELECT count(*) FROM transactions');
        console.log('Jumlah data saat ini:', res.rows[0].count);

        // Coba insert
        const insert = await client.query(`
        INSERT INTO transactions (id, title, amount, category, date) 
        VALUES ($1, $2, $3, $4, $5) RETURNING *
    `, [Date.now(), 'Test Connectivity', 500, 'Income', new Date()]);

        console.log('Berhasil insert data baru:', insert.rows[0]);

    } catch (err) {
        console.error('Error DB:', err);
    } finally {
        await client.end();
    }
}

test();
