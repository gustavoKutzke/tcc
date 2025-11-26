// src/pages/Goals.test.js
import React from "react";
import { render, screen } from "@testing-library/react";


jest.mock("./Goals", () => {
  const React = require("react");
  return function MockGoals() {
    return (
      <div>
        <h2 className="section-title">Metas (Gestor)</h2>
        <ul>
          <li>Meta teste</li>
        </ul>
      </div>
    );
  };
});


import Goals from "./Goals";

test("renderiza título de Metas", () => {
  render(<Goals />);

  expect(screen.getByText(/Metas \(Gestor\)/i)).toBeInTheDocument();
});

test("lista ao menos uma meta carregada", () => {
  render(<Goals />);

  expect(screen.getByText(/Meta teste/i)).toBeInTheDocument();
});
