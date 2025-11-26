// functions/__tests__/xp.test.js

// Mock de firebase
jest.mock("firebase-functions", () => ({
  https: {
    onRequest: (handler) => handler,
  },
}));

// Mocks globais
const mockUpdate = jest.fn();
const mockAdd = jest.fn();
const mockIncrement = jest.fn((n) => n);
const mockServerTimestamp = jest.fn(() => "NOW");

// Mock de firebase-admin
jest.mock("firebase-admin", () => {
  const mockCollection = jest.fn((name) => {
    if (name === "users") {
      return {
        doc: jest.fn(() => ({
          update: mockUpdate,
        })),
      };
    }

    if (name === "xpLog") {
      return {
        add: mockAdd,
      };
    }

    return {};
  });

  const mockFirestore = () => ({
    collection: mockCollection,
  });

  // adiciona FieldValue como propriedade da função firestore mockada
  mockFirestore.FieldValue = {
    increment: mockIncrement,
    serverTimestamp: mockServerTimestamp,
  };

  return {
    initializeApp: jest.fn(),
    firestore: mockFirestore,
  };
});

//IMPORTA O MÓDULO DEPOIS dos mocks
const { grantXp } = require("../xp");

// helper simples de response fake
function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe("xp.grantXp (Cloud Function)", () => {
  beforeEach(() => {
    mockUpdate.mockClear();
    mockAdd.mockClear();
    mockIncrement.mockClear();
    mockServerTimestamp.mockClear();
  });

  test("retorna 400 se faltar uid ou points", async () => {
    const req = {
      method: "POST",
      body: { uid: "u1" }, 
    };
    const res = makeRes();

    await grantXp(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual(
      expect.objectContaining({
        error: expect.any(String),
      })
    );
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockAdd).not.toHaveBeenCalled();
  });

  test("atualiza pontos do usuário e grava log quando dados são válidos", async () => {
    const req = {
      method: "POST",
      body: { uid: "u1", points: 50, source: "teste" },
    };
    const res = makeRes();

    await grantXp(req, res);

    // conferindo chamadas de FieldValue e Firestore
    expect(mockIncrement).toHaveBeenCalledWith(50);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockServerTimestamp).toHaveBeenCalled();

    // resposta HTTP
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: true,
        uid: "u1",
        points: 50,
        source: "teste",
        method: "POST",
      })
    );
  });
});
