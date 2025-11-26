const admin = require("firebase-admin");
const db = admin.firestore();

const { onDocumentUpdated } = require("firebase-functions/v2/firestore");


const XP_VALUES = {
  GOAL_NORMAL: 20,
  GOAL_DIFFICULT: 40,
  GOAL_PDI: 50,
  GOAL_SEASON_BONUS: 10,
};


function computeBaseXpForGoal(goal) {
  const value = Number(goal.points || 0);
  const isPdi = !!goal.isPdi || !!goal.pdiPlanId;
  let xp = 0;

  if (isPdi) xp += XP_VALUES.GOAL_PDI;
  else if (value >= 20) xp += XP_VALUES.GOAL_DIFFICULT;
  else xp += XP_VALUES.GOAL_NORMAL;

  if (goal.seasonKey) xp += XP_VALUES.GOAL_SEASON_BONUS;

  return xp;
}

exports.onGoalUpdated = onDocumentUpdated("goals/{goalId}", async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  if (!before || !after) return;

  const ownerUid = after.ownerUid;
  if (!ownerUid) return;

  const wasOpen = before.status === "aberta";
  const isDone = after.status === "concluida";

  const wasDone = before.status === "concluida";
  const isOpen = after.status === "aberta";

  const baseXp = computeBaseXpForGoal(after);
  if (!baseXp) return;

  const userRef = db.collection("users").doc(ownerUid);
  const logRef = db.collection("xpLog");

  //  caso 1: aberta -> concluída
  if (wasOpen && isDone && !before.completedAt && after.completedAt) {
    await userRef.update({
      points: admin.firestore.FieldValue.increment(baseXp),
    });

    await logRef.add({
      uid: ownerUid,
      source: "goal_completed",
      basePoints: baseXp,
      finalPoints: baseXp,
      appliedMultiplier: 1,
      meta: { goalId: event.params.goalId },
      isSeasonGoal: !!after.seasonKey,
      isStreakDay: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return;
  }

  //  caso 2: concluída -> aberta (reabriu)
  if (wasDone && isOpen && before.completedAt && !after.completedAt) {
    const penalty = -Math.abs(baseXp);

    await userRef.update({
      points: admin.firestore.FieldValue.increment(penalty),
    });

    await logRef.add({
      uid: ownerUid,
      source: "goal_reopen",
      basePoints: penalty,
      finalPoints: penalty,
      appliedMultiplier: 1,
      meta: { goalId: event.params.goalId },
      isSeasonGoal: !!after.seasonKey,
      isStreakDay: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return;
  }
});
