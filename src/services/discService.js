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

/**
 * Salva o resultado do DISC.
 *
 * - Registra histórico em /discResults
 * - Atualiza /users/{uid} com discProfile e campos auxiliares
 * - O XP agora é tratado APENAS no backend (Cloud Functions),
 *   não há mais chamada ao xpService aqui.
 */
export async function saveDiscResultService({ scores, dominant, secondary }) {
  const u = auth.currentUser;
  if (!u) throw new Error("Usuário não autenticado");

  const uid = u.uid;
  const userRef = doc(db, "users", uid);
  const historyCol = collection(db, "discResults");

  const safeName = (u.displayName || u.email || "").slice(0, 160);

  // Ainda verificamos se já existia perfil DISC apenas para retorno da função
  const snap = await getDoc(userRef);
  const prev = snap.exists() ? snap.data() : {};
  const hadDiscBefore = !!prev.discProfile;

  // 1) HISTÓRICO – sempre cria um novo doc em /discResults
  await addDoc(historyCol, {
    ownerUid: uid,
    ownerName: safeName,
    scores,
    dominant,
    secondary,
    createdAt: serverTimestamp(),
  });

  // 2) Payload de atualização do usuário (mantendo compatibilidade com campos antigos)
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

  // 3) Atualiza ou cria o user (por segurança)
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

  // XP agora é calculado exclusivamente pela Cloud Function de DISC.
  // Mantemos o retorno para quem usa a função no front.
  return { wasFirstTime: !hadDiscBefore };
}
