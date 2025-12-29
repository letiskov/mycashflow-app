
async function test() {
    try {
        const res = await fetch('http://localhost:3000/api/gateways/credentials', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                platform: 'BCA',
                username: 'testuser',
                password: 'testpassword',
                type: 'mybca'
            })
        });
        const data = await res.json();
        console.log('Result:', data);
    } catch (err) {
        console.error('Test failed:', err.message);
    }
}
test();
