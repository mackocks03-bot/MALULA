const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccount.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function backfill() {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.get();
  const phoneIndexRef = db.collection('phoneIndex');

  let count = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.phone) {
        await phoneIndexRef.doc(data.phone).set({
            uid: doc.id,
            phone: data.phone
        });
        count++;
    }
  }
  console.log(`Successfully backfilled ${count} phone numbers into phoneIndex.`);
}

backfill().then(() => process.exit(0)).catch(console.error);
