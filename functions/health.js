const functions = require("firebase-functions");

exports.health = functions.https.onRequest((req, res) => {
  res.status(200).json({
    status: "ok",
    backend: "firebase-functions",
    timestamp: Date.now(),
  });
});
