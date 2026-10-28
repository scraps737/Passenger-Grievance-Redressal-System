import { Link, useNavigate } from 'react-router-dom';
import { Icon } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export function PublicHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-gutter">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-container text-brand-blue shadow-sm">
            <Icon name="commute" size={22} />
          </span>
          <span className="flex flex-col">
            <span className="font-display text-headline-sm leading-none tracking-tight text-primary">
              Grievance<span className="text-brand-blue">AI</span>
            </span>
            <span className="text-label-sm uppercase tracking-wider text-slate-500">Transit Redressal System</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {[
            { to: '/', label: 'Home' },
            { to: '/#track', label: 'Track Grievance' },
            { to: '/#categories', label: 'Categories' },
            { to: '/#insights', label: 'Resolution Insights' },
          ].map((item) => (
            <a
              key={item.label}
              href={item.to}
              className="rounded-lg px-3 py-2 text-body-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href="tel:139"
            className="hidden items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-label-md text-slate-600 sm:flex"
          >
            <Icon name="call" size={16} /> 139 Helpline
          </a>
          {user ? (
            <button type="button" className="btn-primary btn-sm" onClick={() => navigate(`/${user.role}`)}>
              <Icon name="dashboard" size={16} /> Go to console
            </button>
          ) : (
            <>
              <Link to="/login" className="btn-secondary btn-sm">
                <Icon name="lock_open" size={16} /> Sign in
              </Link>
              <Link to="/register" className="btn-accent btn-sm">
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto grid w-full max-w-7xl gap-8 px-gutter py-10 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-container text-brand-blue">
              <Icon name="commute" size={22} />
            </span>
            <span className="font-display text-headline-sm text-primary">
              Grievance<span className="text-brand-blue">AI</span>
            </span>
          </div>
          <p className="mt-3 max-w-md text-body-sm text-slate-500">
            AI-enhanced passenger grievance redressal for rail, metro and multimodal transit networks.
            Every grievance is triaged, routed, tracked against a statutory SLA and closed with verified proof.
          </p>
        </div>
        <div>
          <h4 className="text-label-md uppercase tracking-wider text-slate-500">Passengers</h4>
          <ul className="mt-3 space-y-2 text-body-sm text-slate-600">
            <li><Link className="hover:text-brand-blue" to="/register">Create an account</Link></li>
            <li><Link className="hover:text-brand-blue" to="/login">Sign in</Link></li>
            <li><Link className="hover:text-brand-blue" to="/#track">Track a grievance</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-label-md uppercase tracking-wider text-slate-500">Operations</h4>
          <ul className="mt-3 space-y-2 text-body-sm text-slate-600">
            <li><Link className="hover:text-brand-blue" to="/login">Officer console</Link></li>
            <li><Link className="hover:text-brand-blue" to="/login">Administration</Link></li>
            <li><a className="hover:text-brand-blue" href="tel:139">Helpline 139</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-100 px-gutter py-4">
        <p className="mx-auto max-w-7xl text-label-sm text-slate-400">
          © {new Date().getFullYear()} GrievanceAI Transit Redressal Authority. Demonstration system — not affiliated
          with any government body.
        </p>
      </div>
    </footer>
  );
}

export function PublicShell({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicHeader />
      <div className="flex-1">{children}</div>
      <PublicFooter />
    </div>
  );
}
