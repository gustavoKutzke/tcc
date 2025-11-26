// src/components/RouteGuards.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "../hooks/useUser";


export function RequireAuth({ children }) {
  const { userAuth, loading } = useUser();
  const location = useLocation();

  if (loading) return <div className="card"><p className="muted">Carregando…</p></div>;
  if (!userAuth) return <Navigate to="/auth" replace state={{ from: location }} />;

  return children;
}


export function RequireManager({ children }) {
  const { userAuth, userDoc, loading } = useUser();
  const location = useLocation();

  if (loading) return <div className="card"><p className="muted">Carregando…</p></div>;
  if (!userAuth) return <Navigate to="/auth" replace state={{ from: location }} />;
  if ((userDoc?.role || "colaborador") !== "gestor") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
