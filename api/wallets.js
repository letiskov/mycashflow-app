
import pg from 'pg';
const { Pool } = pg;
const connectionString = 'postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const pool = new Pool({ connectionString });

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        if (req.method === 'GET') {
            const result = await pool.query('SELECT * FROM wallets ORDER BY id ASC');
            return res.status(200).json(result.rows);
        }

        // Update Wallet Balance / Edit
        if (req.method === 'PUT') {
            const { id, name, balance } = req.body;
            await pool.query('UPDATE wallets SET balance = $1, name = $2 WHERE id = $3', [balance, name, id]);
            return res.status(200).json({ success: true });
        }

    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
