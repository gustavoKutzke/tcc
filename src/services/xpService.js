// src/services/xpService.js
import { db } from "../lib/firebase";
import {
  collection,
  doc,
  addDoc,
  increment,
  serverTimestamp,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit as limitFn,
} from "firebase/firestore";
import { computeEffectivePoints } from "../lib/gamification";

/**
  TABELA CENTRAL DE XP
 */
export const XP_VALUES = {
  
  GOAL_NORMAL: 20,
  GOAL_DIFFICULT: 40,
  GOAL_PDI: 50,
  GOAL_SEASON_BONUS: 10,

 
  DAILY_MISSIONS_ALL_DONE: 10,
  WEEKLY_MISSIONS_ALL_DONE: 30,

  
  KUDOS_RECEIVED_PER_POINT: 2,
  KUDOS_SENT_BONUS: 5,

  
  FEEDBACK_RECEIVED: 5,
  FEEDBACK_SENT: 8,

  
  PDI_ITEM_COMPLETED: 10,
  PDI_PLAN_COMPLETED: 50,

  
  DISC_FIRST_RESULT: 100,

  
  CUSTOM_DEFAULT: 5,
};


export const XP_SOURCES = {
  GOAL_COMPLETED: "goal_completed",
  GOAL_COMPLETE: "goal_completed", 
  GOAL_REOPEN: "goal_reopen",

  KUDOS_RECEIVED: "kudos_received",
  KUDOS_SENT: "kudos_sent",

  FEEDBACK_RECEIVED: "feedback_received",
  FEEDBACK_SENT: "feedback_sent",

  DAILY_MISSIONS: "daily_missions",
  WEEKLY_MISSIONS: "weekly_missions",

  PDI_COMPLETED: "pdi_completed",
  DISC_COMPLETED: "disc_completed",

  CUSTOM: "custom",
};


async function incrementUserPoints(uid, delta) {
  if (!uid || !delta) return;
  const ref = doc(db, "users", uid);
  await updateDoc(ref, {
    points: increment(delta),
  });
}

/** Registra log */
async function logXp({
  uid,
  source,
  basePoints,
  finalPoints,
  appliedMultiplier,
  meta,
  isSeasonGoal,
  isStreakDay,
}) {
  const col = collection(db, "xpLog");
  await addDoc(col, {
    uid,
    source,
    basePoints,
    finalPoints,
    appliedMultiplier,
    meta: meta || null,
    isSeasonGoal: !!isSeasonGoal,
    isStreakDay: !!isStreakDay,
    createdAt: serverTimestamp(),
  });
}


function emitXpToast({ uid, source, points, basePoints, appliedMultiplier, meta }) {
  try {
    if (typeof window === "undefined") return;
    if (!points || points <= 0) return;

    const detail = {
      uid,
      source,
      points,
      basePoints,
      appliedMultiplier,
      meta: meta || null,
      createdAt: Date.now(),
    };

   
    window.dispatchEvent(new CustomEvent("xp-earned", { detail }));
  } catch {
   
  }
}


export async function awardXpToUser({
  uid,
  basePoints,
  amount,
  source = XP_SOURCES.CUSTOM,
  meta,
  metadata,
  isSeasonGoal = false,
  isStreakDay = false,
}) {
  const rawBase =
    basePoints != null ? basePoints : amount != null ? amount : 0;
  const numericBase = Number(rawBase || 0);

  if (!uid || !numericBase) {
    return { finalPoints: 0, appliedMultiplier: 1 };
  }

  const fullMeta = meta ?? metadata ?? null;

  // Vou computar os dados entre Padrão - se é Uma Streak ou por temporada
  const { finalPoints, appliedMultiplier } = computeEffectivePoints(
    numericBase,
    { isSeasonGoal, isStreakDay }
  );

  
  const safeFinal = finalPoints || numericBase;

  await incrementUserPoints(uid, safeFinal);
  await logXp({
    uid,
    source,
    basePoints: numericBase,
    finalPoints: safeFinal,
    appliedMultiplier,
    meta: fullMeta,
    isSeasonGoal,
    isStreakDay,
  });

  console.log("[XP] awardXpToUser:", {
    uid,
    source,
    basePoints: numericBase,
    finalPoints: safeFinal,
  });

  
  emitXpToast({
    uid,
    source,
    points: safeFinal,
    basePoints: numericBase,
    appliedMultiplier,
    meta: fullMeta,
  });

  return { finalPoints: safeFinal, appliedMultiplier };
}

/* 
  HISTÓRICO DE XP ( aba Evolução)
 */

