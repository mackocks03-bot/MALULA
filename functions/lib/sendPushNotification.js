import { getMessaging } from 'firebase-admin/messaging';
import { FieldValue } from 'firebase-admin/firestore';

export async function sendPushNotification(db, uid, title, message, data = {}) {
    try {
        const userRef = db.collection('users').doc(uid);
        const userSnap = await userRef.get();
        if (!userSnap.exists) {
            console.log(`User ${uid} not found. Skipping push.`);
            return;
        }

        const userData = userSnap.data();
        const fcmTokensObj = userData.fcmTokens;
        if (!fcmTokensObj || typeof fcmTokensObj !== 'object') {
            console.log(`No FCM tokens found for user ${uid}. Skipping push.`);
            return;
        }

        const tokens = Object.keys(fcmTokensObj);
        if (tokens.length === 0) return;

        // Force stringification of all data map values
        const stringifiedData = {};
        for (const [key, val] of Object.entries(data)) {
            if (val !== undefined && val !== null) {
                stringifiedData[key] = String(val);
            }
        }

        const payload = {
            notification: {
                title: String(title),
                body: String(message)
            },
            data: stringifiedData,
            tokens: tokens
        };

        const response = await getMessaging().sendEachForMulticast(payload);
        console.log(`Successfully dispatched ${response.successCount} native pushes for ${uid}. Failed: ${response.failureCount}`);
        
        // Optional: Clean up dead tokens
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const error = resp.error;
                    if (error && (error.code === 'messaging/invalid-registration-token' || error.code === 'messaging/registration-token-not-registered')) {
                        failedTokens.push(tokens[idx]);
                    }
                }
            });
            if (failedTokens.length > 0) {
                const updates = {};
                failedTokens.forEach(t => {
                    updates[`fcmTokens.${t}`] = FieldValue.delete();
                });
                await userRef.update(updates);
                console.log(`Purged ${failedTokens.length} dead FCM tokens for ${uid}`);
            }
        }
    } catch (err) {
        console.error(`Failed to send push notification to user ${uid}:`, err);
    }
}
