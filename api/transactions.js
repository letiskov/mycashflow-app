
import pg from 'pg';

const { Pool } = pg;

// Hardcoded for immediate usage as requested. 
// In ideal production, use process.env.DATABASE_URL
const connectionString = 'postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
    connectionString: connectionString,
});

export default async function handler(request, response) {
    // CORS configuration to allow access from any device
    response.setHeader('Access-Control-Allow-Credentials', true);
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    response.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (request.method === 'OPTIONS') {
        response.status(200).end();
        return;
    }

    try {
        if (request.method === 'GET') {
            const result = await pool.query('SELECT * FROM transactions ORDER BY date DESC');
            return response.status(200).json(result.rows);
        }

        else if (request.method === 'POST') {
            const { id, title, amount, category, date } = request.body;
            const query = 'INSERT INTO transactions (id, title, amount, category, date) VALUES ($1, $2, $3, $4, $5) RETURNING *';
            const values = [id, title, amount, category, date];
            const result = await pool.query(query, values);
            return response.status(200).json(result.rows[0]);
        }

        else if (request.method === 'DELETE') {
            const { id } = request.query;
            await pool.query('DELETE FROM transactions WHERE id = $1', [id]);
            return response.status(200).json({ success: true });
        }

    } catch (error) {
        console.error('DB Error:', error);
        return response.status(500).json({ error: 'Database error' });
    }
}
