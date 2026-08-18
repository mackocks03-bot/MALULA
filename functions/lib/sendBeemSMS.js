import { Buffer } from 'buffer';

/**
 * Send an SMS via Beem Africa API
 * @param {string} phone
 * @param {string} message
 */
export async function sendBeemSMS(phone, message) {
    const api_key = '84bb2396159214e5';
    const secret_key = 'MGM0NWU2MjZhOTQwNjkxY2RjNWQ5MzJkNGJjMmQ5OWNhZDIzMmRmOWI3MTYzMTVjYmU3NjExNjcyMjAyYjY5Yg==';

    // Beem Africa Basic Auth: base64(api_key:secret_key)
    // Both values are used as-is (api_key is the username, secret_key is the password)
    const token = Buffer.from(`${api_key}:${secret_key}`).toString('base64');

    // Normalize phone: strip non-digits, replace leading 0 with 255 for TZ
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
        formattedPhone = '255' + formattedPhone.substring(1);
    }
    // Ensure it starts with country code (no leading +)
    if (!formattedPhone.startsWith('255') && formattedPhone.length === 9) {
        formattedPhone = '255' + formattedPhone;
    }

    const body = {
        source_addr: 'NEW HOPE',
        schedule_time: '',
        encoding: '0',
        message: message,
        recipients: [
            {
                recipient_id: 1,
                dest_addr: formattedPhone
            }
        ]
    };

    const response = await fetch('https://apisms.beem.africa/v1/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${token}`
        },
        body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
        // Log the Beem error but do NOT forward raw response as a message
        console.error(`Beem API Error ${response.status}:`, JSON.stringify(data));
        throw new Error(`Beem API Error: ${response.status} ${response.statusText}`);
    }

    return data;
}
