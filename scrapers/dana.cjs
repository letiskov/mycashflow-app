const { launchBrowser } = require('./utils.cjs');

async function scrape(gateway) {
    const { phone, pin } = gateway.account_info;
    console.log(`[DANA] Starting scrape for: ${phone}`);

    let browser;
    try {
        browser = await launchBrowser(false); // Headless false for OTP
        const page = await browser.newPage();

        await page.goto('https://dashboard.dana.id/login');
        await page.waitForSelector('input[name="mobileNumber"]');
        await page.type('input[name="mobileNumber"]', phone);
        await page.click('button[type="submit"]');

        await page.waitForSelector('input[type="password"]');
        await page.type('input[type="password"]', pin);

        console.log('[DANA] Verifikasi OTP di browser bang!');
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 120000 });

        await page.goto('https://dashboard.dana.id/transaction-history');
        await page.waitForSelector('.transaction-item');

        const transactions = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.transaction-item')).map(item => {
                const title = item.querySelector('.title')?.innerText.trim();
                const amountText = item.querySelector('.amount')?.innerText.trim();
                if (!title || !amountText) return null;
                return {
                    description: title,
                    amount: parseFloat(amountText.replace(/[^0-9.-]+/g, "")),
                    type: amountText.includes('+') ? 'MASUK' : 'KELUAR'
                };
            }).filter(x => x);
        });

        return transactions.map(trx => ({
            type: trx.type,
            merchant: trx.description,
            platform: 'DANA',
            amount: trx.amount,
            raw_data: JSON.stringify(trx),
            profile_id: gateway.profile_id
        }));

    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { scrape };
