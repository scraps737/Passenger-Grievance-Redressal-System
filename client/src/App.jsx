import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell.jsx';
import { RedirectIfAuthed, RequireRole } from './components/RequireRole.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { NotFound } from './pages/NotFound.jsx';

import HomePage from './pages/HomePage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import NotificationsPage from './pages/NotificationsPage.jsx';

import PassengerDashboard from './pages/passenger/PassengerDashboard.jsx';
import SubmitGrievance from './pages/passenger/SubmitGrievance.jsx';
import MyGrievances from './pages/passenger/MyGrievances.jsx';
import PassengerGrievanceDetail from './pages/passenger/PassengerGrievanceDetail.jsx';
import ProfileSettings from './pages/passenger/ProfileSettings.jsx';

import OfficerDashboard from './pages/officer/OfficerDashboard.jsx';
import OfficerQueue from './pages/officer/OfficerQueue.jsx';
import CaseWorkspace from './pages/officer/CaseWorkspace.jsx';
import EscalationConsole from './pages/officer/EscalationConsole.jsx';

import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AiInsights from './pages/admin/AiInsights.jsx';
import Departments from './pages/admin/Departments.jsx';
import UsersRoles from './pages/admin/UsersRoles.jsx';
import Reports from './pages/admin/Reports.jsx';
import SettingsAudit from './pages/admin/SettingsAudit.jsx';

function Shell({ children }) {
  return <AppShell>{children}</AppShell>;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <HomePage />;
  return <Navigate to={`/${user.role}`} replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<RootRedirect />} />
      <Route
        path="/login"
        element={
          <RedirectIfAuthed>
            <AuthPage mode="login" />
          </RedirectIfAuthed>
        }
      />
      <Route
        path="/register"
        element={
          <RedirectIfAuthed>
            <AuthPage mode="register" />
          </RedirectIfAuthed>
        }
      />

      {/* Shared authenticated */}
      <Route
        path="/notifications"
        element={
          <RequireRole>
            <Shell>
              <NotificationsPage />
            </Shell>
          </RequireRole>
        }
      />

      {/* Passenger */}
      <Route
        path="/passenger"
        element={
          <RequireRole roles={['passenger']}>
            <Shell>
              <PassengerDashboard />
            </Shell>
          </RequireRole>
        }
      />
      <Route
        path="/passenger/submit"
        element={
          <RequireRole roles={['passenger']}>
            <Shell>
              <SubmitGrievance />
            </Shell>
          </RequireRole>
        }
      />
      <Route
        path="/passenger/grievances"
        element={
          <RequireRole roles={['passenger']}>
            <Shell>
              <MyGrievances />
            </Shell>
          </RequireRole>
        }
      />
      <Route
        path="/passenger/grievances/:id"
        element={
          <RequireRole roles={['passenger']}>
            <Shell>
              <PassengerGrievanceDetail />
            </Shell>
          </RequireRole>
        }
      />
      <Route
        path="/passenger/profile"
        element={
          <RequireRole roles={['passenger']}>
            <Shell>
              <ProfileSettings />
            </Shell>
          </RequireRole>
        }
      />

      {/* Officer (admins may also open these consoles) */}
      <Route
        path="/officer"
        element={
          <RequireRole roles={['officer', 'admin']}>
            <Shell>
              <OfficerDashboard />
            </Shell>
          </RequireRole>
        }
      />
      <Route
        path="/officer/queue"
        element={
          <RequireRole roles={['officer', 'admin']}>
            <Shell>
              <OfficerQueue />
            </Shell>
          </RequireRole>
        }
      />
      <Route
        path="/officer/cases/:id"
        element={
          <RequireRole roles={['officer', 'admin']}>
            <Shell>
              <CaseWorkspace />
            </Shell>
          </RequireRole>
        }
      />
      <Route
        path="/officer/escalations"
        element={
          <RequireRole roles={['officer', 'admin']}>
            <Shell>
              <EscalationConsole />
            </Shell>
          </RequireRole>
        }
      />

      {/* Admin */}
      <Route
        path="/admin"
        element={
          <RequireRole roles={['admin']}>
            <Shell>
              <AdminDashboard />
            </Shell>
          </RequireRole>
        }
      />
      <Route
        path="/admin/ai-insights"
        element={
          <RequireRole roles={['admin']}>
            <Shell>
              <AiInsights />
            </Shell>
          </RequireRole>
        }
      />
      <Route
        path="/admin/departments"
        element={
          <RequireRole roles={['admin']}>
            <Shell>
              <Departments />
            </Shell>
          </RequireRole>
        }
      />
      <Route
        path="/admin/users"
        element={
          <RequireRole roles={['admin']}>
            <Shell>
              <UsersRoles />
            </Shell>
          </RequireRole>
        }
      />
      <Route
        path="/admin/reports"
        element={
          <RequireRole roles={['admin']}>
            <Shell>
              <Reports />
            </Shell>
          </RequireRole>
        }
      />
      <Route
        path="/admin/settings"
        element={
          <RequireRole roles={['admin']}>
            <Shell>
              <SettingsAudit />
            </Shell>
          </RequireRole>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export { Route, Routes };
