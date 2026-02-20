import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: "AIzaSyCY5imlb30rIyiceXqYgYD0Y-qx8aXuaDg",
  authDomain: "contador-1dd17.firebaseapp.com",
  projectId: "contador-1dd17",
  storageBucket: "contador-1dd17.firebasestorage.app",
  messagingSenderId: "709500167777",
  appId: "1:709500167777:web:506bea328264da156e6c20",
  measurementId: "G-9EG9G6FVNH"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
