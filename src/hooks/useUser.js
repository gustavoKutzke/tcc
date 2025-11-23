// src/hooks/useUser.js
import { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";

/**
 * Retorna { userAuth, userDoc, loading }
 * - userAuth: objeto do Firebase Auth (ou null)
 * - userDoc:  { uid, role, points, ... } do Firestore (ou null enquanto carrega)
 */
export function useUser() {
  const [userAuth, setUserAuth] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubDoc = null;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      setUserAuth(u);
      if (!u) {
        setUserDoc(null);
        setLoading(false);
        unsubDoc?.();
        return;
      }

      // 1° fetch
      const ref = doc(db, "users", u.uid);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setUserDoc({ uid: u.uid, ...snap.data() });
      } else {
        // fallback mínimo
        setUserDoc({ uid: u.uid, role: "colaborador", points: 0 });
      }
      setLoading(false);

      // tempo real
      unsubDoc?.();
      unsubDoc = onSnapshot(ref, (s2) => {
        if (s2.exists()) setUserDoc({ uid: u.uid, ...s2.data() });
      });
    });

    return () => {
      unsubAuth?.();
      unsubDoc?.();
    };
  }, []);

  return { userAuth, userDoc, loading };
}
