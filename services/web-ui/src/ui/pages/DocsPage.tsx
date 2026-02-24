import { Code, Key, Server, Zap, ChevronRight, ExternalLink } from 'lucide-react';

const docSections = [
  {
    title: 'Getting Started',
    icon: Zap,
    items: [
      { title: 'Quick Start', href: '#quickstart' },
      { title: 'Generate an API Key', href: '#api-key' },
      { title: 'Make Your First Request', href: '#first-request' },
    ],
  },
  {
    title: 'API Reference',
    icon: Code,
    items: [
      { title: 'Authentication', href: '#auth' },
      { title: 'Chat Completions', href: '#chat' },
      { title: 'Models', href: '#models' },
      { title: 'Error Handling', href: '#errors' },
    ],
  },
  {
    title: 'Running a Node',
    icon: Server,
    items: [
      { title: 'System Requirements', href: '#requirements' },
      { title: 'Installation', href: '#installation' },
      { title: 'Configuration', href: '#config' },
      { title: 'Monitoring', href: '#monitoring' },
    ],
  },
  {
    title: 'Authentication',
    icon: Key,
    items: [
      { title: 'API Keys', href: '#api-keys' },
      { title: 'Wallet Connection', href: '#wallet' },
      { title: 'Security Best Practices', href: '#security' },
    ],
  },
];

export function DocsPage() {
  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-charcoal-100 mb-2">Documentation</h1>
        <p className="text-charcoal-400">Learn how to integrate with and contribute to the Synapse network.</p>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-4 mb-12">
        <a 
          href="/gateway/chat"
          className="flex items-center gap-4 p-6 bg-charcoal-900 hover:bg-charcoal-800 border border-charcoal-800 hover:border-charcoal-700 rounded-xl transition-colors group"
        >
          <div className="w-12 h-12 bg-synapse-500/10 rounded-lg flex items-center justify-center">
            <Zap size={24} className="text-synapse-500" />
          </div>
          <div>
            <h3 className="font-medium text-charcoal-100 group-hover:text-synapse-400 transition-colors">Try the Gateway</h3>
            <p className="text-sm text-charcoal-500">Start using the API immediately</p>
          </div>
          <ChevronRight size={20} className="text-charcoal-600 ml-auto group-hover:text-charcoal-400" />
        </a>

        <a 
          href="https://github.com/synapse/api"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-4 p-6 bg-charcoal-900 hover:bg-charcoal-800 border border-charcoal-800 hover:border-charcoal-700 rounded-xl transition-colors group"
        >
          <div className="w-12 h-12 bg-charcoal-800 rounded-lg flex items-center justify-center">
            <Code size={24} className="text-charcoal-400" />
          </div>
          <div>
            <h3 className="font-medium text-charcoal-100 group-hover:text-charcoal-200 transition-colors">API Reference</h3>
            <p className="text-sm text-charcoal-500">OpenAPI spec and examples</p>
          </div>
          <ExternalLink size={18} className="text-charcoal-600 ml-auto group-hover:text-charcoal-400" />
        </a>
      </div>

      {/* Doc Sections */}
      <div className="grid grid-cols-2 gap-6">
        {docSections.map((section) => (
          <div key={section.title} className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-charcoal-800 rounded-lg">
                <section.icon size={20} className="text-charcoal-400" />
              </div>
              <h2 className="font-medium text-charcoal-100">{section.title}</h2>
            </div>
            
            <ul className="space-y-2">
              {section.items.map((item) => (
                <li key={item.title}>
                  <a 
                    href={item.href}
                    className="flex items-center gap-2 text-sm text-charcoal-400 hover:text-synapse-400 transition-colors py-1"
                  >
                    <ChevronRight size={14} className="text-charcoal-600" />
                    {item.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Code Example */}
      <div className="mt-12">
        <h2 className="text-lg font-medium text-charcoal-100 mb-4">Quick Example</h2>
        <div className="bg-charcoal-950 rounded-xl border border-charcoal-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-charcoal-800 bg-charcoal-900">
            <span className="text-sm text-charcoal-400">cURL</span>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(`curl https://api.synapse.sh/v1/chat/completions \\
  -H "Authorization: Bearer \${SYNAPSE_API_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "synapse-llama-3-70b",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`);
              }}
              className="text-xs text-charcoal-500 hover:text-charcoal-300"
            >
              Copy
            </button>
          </div>
          <pre className="p-4 text-sm text-charcoal-300 font-mono overflow-x-auto">
{`curl https://api.synapse.sh/v1/chat/completions \\
  -H "Authorization: Bearer \${SYNAPSE_API_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "synapse-llama-3-70b",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}
          </pre>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 pt-8 border-t border-charcoal-800">
        <div className="flex items-center justify-between text-sm">
          <p className="text-charcoal-500">
            Need help? Contact <a href="mailto:support@synapse.sh" className="text-synapse-400 hover:underline">support@synapse.sh</a>
          </p>
          <div className="flex items-center gap-4">
            <a href="https://discord.gg/synapse" target="_blank" rel="noopener noreferrer" className="text-charcoal-400 hover:text-charcoal-200">Discord</a>
            <a href="https://twitter.com/synapse" target="_blank" rel="noopener noreferrer" className="text-charcoal-400 hover:text-charcoal-200">Twitter</a>
            <a href="https://github.com/synapse" target="_blank" rel="noopener noreferrer" className="text-charcoal-400 hover:text-charcoal-200">GitHub</a>
          </div>
        </div>
      </div>
    </div>
  );
}
