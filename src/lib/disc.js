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

/**
 * ============================================================
 *  SALVA O RESULTADO DO DISC (centralizado com XP)
 * ------------------------------------------------------------
 *  - Registra histórico em /discResults
 *  - Atualiza /users/{uid} com discProfile, scores, etc.
 *  - Se for a PRIMEIRA vez → chama grantDiscFirstResultXp
 *    (+100 pts no Mapa de Carreira, registrado no /xpLog)
 * ============================================================
 */

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

  // 2) Transação para salvar histórico + atualizar perfil DISC
  await runTransaction(db, async (tx) => {
    // histórico de DISC (sempre grava uma linha nova)
    const newHistoryRef = doc(historyCol);
    tx.set(newHistoryRef, {
      ownerUid: userId,
      ownerName: safeName,
      scores,
      dominant,
      secondary,
      // só para informação (o XP mesmo fica centralizado no xpLog)
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

    // cria ou atualiza user (sem mexer em points aqui)
    tx.set(
      userRef,
      {
        uid: userId,
        name: safeName,
        email: current?.email || "",
        // não alteramos "points" aqui
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
