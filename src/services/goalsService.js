// src/services/goalsService.js
import { db } from "../lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

const GOALS_COLLECTION = "goals";


export function listenUserGoals(uid, setGoals) {
  if (!uid) {
    return () => {};
  }

  const qGoals = query(
    collection(db, GOALS_COLLECTION),
    where("ownerUid", "==", uid),
    orderBy("createdAt", "asc")
  );

  const unsub = onSnapshot(qGoals, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    setGoals(list);
  });

  return unsub;
}


export function listenCompletedGoals(setGoals) {
  const qG = query(
    collection(db, GOALS_COLLECTION),
    where("status", "==", "concluida"),
    orderBy("completedAt", "desc")
  );

  const unsub = onSnapshot(qG, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    setGoals(list);
  });

  return unsub;
}


export function listenGoalsForManager(filters, setGoals) {
  const { ownerUid = "all", status = "all" } = filters || {};

  const colRef = collection(db, GOALS_COLLECTION);
  const clauses = [];

  if (ownerUid !== "all") {
    clauses.push(where("ownerUid", "==", ownerUid));
  }
  if (status !== "all") {
    clauses.push(where("status", "==", status));
  }

  const qGoals = query(colRef, ...clauses, orderBy("createdAt", "desc"));

  const unsub = onSnapshot(qGoals, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    setGoals(list);
  });

  return unsub;
}


export function listenGoalsForCollaborator(ownerUid, setGoals) {
  if (!ownerUid) return () => {};

  const colRef = collection(db, GOALS_COLLECTION);
  const qGoals = query(
    colRef,
    where("ownerUid", "==", ownerUid),
    orderBy("createdAt", "desc")
  );

  const unsub = onSnapshot(qGoals, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    setGoals(list);
  });

  return unsub;
}


export async function createGoal({
  title,
  description,
  points,
  dueDateISO,
  ownerUid,
  ownerName,
  createdByUid,
  isPdi = false, 
  seasonKey = null, 
}) {
  const dueDate = dueDateISO
    ? Timestamp.fromDate(new Date(dueDateISO + "T23:59:59"))
    : null;

  const payload = {
    title: title?.trim() || "",
    description: description?.trim() || "",
    points: Number(points || 0), 
    dueDate,
    ownerUid,
    ownerName: ownerName || "",
    createdByUid: createdByUid || null,
    createdAt: serverTimestamp(),
    status: "aberta",
    completedAt: null,
    
    isPdi: !!isPdi,
    seasonKey: seasonKey || null,
  };

  return addDoc(collection(db, GOALS_COLLECTION), payload);
}


export async function toggleGoalStatus(
  goal,
  _options = {}
) {
  if (!goal?.id || !goal?.ownerUid) return;

  const goalRef = doc(db, GOALS_COLLECTION, goal.id);

  if (goal.status === "aberta") {
    // marcar como concluída
    await updateDoc(goalRef, {
      status: "concluida",
      completedAt: serverTimestamp(),
    });
  } else {
    // reabrir meta
    await updateDoc(goalRef, {
      status: "aberta",
      completedAt: null,
    });
  }
}

/**
 * Remove uma meta pelo ID.
 */
export async function deleteGoalById(id) {
  if (!id) return;
  await deleteDoc(doc(db, GOALS_COLLECTION, id));
}
