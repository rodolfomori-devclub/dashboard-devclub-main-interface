// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

// Sua configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDopks275QLMMYr_sO2nh1p31TH-6GIWLI",
    authDomain: "dashboard-devclub.firebaseapp.com",
    projectId: "dashboard-devclub",
    storageBucket: "dashboard-devclub.firebasestorage.app",
    messagingSenderId: "887087051110",
    appId: "1:887087051110:web:ead1a4d9eb6d4d01c018a7"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o Firestore
const db = getFirestore(app);

// Dicionário de valores dos produtos
export const productValues = {
  'DevClub Boleto': 2200,
  'DevClub Cartão': 2000,
  'Vitalicio Cartão': 1000,
  'Vitalicio Boleto': 1200,
  'Front End Cartão': 500,
  'Front End Boleto': 1200,
};

// Opcional: Use o emulador local durante o desenvolvimento
// if (window.location.hostname === "localhost") {
//   connectFirestoreEmulator(db, 'localhost', 8080);
// }

export { db };