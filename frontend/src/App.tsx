import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { AuthProvider } from "./components/AuthProvider";
import { CommandPalette } from "./components/CommandPalette";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AblationLabPage } from "./pages/AblationLabPage";
import { ArenaPage } from "./pages/ArenaPage";
import { BenchmarkLabPage } from "./pages/BenchmarkLabPage";
import { CausalGraphPage } from "./pages/CausalGraphPage";
import { DashboardPage } from "./pages/DashboardPage";
import { EvidenceExplorerPage } from "./pages/EvidenceExplorerPage";
import { ExperimentResultsPage } from "./pages/ExperimentResultsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { NewSessionPage } from "./pages/NewSessionPage";
import { ReplayPage } from "./pages/ReplayPage";
import { ReportPage } from "./pages/ReportPage";
import { SandboxMonitorPage } from "./pages/SandboxMonitorPage";
import { SessionPage } from "./pages/SessionPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SystemHealthPage } from "./pages/SystemHealthPage";
import { TracePage } from "./pages/TracePage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CommandPalette />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="new" element={<NewSessionPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="sessions/:sessionId" element={<SessionPage />} />
            <Route path="sessions/:sessionId/report" element={<ReportPage />} />
            <Route path="arena" element={<ArenaPage />} />
            <Route path="evidence" element={<EvidenceExplorerPage />} />
            <Route path="trace" element={<TracePage />} />
            <Route path="causal" element={<CausalGraphPage />} />
            <Route path="replay" element={<ReplayPage />} />
            <Route path="benchmarks" element={<BenchmarkLabPage />} />
            <Route path="ablation" element={<AblationLabPage />} />
            <Route path="experiments" element={<ExperimentResultsPage />} />
            <Route path="sandbox" element={<SandboxMonitorPage />} />
            <Route path="health" element={<SystemHealthPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="/" element={<LandingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
