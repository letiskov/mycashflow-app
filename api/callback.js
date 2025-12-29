
import pg from 'pg';
const { Pool } = pg;
const connectionString = 'postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const pool = new Pool({ connectionString });

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const client = await pool.connect();
    try {
        const { type, merchant, platform, amount, raw_data, profile_id = 1 } = request.body;

        if (!type || !amount || !platform) {
            return response.status(400).json({ error: 'Missing required fields: type, amount, platform' });
        }

        const query = `
            INSERT INTO mutations (type, merchant, platform, amount, raw_data, profile_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        const result = await client.query(query, [type, merchant, platform, amount, raw_data, profile_id]);

        // Update last_seen for the gateway
        await client.query(`
            UPDATE gateways 
            SET last_seen = NOW(), status = 'active'
            WHERE platform = $1 AND profile_id = $2
        `, [platform, profile_id]);

        return response.status(200).json({ success: true, mutation: result.rows[0] });
    } catch (error) {
        console.error('Callback error:', error);
        return response.status(500).json({ error: 'Internal Server Error' });
    } finally {
        client.release();
    }
}
