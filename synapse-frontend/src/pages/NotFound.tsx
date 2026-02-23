import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Search, AlertTriangle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 bg-white/[0.03] border border-white/[0.08] rounded-2xl flex items-center justify-center mx-auto mb-8">
          <AlertTriangle className="w-12 h-12 text-neutral-500" />
        </div>
        
        <h1 className="text-6xl font-bold mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-4">Page Not Found</h2>
        <p className="text-neutral-400 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button 
            onClick={() => window.history.back()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white/[0.05] border border-white/[0.08] text-white px-6 py-3 rounded-lg font-medium hover:bg-white/[0.08] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <Link 
            to="/"
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-500 text-black px-6 py-3 rounded-lg font-medium hover:bg-emerald-400 transition-colors"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
        </div>

        <div className="mt-12 pt-8 border-t border-white/[0.08]">
          <p className="text-sm text-neutral-500 mb-4">Looking for something else?</p>
          <div className="flex flex-wrap justify-center gap-3 text-sm">
            <Link to="/docs" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              Documentation
            </Link>
            <span className="text-neutral-600">•</span>
            <Link to="/pricing" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              Pricing
            </Link>
            <span className="text-neutral-600">•</span>
            <Link to="/governance" className="text-emerald-400 hover:text-emerald-300 transition-colors">
              Governance
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
