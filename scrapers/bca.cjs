const { launchBrowser } = require('./utils.cjs');

async function scrape(gateway) {
    const { username, password } = gateway.account_info;
    console.log(`[BCA] Starting scrape for: ${username}`);

    let browser;
    try {
        browser = await launchBrowser(true); // Headless for KlikBCA
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1');

        await page.goto('https://m.klikbca.com/login.jsp');
        await page.type('#user_id', username);
        await page.type('#pswd', password);
        await page.click('button[type="submit"]');
        await page.waitForNavigation();

        await page.goto('https://m.klikbca.com/accountstmt.do?value(actions)=menu');
        await page.click('a[href*="stmthistory"]');
        await page.click('input[value="Submit"]');
        await page.waitForSelector('table');

        const transactions = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('table tr')).slice(1).map(row => {
                const cols = row.querySelectorAll('td');
                if (cols.length < 3) return null;
                return {
                    description: cols[1].innerText.trim(),
                    amount: parseFloat(cols[2].innerText.replace(/[^0-9.-]+/g, "")),
                    type: cols[2].innerText.includes('CR') ? 'MASUK' : 'KELUAR'
                };
            }).filter(x => x);
        });

        return transactions.map(trx => ({
            type: trx.type,
            merchant: trx.description,
            platform: 'BCA',
            amount: trx.amount,
            raw_data: JSON.stringify(trx),
            profile_id: gateway.profile_id
        }));

    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { scrape };
