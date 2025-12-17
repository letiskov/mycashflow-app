
import pg from 'pg';
const { Pool } = pg;
const connectionString = 'postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const pool = new Pool({ connectionString });

export default async function handler(request, response) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-profile-id');

    if (request.method === 'OPTIONS') return response.status(200).end();

    const profileId = request.headers['x-profile-id'] || 1;
    const client = await pool.connect();

    try {
        if (request.method === 'GET') {
            const result = await client.query('SELECT * FROM transactions WHERE profile_id = $1 ORDER BY date DESC', [profileId]);
            return response.status(200).json(result.rows);
        }

        else if (request.method === 'POST') {
            const { id, title, amount, category, date, walletId } = request.body;
            await client.query('BEGIN');

            const query = 'INSERT INTO transactions (id, title, amount, category, date, wallet_id, profile_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *';
            const result = await client.query(query, [id, title, amount, category, date, walletId, profileId]);

            if (walletId) {
                await client.query('UPDATE wallets SET balance = balance + $1 WHERE id = $2 AND profile_id = $3', [amount, walletId, profileId]);
            }

            await client.query('COMMIT');
            return response.status(200).json(result.rows[0]);
        }

        else if (request.method === 'DELETE') {
            const { id } = request.query;
            await client.query('BEGIN');
            const trx = await client.query('SELECT amount, wallet_id FROM transactions WHERE id = $1 AND profile_id = $2', [id, profileId]);

            if (trx.rows.length > 0) {
                const { amount, wallet_id } = trx.rows[0];
                if (wallet_id) {
                    await client.query('UPDATE wallets SET balance = balance - $1 WHERE id = $2 AND profile_id = $3', [amount, wallet_id, profileId]);
                }
            }

            await client.query('DELETE FROM transactions WHERE id = $1 AND profile_id = $2', [id, profileId]);
            await client.query('COMMIT');
            return response.status(200).json({ success: true });
        }
    } catch (error) {
        await client.query('ROLLBACK');
        return response.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
}
