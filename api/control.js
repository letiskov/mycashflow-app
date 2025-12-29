
import pg from 'pg';
const { Pool } = pg;
const connectionString = "postgres://neondb_owner:npg_u3XfORd6YyWp@ep-blue-cloud-a1zuz50e-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const pool = new Pool({ connectionString });

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'POST') {
        const client = await pool.connect();
        try {
            const { action, platform } = req.body;
            const status = action === 'stop' ? 'inactive' : 'active';

            if (platform) {
                await client.query("UPDATE gateways SET status = $1 WHERE platform = $2", [status, platform]);
            } else {
                await client.query("UPDATE gateways SET status = $1", [status]);
            }

            return res.status(200).json({ success: true, status });
        } catch (error) {
            console.error('Control API error:', error);
            return res.status(500).json({ error: error.message });
        } finally {
            client.release();
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
