// src/services/profileService.js
import { db } from "../lib/firebase";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";


export async function fetchUserByUid(uid) {
  if (!uid) throw new Error("uid obrigatório em fetchUserByUid");

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      return { uid, ...snap.data() };
    }
    return { uid, role: "colaborador" };
  } catch (e) {
    console.error("fetchUserByUid error:", e);
    return { uid, role: "colaborador" };
  }
}


export function listenCollaborators(onUsersChange) {
  const qUsers = query(
    collection(db, "users"),
    where("role", "==", "colaborador"),
    orderBy("name")
  );

  const unsub = onSnapshot(qUsers, (snap) => {
    const users = snap.docs.map((d) => ({ uid: d.id, ...(d.data() || {}) }));
    onUsersChange(users);
  });

  return unsub;
}


export function listenProfileData(subjectUid, monthKey, callbacks) {
  const {
    onUser,
    onGoals,
    onFeedbacks,
    onKudosAll,
    onKudosMonth,
  } = callbacks || {};

  if (!subjectUid) {
    onUser && onUser(null);
    onGoals && onGoals([]);
    onFeedbacks && onFeedbacks([]);
    onKudosAll && onKudosAll([]);
    onKudosMonth && onKudosMonth([]);
    return () => {};
  }

  const unsubUser = onSnapshot(doc(db, "users", subjectUid), (s) => {
    if (s.exists()) onUser && onUser({ uid: s.id, ...s.data() });
    else onUser && onUser(null);
  });

  const unsubGoals = onSnapshot(
    query(
      collection(db, "goals"),
      where("ownerUid", "==", subjectUid),
      orderBy("createdAt", "desc")
    ),
    (snap) =>
      onGoals &&
      onGoals(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })))
  );

  const unsubFeedbacks = onSnapshot(
    query(
      collection(db, "feedbacks"),
      where("collaboratorUid", "==", subjectUid),
      orderBy("createdAt", "desc")
    ),
    (snap) =>
      onFeedbacks &&
      onFeedbacks(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })))
  );

  const unsubKudosAll = onSnapshot(
    query(
      collection(db, "kudos"),
      where("toUid", "==", subjectUid),
      orderBy("createdAt", "desc")
    ),
    (snap) =>
      onKudosAll &&
      onKudosAll(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })))
  );

  const unsubKudosMonth = onSnapshot(
    query(
      collection(db, "kudos"),
      where("toUid", "==", subjectUid),
      where("monthKey", "==", monthKey),
      orderBy("createdAt", "desc")
    ),
    (snap) =>
      onKudosMonth &&
      onKudosMonth(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }))
      )
  );

  return () => {
    unsubUser();
    unsubGoals();
    unsubFeedbacks();
    unsubKudosAll();
    unsubKudosMonth();
  };
}

/**
 * Busca as assinaturas (gestor e colaborador) de um feedback.
 */
export async function fetchFeedbackSignatures(feedbackId) {
  if (!feedbackId)
    throw new Error("feedbackId obrigatório em fetchFeedbackSignatures");

  try {
    const [snapMng, snapCol] = await Promise.all([
      getDoc(doc(db, "feedbacks", feedbackId, "signatures", "manager")),
      getDoc(
        doc(db, "feedbacks", feedbackId, "signatures", "collaborator")
      ),
    ]);

    return {
      manager: snapMng.exists() ? snapMng.data().imageData : "",
      collaborator: snapCol.exists() ? snapCol.data().imageData : "",
    };
  } catch (e) {
    console.error("fetchFeedbackSignatures error:", e);
    return { manager: "", collaborator: "" };
  }
}
