import { Buffer } from 'buffer';

/**
 * Send an SMS via Beem Africa API
 * 
 * @param {string} phone 
 * @param {string} message 
 */
export async function sendBeemSMS(phone, message) {
    const api_key = '84bb2396159214e5';
    const secret_key = 'MGM0NWU2MjZhOTQwNjkxY2RjNWQ5MzJkNGJjMmQ5OWNhZDIzMmRmOWI3MTYzMTVjYmU3NjExNjcyMjAyYjY5Yg==';
    
    // Generate basic auth token
    const token = Buffer.from(`${api_key}:${secret_key}`).toString('base64');
    
    // Normalize phone number (strip +, replace leading 0 with 255 for TZ)
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
        formattedPhone = '255' + formattedPhone.substring(1);
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
            'Authorization': 'Basic ' + token
        },
        body: JSON.stringify(body)
    });
    
    if (!response.ok) {
        throw new Error(`Beem API Error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
}
