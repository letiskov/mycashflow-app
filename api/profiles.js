
import pg from 'pg';
const { Pool } = pg;
const connectionString = 'postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const pool = new Pool({ connectionString });

export default async function handler(request, response) {
    response.setHeader('Access-Control-Allow-Origin', '*');

    try {
        if (request.method === 'GET') {
            const result = await pool.query('SELECT * FROM profiles ORDER BY id ASC');
            return response.status(200).json(result.rows);
        }
    } catch (error) {
        return response.status(500).json({ error: error.message });
    }
}
