// scripts/create-admin.js
import admin from 'firebase-admin';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Admin credentials
const ADMIN_EMAIL = 'admin@email.com';
const ADMIN_PASSWORD = 'R453FJ4394&*#$CH@#*';
const ADMIN_DISPLAY_NAME = 'Administrator';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Initialize Firebase Admin
async function initializeFirebaseAdmin() {
  const serviceAccountPath = join(rootDir, 'serviceAccountKey.json');

  if (!existsSync(serviceAccountPath)) {
    log('\n❌ ERROR: Service Account Key not found!', 'red');
    log('\nTo obtain your Firebase Service Account Key:', 'yellow');
    log('1. Go to Firebase Console: https://console.firebase.google.com/', 'cyan');
    log('2. Select your project: dashboard-devclub', 'cyan');
    log('3. Go to Project Settings (gear icon) > Service Accounts', 'cyan');
    log('4. Click "Generate New Private Key"', 'cyan');
    log('5. Save the file as "serviceAccountKey.json" in the project root', 'cyan');
    log(`   Path: ${serviceAccountPath}`, 'cyan');
    log('\nThen run this script again: npm run create-admin\n', 'yellow');
    process.exit(1);
  }

  try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'dashboard-devclub'
    });

    log('✅ Firebase Admin initialized successfully', 'green');
  } catch (error) {
    log(`\n❌ ERROR initializing Firebase Admin: ${error.message}`, 'red');
    process.exit(1);
  }
}

// Delete all users from Firebase Authentication
async function deleteAllAuthUsers() {
  log('\n🗑️  Deleting all users from Firebase Authentication...', 'yellow');

  try {
    let deletedCount = 0;
    let nextPageToken;

    do {
      const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);

      if (listUsersResult.users.length === 0) {
        break;
      }

      // Delete users in batches
      const deletePromises = listUsersResult.users.map(user => {
        return admin.auth().deleteUser(user.uid)
          .then(() => {
            deletedCount++;
            log(`   Deleted user: ${user.email || user.uid}`, 'cyan');
          })
          .catch(error => {
            log(`   Error deleting user ${user.email || user.uid}: ${error.message}`, 'red');
          });
      });

      await Promise.all(deletePromises);
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);

    log(`\n✅ Deleted ${deletedCount} users from Firebase Authentication`, 'green');
    return deletedCount;
  } catch (error) {
    log(`\n❌ ERROR deleting auth users: ${error.message}`, 'red');
    throw error;
  }
}

// Delete all user documents from Firestore
async function deleteAllFirestoreUsers() {
  log('\n🗑️  Deleting all user documents from Firestore...', 'yellow');

  try {
    const db = admin.firestore();
    const usersCollection = db.collection('users');
    const snapshot = await usersCollection.get();

    if (snapshot.empty) {
      log('   No user documents found in Firestore', 'cyan');
      return 0;
    }

    let deletedCount = 0;
    const deletePromises = [];

    snapshot.forEach(doc => {
      deletePromises.push(
        doc.ref.delete()
          .then(() => {
            deletedCount++;
            log(`   Deleted document: ${doc.id}`, 'cyan');
          })
          .catch(error => {
            log(`   Error deleting document ${doc.id}: ${error.message}`, 'red');
          })
      );
    });

    await Promise.all(deletePromises);
    log(`\n✅ Deleted ${deletedCount} user documents from Firestore`, 'green');
    return deletedCount;
  } catch (error) {
    log(`\n❌ ERROR deleting Firestore users: ${error.message}`, 'red');
    throw error;
  }
}

// Create admin user
async function createAdminUser() {
  log('\n👤 Creating new admin user...', 'yellow');

  try {
    // Create user in Firebase Authentication
    const userRecord = await admin.auth().createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      displayName: ADMIN_DISPLAY_NAME,
      emailVerified: true,
    });

    log(`   Created auth user: ${userRecord.email} (UID: ${userRecord.uid})`, 'cyan');

    // Create user document in Firestore
    const db = admin.firestore();
    await db.collection('users').doc(userRecord.uid).set({
      email: ADMIN_EMAIL,
      displayName: ADMIN_DISPLAY_NAME,
      isAdmin: true,
      roles: {
        today: true,
        daily: true,
        monthly: true,
        yearly: true,
        commercial: true,
        dre: true,
        launch: true,
        'lead-scoring': true,
        ts: true,
        'data-sources': true,
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'system',
    });

    log(`   Created Firestore document for user`, 'cyan');
    log(`\n✅ Admin user created successfully!`, 'green');

    return userRecord;
  } catch (error) {
    log(`\n❌ ERROR creating admin user: ${error.message}`, 'red');
    throw error;
  }
}

// Save credentials to file
function saveCredentialsToFile() {
  log('\n💾 Saving credentials to file...', 'yellow');

  const credentialsPath = join(rootDir, 'admin-credentials.txt');
  const content = `ADMIN CREDENTIALS
=================

Login: ${ADMIN_EMAIL}
Password: ${ADMIN_PASSWORD}

Created: ${new Date().toISOString()}

IMPORTANT: Keep this file secure and do not commit to version control!
`;

  try {
    writeFileSync(credentialsPath, content, 'utf8');
    log(`   Credentials saved to: ${credentialsPath}`, 'cyan');
    log(`\n✅ Credentials file created successfully!`, 'green');
  } catch (error) {
    log(`\n❌ ERROR saving credentials: ${error.message}`, 'red');
    throw error;
  }
}

// Main execution
async function main() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║  Firebase User Management Script                          ║', 'blue');
  log('║  Delete all users and create new admin                    ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');

  try {
    // Initialize Firebase Admin
    await initializeFirebaseAdmin();

    // Confirm action
    log('\n⚠️  WARNING: This will DELETE ALL existing users!', 'red');
    log('Press Ctrl+C to cancel or wait 5 seconds to continue...', 'yellow');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Delete all users
    await deleteAllAuthUsers();
    await deleteAllFirestoreUsers();

    // Create admin user
    await createAdminUser();

    // Save credentials to file
    saveCredentialsToFile();

    log('\n╔════════════════════════════════════════════════════════════╗', 'green');
    log('║  ✅ OPERATION COMPLETED SUCCESSFULLY!                     ║', 'green');
    log('╚════════════════════════════════════════════════════════════╝', 'green');
    log(`\nAdmin Login: ${ADMIN_EMAIL}`, 'cyan');
    log(`Admin Password: ${ADMIN_PASSWORD}`, 'cyan');
    log('\nCredentials have been saved to: admin-credentials.txt\n', 'yellow');

  } catch (error) {
    log('\n╔════════════════════════════════════════════════════════════╗', 'red');
    log('║  ❌ OPERATION FAILED!                                     ║', 'red');
    log('╚════════════════════════════════════════════════════════════╝', 'red');
    log(`\nError: ${error.message}\n`, 'red');
    process.exit(1);
  }
}

// Run the script
main();
