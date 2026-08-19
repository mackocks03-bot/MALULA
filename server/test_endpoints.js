import dotenv from 'dotenv';
dotenv.config();

const DEFAULT_BASE_URL = 'https://palmpesa.drmlelwa.co.tz/api';

function authHeader() {
    const raw = process.env.PALMPESA_API_KEY || process.env.PALMPESA_API_TOKEN || '';
    const token = raw.replace(/^Bearer\s+/i, '').trim();
    if (!token) return null;
    return `Bearer ${token}`;
}

async function testEndpoint(path) {
    const url = `${DEFAULT_BASE_URL}${path}`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Authorization: authHeader(),
                Accept: 'application/json',
            }
        });
        const text = await response.text();
        console.log(`GET ${path} => ${response.status} : ${text.substring(0, 150)}`);
    } catch (e) {
        console.log(`GET ${path} => ERROR: ${e.message}`);
    }
}

async function run() {
    const endpoints = [
        '/transactions',
        '/api/transactions',
        '/orders',
        '/history',
        '/payments',
        '/palmpesa/transactions',
        '/palmpesa/history'
    ];
    for (const ep of endpoints) {
        await testEndpoint(ep);
    }
}
run();
