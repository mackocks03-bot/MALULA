import fetch from 'node-fetch';

async function run() {
    try {
        const res = await fetch('http://localhost:5000/api/deposits/palmpesa/initiate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // providing a fake authorization to pass the middleware check
                // but actually we expect 401 if it's fake.
                // To bypass requireUser we need a real token or mock it.
            },
            body: JSON.stringify({ phone: '0744000000', amount: 500, country: 'TZ' })
        });
        const text = await res.text();
        console.log(`STATUS: ${res.status}`);
        console.log(`HEADERS: ${JSON.stringify(res.headers.raw())}`);
        console.log(`BODY: ${text}`);
    } catch (e) {
        console.error('Fetch error:', e);
    }
}
run();
