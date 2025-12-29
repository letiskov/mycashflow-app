
import { Pool } from 'pg';
import { encrypt } from './security.js';

const connectionString = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const pool = new Pool({ connectionString });

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'POST') {
        const client = await pool.connect();
        try {
            const { platform, username, password, type } = req.body;
            const profileId = 1;

            // ENCRYPT SENSITIVE DATA
            const encryptedPassword = encrypt(password);
            const accountInfo = JSON.stringify({
                username: username, // Username usually less sensitive but can be encrypted too if needed
                password: encryptedPassword,
                type
            });
            const displayName = `${type === 'mybca' ? 'MyBCA' : 'BCA'} - ${username}`;

            await client.query(
                `UPDATE gateways 
                 SET account_info = $1, name = $2, status = 'active' 
                 WHERE platform = $3 AND profile_id = $4`,
                [accountInfo, displayName, platform, profileId]
            );

            return res.status(200).json({ success: true, name: displayName });
        } catch (error) {
            console.error('Credentials API error:', error);
            return res.status(500).json({
                success: false,
                error: 'Server Error: ' + error.message,
                tip: 'Pastikan ENCRYPTION_KEY di Vercel sudah benar (32 karakter).'
            });
        } finally {
            client.release();
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
