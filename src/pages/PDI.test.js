// src/pages/PDI.test.js
import { render, screen } from "@testing-library/react";
import PDI from "./PDI";

// 🔧 mock do serviço de PDI para não chamar Firestore de verdade
jest.mock("../services/pdiService", () => ({
  listenCurrentUser: (callback) => {
    callback({ uid: "u-gestor", role: "gestor", name: "Gestor Teste" });
    return () => {};
  },
  listenCollaborators: (setList) => {
    setList([{ uid: "colab-1", name: "Colaborador Teste" }]);
    return () => {};
  },
  listenPdiPlanByOwnerUid: (_uid, callback) => {
    // sem plano inicial -> deixa a tela num estado "novo PDI"
    callback(null);
    return () => {};
  },
  listenPdiItems: () => () => {},
  savePdiHeader: jest.fn(),
  createPdiItem: jest.fn(),
  duplicatePdiItem: jest.fn(),
  deletePdiItem: jest.fn(),
  updatePdiItem: jest.fn(),
  syncPlanProgress: jest.fn(),
  calculateProgressFromItems: jest.fn(() => 0),
  applyPdiGamification: jest.fn(),
}));

test("renderiza o título do Plano de Desenvolvimento Individual", () => {
  render(<PDI />);

  expect(
    screen.getByText(/Plano de Desenvolvimento Individual/i)
  ).toBeInTheDocument();
});

test("mostra o colaborador mockado na tela (quando aplicável)", () => {
  render(<PDI />);

  // Se tiver um select/input mostrando o colaborador, esse teste já garante render básico.
  // Ajuste o texto conforme aparece no componente (placeholder, opção, etc.).
  expect(screen.getByText(/Colaborador Teste/i)).toBeInTheDocument();
});
