import { Zap } from 'lucide-react';

export default function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="relative">
          <div className="w-16 h-16 bg-gradient-to-br from-synapse-500 to-neon-purple rounded-2xl flex items-center justify-center animate-pulse">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <div className="absolute inset-0 w-16 h-16 bg-gradient-to-br from-synapse-500 to-neon-purple rounded-2xl blur-xl opacity-50 animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-2 w-32 bg-slate-800 rounded animate-pulse mx-auto" />
          <div className="h-2 w-24 bg-slate-800 rounded animate-pulse mx-auto" />
        </div>
      </div>
    </div>
  );
}
