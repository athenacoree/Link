/**
 * Firebase Config for Link Google Services Engine
 */

const DEFAULT_PROJECT_ID = 'linkai-3eda1';

function getFirebaseConfig() {
  return {
    projectId: process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID}.firebaseapp.com`,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID}.firebasestorage.app`,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '3670012873',
    appId: process.env.FIREBASE_APP_ID || '1:3670012873:web:f45dbc96a48b1c40a62e18',
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || 'G-7T38731QBT',
    hasAdminCredentials: Boolean(process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL)
  };
}

module.exports = {
  getFirebaseConfig
};
