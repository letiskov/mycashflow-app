
import pg from 'pg';
const { Pool } = pg;
const connectionString = 'postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const pool = new Pool({ connectionString });

export default async function handler(request, response) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PUT');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-profile-id');

    if (request.method === 'OPTIONS') return response.status(200).end();

    const profileId = request.headers['x-profile-id'] || 1;

    try {
        if (request.method === 'GET') {
            const result = await pool.query('SELECT * FROM wallets WHERE profile_id = $1 ORDER BY id ASC', [profileId]);
            return response.status(200).json(result.rows);
        }

        if (request.method === 'PUT') {
            const { id, name, balance } = request.body;
            await pool.query('UPDATE wallets SET name = $1, balance = $2 WHERE id = $3 AND profile_id = $4', [name, balance, id, profileId]);
            return response.status(200).json({ success: true });
        }
    } catch (error) {
        return response.status(500).json({ error: error.message });
    }
}
