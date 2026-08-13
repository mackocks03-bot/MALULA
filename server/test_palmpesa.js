import dotenv from 'dotenv';
dotenv.config();

// Mute console.log from other files if possible, just want clean output
import { initiateMobilePayment } from './services/palmpesa.js';

async function run() {
    console.log("Testing PalmPesa initiateMobilePayment...");
    try {
        const payment = await initiateMobilePayment({
            phone: '0744000000',
            amount: 500,
            name: 'Test',
            email: 'test@test.com'
        });
        console.log("SUCCESS:", payment);
    } catch (e) {
        console.error("ERROR:", e.message);
        console.error(e.stack);
    }
}
run();
