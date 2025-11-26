// src/services/discService.js
import { auth, db } from "../lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";


export async function saveDiscResultService({ scores, dominant, secondary }) {
  const u = auth.currentUser;
  if (!u) throw new Error("Usuário não autenticado");

  const uid = u.uid;
  const userRef = doc(db, "users", uid);
  const historyCol = collection(db, "discResults");

  const safeName = (u.displayName || u.email || "").slice(0, 160);

  // Ainda verificamos se já existia perfil DISC
  const snap = await getDoc(userRef);
  const prev = snap.exists() ? snap.data() : {};
  const hadDiscBefore = !!prev.discProfile;

  //HISTÓRICO 
  await addDoc(historyCol, {
    ownerUid: uid,
    ownerName: safeName,
    scores,
    dominant,
    secondary,
    createdAt: serverTimestamp(),
  });


  const discUpdate = {
    discProfile: {
      dominant,
      secondary,
      scores,
      updatedAt: serverTimestamp(),
    },
    discDominant: dominant,
    discSecondary: secondary,
    discScores: scores,
    discCompletedAt: serverTimestamp(),
  };

 
  if (snap.exists()) {
    await updateDoc(userRef, discUpdate);
  } else {
    await setDoc(userRef, {
      uid,
      name: safeName,
      email: u.email || "",
      points: 0,
      ...discUpdate,
    });
  }
  return { wasFirstTime: !hadDiscBefore };
}
