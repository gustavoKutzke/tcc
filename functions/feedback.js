const admin = require("firebase-admin");
const db = admin.firestore();

const { onDocumentCreated } = require("firebase-functions/v2/firestore");

const XP_VALUES = {
  FEEDBACK_RECEIVED: 5,
  FEEDBACK_SENT: 8,
};

exports.onFeedbackCreated = onDocumentCreated(
  "feedbacks/{feedbackId}",
  async (event) => {
    const data = event.data.data();
    if (!data) return;

    const managerUid = data.managerUid;
    const collaboratorUid = data.collaboratorUid;

    if (!managerUid || !collaboratorUid) return;

    // gestor recebe XP
    await db.collection("users").doc(managerUid).update({
      points: admin.firestore.FieldValue.increment(XP_VALUES.FEEDBACK_SENT),
    });

    await db.collection("xpLog").add({
      uid: managerUid,
      source: "feedback_sent",
      basePoints: XP_VALUES.FEEDBACK_SENT,
      finalPoints: XP_VALUES.FEEDBACK_SENT,
      appliedMultiplier: 1,
      meta: { feedbackId: event.params.feedbackId },
      isSeasonGoal: false,
      isStreakDay: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // colaborador recebe XP
    await db.collection("users").doc(collaboratorUid).update({
      points: admin.firestore.FieldValue.increment(XP_VALUES.FEEDBACK_RECEIVED),
    });

    await db.collection("xpLog").add({
      uid: collaboratorUid,
      source: "feedback_received",
      basePoints: XP_VALUES.FEEDBACK_RECEIVED,
      finalPoints: XP_VALUES.FEEDBACK_RECEIVED,
      appliedMultiplier: 1,
      meta: { feedbackId: event.params.feedbackId },
      isSeasonGoal: false,
      isStreakDay: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);
