
import pg from 'pg';
const { Pool } = pg;
const connectionString = 'postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const pool = new Pool({ connectionString });

export default async function handler(request, response) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') return response.status(200).end();

    const client = await pool.connect();

    try {
        if (request.method === 'GET') {
            const result = await client.query('SELECT * FROM transactions ORDER BY date DESC');
            return response.status(200).json(result.rows);
        }

        else if (request.method === 'POST') {
            const { id, title, amount, category, date, walletId } = request.body;

            await client.query('BEGIN'); // Start transaction

            // 1. Insert Transaction
            const query = 'INSERT INTO transactions (id, title, amount, category, date, wallet_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *';
            const values = [id, title, amount, category, date, walletId];
            const result = await client.query(query, values);

            // 2. Update Wallet Balance
            if (walletId) {
                await client.query('UPDATE wallets SET balance = balance + $1 WHERE id = $2', [amount, walletId]);
            }

            await client.query('COMMIT');
            return response.status(200).json(result.rows[0]);
        }

        else if (request.method === 'DELETE') {
            const { id } = request.query;

            await client.query('BEGIN');

            // 1. Get transaction info before deleting to reverse balance
            const trx = await client.query('SELECT amount, wallet_id FROM transactions WHERE id = $1', [id]);

            if (trx.rows.length > 0) {
                const { amount, wallet_id } = trx.rows[0];
                // 2. Reverse balance update
                if (wallet_id) {
                    await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2', [amount, wallet_id]);
                }
            }

            // 3. Delete
            await client.query('DELETE FROM transactions WHERE id = $1', [id]);

            await client.query('COMMIT');
            return response.status(200).json({ success: true });
        }

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('DB Error:', error);
        return response.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
}
