// src/services/pdiService.js
import { auth, db } from "../lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

/* ====================== */
/* AUTH / USERS HELPERS   */
/* ====================== */

export function listenCurrentUser(callback) {
  const unsub = onAuthStateChanged(auth, async (u) => {
    if (!u) return callback(null);

    try {
      const snap = await getDoc(doc(db, "users", u.uid));
      const data = snap.exists()
        ? { uid: u.uid, ...snap.data() }
        : { uid: u.uid, role: "colaborador" };
      callback(data);
    } catch (e) {
      console.error("listenCurrentUser error:", e);
      callback({ uid: u.uid, role: "colaborador" });
    }
  });
  return unsub;
}

export function listenCollaborators(callback) {
  const qUsers = query(
    collection(db, "users"),
    where("role", "==", "colaborador"),
    orderBy("name")
  );
  return onSnapshot(qUsers, (snap) => {
    const list = snap.docs.map((d) => ({ uid: d.id, ...(d.data() || {}) }));
    callback(list);
  });
}

/* ====================== */
/* PDI – PLANO            */
/* ====================== */

export function listenPdiPlanForUser(subjectUid, onPlanChange) {
  if (!subjectUid) {
    onPlanChange(null);
    return () => {};
  }

  const qPlans = query(
    collection(db, "pdiPlans"),
    where("ownerUid", "==", subjectUid),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(qPlans, (snap) => {
    if (snap.empty) return onPlanChange(null);
    const doc0 = snap.docs[0];
    onPlanChange({ id: doc0.id, ...(doc0.data() || {}) });
  });
}

export const listenPdiPlanByOwnerUid = listenPdiPlanForUser;

export function listenPdiItems(planId, onItemsChange) {
  if (!planId) {
    onItemsChange([]);
    return () => {};
  }

  const qItems = query(
    collection(db, "pdiPlans", planId, "items"),
    orderBy("order", "asc")
  );

  return onSnapshot(qItems, (snap) => {
    const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    onItemsChange(rows);
  });
}

export async function savePdiHeader(params) {
  const ownerUid = params.ownerUid || params.subjectUid;
  if (!ownerUid) throw new Error("ownerUid/subjectUid obrigatório");

  const ownerName =
    params.ownerName ||
    params.subjectDisplayName ||
    params.collaboratorName ||
    "";

  const collaboratorName =
    params.collaboratorName ||
    params.subjectDisplayName ||
    params.ownerName ||
    ownerName ||
    "";

  const payload = {
    ownerUid,
    ownerName,
    collaboratorName,
    profile: (params.profile || "").trim(),
    roleTitle: (params.roleTitle || "").trim(),
    managerName: (params.managerName || "").trim(),
    startDate: (params.startDate || "").trim(),
    endDate: (params.endDate || "").trim(),
    followUp: params.followUp,
    updatedAt: serverTimestamp(),
  };

  if (!params.planId) {
    const ref = await addDoc(collection(db, "pdiPlans"), {
      ...payload,
      progress: 0,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  }

  await updateDoc(doc(db, "pdiPlans", params.planId), payload);
  return params.planId;
}

/* ===== helpers de progresso ===== */

export function calculateProgressFromItems(items = []) {
  if (!items.length) return 0;
  const done = items.filter((i) => i.status === "concluida").length;
  return Math.round((done / items.length) * 100);
}

async function recomputeAndUpdateProgress(planId, items = []) {
  const pct = calculateProgressFromItems(items);
  await updateDoc(doc(db, "pdiPlans", planId), {
    progress: pct,
    updatedAt: serverTimestamp(),
  });
  return pct;
}

export async function syncPlanProgress(planId, items) {
  if (!planId) return 0;
  return recomputeAndUpdateProgress(planId, items || []);
}

/* ===== itens ===== */

export async function createPdiItem(planId, currentItems = []) {
  const nextOrder =
    currentItems.length > 0
      ? (currentItems[currentItems.length - 1].order || 0) + 1
      : 1;

  const data = {
    devPoint: "",
    evidenceExpected: "",
    what: "",
    who: "",
    whenPlanned: "",
    whenRealized: "",
    evidenceActual: "",
    status: "nao_iniciada",
    doneAt: null,
    createdAt: serverTimestamp(),
    order: nextOrder,
  };

  const ref = await addDoc(collection(db, "pdiPlans", planId, "items"), data);
  return { id: ref.id, ...data };
}

export async function duplicatePdiItem(planId, row) {
  await addDoc(collection(db, "pdiPlans", planId, "items"), {
    devPoint: row.devPoint || "",
    evidenceExpected: row.evidenceExpected || "",
    what: row.what || "",
    who: row.who || "",
    whenPlanned: row.whenPlanned || "",
    whenRealized: "",
    evidenceActual: "",
    status: "nao_iniciada",
    doneAt: null,
    createdAt: serverTimestamp(),
    order: (row.order || 0) + 0.1,
  });
}

export async function deletePdiItem(planId, rowId) {
  await deleteDoc(doc(db, "pdiPlans", planId, "items", rowId));
}

export async function updatePdiItem(planId, rowId, patch, currentItems) {
  await updateDoc(doc(db, "pdiPlans", planId, "items", rowId), patch);

  if (Array.isArray(currentItems)) {
    const nextItems = currentItems.map((i) =>
      i.id === rowId ? { ...i, ...patch } : i
    );
    await recomputeAndUpdateProgress(planId, nextItems);
  }
}
