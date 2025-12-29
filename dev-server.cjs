
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

// Proxy-like helper for serverless functions
const runHandler = async (modulePath, req, res) => {
    try {
        const fullPath = path.join(__dirname, modulePath);
        // Clear cache so edits reflect immediately
        delete require.cache[require.resolve(fullPath)];
        const { default: handler } = await import(`file://${fullPath}`);

        // Mocking Vercel's response object
        const vercelRes = {
            status: (code) => ({
                json: (data) => res.status(code).json(data),
                end: () => res.status(code).end()
            }),
            setHeader: (name, val) => res.setHeader(name, val),
            json: (data) => res.json(data)
        };

        await handler(req, vercelRes);
    } catch (e) {
        console.error(`[SERVER] Error in ${modulePath}:`, e);
        res.status(500).json({ error: e.message });
    }
};

// Map local endpoints to serverless API functions
app.all('/api/mutations', (req, res) => runHandler('api/mutations.js', req, res));
app.all('/api/credentials', (req, res) => runHandler('api/credentials.js', req, res));
app.all('/api/control', (req, res) => runHandler('api/control.js', req, res));
app.all('/api/scrape', (req, res) => runHandler('api/scrape.js', req, res));

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\x1b[32m[SERVER] API Emulator jalan di http://localhost:${PORT}\x1b[00m`);
    console.log(`[SERVER] Semua request di-oper ke folder /api (Serverless Ready)`);
});
