import { initializeApp } from 'firebase/app';
import {
    getAuth,
    setPersistence,
    browserLocalPersistence,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    sendEmailVerification,
    signOut,
    onAuthStateChanged,
    fetchSignInMethodsForEmail,
    deleteUser
} from 'firebase/auth';
import {
    getFirestore,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    addDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    startAt,
    startAfter,
    endAt,
    endBefore,
    writeBatch,
    arrayUnion
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

setPersistence(auth, browserLocalPersistence).catch(console.error);

export {
    app,
    auth,
    db,
    storage,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    updateDoc,
    addDoc,
    deleteDoc,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    startAt,
    startAfter,
    endAt,
    endBefore,
    writeBatch,
    arrayUnion,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    sendEmailVerification,
    signOut,
    onAuthStateChanged,
    fetchSignInMethodsForEmail,
    deleteUser
};
