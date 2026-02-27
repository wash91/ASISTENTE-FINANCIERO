/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { clearKeyCache } from "../utils/empresaKey";

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [empresaId, setEmpresaId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Login con email y password
  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  // Logout
  async function logout() {
    clearKeyCache(); // limpiar claves en memoria antes de cerrar sesión
    return signOut(auth);
  }

  // Reset password
  async function resetPassword(email) {
    return sendPasswordResetEmail(auth, email);
  }

  // Cargar perfil del usuario desde Firestore
  async function loadUserProfile(uid, email) {
    try {
      // Buscar en qué empresa está este usuario
      // Por ahora usamos un enfoque simple: el uid del usuario es el empresaId del admin
      const userRef = doc(db, "usuarios_index", uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        setEmpresaId(data.empresaId);

        // Cargar perfil dentro de la empresa
        const perfilRef = doc(db, "empresas", data.empresaId, "usuarios", uid);
        const perfilSnap = await getDoc(perfilRef);
        if (perfilSnap.exists()) {
          const perfil = perfilSnap.data();
          if (perfil.estado === "inactivo") {
            await signOut(auth);
            return;
          }
          setUserProfile({ uid, ...perfil });
        }
      } else {
        // Primera vez: el usuario ES el admin y su empresaId es su uid
        setEmpresaId(uid);
        setUserProfile({ uid, rol: "admin", nombre: email ? email.split("@")[0] : "Admin" });
      }
    } catch (error) {
      console.error("Error cargando perfil:", error);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await loadUserProfile(user.uid, user.email);
      } else {
        setUserProfile(null);
        setEmpresaId(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    empresaId,
    loading,
    login,
    logout,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
