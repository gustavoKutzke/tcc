const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const db = admin.firestore();

exports.onKudosCreated = onDocumentCreated("kudos/{kudosId}", async (event) => {
  const kudos = event.data?.data();
  if (!kudos) return;

  const { toUid, value, fromUid } = kudos;
  const numericValue = Number(value || 0);

  if (!toUid || !numericValue) return;

  // XP do recebedor (backend)
  await db.collection("users").doc(toUid).update({
    points: admin.firestore.FieldValue.increment(numericValue * 2),
  });

  await db.collection("xpLog").add({
    uid: toUid,
    source: "kudos_received",
    basePoints: numericValue * 2,
    finalPoints: numericValue * 2,
    appliedMultiplier: 1,
    meta: { fromUid, kudosId: event.params.kudosId },
    isSeasonGoal: false,
    isStreakDay: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
});
