const admin = require("firebase-admin");
const db = admin.firestore();
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");

const XP_VALUES = {
  PDI_ITEM_COMPLETED: 10,
  PDI_PLAN_COMPLETED: 50,
};

/**
 * Normaliza o status para comparação:
 * - remove acentos
 * - converte para minúsculas
 * - remove espaços extras
 */
function isDoneStatus(status) {
  if (!status) return false;

  const normalized = String(status)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  return normalized === "concluida";
}

/**
 * Handler puro para o trigger de item de PDI.
 * Exportado via _test para facilitar testes unitários.
 */
async function handlePdiItemUpdated(event, deps = { db, admin }) {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!before || !after) return;

  const wasDone = isDoneStatus(before.status);
  const isDone = isDoneStatus(after.status);

  // Só dispara quando muda de "não concluída" para "concluída"
  if (wasDone || !isDone) return;

  // Se já tiver doneAt, significa que o XP desse item já foi aplicado
  if (after.doneAt) return;

  const planId = event.params.planId;

  // Descobre o dono do plano
  const planSnap = await deps.db.collection("pdiPlans").doc(planId).get();
  const plan = planSnap.exists ? planSnap.data() : null;
  if (!plan || !plan.ownerUid) return;

  const uid = plan.ownerUid;

  // Incrementa pontos do dono do plano
  await deps.db.collection("users").doc(uid).update({
    points: deps.admin.firestore.FieldValue.increment(
      XP_VALUES.PDI_ITEM_COMPLETED
    ),
  });

  // Log de XP
  await deps.db.collection("xpLog").add({
    uid,
    source: "pdi_item_completed",
    basePoints: XP_VALUES.PDI_ITEM_COMPLETED,
    finalPoints: XP_VALUES.PDI_ITEM_COMPLETED,
    appliedMultiplier: 1,
    meta: { planId, itemId: event.params.itemId },
    isSeasonGoal: false,
    isStreakDay: false,
    createdAt: deps.admin.firestore.FieldValue.serverTimestamp(),
  });

  // Marca o item como já premiado
  await event.data.after.ref.update({
    doneAt: deps.admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Handler puro para o trigger de plano de PDI.
 * Dá XP quando o progresso cruza de <100 para >=100.
 */
async function handlePdiPlanUpdated(event, deps = { db, admin }) {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!before || !after) return;

  const uid = after.ownerUid;
  if (!uid) return;

  const beforeProg = Number(before.progress || 0);
  const afterProg = Number(after.progress || 0);

  // Só dispara quando cruza de <100 pra >=100
  if (beforeProg >= 100 || afterProg < 100) return;

  // Evita aplicar XP do plano mais de uma vez
  if (after.xpAppliedPlan) return;

  // Aplica XP do plano concluído
  await deps.db.collection("users").doc(uid).update({
    points: deps.admin.firestore.FieldValue.increment(
      XP_VALUES.PDI_PLAN_COMPLETED
    ),
  });

  await deps.db.collection("xpLog").add({
    uid,
    source: "pdi_plan_completed",
    basePoints: XP_VALUES.PDI_PLAN_COMPLETED,
    finalPoints: XP_VALUES.PDI_PLAN_COMPLETED,
    appliedMultiplier: 1,
    meta: { planId: event.params.planId },
    isSeasonGoal: false,
    isStreakDay: false,
    createdAt: deps.admin.firestore.FieldValue.serverTimestamp(),
  });

  await event.data.after.ref.update({
    xpAppliedPlan: true,
    pdiLastCompletedAt: deps.admin.firestore.FieldValue.serverTimestamp(),
    pdiPlansCompleted: deps.admin.firestore.FieldValue.increment(1),
  });
}

// Triggers reais usados pelo Firebase
exports.onPdiItemUpdated = onDocumentUpdated(
  "pdiPlans/{planId}/items/{itemId}",
  (event) => handlePdiItemUpdated(event)
);

exports.onPdiPlanUpdated = onDocumentUpdated(
  "pdiPlans/{planId}",
  (event) => handlePdiPlanUpdated(event)
);

// Exportações auxiliares para testes unitários
exports._test = {
  isDoneStatus,
  handlePdiItemUpdated,
  handlePdiPlanUpdated,
  XP_VALUES,
};
