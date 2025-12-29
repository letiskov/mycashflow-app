import { Pool } from 'pg';
const connectionString = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const pool = new Pool({ connectionString });

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { platform, otp } = req.body;

    const client = await pool.connect();
    try {
        await client.query("UPDATE gateways SET pending_otp = $1 WHERE platform = $2", [otp, platform]);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        client.release();
    }
}
