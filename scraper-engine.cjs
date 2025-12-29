const { Pool } = require('pg');
const path = require('path');

const pool = new Pool({
    connectionString: "postgres://neondb_owner:npg_u3XfORd6YyWp@ep-blue-cloud-a1zuz50e-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
});

async function runEngines() {
    console.log(`[SCRAPER] Session started at ${new Date().toLocaleString()}`);

    try {
        const client = await pool.connect();
        const gateways = await client.query("SELECT * FROM gateways WHERE status = 'active'");
        client.release();

        console.log(`[SCRAPER] Found ${gateways.rows.length} active gateways.`);

        for (const gateway of gateways.rows) {
            await processGateway(gateway);
        }
    } catch (err) {
        console.error('[SCRAPER] Database Error:', err.message);
    } finally {
        console.log('[SCRAPER] Session finished.');
        process.exit(0);
    }
}

async function processGateway(gateway) {
    const platform = gateway.platform.toUpperCase();
    console.log(`[SCRAPER] Processing: ${gateway.name} (${platform})`);

    try {
        const mutations = await scrapeData(gateway);
        if (mutations && mutations.length > 0) {
            await saveMutations(mutations);
            console.log(`[SCRAPER] Success: ${mutations.length} mutations saved for ${gateway.name}`);
        } else {
            console.log(`[SCRAPER] No new data for ${gateway.name}`);
        }
    } catch (err) {
        console.error(`[SCRAPER] Error in ${gateway.name}:`, err.message);
    }
}

async function scrapeData(gateway) {
    const platform = gateway.platform.toUpperCase();

    // Mapping platform to module files
    const modules = {
        'BCA': gateway.account_info?.type === 'mybca' ? 'mybca_csv.cjs' : 'bca.cjs',
        'DANA': 'dana.cjs'
    };

    const moduleFile = modules[platform];
    if (!moduleFile) {
        console.warn(`[ENGINE] No scraper implementation for ${platform}`);
        return [];
    }

    const modulePath = path.join(__dirname, 'scrapers', moduleFile);
    const scraper = require(modulePath);
    return await scraper.scrape(gateway);
}

async function saveMutations(mutations) {
    const client = await pool.connect();
    try {
        for (const m of mutations) {
            await client.query(
                `INSERT INTO mutations (type, merchant, platform, amount, raw_data, profile_id) 
                 VALUES ($1, $2, $3, $4, $5, $6) 
                 ON CONFLICT DO NOTHING`,
                [m.type, m.merchant, m.platform, m.amount, m.raw_data, m.profile_id]
            );
        }
        // Update gateway last sync
        if (mutations.length > 0) {
            await client.query("UPDATE gateways SET last_sync = NOW() WHERE profile_id = $1", [mutations[0].profile_id]);
        }
    } finally {
        client.release();
    }
}

runEngines();
