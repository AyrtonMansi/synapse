import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface AppShellProps {
  children: React.ReactNode;
  apiKey?: string;
  isAdmin?: boolean;
}

export function AppShell({ children, apiKey, isAdmin }: AppShellProps) {
  return (
    <div className="flex h-screen bg-charcoal-950">
      <Sidebar isAdmin={isAdmin} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar apiKey={apiKey} />
        
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
