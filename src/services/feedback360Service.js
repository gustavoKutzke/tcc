// src/services/feedback360Service.js
// Centraliza toda a lógica de Firestore da tela Feedback360

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

/**
 * Escuta em tempo real TODOS os feedbacks (modo gestor).
 * Retorna função de unsubscribe (para usar no useEffect).
 */
export function listenFeedbacksForManager(setItems) {
  const base = collection(db, FEEDBACKS_COLLECTION);
  const qFb = query(base, orderBy("createdAt", "desc"));

  const unsub = onSnapshot(qFb, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) }));
    setItems(list);
  });

  return unsub;
}

/**
 * Escuta em tempo real os feedbacks de um colaborador específico.
 */
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

/**
 * Cria um novo feedback (contrato de expectativa) e, se houver,
 * já salva a assinatura do gestor na subcoleção /signatures.
 *
 * ✅ O XP agora é aplicado SOMENTE no backend (Cloud Functions).
 * Aqui apenas criamos o documento com xpApplied: false.
 */
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
  managerSignature, // base64 da assinatura ou ""
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

  // 1) cria documento principal
  const ref = await addDoc(collection(db, FEEDBACKS_COLLECTION), payload);

  // 2) salva assinatura do gestor (opcional)
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

  // 3) XP é tratado apenas pelas Cloud Functions (feedback.js)
  return ref;
}

/**
 * Salva/atualiza a assinatura do colaborador para um feedback.
 */
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

/**
 * Carrega as assinaturas (gestor e colaborador) de um feedback.
 * Retorna { manager: string, collaborator: string }
 */
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
