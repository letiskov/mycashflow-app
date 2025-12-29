
// Mock Scraper to test the callback API
const data = [
    {
        type: 'MASUK',
        merchant: 'DANA TOPUP',
        platform: 'DANA',
        amount: 500,
        raw_data: { detail: 'Topup via Bank' }
    },
    {
        type: 'MASUK',
        merchant: 'NEO TRANSFER',
        platform: 'BCA',
        amount: 153,
        raw_data: { from: 'John Doe' }
    }
];

async function runTest() {
    const port = 3000;
    console.log(`Sending mock data to http://localhost:${port}/api/callback...`);

    for (const item of data) {
        try {
            const res = await fetch(`http://localhost:${port}/api/callback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            const result = await res.json();
            console.log(`Sent ${item.platform}:`, result);
        } catch (err) {
            console.error(`Failed to send ${item.platform}:`, err.message);
        }
    }
}

runTest();
