import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

try {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json) throw new Error('No FIREBASE_SERVICE_ACCOUNT_JSON found in .env');
  
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(json))
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
