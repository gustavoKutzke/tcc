// src/services/rankingService.js
import { db } from "../lib/firebase";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  doc,
  getDoc,
  Timestamp,
} from "firebase/firestore";

/**
 * Busca o usuário logado na coleção "users".
 */
export async function fetchCurrentUser(uid) {
  if (!uid) return null;

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      return { uid, role: "colaborador" };
    }
    return { uid, ...(snap.data() || {}) };
  } catch (e) {
    console.error("fetchCurrentUser error:", e);
    return { uid, role: "colaborador" };
  }
}

/**
 * Busca metas no intervalo [start, end) filtrando por completedAt.
 * Se ownerUid for informado, restringe ao colaborador.
 * Retorna um array de docs (id + data()).
 */
export async function fetchGoalsInRange({ start, end, ownerUid }) {
  if (!start || !end) return [];

  const colRef = collection(db, "goals");

  const constraints = [
    where("completedAt", ">=", Timestamp.fromDate(start)),
    where("completedAt", "<", Timestamp.fromDate(end)),
  ];

  if (ownerUid) {
    constraints.unshift(where("ownerUid", "==", ownerUid));
  }

  let snap;
  try {
    const q1 = query(colRef, ...constraints, orderBy("completedAt", "desc"));
    snap = await getDocs(q1);
  } catch (e) {
    console.warn(
      "fetchGoalsInRange fallback sem orderBy:",
      e?.code || e?.message
    );
    const q2 = query(colRef, ...constraints);
    snap = await getDocs(q2);
  }

  const rows = [];
  snap.forEach((d) => rows.push({ id: d.id, ...(d.data() || {}) }));
  return rows;
}

/**
 * Busca kudos de um determinado mês (monthKey = 'YYYY-MM').
 * Se toUid for informado, restringe ao destinatário.
 */
export async function fetchKudosForMonth({ monthKey, toUid }) {
  if (!monthKey) return [];

  const colRef = collection(db, "kudos");
  const constraints = [where("monthKey", "==", monthKey)];

  if (toUid) {
    constraints.push(where("toUid", "==", toUid));
  }

  const qy = query(colRef, ...constraints);
  const snap = await getDocs(qy);

  const rows = [];
  snap.forEach((d) => rows.push({ id: d.id, ...(d.data() || {}) }));
  return rows;
}
