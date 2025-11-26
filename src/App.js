// src/App.js
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import "./theme.css";


import { ToastXPProvider } from "./components/ToastXP";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Goals from "./pages/Goals";
import Ranking from "./pages/Ranking";
import Feedback360 from "./pages/Feedback360";
import Shop from "./pages/Shop";
import Profile from "./pages/Profile";
import Kudos from "./pages/Kudos";
import Timeline from "./pages/Timeline";
import Career from "./pages/Career";
import Feed from "./pages/Feed";
import Insights from "./pages/Insights";
import PDI from "./pages/PDI";
import PDIPrint from "./pages/PDIPrint";
import DISC from "./pages/DISC";

import { RequireAuth, RequireManager } from "./components/RouteGuards";

export default function App() {
  return (
    <ToastXPProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />

          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Layout>
                  <Dashboard />
                </Layout>
              </RequireAuth>
            }
          />

          <Route
            path="/goals"
            element={
              <RequireAuth>
                <Layout>
                  <Goals />
                </Layout>
              </RequireAuth>
            }
          />

          <Route
            path="/ranking"
            element={
              <RequireAuth>
                <Layout>
                  <Ranking />
                </Layout>
              </RequireAuth>
            }
          />

          <Route
            path="/feedback"
            element={
              <RequireManager>
                <Layout>
                  <Feedback360 />
                </Layout>
              </RequireManager>
            }
          />

          <Route
            path="/shop"
            element={
              <RequireAuth>
                <Layout>
                  <Shop />
                </Layout>
              </RequireAuth>
            }
          />

          <Route
            path="/perfil"
            element={
              <RequireAuth>
                <Layout>
                  <Profile />
                </Layout>
              </RequireAuth>
            }
          />

          <Route
            path="/kudos"
            element={
              <RequireAuth>
                <Layout>
                  <Kudos />
                </Layout>
              </RequireAuth>
            }
          />

          <Route
            path="/timeline"
            element={
              <RequireAuth>
                <Layout>
                  <Timeline />
                </Layout>
              </RequireAuth>
            }
          />

          <Route
            path="/carreira"
            element={
              <RequireAuth>
                <Layout>
                  <Career />
                </Layout>
              </RequireAuth>
            }
          />

          <Route
            path="/feed"
            element={
              <RequireAuth>
                <Layout>
                  <Feed />
                </Layout>
              </RequireAuth>
            }
          />

          <Route
            path="/insights"
            element={
              <RequireManager>
                <Layout>
                  <Insights />
                </Layout>
              </RequireManager>
            }
          />

       <Route
  path="/pdi"
  element={
    <RequireAuth>
      <Layout>
        <PDI />
      </Layout>
    </RequireAuth>
  }
/>

          <Route
            path="/pdi/print/:planId"
            element={
              <RequireAuth>
                <PDIPrint />
              </RequireAuth>
            }
          />

          <Route
            path="/disc"
            element={
              <RequireAuth>
                <Layout>
                  <DISC />
                </Layout>
              </RequireAuth>
            }
          />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastXPProvider>
  );
}
