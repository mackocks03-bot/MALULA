import React, { createContext, useContext, useEffect, useState } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { useAuth } from './AuthContext.jsx';
import { db, doc, updateDoc } from '../services/firebase-config.js';

const PushContext = createContext();

export function usePushContext() {
    return useContext(PushContext);
}

export function PushProvider({ children }) {
    const { user } = useAuth();
    const [fcmToken, setFcmToken] = useState(null);

    useEffect(() => {
        if (!user || Capacitor.getPlatform() === 'web') return;

        const registerPush = async () => {
            try {
                // Request permissions first
                let permStatus = await PushNotifications.checkPermissions();
                if (permStatus.receive === 'prompt') {
                    permStatus = await PushNotifications.requestPermissions();
                }

                if (permStatus.receive !== 'granted') {
                    console.log('User denied push notification permissions.');
                    return;
                }

                // Register with Apple / Google to receive token
                await PushNotifications.register();

                // Listen for successful registration
                PushNotifications.addListener('registration', async (token) => {
                    console.log('FCM Token received:', token.value);
                    setFcmToken(token.value);
                    
                    // Save token to RTDB under the user's profile
                    // This allows Cloud Functions to target this specific device
                    await updateDoc(doc(db, 'users', user.uid), {
                        [`fcmTokens.${token.value}`]: true
                    });
                });

                // Listen for errors
                PushNotifications.addListener('registrationError', (error) => {
                    console.warn('Error on push notification registration:', JSON.stringify(error));
                });

                // Listen for incoming notifications when app is foregrounded
                PushNotifications.addListener('pushNotificationReceived', (notification) => {
                    console.log('Push notification received: ', notification);
                    // Could trigger a toast or in-app bell ring here if desired
                });
                
            } catch (err) {
                console.warn('Failed to register push notifications:', err);
            }
        };

        registerPush();

        return () => {
            if (Capacitor.getPlatform() !== 'web') {
                PushNotifications.removeAllListeners();
            }
        };
    }, [user]);

    return (
        <PushContext.Provider value={{ fcmToken }}>
            {children}
        </PushContext.Provider>
    );
}
