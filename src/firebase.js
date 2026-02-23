import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC-Tqgi3N2FQDva_1GRsNLduwd1zG0zrdc",
  authDomain: "crewlog-890ba.firebaseapp.com",
  projectId: "crewlog-890ba",
  storageBucket: "crewlog-890ba.firebasestorage.app",
  messagingSenderId: "220639273214",
  appId: "1:220639273214:web:d02d5318ecd7bc51d485af"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
