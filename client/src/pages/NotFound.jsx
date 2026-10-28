import { Link } from 'react-router-dom';
import { Icon } from '../components/ui.jsx';

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-container text-brand-blue">
        <Icon name="explore_off" size={32} />
      </span>
      <h1 className="font-display text-display-lg text-primary">404</h1>
      <p className="max-w-md text-body-lg text-slate-500">
        That page does not exist in the GrievanceAI portal.
      </p>
      <Link to="/" className="btn-primary">
        <Icon name="home" size={18} /> Back to home
      </Link>
    </div>
  );
}
