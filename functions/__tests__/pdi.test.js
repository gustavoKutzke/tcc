// Mock do firebase-admin para não precisar de initializeApp()
jest.mock("firebase-admin", () => {
  const FieldValue = {
    increment: (value) => ({ __op: "increment", value }),
    serverTimestamp: () => ({ __op: "serverTimestamp" }),
  };

  return {
    firestore: () => ({
      // não usamos esse db global nos testes, mas precisa existir
      collection: jest.fn(),
      FieldValue,
    }),
  };
});

// Mock do firebase-functions/v2/firestore (evita dependência real)
jest.mock("firebase-functions/v2/firestore", () => ({
  onDocumentUpdated: jest.fn((path, handler) => handler),
}));

// Agora podemos importar o pdi.js com segurança
const { _test } = require("../pdi");

const {
  isDoneStatus,
  handlePdiItemUpdated,
  handlePdiPlanUpdated,
  XP_VALUES,
} = _test;

// helpers para criar stubs de FieldValue
function makeFieldValue() {
  return {
    increment: (value) => ({ __op: "increment", value }),
    serverTimestamp: () => ({ __op: "serverTimestamp" }),
  };
}

function makeDeps(overrides = {}) {
  const fieldValue = makeFieldValue();

  const usersUpdate = jest.fn();
  const xpLogAdd = jest.fn();
  const pdiPlansDocGet = jest.fn();

  const db = {
    collection: jest.fn((name) => {
      if (name === "users") {
        return {
          doc: jest.fn(() => ({ update: usersUpdate })),
        };
      }
      if (name === "xpLog") {
        return {
          add: xpLogAdd,
        };
      }
      if (name === "pdiPlans") {
        return {
          doc: jest.fn(() => ({ get: pdiPlansDocGet })),
        };
      }
      throw new Error("Unexpected collection: " + name);
    }),
  };

  const admin = {
    firestore: {
      FieldValue: fieldValue,
    },
  };

  return {
    db,
    admin,
    usersUpdate,
    xpLogAdd,
    pdiPlansDocGet,
    fieldValue,
    ...overrides,
  };
}

function makeEvent(beforeData, afterData, params = {}) {
  return {
    params: {
      planId: "plan1",
      itemId: "item1",
      ...params,
    },
    data: {
      before: {
        data: () => beforeData,
      },
      after: {
        data: () => afterData,
        ref: {
          update: jest.fn(),
        },
      },
    },
  };
}

describe("isDoneStatus", () => {
  test("reconhece status concluído em diferentes formatos", () => {
    expect(isDoneStatus("Concluída")).toBe(true);
    expect(isDoneStatus("concluida")).toBe(true);
    expect(isDoneStatus("  CONCLUÍDA  ")).toBe(true);
  });

  test("retorna false para outros status", () => {
    expect(isDoneStatus("Em andamento")).toBe(false);
    expect(isDoneStatus("Não iniciada")).toBe(false);
    expect(isDoneStatus(null)).toBe(false);
  });
});

describe("handlePdiItemUpdated", () => {
  test("aplica XP quando item muda para concluído pela primeira vez", async () => {
    const deps = makeDeps();
    const before = { status: "Em andamento" };
    const after = { status: "Concluída" };

    const event = makeEvent(before, after);

    // plano existente com ownerUid
    deps.pdiPlansDocGet.mockResolvedValue({
      exists: true,
      data: () => ({ ownerUid: "user123" }),
    });

    await handlePdiItemUpdated(event, deps);

    // deve atualizar pontos do usuário
    expect(deps.usersUpdate).toHaveBeenCalledTimes(1);
    expect(deps.usersUpdate.mock.calls[0][0]).toEqual({
      points: deps.fieldValue.increment(XP_VALUES.PDI_ITEM_COMPLETED),
    });

    // deve registrar log
    expect(deps.xpLogAdd).toHaveBeenCalledTimes(1);
    const logPayload = deps.xpLogAdd.mock.calls[0][0];
    expect(logPayload.uid).toBe("user123");
    expect(logPayload.source).toBe("pdi_item_completed");

    // deve marcar item como premiado
    expect(event.data.after.ref.update).toHaveBeenCalledTimes(1);
  });

  test("não aplica XP se já estava concluído antes", async () => {
    const deps = makeDeps();
    const before = { status: "Concluída" };
    const after = { status: "Concluída" };

    const event = makeEvent(before, after);

    await handlePdiItemUpdated(event, deps);

    expect(deps.usersUpdate).not.toHaveBeenCalled();
    expect(deps.xpLogAdd).not.toHaveBeenCalled();
    expect(event.data.after.ref.update).not.toHaveBeenCalled();
  });

  test("não aplica XP se item já tinha doneAt", async () => {
    const deps = makeDeps();
    const before = { status: "Em andamento" };
    const after = { status: "Concluída", doneAt: { some: "value" } };

    const event = makeEvent(before, after);

    await handlePdiItemUpdated(event, deps);

    expect(deps.usersUpdate).not.toHaveBeenCalled();
    expect(deps.xpLogAdd).not.toHaveBeenCalled();
  });
});

describe("handlePdiPlanUpdated", () => {
  function makePlanEvent(beforeData, afterData, params = {}) {
    return {
      params: {
        planId: "plan1",
        ...params,
      },
      data: {
        before: { data: () => beforeData },
        after: {
          data: () => afterData,
          ref: { update: jest.fn() },
        },
      },
    };
  }

  test("aplica XP quando progresso cruza 100%", async () => {
    const deps = makeDeps();
    const before = { ownerUid: "user123", progress: 80, xpAppliedPlan: false };
    const after = { ownerUid: "user123", progress: 100, xpAppliedPlan: false };

    const event = makePlanEvent(before, after);

    await handlePdiPlanUpdated(event, deps);

    expect(deps.usersUpdate).toHaveBeenCalledTimes(1);
    expect(deps.usersUpdate.mock.calls[0][0]).toEqual({
      points: deps.fieldValue.increment(XP_VALUES.PDI_PLAN_COMPLETED),
    });

    expect(deps.xpLogAdd).toHaveBeenCalledTimes(1);
    const logPayload = deps.xpLogAdd.mock.calls[0][0];
    expect(logPayload.uid).toBe("user123");
    expect(logPayload.source).toBe("pdi_plan_completed");

    expect(event.data.after.ref.update).toHaveBeenCalledTimes(1);
  });

  test("não aplica XP se progresso já era >= 100", async () => {
    const deps = makeDeps();
    const before = { ownerUid: "user123", progress: 100, xpAppliedPlan: false };
    const after = { ownerUid: "user123", progress: 100, xpAppliedPlan: false };

    const event = makePlanEvent(before, after);

    await handlePdiPlanUpdated(event, deps);

    expect(deps.usersUpdate).not.toHaveBeenCalled();
    expect(deps.xpLogAdd).not.toHaveBeenCalled();
  });

  test("não aplica XP se xpAppliedPlan já for true", async () => {
    const deps = makeDeps();
    const before = { ownerUid: "user123", progress: 80, xpAppliedPlan: true };
    const after = { ownerUid: "user123", progress: 100, xpAppliedPlan: true };

    const event = makePlanEvent(before, after);

    await handlePdiPlanUpdated(event, deps);

    expect(deps.usersUpdate).not.toHaveBeenCalled();
    expect(deps.xpLogAdd).not.toHaveBeenCalled();
  });
});
