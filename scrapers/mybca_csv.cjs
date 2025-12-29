const fs = require('fs');
const path = require('path');
const { launchBrowser } = require('./utils.cjs');

async function scrape(gateway) {
    const { username, password } = gateway.account_info;
    const downloadPath = path.resolve(__dirname, '../downloads');
    if (!fs.existsSync(downloadPath)) fs.mkdirSync(downloadPath);

    console.log(`[MyBCA] 🚀 Memulai Scrape untuk: ${username}`);

    let browser;
    try {
        browser = await launchBrowser(false); // Headless false for OTP
        const page = await browser.newPage();

        const client = await page.target().createCDPSession();
        await client.send('Page.setDownloadBehavior', {
            behavior: 'allow',
            downloadPath: downloadPath
        });

        await page.goto('https://mybca.bca.co.id/auth/login', { waitUntil: 'networkidle2' });

        await page.waitForSelector('input[placeholder*="BCA ID"]', { timeout: 30000 });
        await page.type('input[placeholder*="BCA ID"]', username);
        await page.type('input[type="password"]', password);

        console.log('[MyBCA] Login diklik. Hubungi HP buat OTP!');
        await page.click('button[type="submit"]');

        await page.waitForSelector('a[href*="history"]', { timeout: 120000 });
        await page.goto('https://mybca.bca.co.id/transaction/history');

        await new Promise(r => setTimeout(r, 5000));

        const exportBtn = await page.$('button[class*="export"], [aria-label*="Export"]');
        if (exportBtn) {
            await exportBtn.click();
            console.log('[MyBCA] Downloading CSV...');
        }

        const filename = await waitForFile(downloadPath, '.csv');
        const filePath = path.join(downloadPath, filename);
        const content = fs.readFileSync(filePath, 'utf-8');
        fs.unlinkSync(filePath);

        const records = parseCSV(content);
        return records.map(r => ({
            type: parseFloat(r.amount) < 0 ? 'KELUAR' : 'MASUK',
            merchant: r.description,
            platform: 'BCA',
            amount: Math.abs(parseFloat(r.amount)),
            raw_data: JSON.stringify(r),
            profile_id: gateway.profile_id
        }));

    } finally {
        if (browser) console.log('[MyBCA] Browser closed.');
    }
}

function parseCSV(content) {
    const lines = content.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const obj = {};
        headers.forEach((h, i) => {
            const val = values[i] || '';
            if (h === 'Amount' || h === 'Jumlah') obj.amount = val.replace(/[^0-9.-]+/g, "");
            if (h === 'Description' || h === 'Keterangan') obj.description = val;
            obj[h] = val;
        });
        return obj;
    });
}

async function waitForFile(dir, ext) {
    for (let i = 0; i < 30; i++) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith(ext));
        if (files.length > 0) return files[0];
        await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error('Download timeout');
}

module.exports = { scrape };
