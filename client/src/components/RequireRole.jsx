import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, HOME_FOR_ROLE } from '../context/AuthContext.jsx';
import { LoadingBlock } from './ui.jsx';

/**
 * Client-side route guard. This is a UX convenience only — every permission is
 * independently enforced by the API, which is the real boundary.
 */
export function RequireRole({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-gutter">
        <LoadingBlock label="Verifying your session…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={HOME_FOR_ROLE[user.role] || '/'} replace />;
  }

  return children ?? <Outlet />;
}

export function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingBlock label="Loading…" />;
  if (user) return <Navigate to={HOME_FOR_ROLE[user.role] || '/'} replace />;
  return children;
}
