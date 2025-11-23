// Importações corretas da versão 9
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyATSjdDCbkSiZS7vVn_KC1FkmkXcv-h4-A",
  authDomain: "meutcc-5bacf.firebaseapp.com",
  projectId: "meutcc-5bacf",
  storageBucket: "meutcc-5bacf.appspot.com",

  messagingSenderId: "510887510585",
  appId: "1:510887510585:web:20299af380e01da11303e8",
  measurementId: "G-XXXXXXX" // aparece no console, se tiver Analytics
};

// Inicializa
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
export const storage = getStorage(app);

