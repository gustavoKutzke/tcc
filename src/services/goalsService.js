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

/**
 * Escuta em tempo real as metas (/goals) de um usuário específico.
 * Usado, por exemplo, na tela de Mapa de Carreira.
 */
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

/**
 * Escuta TODAS as metas concluídas (status == "concluida").
 * Usado no FEED para montar o mural de conquistas.
 */
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

/**
 * Escuta metas para o GESTOR, com filtros opcionais.
 * filters: { ownerUid: "all" | uid, status: "all" | "aberta" | "concluida" }
 */
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

/**
 * Escuta metas para um COLABORADOR específico (tela Metas -> visão do colaborador).
 */
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

/**
 * Cria uma nova meta para um colaborador.
 * dueDateISO: string "yyyy-mm-dd"
 */
export async function createGoal({
  title,
  description,
  points,
  dueDateISO,
  ownerUid,
  ownerName,
  createdByUid,
  isPdi = false, // opcional: marcar meta ligada ao PDI
  seasonKey = null, // opcional: meta vinculada a uma temporada
}) {
  const dueDate = dueDateISO
    ? Timestamp.fromDate(new Date(dueDateISO + "T23:59:59"))
    : null;

  const payload = {
    title: title?.trim() || "",
    description: description?.trim() || "",
    points: Number(points || 0), // continua existindo como "peso" da meta
    dueDate,
    ownerUid,
    ownerName: ownerName || "",
    createdByUid: createdByUid || null,
    createdAt: serverTimestamp(),
    status: "aberta",
    completedAt: null,
    // flags de gamificação
    isPdi: !!isPdi,
    seasonKey: seasonKey || null,
  };

  return addDoc(collection(db, GOALS_COLLECTION), payload);
}

/**
 * Alterna o status da meta (aberta <-> concluída).
 *
 * ❗ Toda a lógica de XP agora está nas Cloud Functions (backend),
 * então aqui só atualizamos o documento no Firestore.
 *
 * Mantemos a assinatura com o segundo parâmetro por compatibilidade,
 * mas ele não é mais utilizado.
 */
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
