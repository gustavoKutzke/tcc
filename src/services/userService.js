// src/services/userService.js
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { awardXpToUser, XP_SOURCES } from "./xpService";

/**
 * Cria/atualiza o perfil básico de usuário em /users.
 */
export async function upsertUserProfile(uid, data = {}) {
  if (!uid) throw new Error("uid é obrigatório para criar/atualizar usuário");

  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      role: "colaborador",
      createdAt: serverTimestamp(),
      points: 0,
      team: null,
      ...data,
    });
  } else if (Object.keys(data).length > 0) {
    await updateDoc(ref, data);
  }
}

/**
 * Escuta o usuário logado + documento em /users em tempo real.
 */
export function listenCurrentUser(setUser) {
  let userDocUnsub = null;

  const authUnsub = onAuthStateChanged(auth, async (u) => {
    if (typeof userDocUnsub === "function") {
      userDocUnsub();
      userDocUnsub = null;
    }

    if (!u) {
      setUser(null);
      return;
    }

    const ref = doc(db, "users", u.uid);

    try {
      const snap = await getDoc(ref);
      let base;

      if (!snap.exists()) {
        const payload = {
          role: "colaborador",
          createdAt: serverTimestamp(),
          points: 0,
          team: null,
          email: u.email || "",
          name: u.displayName || u.email || "",
          photoURL: u.photoURL || null,
        };

        await setDoc(ref, payload);
        base = { uid: u.uid, ...payload };
      } else {
        base = { uid: u.uid, ...(snap.data() || {}) };
      }

      setUser(base);

      userDocUnsub = onSnapshot(ref, (s2) => {
        if (s2.exists()) {
          setUser({ uid: u.uid, ...(s2.data() || {}) });
        }
      });
    } catch (e) {
      console.error("listenCurrentUser error:", e);
      setUser({ uid: u.uid });
    }
  });

  return () => {
    authUnsub?.();
    if (typeof userDocUnsub === "function") userDocUnsub();
  };
}

/**
 * Bônus diário de missões — totalmente integrado ao XP central.
 */
export async function updateDailyMissionsBonus(
  uid,
  currentPoints,
  bonus,
  todayKey
) {
  if (!uid) throw new Error("uid é obrigatório para atualizar bônus diário");

  const ref = doc(db, "users", uid);
  const numericBonus = Number(bonus || 0);

  if (numericBonus !== 0) {
    await awardXpToUser({
      uid,
      amount: numericBonus,                 // assinatura nova
      source: XP_SOURCES.DAILY_MISSIONS,
      metadata: { date: todayKey },
    });
  }

  await updateDoc(ref, {
    lastDailyMissionsBonusDate: todayKey,
  });
}

/**
 * Ranking: escuta todos os usuários ordenados por pontos (desc).
 */
export function listenUsersByPoints(callback) {
  const qUsers = query(collection(db, "users"), orderBy("points", "desc"));
  const unsub = onSnapshot(qUsers, (snap) => {
    const users = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    callback(users);
  });
  return unsub;
}