export function listenXpHistory(uid, callback, { limit = 50 } = {}) {
  if (!uid) return () => {};

  const q = query(
    collection(db, "xpLog"),
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
    limitFn(limit)
  );

  const unsub = onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() || {}),
    }));
    callback(list);
  });

  return unsub;
}

// Meta concluída
export async function grantGoalCompletionXp({
  uid,
  basePoints,
  meta,
  isSeasonGoal = false,
  isStreakDay = false,
}) {
  const bp =
    basePoints != null ? Number(basePoints) : XP_VALUES.GOAL_NORMAL;
  return awardXpToUser({
    uid,
    basePoints: bp,
    source: XP_SOURCES.GOAL_COMPLETED,
    meta,
    isSeasonGoal,
    isStreakDay,
  });
}

// Penalidade ao reabrir meta
export async function grantGoalReopenPenalty({
  uid,
  basePoints,
  meta,
}) {
  const bp =
    basePoints != null ? Number(basePoints) : XP_VALUES.GOAL_NORMAL;
  return awardXpToUser({
    uid,
    basePoints: -Math.abs(bp),
    source: XP_SOURCES.GOAL_REOPEN,
    meta,
  });
}

// Kudos recebidos
export async function grantKudosReceivedXp({ uid, value, meta }) {
  const bp = Number(value || 0) * XP_VALUES.KUDOS_RECEIVED_PER_POINT;
  if (!bp) return { finalPoints: 0, appliedMultiplier: 1 };
  return awardXpToUser({
    uid,
    basePoints: bp,
    source: XP_SOURCES.KUDOS_RECEIVED,
    meta,
  });
}

// bônus ao enviar kudos
export async function grantKudosSentXp({ uid, meta }) {
  return awardXpToUser({
    uid,
    basePoints: XP_VALUES.KUDOS_SENT_BONUS,
    source: XP_SOURCES.KUDOS_SENT,
    meta,
  });
}

// Feedback recebido
export async function grantFeedbackReceivedXp({ uid, meta }) {
  return awardXpToUser({
    uid,
    basePoints: XP_VALUES.FEEDBACK_RECEIVED,
    source: XP_SOURCES.FEEDBACK_RECEIVED,
    meta,
  });
}

// Feedback enviado
export async function grantFeedbackSentXp({ uid, meta }) {
  return awardXpToUser({
    uid,
    basePoints: XP_VALUES.FEEDBACK_SENT,
    source: XP_SOURCES.FEEDBACK_SENT,
    meta,
  });
}

// Todas missões diárias concluídas
export async function grantDailyMissionsXp({ uid, meta }) {
  return awardXpToUser({
    uid,
    basePoints: XP_VALUES.DAILY_MISSIONS_ALL_DONE,
    source: XP_SOURCES.DAILY_MISSIONS,
    meta,
  });
}

// Missões semanais concluídas
export async function grantWeeklyMissionsXp({ uid, meta }) {
  return awardXpToUser({
    uid,
    basePoints: XP_VALUES.WEEKLY_MISSIONS_ALL_DONE,
    source: XP_SOURCES.WEEKLY_MISSIONS,
    meta,
  });
}

// PDI concluído (plano)
export async function grantPdiCompletedXp({ uid, meta }) {
  return awardXpToUser({
    uid,
    basePoints: XP_VALUES.PDI_PLAN_COMPLETED,
    source: XP_SOURCES.PDI_COMPLETED,
    meta,
  });
}

// XP por item de PDI concluído
export async function grantPdiItemCompletedXp({
  uid,
  delta = 1,
  meta,
}) {
  if (!delta) return { finalPoints: 0, appliedMultiplier: 1 };
  return awardXpToUser({
    uid,
    basePoints: XP_VALUES.PDI_ITEM_COMPLETED * delta,
    source: XP_SOURCES.PDI_COMPLETED,
    meta,
  });
}

// DISC – primeira conclusão
export async function grantDiscFirstResultXp({ uid, meta }) {
  return awardXpToUser({
    uid,
    basePoints: XP_VALUES.DISC_FIRST_RESULT,
    source: XP_SOURCES.DISC_COMPLETED,
    meta,
  });
}

// XP totalmente customizado se precisar utilizar
export async function grantCustomXp({
  uid,
  basePoints,
  meta,
  source = XP_SOURCES.CUSTOM,
  isSeasonGoal = false,
  isStreakDay = false,
}) {
  const bp =
    basePoints != null ? Number(basePoints) : XP_VALUES.CUSTOM_DEFAULT;
  return awardXpToUser({
    uid,
    basePoints: bp,
    source,
    meta,
    isSeasonGoal,
    isStreakDay,
  });
}
