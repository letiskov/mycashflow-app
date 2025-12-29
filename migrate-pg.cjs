
const pg = require('pg');
const { Pool } = pg;
const connectionString = 'postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const pool = new Pool({ connectionString });

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Starting migration...');

        // 1. Create mutations table
        await client.query(`
            CREATE TABLE IF NOT EXISTS mutations (
                id SERIAL PRIMARY KEY,
                type VARCHAR(10) NOT NULL, -- MASUK / KELUAR
                merchant TEXT,
                platform VARCHAR(50), -- DANA, BCA, NEO, etc.
                amount NUMERIC(15, 2) NOT NULL,
                date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                raw_data JSONB,
                profile_id INTEGER DEFAULT 1
            );
        `);
        console.log('Table "mutations" created/exists.');

        // 2. Create gateways table
        await client.query(`
            CREATE TABLE IF NOT EXISTS gateways (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) NOT NULL,
                platform VARCHAR(50),
                status VARCHAR(20) DEFAULT 'inactive', -- active / inactive
                last_seen TIMESTAMP WITH TIME ZONE,
                account_info JSONB,
                profile_id INTEGER DEFAULT 1
            );
        `);
        console.log('Table "gateways" created/exists.');

        // 3. Seed initial gateways if empty
        const gatewayCheck = await client.query('SELECT COUNT(*) FROM gateways');
        if (parseInt(gatewayCheck.rows[0].count) === 0) {
            await client.query(`
                INSERT INTO gateways (name, platform, status, last_seen, account_info)
                VALUES 
                ('BCA QRIS', 'BCA', 'active', NOW(), '{"account_name": "Antigravity Store", "account_number": "123***"}'),
                ('DANA Business', 'DANA', 'active', NOW(), '{"account_name": "Antigravity Business", "phone": "0812***"}'),
                ('Bank Neo Commerce', 'NEO', 'inactive', NOW(), '{"account_name": "Neo Holder"}')
            `);
            console.log('Seeded initial gateways.');
        }

        console.log('Migration completed successfully!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
