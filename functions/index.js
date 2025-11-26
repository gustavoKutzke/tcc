const admin = require("firebase-admin");
admin.initializeApp(); 


const { health } = require("./health");
const { grantXp } = require("./xp");


const { onKudosCreated } = require("./kudos");
const { onGoalUpdated } = require("./goals");
const { onPdiItemUpdated, onPdiPlanUpdated } = require("./pdi");
const { onDiscCreated } = require("./disc");
const { onFeedbackCreated } = require("./feedback");

exports.health = health;
exports.grantXp = grantXp;

exports.onKudosCreated = onKudosCreated;
exports.onGoalUpdated = onGoalUpdated;

exports.onPdiItemUpdated = onPdiItemUpdated;
exports.onPdiPlanUpdated = onPdiPlanUpdated;

exports.onDiscCreated = onDiscCreated;
exports.onFeedbackCreated = onFeedbackCreated;
