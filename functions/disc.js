const admin = require("firebase-admin");
const db = admin.firestore();

const { onDocumentCreated } = require("firebase-functions/v2/firestore");

const XP_VALUES = {
  DISC_FIRST_RESULT: 100,
};

exports.onDiscCreated = onDocumentCreated(
  "discResults/{resultId}",
  async (event) => {
    const data = event.data.data();
    if (!data?.ownerUid) return;

    const uid = data.ownerUid;

    // checa se já tinha DISC antes
    const prev = await db
      .collection("discResults")
      .where("ownerUid", "==", uid)
      .limit(2)
      .get();

    if (prev.size > 1) return; // já existia → não dá XP

    await db.collection("users").doc(uid).update({
      points: admin.firestore.FieldValue.increment(XP_VALUES.DISC_FIRST_RESULT),
    });

    await db.collection("xpLog").add({
      uid,
      source: "disc_completed",
      basePoints: XP_VALUES.DISC_FIRST_RESULT,
      finalPoints: XP_VALUES.DISC_FIRST_RESULT,
      appliedMultiplier: 1,
      meta: { resultId: event.params.resultId },
      isSeasonGoal: false,
      isStreakDay: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);
