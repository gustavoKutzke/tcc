// src/lib/missions.js
import {
  collection, getDocs, query, where, orderBy, limit
} from "firebase/firestore";
import { startOfWeek, endOfWeek } from "./week";

/**
 * Missões semanais disponíveis.
 */
export const WEEKLY_MISSIONS = [
  {
    key: "kudos_sent_3",
    title: "Espalhe o reconhecimento",
    desc: "Envie 3 kudos nesta semana",
    target: 3,
    reward: 10,
    progressFn: progressKudosSent,
  },
  {
    key: "kudos_received_5",
    title: "Reconhecido pela equipe",
    desc: "Receba 5 kudos nesta semana",
    target: 5,
    reward: 15,
    progressFn: progressKudosReceived,
  },
  {
    key: "goals_done_2",
    title: "Foco nas entregas",
    desc: "Conclua 2 metas nesta semana",
    target: 2,
    reward: 20,
    progressFn: progressGoalsDone,
  },
];

/* ========== Calculadores de progresso (sem precisar de backend) ========== */

async function progressKudosSent(db, uid) {
  const start = startOfWeek();
  const end = endOfWeek();

  // Pega últimos 200 kudos enviados e filtra no cliente pela data
  let snap;
  try {
    snap = await getDocs(
      query(
        collection(db, "kudos"),
        where("fromUid", "==", uid),
        orderBy("createdAt", "desc"),
        limit(200)
      )
    );
  } catch {
    snap = await getDocs(
      query(
        collection(db, "kudos"),
        where("fromUid", "==", uid)
      )
    );
  }

  const rows = snap.docs
    .map(d => d.data() || {})
    .filter(k => k.createdAt?.toDate && k.createdAt.toDate() >= start && k.createdAt.toDate() < end);

  return rows.length;
}

async function progressKudosReceived(db, uid) {
  const start = startOfWeek();
  const end = endOfWeek();

  let snap;
  try {
    snap = await getDocs(
      query(
        collection(db, "kudos"),
        where("toUid", "==", uid),
        orderBy("createdAt", "desc"),
        limit(200)
      )
    );
  } catch {
    snap = await getDocs(
      query(
        collection(db, "kudos"),
        where("toUid", "==", uid)
      )
    );
  }

  const rows = snap.docs
    .map(d => d.data() || {})
    .filter(k => k.createdAt?.toDate && k.createdAt.toDate() >= start && k.createdAt.toDate() < end);

  return rows.length;
}

async function progressGoalsDone(db, uid) {
  const start = startOfWeek();
  const end = endOfWeek();

  let snap;
  try {
    snap = await getDocs(
      query(
        collection(db, "goals"),
        where("ownerUid", "==", uid)
      )
    );
  } catch {
    snap = await getDocs(collection(db, "goals"));
  }

  const rows = snap.docs
    .map(d => d.data() || {})
    .filter(g => g.status === "concluida" && g.completedAt?.toDate)
    .filter(g => {
      const dt = g.completedAt.toDate();
      return dt >= start && dt < end;
    });

  return rows.length;
}
  