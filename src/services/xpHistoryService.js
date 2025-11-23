// src/services/xpHistoryService.js
import { db } from "../lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";

/**
 * Escuta últimos eventos de XP do usuário.
 * maxEvents: quantos logs trazer (default 30).
 */
export function listenXpLogForUser(uid, setEvents, maxEvents = 30) {
  if (!uid) return () => {};

  const q = query(
    collection(db, "xpLog"),
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(maxEvents)
  );

  const unsub = onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    setEvents(list);
  });

  return unsub;
}
