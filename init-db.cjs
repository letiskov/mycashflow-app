const { Client } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const client = new Client({
    connectionString: connectionString,
});

async function init() {
    try {
        await client.connect();
        console.log('Connected to Neon!');

        const createTableQuery = `
      CREATE TABLE IF NOT EXISTS transactions (
        id BIGINT PRIMARY KEY,
        title TEXT NOT NULL,
        amount NUMERIC NOT NULL,
        category TEXT NOT NULL,
        date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

        await client.query(createTableQuery);
        console.log('Table "transactions" created successfully!');

    } catch (err) {
        console.error('Error initializing DB:', err);
    } finally {
        await client.end();
    }
}

init();
