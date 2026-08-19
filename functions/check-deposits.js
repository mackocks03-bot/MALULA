import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccountPath = path.resolve('../serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
  databaseURL: 'https://newhope-chat.firebaseio.com' 
});

const db = admin.firestore();

async function check() {
    const dSnap = await db.collection('shopDeposits').orderBy('createdAt', 'desc').get();
    console.log('--- ALL shopDeposits ---');
    dSnap.forEach(doc => console.log(doc.id, '=>', doc.data()));

    const pSnap = await db.collection('palmpesaPending').get();
    console.log('--- ALL palmpesaPending (type=deposit) ---');
    pSnap.forEach(doc => {
        if(doc.data().type === 'deposit') console.log(doc.id, '=>', doc.data());
    });
}

check().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
