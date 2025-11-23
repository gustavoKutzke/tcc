const functions = require("firebase-functions");
const admin = require("firebase-admin");

const db = admin.firestore();

/**
 * grantXp
 * GET  /grantXp?uid=XXX&points=10&source=test
 * POST /grantXp  body { uid, points, source }
 */
exports.grantXp = functions.https.onRequest(async (req, res) => {
  try {
    // Aceita GET (query) ou POST (body)
    const data = req.method === "POST" ? req.body : req.query;

    const uid = data.uid;
    const points = data.points;
    const source = data.source || "backend_manual";

    if (!uid || points == null) {
      return res.status(400).json({ error: "Parâmetros inválidos: uid e points" });
    }

    const numericPoints = Number(points || 0);
    if (!numericPoints) {
      return res.status(400).json({ error: "points precisa ser número ≠ 0" });
    }

    // 1) incrementa XP
    await db.collection("users").doc(uid).update({
      points: admin.firestore.FieldValue.increment(numericPoints),
    });

    // 2) cria log
    await db.collection("xpLog").add({
      uid,
      source,
      basePoints: numericPoints,
      finalPoints: numericPoints,
      appliedMultiplier: 1,
      meta: null,
      isSeasonGoal: false,
      isStreakDay: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.status(200).json({
      ok: true,
      uid,
      points: numericPoints,
      source,
      method: req.method,
    });
  } catch (err) {
    console.error("Erro ao conceder XP:", err);
    return res.status(500).json({ error: "Erro interno" });
  }
});
