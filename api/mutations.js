
import pg from 'pg';
const { Pool } = pg;
const connectionString = process.env.DATABASE_URL || "postgresql://neondb_owner:npg_Xf9lsAxp6LEG@ep-quiet-bonus-a1817lwt-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const pool = new Pool({ connectionString });

export default async function handler(request, response) {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-profile-id');

    if (request.method === 'OPTIONS') return response.status(200).end();

    const profileId = request.headers['x-profile-id'] || 1;
    const client = await pool.connect();

    try {
        if (request.method === 'GET') {
            const { type } = request.query;

            if (type === 'stats') {
                // Get totals
                const totals = await client.query(`
                    SELECT 
                        COALESCE(SUM(CASE WHEN type = 'MASUK' THEN amount ELSE 0 END), 0) as pemasukan,
                        COALESCE(SUM(CASE WHEN type = 'KELUAR' THEN amount ELSE 0 END), 0) as pengeluaran
                    FROM mutations 
                    WHERE profile_id = $1 AND date >= CURRENT_DATE
                `, [profileId]);

                const platforms = await client.query(`
                    SELECT platform, SUM(amount) as total, COUNT(*) as count 
                    FROM mutations 
                    WHERE profile_id = $1 AND date >= CURRENT_DATE AND type = 'MASUK'
                    GROUP BY platform
                `, [profileId]);

                const gateways = await client.query(`
                    SELECT * FROM gateways WHERE profile_id = $1 ORDER BY status DESC, last_seen DESC
                `, [profileId]);

                // 7-day history for chart
                const history = await client.query(`
                    SELECT 
                        TO_CHAR(date, 'Dy') as label,
                        SUM(CASE WHEN type = 'MASUK' THEN amount ELSE 0 END) as income,
                        SUM(CASE WHEN type = 'KELUAR' THEN amount ELSE 0 END) as cut
                    FROM mutations 
                    WHERE profile_id = $1 AND date >= CURRENT_DATE - INTERVAL '6 days'
                    GROUP BY TO_CHAR(date, 'Dy'), DATE_TRUNC('day', date)
                    ORDER BY DATE_TRUNC('day', date) ASC
                `, [profileId]);

                return response.status(200).json({
                    summary: totals.rows[0],
                    platforms: platforms.rows,
                    gateways: gateways.rows,
                    history: history.rows
                });
            } else {
                // Get mutation list
                const result = await client.query(`
                    SELECT * FROM mutations 
                    WHERE profile_id = $1 
                    ORDER BY date DESC 
                    LIMIT 50
                `, [profileId]);
                return response.status(200).json(result.rows);
            }
        }
    } catch (error) {
        console.error('Mutations API error:', error);
        return response.status(500).json({ error: error.message });
    } finally {
        client.release();
    }

}
