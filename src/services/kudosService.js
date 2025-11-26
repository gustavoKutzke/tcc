// src/services/kudosService.js
import { db } from "../lib/firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";

import { monthKeyFromDate } from "../utils/dateUtils";
import { grantKudosSentXp } from "./xpService";

/**
 * Kudos recebidos no mês atual
 */
export function listenKudosReceivedThisMonth(uid, setSum) {
  if (!uid) return () => {};

  const monthKey = monthKeyFromDate(new Date());

  const qKudos = query(
    collection(db, "kudos"),
    where("toUid", "==", uid),
    where("monthKey", "==", monthKey),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(qKudos, (snap) => {
    let sum = 0;
    snap.forEach((d) => (sum += Number(d.data()?.value || 0)));
    setSum(sum);
  });
}

/**
 * Kudos enviados hoje
 */
export function listenKudosSentToday(uid, setCount) {
  if (!uid) return () => {};

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const q = query(
    collection(db, "kudos"),
    where("fromUid", "==", uid),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snap) => {
    let count = 0;
    snap.forEach((doc) => {
      const k = doc.data();
      if (!k.createdAt?.toDate) return;
      const dt = k.createdAt.toDate();
      if (dt >= start && dt < end) count++;
    });
    setCount(count);
  });
}

/**
 * Feed de kudos do mês
 */
export function listenKudosByMonth(monthKey, setKudos) {
  if (!monthKey) return () => {};

  const q = query(
    collection(db, "kudos"),
    where("monthKey", "==", monthKey),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snap) => {
    setKudos(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
  });
}

/**
 * Kudos recebidos por mês
 */
export function listenKudosForUserMonth(uid, monthKey, setKudos) {
  if (!uid || !monthKey) return () => {};

  const q = query(
    collection(db, "kudos"),
    where("toUid", "==", uid),
    where("monthKey", "==", monthKey),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snap) => {
    setKudos(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
  });
}

/**
 * Kudos enviados por usuário
 */
export function listenKudosSentByUserMonth(uid, monthKey, setKudos) {
  if (!uid || !monthKey) return () => {};

  const q = query(
    collection(db, "kudos"),
    where("fromUid", "==", uid),
    where("monthKey", "==", monthKey),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snap) => {
    setKudos(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
  });
}


export async function sendKudosWithXp({
  fromUid,
  fromName,
  toUid,
  toName,
  value = 1,
  message = "",
  teamId = null,
}) {
  if (!fromUid || !toUid) {
    throw new Error("fromUid e toUid são obrigatórios");
  }

  const now = new Date();
  const monthKey = monthKeyFromDate(now);
  const numericValue = Number(value || 0);

  const payload = {
    fromUid,
    fromName: fromName || "",
    toUid,
    toName: toName || "",
    value: numericValue,
    message: message.trim(),
    teamId: teamId || null,
    monthKey,
    createdAt: serverTimestamp(),

    
    xpReceiverApplied: false,
  };

  // Criar kudos no Firestore
  const ref = await addDoc(collection(db, "kudos"), payload);

  
  await grantKudosSentXp({
    uid: fromUid,
    meta: {
      type: "kudos_sent",
      kudosId: ref.id,
      fromUid,
      toUid,
      value: numericValue,
    },
  });

  return ref.id;
}
