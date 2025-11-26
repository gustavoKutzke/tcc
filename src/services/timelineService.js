// src/services/timelineService.js
import { db } from "../lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { computeBadges } from "../lib/gamification";


export async function fetchCurrentUserForTimeline(uid) {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      return { uid, role: "colaborador" };
    }
    return { uid, ...(snap.data() || {}) };
  } catch (e) {
    console.error("fetchCurrentUserForTimeline error:", e);
    return { uid, role: "colaborador" };
  }
}


export function subscribeCollaborators(callback) {
  const qUsers = query(
    collection(db, "users"),
    where("role", "==", "colaborador"),
    orderBy("name")
  );
  return onSnapshot(qUsers, (snap) => {
    callback(snap.docs.map((d) => ({ uid: d.id, ...(d.data() || {}) })));
  });
}

/** Buscar eventos da Timeline de um colaborador no mês */
export async function fetchTimelineEvents({ subjectUid, monthKey, start, end }) {
  if (!subjectUid || !monthKey || !start || !end) return [];

  const list = [];

  //Metas concluídas no mês
  const qGoals = query(
    collection(db, "goals"),
    where("ownerUid", "==", subjectUid)
  );
  const gSnap = await getDocs(qGoals);
  gSnap.forEach((docu) => {
    const g = docu.data() || {};
    if (g.status !== "concluida") return;
    const t = g.completedAt?.toDate ? g.completedAt.toDate() : null;
    if (!t || t < start || t >= end) return;
    list.push({
      type: "goal_done",
      at: t,
      title: g.title || "Meta",
      points: Number(g.points || 0),
      desc: g.description || "",
    });
  });

  // Kudos recebidos no mês
  const qKIn = query(
    collection(db, "kudos"),
    where("toUid", "==", subjectUid),
    where("monthKey", "==", monthKey)
  );
  const kinSnap = await getDocs(qKIn);
  kinSnap.forEach((d) => {
    const k = d.data() || {};
    const t = k.createdAt?.toDate ? k.createdAt.toDate() : null;
    if (!t) return;
    list.push({
      type: "kudos_in",
      at: t,
      fromName: k.fromName || "—",
      fromUid: k.fromUid,
      value: Number(k.value || 0),
      message: k.message || "",
    });
  });

  //Kudos enviados no mês
  const qKOut = query(
    collection(db, "kudos"),
    where("fromUid", "==", subjectUid),
    where("monthKey", "==", monthKey)
  );
  const koutSnap = await getDocs(qKOut);
  koutSnap.forEach((d) => {
    const k = d.data() || {};
    const t = k.createdAt?.toDate ? k.createdAt.toDate() : null;
    if (!t) return;
    list.push({
      type: "kudos_out",
      at: t,
      toName: k.toName || "—",
      toUid: k.toUid,
      value: Number(k.value || 0),
      message: k.message || "",
    });
  });

  // Feedbacks recebidos no mês 
  const qFb = query(
    collection(db, "feedbacks"),
    where("collaboratorUid", "==", subjectUid)
  );
  const fbSnap = await getDocs(qFb);
  fbSnap.forEach((d) => {
    const f = d.data() || {};
    const t = f.createdAt?.toDate ? f.createdAt.toDate() : null;
    if (!t || t < start || t >= end) return;
    list.push({
      type: "feedback_in",
      at: t,
      department: f.department || "",
      managerName: f.managerName || "",
    });
  });

  // Conquistas
  const allGoalsSnap = await getDocs(
    query(collection(db, "goals"), where("ownerUid", "==", subjectUid))
  );
  const allGoals = allGoalsSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() || {}),
  }));

  const uDoc = await getDoc(doc(db, "users", subjectUid));
  const uData = uDoc.exists() ? uDoc.data() || {} : {};

  const totalPoints = Number(uData.points || 0);
  const pdiItemsCompleted = Number(uData.pdiItemsCompleted || 0);
  const pdiPlansCompleted = Number(uData.pdiPlansCompleted || 0);
  const pdiLastCompletedAt = uData.pdiLastCompletedAt?.toDate
    ? uData.pdiLastCompletedAt.toDate()
    : null;

  const allBadges = computeBadges({
    totalPoints,
    goals: allGoals,
    pdiItemsCompleted,
    pdiPlansCompleted,
  });

  if (allBadges.length > 0) {
    // metas concluídas no mês
    const monthGoalsDone = allGoals.filter(
      (g) =>
        g.status === "concluida" &&
        g.completedAt?.toDate &&
        g.completedAt.toDate() >= start &&
        g.completedAt.toDate() < end
    );

    let badgeDate = null;

    if (monthGoalsDone.length > 0) {
      
      badgeDate =
        monthGoalsDone[monthGoalsDone.length - 1].completedAt.toDate();
    } else if (pdiLastCompletedAt && pdiLastCompletedAt >= start && pdiLastCompletedAt < end) {
      
      badgeDate = pdiLastCompletedAt;
    }

    if (badgeDate) {
      allBadges.forEach((b) => {
        list.push({
          type: "badge",
          at: badgeDate,
          badge: b,
        });
      });
    }
  }

  
  list.sort((a, b) => b.at - a.at);
  return list;
}
