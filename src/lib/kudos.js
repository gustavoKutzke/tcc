// src/lib/kudos.js
import {
  addDoc,
  collection,
  doc,
  increment,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import { monthKeyFromDate } from "./date";


export async function sendKudos({ from, to, value, message }) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  
  const fromUid = from?.uid || user.uid;
  if (fromUid !== user.uid) {
    console.warn(
      "sendKudos: from.uid diferente do usuário logado, ajustando para o auth.currentUser.uid."
    );
  }

  if (!to?.uid) {
    throw new Error("Destinatário inválido.");
  }

  const v = Number(value);
  if (!Number.isFinite(v) || v < 1 || v > 5) {
    throw new Error("O valor do kudo deve estar entre 1 e 5.");
  }

  const mk = monthKeyFromDate(new Date());

 
  const fromName =
    (from && (from.name || from.email)) ||
    user.displayName ||
    user.email ||
    "Anônimo";

  const toName = to.name || to.email || to.uid || "Colaborador";

  
  const safeMsg = (message || "").trim().slice(0, 240);

  
  const data = {
    fromUid: user.uid,
    fromName: String(fromName),
    toUid: String(to.uid),
    toName: String(toName),
    value: v, 
    monthKey: String(mk),
    createdAt: serverTimestamp(), 
  };

 
  if (safeMsg) {
    data.message = safeMsg;
  }

 
  const docRef = await addDoc(collection(db, "kudos"), data);

  
  try {
    await updateDoc(doc(db, "users", user.uid), {
      [`kudosGivenByMonth.${mk}`]: increment(v),
    });
  } catch (err) {
    console.warn("Falha ao atualizar kudosGivenByMonth:", err);
    
  }

  return docRef;
}
