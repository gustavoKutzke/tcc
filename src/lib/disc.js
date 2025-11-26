// src/lib/disc.js
import { auth, db } from "../lib/firebase";
import {
  addDoc,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import {
  XP_VALUES,
  grantDiscFirstResultXp,
} from "../services/xpService";

export async function saveDiscResult({ uid, scores, dominant, secondary }) {
  const current = auth.currentUser;
  const userId = uid || current?.uid;

  if (!userId) {
    throw new Error("Usuário não autenticado");
  }

  const userRef = doc(db, "users", userId);
  const historyCol = collection(db, "discResults");

  const safeName = (current?.displayName || current?.email || "").slice(
    0,
    160
  );

  // 1) Verifica se já havia DISC concluído antes
  const snap = await getDoc(userRef);
  const prevData = snap.exists() ? snap.data() : {};
  const alreadyHadDisc = !!prevData.discCompletedAt;

  //salvar histórico + atualizar perfil DISC
  await runTransaction(db, async (tx) => {
    
    const newHistoryRef = doc(historyCol);
    tx.set(newHistoryRef, {
      ownerUid: userId,
      ownerName: safeName,
      scores,
      dominant,
      secondary,
      
      pointsBonus: alreadyHadDisc ? 0 : XP_VALUES.DISC_FIRST_RESULT,
      createdAt: serverTimestamp(),
    });

    const discUpdate = {
      discProfile: {
        dominant,
        secondary,
        scores,
      },
      discDominant: dominant,
      discSecondary: secondary,
      discScores: scores,
      discCompletedAt: serverTimestamp(),
    };

   
    tx.set(
      userRef,
      {
        uid: userId,
        name: safeName,
        email: current?.email || "",
       
        ...discUpdate,
      },
      { merge: true }
    );
  });

  // 3) Se for a primeira vez → aplica XP via xpService (centralizado)
  if (!alreadyHadDisc) {
    await grantDiscFirstResultXp({
      uid: userId,
      meta: {
        reason: "first_disc_completion",
        scores,
        dominant,
        secondary,
      },
    });
  }
}
