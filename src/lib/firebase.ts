import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, OAuthProvider, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

// Validate that we have all required environment variables
const requiredEnvVars = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if we have all required env vars
const hasAllEnvVars = Object.values(requiredEnvVars).every(Boolean);

if (!hasAllEnvVars) {
  console.error('Missing Firebase environment variables:', 
    Object.entries(requiredEnvVars)
      .filter(([, value]) => !value)
      .map(([key]) => `NEXT_PUBLIC_FIREBASE_${key.toUpperCase()}`)
  );
}

const firebaseConfig = requiredEnvVars;

// Initialize Firebase (works on both client and server)
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let googleProvider: GoogleAuthProvider | null = null;
let microsoftProvider: OAuthProvider | null = null;
let appleProvider: OAuthProvider | null = null;

if (hasAllEnvVars) {
  // Initialize Firebase
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

  // Initialize Cloud Firestore and get a reference to the service
  db = getFirestore(app);

  // Initialize Firebase Authentication only on client side
  const isClientSide = typeof window !== 'undefined';
  if (isClientSide) {
    auth = getAuth(app);
    
    // Auth providers
    googleProvider = new GoogleAuthProvider();
    microsoftProvider = new OAuthProvider('microsoft.com');
    appleProvider = new OAuthProvider('apple.com');
    
    // Configure providers
    googleProvider.setCustomParameters({
      prompt: 'select_account',
    });

    microsoftProvider.setCustomParameters({
      prompt: 'select_account',
      tenant: 'common',
    });
  }
}

export { auth, db, googleProvider, microsoftProvider, appleProvider };
export default app;
