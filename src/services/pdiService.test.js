// src/services/pdiService.test.js
import {
  listenCollaborators,
  listenPdiPlanForUser,
  listenPdiPlanByOwnerUid,
  listenPdiItems,
  savePdiHeader,
  calculateProgressFromItems,
  syncPlanProgress,
  createPdiItem,
  duplicatePdiItem,
  deletePdiItem,
  updatePdiItem,
} from "./pdiService";


jest.mock("../lib/firebase", () => ({
  auth: {},
  db: {},
}));

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  addDoc: jest.fn(),
  collection: jest.fn(() => "COL_REF"),
  deleteDoc: jest.fn(),
  doc: jest.fn(() => "DOC_REF"),
  getDoc: jest.fn(),
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(() => "Q_REF"),
  serverTimestamp: jest.fn(),
  updateDoc: jest.fn(),
  where: jest.fn(),
}));

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

describe("pdiService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

 
  test("listenCollaborators monta query e converte docs", () => {
    const cb = jest.fn();

    onSnapshot.mockImplementation((_q, handler) => {
      const snap = {
        docs: [
          { id: "c1", data: () => ({ name: "A" }) },
          { id: "c2", data: () => ({ name: "B" }) },
        ],
      };
      handler(snap);
      return "UNSUB_COLLABS";
    });

    const unsub = listenCollaborators(cb);

    expect(collection).toHaveBeenCalledWith(expect.anything(), "users");
    expect(where).toHaveBeenCalledWith("role", "==", "colaborador");
    expect(orderBy).toHaveBeenCalledWith("name");

    expect(cb).toHaveBeenCalledWith([
      { uid: "c1", name: "A" },
      { uid: "c2", name: "B" },
    ]);
    expect(unsub).toBe("UNSUB_COLLABS");
  });

 

  test("listenPdiPlanForUser retorna noop e null se subjectUid vazio", () => {
    const cb = jest.fn();
    const unsub = listenPdiPlanForUser("", cb);

    expect(cb).toHaveBeenCalledWith(null);
    expect(typeof unsub).toBe("function");
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  test("listenPdiPlanForUser retorna null se snapshot estiver vazio", () => {
    const cb = jest.fn();

    onSnapshot.mockImplementation((_q, handler) => {
      handler({ empty: true, docs: [] });
      return "UNSUB_PLAN";
    });

    const unsub = listenPdiPlanForUser("u1", cb);

    expect(collection).toHaveBeenCalledWith(expect.anything(), "pdiPlans");
    expect(where).toHaveBeenCalledWith("ownerUid", "==", "u1");
    expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
    expect(cb).toHaveBeenCalledWith(null);
    expect(unsub).toBe("UNSUB_PLAN");
  });

  test("listenPdiPlanForUser retorna o primeiro plano quando existir", () => {
    const cb = jest.fn();

    onSnapshot.mockImplementation((_q, handler) => {
      const snap = {
        empty: false,
        docs: [
          { id: "plan1", data: () => ({ ownerUid: "u1", profile: "Dev" }) },
          { id: "plan2", data: () => ({ ownerUid: "u1", profile: "Outra" }) },
        ],
      };
      handler(snap);
      return "UNSUB_PLAN";
    });

    listenPdiPlanForUser("u1", cb);

    expect(cb).toHaveBeenCalledWith({
      id: "plan1",
      ownerUid: "u1",
      profile: "Dev",
    });
  });

  test("listenPdiPlanByOwnerUid é alias de listenPdiPlanForUser", () => {
    expect(listenPdiPlanByOwnerUid).toBe(listenPdiPlanForUser);
  });

 

  test("listenPdiItems retorna noop e [] se planId vazio", () => {
    const cb = jest.fn();
    const unsub = listenPdiItems("", cb);

    expect(cb).toHaveBeenCalledWith([]);
    expect(typeof unsub).toBe("function");
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  test("listenPdiItems escuta itens e converte docs", () => {
    const cb = jest.fn();

    onSnapshot.mockImplementation((_q, handler) => {
      const snap = {
        docs: [
          { id: "i1", data: () => ({ status: "nao_iniciada" }) },
          { id: "i2", data: () => ({ status: "concluida" }) },
        ],
      };
      handler(snap);
      return "UNSUB_ITEMS";
    });

    const unsub = listenPdiItems("plan1", cb);

    expect(collection).toHaveBeenCalledWith(
      expect.anything(),
      "pdiPlans",
      "plan1",
      "items"
    );
    expect(orderBy).toHaveBeenCalledWith("order", "asc");

    expect(cb).toHaveBeenCalledWith([
      { id: "i1", status: "nao_iniciada" },
      { id: "i2", status: "concluida" },
    ]);
    expect(unsub).toBe("UNSUB_ITEMS");
  });

  

  test("savePdiHeader lança erro se não tiver ownerUid/subjectUid", async () => {
    await expect(
      savePdiHeader({
        profile: "Dev",
      })
    ).rejects.toThrow("ownerUid/subjectUid obrigatório");
  });

  test("savePdiHeader cria novo plano quando não há planId", async () => {
    serverTimestamp.mockReturnValue("NOW");
    addDoc.mockResolvedValue({ id: "NEW_PLAN" });

    const id = await savePdiHeader({
      ownerUid: "u1",
      ownerName: "Colaborador",
      profile: " Dev ",
      roleTitle: " Eng ",
      managerName: " Gestor ",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      followUp: "Mensal",
    });

    expect(id).toBe("NEW_PLAN");
    expect(addDoc).toHaveBeenCalledTimes(1);

    const payload = addDoc.mock.calls[0][1];
    expect(payload).toMatchObject({
      ownerUid: "u1",
      ownerName: "Colaborador",
      collaboratorName: "Colaborador",
      profile: "Dev",
      roleTitle: "Eng",
      managerName: "Gestor",
      startDate: "2025-01-01",
      endDate: "2025-12-31",
      followUp: "Mensal",
      progress: 0,
    });
  });

  test("savePdiHeader atualiza plano existente quando planId é fornecido", async () => {
    serverTimestamp.mockReturnValue("NOW");

    const id = await savePdiHeader({
      planId: "PLAN_1",
      subjectUid: "u1",
      subjectDisplayName: "Nome",
      profile: " Perfil ",
    });

    expect(id).toBe("PLAN_1");
    expect(updateDoc).toHaveBeenCalledTimes(1);

    const payload = updateDoc.mock.calls[0][1];
    expect(payload).toMatchObject({
      ownerUid: "u1",
      ownerName: "Nome",
      collaboratorName: "Nome",
      profile: "Perfil",
    });
  });

 

  test("calculateProgressFromItems retorna 0 para lista vazia", () => {
    expect(calculateProgressFromItems([])).toBe(0);
  });

  test("calculateProgressFromItems calcula % de concluídas com arredondamento", () => {
    const items = [
      { status: "concluida" },
      { status: "em_andamento" },
      { status: "concluida" },
    ];
    const pct = calculateProgressFromItems(items);
    expect(pct).toBe(67); // 2/3 -> 66.66 -> 67
  });

  test("syncPlanProgress retorna 0 se planId for falsy e não chama updateDoc", async () => {
    const result = await syncPlanProgress("", [{ status: "concluida" }]);

    expect(result).toBe(0);
    expect(updateDoc).not.toHaveBeenCalled();
  });

  test("syncPlanProgress recalcula progresso e atualiza plano", async () => {
    serverTimestamp.mockReturnValue("NOW");
    const items = [
      { status: "concluida" },
      { status: "em_andamento" },
      { status: "concluida" },
    ];

    const pct = await syncPlanProgress("PLAN_X", items);

    expect(pct).toBe(67);
    expect(updateDoc).toHaveBeenCalledTimes(1);

    const payload = updateDoc.mock.calls[0][1];
    expect(payload).toEqual({
      progress: 67,
      updatedAt: "NOW",
    });
  });

  

  test("createPdiItem cria item com order 1 quando lista vazia", async () => {
    serverTimestamp.mockReturnValue("NOW");
    addDoc.mockResolvedValue({ id: "ITEM_1" });

    const result = await createPdiItem("PLAN_1", []);

    expect(collection).toHaveBeenCalledWith(
      expect.anything(),
      "pdiPlans",
      "PLAN_1",
      "items"
    );
    expect(addDoc).toHaveBeenCalledTimes(1);

    const data = addDoc.mock.calls[0][1];
    expect(data.order).toBe(1);
    expect(data.status).toBe("nao_iniciada");
    expect(data.createdAt).toBe("NOW");

    expect(result).toEqual({
      id: "ITEM_1",
      ...data,
    });
  });

  test("createPdiItem usa order do último item + 1", async () => {
    serverTimestamp.mockReturnValue("NOW");
    addDoc.mockResolvedValue({ id: "ITEM_2" });

    const currentItems = [
      { id: "i1", order: 2 },
      { id: "i2", order: 5 },
    ];

    const result = await createPdiItem("PLAN_1", currentItems);
    const data = addDoc.mock.calls[0][1];

    expect(data.order).toBe(6);
    expect(result.id).toBe("ITEM_2");
  });

 

  test("duplicatePdiItem cria item com campos resetados e order + 0.1", async () => {
    serverTimestamp.mockReturnValue("NOW");

    const row = {
      devPoint: "Ponto",
      evidenceExpected: "Evidência",
      what: "O que",
      who: "Quem",
      whenPlanned: "2025-01-01",
      whenRealized: "2025-02-01",
      evidenceActual: "Real",
      status: "concluida",
      order: 3,
    };

    await duplicatePdiItem("PLAN_1", row);

    expect(addDoc).toHaveBeenCalledTimes(1);
    const data = addDoc.mock.calls[0][1];

    expect(data).toMatchObject({
      devPoint: "Ponto",
      evidenceExpected: "Evidência",
      what: "O que",
      who: "Quem",
      whenPlanned: "2025-01-01",
      whenRealized: "",
      evidenceActual: "",
      status: "nao_iniciada",
      doneAt: null,
      order: 3.1,
    });
  });



  test("deletePdiItem chama deleteDoc com caminho correto", async () => {
    await deletePdiItem("PLAN_1", "ROW_1");

    expect(doc).toHaveBeenCalledWith(
      expect.anything(),
      "pdiPlans",
      "PLAN_1",
      "items",
      "ROW_1"
    );
    expect(deleteDoc).toHaveBeenCalledTimes(1);
  });

  

  test("updatePdiItem atualiza item e não recalcula progresso se currentItems não for array", async () => {
    await updatePdiItem("PLAN_1", "ROW_1", { status: "em_andamento" });

    expect(updateDoc).toHaveBeenCalledTimes(1);
    const patch = updateDoc.mock.calls[0][1];
    expect(patch).toEqual({ status: "em_andamento" });
  });

  test("updatePdiItem atualiza item e recalcula progresso quando currentItems é array", async () => {
    serverTimestamp.mockReturnValue("NOW");

    const currentItems = [
      { id: "i1", status: "nao_iniciada" },
      { id: "i2", status: "nao_iniciada" },
    ];

    await updatePdiItem("PLAN_1", "i2", { status: "concluida" }, currentItems);

    
    expect(updateDoc).toHaveBeenCalledTimes(2);

    const firstPatch = updateDoc.mock.calls[0][1];
    const secondPatch = updateDoc.mock.calls[1][1];

    expect(firstPatch).toEqual({ status: "concluida" });
    expect(secondPatch).toEqual({
      progress: 50,
      updatedAt: "NOW",
    });
  });
});
