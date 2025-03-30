// scripts/create-admin.js
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDopks275QLMMYr_sO2nh1p31TH-6GIWLI",
  authDomain: "dashboard-devclub.firebaseapp.com",
  projectId: "dashboard-devclub",
  storageBucket: "dashboard-devclub.firebasestorage.app",
  messagingSenderId: "887087051110",
  appId: "1:887087051110:web:ead1a4d9eb6d4d01c018a7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Admin user details
const ADMIN_EMAIL = 'admin@devclub.com.br';
const ADMIN_PASSWORD = 'Admin@123456'; // This should be changed immediately after creation
const ADMIN_NAME = 'Admin DevClub';

// Function to create admin user
async function createAdminUser() {
  try {
    console.log(`Creating admin user: ${ADMIN_EMAIL}`);
    
    // Create user
    const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    const user = userCredential.user;
    
    // Update profile with displayName
    await updateProfile(user, {
      displayName: ADMIN_NAME
    });
    
    console.log(`Admin user created with UID: ${user.uid}`);
    
    // Set admin role in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      email: ADMIN_EMAIL,
      displayName: ADMIN_NAME,
      isAdmin: true,
      roles: {
        today: true,
        daily: true,
        monthly: true,
        yearly: true,
        commercial: true,
        'data-sources': true
      },
      createdAt: new Date()
    });
    
    console.log('Admin user role set in Firestore');
    
    // Sign out
    await signOut(auth);
    console.log('Admin user created successfully!');
    console.log('IMPORTANT: Change this password immediately after first login.');
    
    // Exit process
    process.exit(0);
  } catch (error) {
    console.error('Error creating admin user:', error);
    process.exit(1);
  }
}

// Run the function
createAdminUser();