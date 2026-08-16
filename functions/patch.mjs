import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Fix relative path depending on where script runs
const serviceAccountPath = 'd:\\GLORIA\\NEWHOPE-CHAT\\server\\config\\serviceAccountKey.json';
try {
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  const db = admin.firestore();
  
  async function run() {
    console.log('Updating settings/general with new commission base rates...');
    const generalRef = db.collection('settings').doc('general');
    await generalRef.set({
      referralLevel1: 3.6,
      referralLevel2: 1.2,
      referralLevel3: 0.4
    }, { merge: true });
    
    console.log('Done mapping new rates: Level 1=3.6, Level 2=1.2, Level 3=0.4');
    process.exit(0);
  }
  
  run().catch(console.error);
} catch (err) {
  console.error('Failed to init firebase:', err);
  process.exit(1);
}
