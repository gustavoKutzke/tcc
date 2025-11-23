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

/**
 * Envia um kudo.
 *
 * params:
 *  - from: { uid, name, email }
 *  - to:   { uid, name, email }
 *  - value: number (1–5)
 *  - message: string (opcional, até 240)
 */
export async function sendKudos({ from, to, value, message }) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("Usuário não autenticado.");
  }

  // garante que o remetente é o usuário logado
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

  // nomes seguros (sempre string)
  const fromName =
    (from && (from.name || from.email)) ||
    user.displayName ||
    user.email ||
    "Anônimo";

  const toName = to.name || to.email || to.uid || "Colaborador";

  // mensagem opcional, até 240 chars
  const safeMsg = (message || "").trim().slice(0, 240);

  // monta payload exatamente como as regras esperam
  const data = {
    fromUid: user.uid,
    fromName: String(fromName),
    toUid: String(to.uid),
    toName: String(toName),
    value: v, // number → Firestore salva como int
    monthKey: String(mk),
    createdAt: serverTimestamp(), // timestamp
  };

  // só adiciona a chave message se tiver conteúdo
  if (safeMsg) {
    data.message = safeMsg;
  }

  // cria o documento de kudo
  const docRef = await addDoc(collection(db, "kudos"), data);

  // atualiza contador de kudos dados no mês (usado no KudosBudgetCard)
  try {
    await updateDoc(doc(db, "users", user.uid), {
      [`kudosGivenByMonth.${mk}`]: increment(v),
    });
  } catch (err) {
    console.warn("Falha ao atualizar kudosGivenByMonth:", err);
    // não quebra o envio do kudo se só o contador falhar
  }

  return docRef;
}
