// src/services/goalsService.test.js
import {
  listenUserGoals,
  listenCompletedGoals,
  listenGoalsForManager,
  listenGoalsForCollaborator,
  createGoal,
  toggleGoalStatus,
  deleteGoalById,
} from "./goalsService";

// mock de ../lib/firebase
jest.mock("../lib/firebase", () => ({
  db: {},
}));

// mock de firebase/firestore (só o que usamos aqui)
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => "COL_REF"),
  query: jest.fn(() => "Q_REF"),
  where: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(),
  addDoc: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(), // não precisamos do retorno
  updateDoc: jest.fn(),
  Timestamp: {
    fromDate: jest.fn(),
  },
  serverTimestamp: jest.fn(),
}));

import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore";

describe("goalsService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* ========= Escutas ========= */

  test("listenUserGoals retorna noop se uid não informado", () => {
    const setGoals = jest.fn();

    const unsub = listenUserGoals("", setGoals);
    expect(typeof unsub).toBe("function");

    // não deve montar query nem snapshot
    expect(collection).not.toHaveBeenCalled();
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  test("listenUserGoals monta query e converte documentos corretamente", () => {
    const setGoals = jest.fn();

    // snapshot fake
    onSnapshot.mockImplementation((_q, cb) => {
      const snap = {
        docs: [
          { id: "g1", data: () => ({ title: "Meta 1" }) },
          { id: "g2", data: () => ({ title: "Meta 2" }) },
        ],
      };
      cb(snap);
      return "UNSUB_FN";
    });

    const unsub = listenUserGoals("user123", setGoals);

    expect(collection).toHaveBeenCalledWith(expect.anything(), "goals");
    expect(query).toHaveBeenCalled();
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(setGoals).toHaveBeenCalledWith([
      { id: "g1", title: "Meta 1" },
      { id: "g2", title: "Meta 2" },
    ]);
    expect(unsub).toBe("UNSUB_FN");
  });

  test("listenCompletedGoals escuta apenas metas concluídas", () => {
    const setGoals = jest.fn();

    onSnapshot.mockImplementation((_q, cb) => {
      const snap = { docs: [] };
      cb(snap);
      return "UNSUB_COMPLETED";
    });

    const unsub = listenCompletedGoals(setGoals);

    expect(collection).toHaveBeenCalledWith(expect.anything(), "goals");
    expect(where).toHaveBeenCalledWith("status", "==", "concluida");
    expect(orderBy).toHaveBeenCalledWith("completedAt", "desc");
    expect(typeof unsub).toBe("string");
  });

  test("listenGoalsForCollaborator retorna noop se ownerUid não informado", () => {
    const setGoals = jest.fn();
    const unsub = listenGoalsForCollaborator("", setGoals);

    expect(typeof unsub).toBe("function");
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  test("listenGoalsForManager aplica filtros corretamente", () => {
    const setGoals = jest.fn();

    onSnapshot.mockImplementation((_q, cb) => {
      cb({ docs: [] });
      return "UNSUB_MANAGER";
    });

    const filters = { ownerUid: "colab-1", status: "aberta" };
    const unsub = listenGoalsForManager(filters, setGoals);

    expect(collection).toHaveBeenCalledWith(expect.anything(), "goals");
    expect(where).toHaveBeenCalledWith("ownerUid", "==", "colab-1");
    expect(where).toHaveBeenCalledWith("status", "==", "aberta");
    expect(orderBy).toHaveBeenCalledWith("createdAt", "desc");
    expect(unsub).toBe("UNSUB_MANAGER");
  });

  /* ========= createGoal ========= */

  test("createGoal monta payload corretamente com dueDate", async () => {
    Timestamp.fromDate.mockImplementation((d) => ({
      _type: "timestamp",
      iso: d.toISOString(),
    }));
    serverTimestamp.mockReturnValue("NOW");
    addDoc.mockResolvedValue("NEW_DOC");

    const result = await createGoal({
      title: "  Meta teste  ",
      description: "  Descrição  ",
      points: "25",
      dueDateISO: "2025-12-31",
      ownerUid: "user123",
      ownerName: "Colaborador Teste",
      createdByUid: "gestor1",
      isPdi: true,
      seasonKey: "S01",
    });

    expect(result).toBe("NEW_DOC");
    expect(collection).toHaveBeenCalledWith(expect.anything(), "goals");

    const payload = addDoc.mock.calls[0][1];

    expect(payload.title).toBe("Meta teste");
    expect(payload.description).toBe("Descrição");
    expect(payload.points).toBe(25);
    expect(payload.ownerUid).toBe("user123");
    expect(payload.ownerName).toBe("Colaborador Teste");
    expect(payload.createdByUid).toBe("gestor1");
    expect(payload.status).toBe("aberta");
    expect(payload.completedAt).toBeNull();
    expect(payload.isPdi).toBe(true);
    expect(payload.seasonKey).toBe("S01");
    expect(payload.createdAt).toBe("NOW");

    expect(Timestamp.fromDate).toHaveBeenCalledTimes(1);
    const dateArg = Timestamp.fromDate.mock.calls[0][0];
    expect(dateArg).toBeInstanceOf(Date);
  });

  test("createGoal permite dueDate nulo quando dueDateISO não informado", async () => {
    Timestamp.fromDate.mockClear();
    addDoc.mockResolvedValue("NEW_DOC_2");

    await createGoal({
      title: "Sem prazo",
      description: "",
      points: 10,
      dueDateISO: "",
      ownerUid: "user123",
    });

    const payload = addDoc.mock.calls[0][1];
    expect(payload.dueDate).toBeNull();
    expect(Timestamp.fromDate).not.toHaveBeenCalled();
  });

  /* ========= toggleGoalStatus ========= */

  test("toggleGoalStatus marca meta aberta como concluída", async () => {
    serverTimestamp.mockReturnValue("NOW");
    const goal = { id: "g1", ownerUid: "user123", status: "aberta" };

    await toggleGoalStatus(goal);

    expect(doc).toHaveBeenCalledWith(expect.anything(), "goals", "g1");
    expect(updateDoc).toHaveBeenCalledTimes(1);

    const [, data] = updateDoc.mock.calls[0];
    expect(data).toEqual({
      status: "concluida",
      completedAt: "NOW",
    });
  });

  test("toggleGoalStatus reabre meta concluída", async () => {
    const goal = { id: "g2", ownerUid: "user123", status: "concluida" };

    await toggleGoalStatus(goal);

    expect(doc).toHaveBeenCalledWith(expect.anything(), "goals", "g2");
    expect(updateDoc).toHaveBeenCalledTimes(1);

    const [, data] = updateDoc.mock.calls[0];
    expect(data).toEqual({
      status: "aberta",
      completedAt: null,
    });
  });

  test("toggleGoalStatus ignora goal inválido", async () => {
    await toggleGoalStatus({}); // sem id / ownerUid

    expect(doc).not.toHaveBeenCalled();
    expect(updateDoc).not.toHaveBeenCalled();
  });

  /* ========= deleteGoalById ========= */

  test("deleteGoalById chama deleteDoc quando id é válido", async () => {
    await deleteGoalById("g1");

    expect(doc).toHaveBeenCalledWith(expect.anything(), "goals", "g1");
    expect(deleteDoc).toHaveBeenCalledTimes(1);
  });

  test("deleteGoalById não faz nada quando id é vazio", async () => {
    await deleteGoalById("");

    expect(doc).not.toHaveBeenCalled();
    expect(deleteDoc).not.toHaveBeenCalled();
  });
});
