// src/services/shopService.js
import { db } from "../lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";


export async function fetchCurrentUserForShop(uid) {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      return { uid, role: "colaborador", points: 0 };
    }
    return { uid, ...(snap.data() || {}), points: snap.data()?.points || 0 };
  } catch (e) {
    console.error("fetchCurrentUserForShop error:", e);
    return { uid, role: "colaborador", points: 0 };
  }
}


export function subscribeRewards(callback) {
  const qy = query(collection(db, "rewards"), orderBy("createdAt", "desc"));
  return onSnapshot(qy, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
  });
}


export function subscribeRedemptions({ uid, isManager, callback }) {
  let qy;
  if (isManager) {
    qy = query(
      collection(db, "redemptions"),
      orderBy("createdAt", "desc")
    );
  } else {
    qy = query(
      collection(db, "redemptions"),
      where("userUid", "==", uid),
      orderBy("createdAt", "desc")
    );
  }
  return onSnapshot(qy, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() || {}) })));
  });
}

/** Gestor: criar item no catálogo */
export async function createReward(data) {
  const { name, price, stock, imageUrl } = data;
  await addDoc(collection(db, "rewards"), {
    name: name.trim(),
    price: Number(price),
    stock: Number(stock),
    imageUrl: imageUrl.trim(),
    createdAt: serverTimestamp(),
  });
}

/** Gestor: excluir item do catálogo */
export async function deleteReward(id) {
  await deleteDoc(doc(db, "rewards", id));
}

/** Colaborador: resgatar item */
export async function redeemReward({ user, reward }) {
  await runTransaction(db, async (tx) => {
    const meRef = doc(db, "users", user.uid);
    const meSnap = await tx.get(meRef);
    if (!meSnap.exists()) throw new Error("Usuário não encontrado.");

    const meData = meSnap.data() || {};
    const current = Number(meData.points || 0);
    const price = Number(reward.price || 0);
    if (current < price) throw new Error("Pontos insuficientes.");

    // debita pontos
    tx.update(meRef, { points: current - price });

    // cria resgate pendente
    const redRef = doc(collection(db, "redemptions"));
    tx.set(redRef, {
      rewardId: reward.id,
      rewardName: reward.name,
      rewardPrice: price,
      userUid: user.uid,
      userName: user.name || user.email || "",
      status: "pendente",
      createdAt: serverTimestamp(),
    });
  });
}

/** Gestor: aprovar resgate */
export async function approveRedemption(r) {
  await runTransaction(db, async (tx) => {
    const rRef = doc(db, "redemptions", r.id);
    const rSnap = await tx.get(rRef);
    if (!rSnap.exists()) throw new Error("Resgate não existe mais.");
    const data = rSnap.data();

    if (data.status !== "pendente") {
      throw new Error("Este resgate já foi decidido.");
    }

    // checa estoque do item
    const itRef = doc(db, "rewards", data.rewardId);
    const itSnap = await tx.get(itRef);
    if (!itSnap.exists()) throw new Error("Item não encontrado.");
    const item = itSnap.data();
    const st = Number(item.stock || 0);
    if (st <= 0) throw new Error("Sem estoque. Negue o resgate ou reabasteça.");

    // baixa 1 do estoque e muda status
    tx.update(itRef, { stock: st - 1 });
    tx.update(rRef, { status: "aprovado", decidedAt: serverTimestamp() });
  });
}

/** Gestor: negar resgate e reembolsar pontos */
export async function denyRedemption(r) {
  await runTransaction(db, async (tx) => {
    const rRef = doc(db, "redemptions", r.id);
    const rSnap = await tx.get(rRef);
    if (!rSnap.exists()) throw new Error("Resgate não existe mais.");
    const data = rSnap.data();

    if (data.status !== "pendente") {
      throw new Error("Este resgate já foi decidido.");
    }

    const uRef = doc(db, "users", data.userUid);
    const uSnap = await tx.get(uRef);
    if (!uSnap.exists()) throw new Error("Usuário não encontrado.");
    const curr = Number(uSnap.data()?.points || 0);

    tx.update(uRef, { points: curr + Number(data.rewardPrice || 0) });
    tx.update(rRef, { status: "negado", decidedAt: serverTimestamp() });
  });
}

/** Gestor: marcar resgate como entregue */
export async function markDelivered(rId) {
  await updateDoc(doc(db, "redemptions", rId), {
    status: "entregue",
    decidedAt: serverTimestamp(),
  });
}
