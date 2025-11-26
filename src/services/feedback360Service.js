// src/services/feedback360Service.js


import { db } from "../lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

const FEEDBACKS_COLLECTION = "feedbacks";


export function listenFeedbacksForManager(setItems) {
  const base = collection(db, FEEDBACKS_COLLECTION);
  const qFb = query(base, orderBy("createdAt", "desc"));

  const unsub = onSnapshot(qFb, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    setItems(list);
  });

  return unsub;
}


export function listenFeedbacksForCollaborator(uid, setItems) {
  if (!uid) return () => {};

  const base = collection(db, FEEDBACKS_COLLECTION);
  const qFb = query(
    base,
    where("collaboratorUid", "==", uid),
    orderBy("createdAt", "desc")
  );

  const unsub = onSnapshot(qFb, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    setItems(list);
  });

  return unsub;
}


export async function createFeedbackWithManagerSignature({
  collaboratorUid,
  collaboratorName,
  department,
  managerUid,
  managerName,
  startDate,
  endDate,
  deliverables,
  behavior,
  managerSignature,
}) {
  const payload = {
    collaboratorUid,
    collaboratorName,
    department,
    managerUid,
    managerName,
    startDate,
    endDate,
    deliverables,
    behavior,
    createdAt: serverTimestamp(),

    // controle simples para o backend saber se já aplicou XP
    xpApplied: false,
  };

  
  const ref = await addDoc(collection(db, FEEDBACKS_COLLECTION), payload);

  //salvar assinatura do gestor 
  if (managerSignature) {
    await setDoc(
      doc(db, FEEDBACKS_COLLECTION, ref.id, "signatures", "manager"),
      {
        byUid: managerUid,
        name: managerName,
        when: serverTimestamp(),
        imageData: managerSignature,
      }
    );
  }

 
  return ref;
}


export async function saveCollaboratorSignature(
  feedbackId,
  { byUid, name, imageData }
) {
  if (!feedbackId || !imageData) return;

  await setDoc(
    doc(db, FEEDBACKS_COLLECTION, feedbackId, "signatures", "collaborator"),
    {
      byUid,
      name,
      when: serverTimestamp(),
      imageData,
    }
  );
}

export async function loadFeedbackSignatures(feedbackId) {
  if (!feedbackId) {
    return { manager: "", collaborator: "" };
  }

  const [snapMng, snapCol] = await Promise.all([
    getDoc(
      doc(db, FEEDBACKS_COLLECTION, feedbackId, "signatures", "manager")
    ),
    getDoc(
      doc(db, FEEDBACKS_COLLECTION, feedbackId, "signatures", "collaborator")
    ),
  ]);

  return {
    manager: snapMng.exists() ? snapMng.data().imageData : "",
    collaborator: snapCol.exists() ? snapCol.data().imageData : "",
  };
}
