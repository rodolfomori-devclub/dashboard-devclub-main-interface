// Simple script to create admin user using Firebase Web SDK
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
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

// Admin credentials
const ADMIN_EMAIL = 'admin@devclub.com';
const ADMIN_PASSWORD = 'Admin123!@#';
const ADMIN_DISPLAY_NAME = 'Administrator';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function createAdminUser() {
  log('\n🚀 Criando usuário admin...', 'cyan');

  try {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    log('✅ Firebase inicializado', 'green');

    // Create user in Firebase Authentication
    log('\n👤 Criando usuário no Firebase Auth...', 'yellow');
    const userCredential = await createUserWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
    const user = userCredential.user;

    log(`✅ Usuário criado: ${user.email} (UID: ${user.uid})`, 'green');

    // Update display name
    await updateProfile(user, {
      displayName: ADMIN_DISPLAY_NAME
    });

    log('✅ Display name atualizado', 'green');

    // Create user document in Firestore
    log('\n📄 Criando documento no Firestore...', 'yellow');
    await setDoc(doc(db, 'users', user.uid), {
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
        traffic: true,
        'data-sources': true,
      },
      createdAt: new Date(),
      createdBy: 'system',
    });

    log('✅ Documento criado no Firestore', 'green');

    log('\n╔════════════════════════════════════════════════════════════╗', 'green');
    log('║  ✅ USUÁRIO ADMIN CRIADO COM SUCESSO!                    ║', 'green');
    log('╚════════════════════════════════════════════════════════════╝', 'green');
    log(`\n📧 Email: ${ADMIN_EMAIL}`, 'cyan');
    log(`🔑 Senha: ${ADMIN_PASSWORD}`, 'cyan');
    log('\n⚠️  IMPORTANTE: Troque a senha após o primeiro login!\n', 'yellow');

  } catch (error) {
    log('\n❌ ERRO ao criar usuário:', 'red');

    if (error.code === 'auth/email-already-in-use') {
      log('   O email já está em uso. Tente fazer login ou use outro email.', 'yellow');
    } else if (error.code === 'auth/weak-password') {
      log('   A senha é muito fraca. Use uma senha mais forte.', 'yellow');
    } else if (error.code === 'auth/invalid-email') {
      log('   O email é inválido.', 'yellow');
    } else {
      log(`   ${error.message}`, 'red');
    }

    process.exit(1);
  }
}

// Run the script
createAdminUser();
