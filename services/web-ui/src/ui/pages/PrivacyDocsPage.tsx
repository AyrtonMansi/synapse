import { Shield, Lock, Eye, AlertTriangle } from 'lucide-react';

export function PrivacyDocsPage() {
  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-charcoal-100 mb-4">Privacy & Security</h1>
        <p className="text-charcoal-400 text-lg">
          Synapse provides multiple privacy tiers to match your threat model. 
          This page explains what we protect, what we don't, and how to choose the right tier.
        </p>
      </div>

      {/* Quick Comparison */}
      <div className="bg-charcoal-900 rounded-xl border border-charcoal-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-charcoal-800">
          <h2 className="font-medium text-charcoal-100">Privacy Tier Comparison</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-charcoal-950">
            <tr>
              <th className="px-6 py-3 text-left text-charcoal-400 font-medium">Feature</th>
              <th className="px-6 py-3 text-center text-charcoal-400 font-medium">Standard</th>
              <th className="px-6 py-3 text-center text-charcoal-400 font-medium">Encrypted</th>
              <th className="px-6 py-3 text-center text-charcoal-400 font-medium">E2EE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-charcoal-800">
            <tr>
              <td className="px-6 py-4 text-charcoal-300">TLS in transit</td>
              <td className="px-6 py-4 text-center text-synapse-500">✓</td>
              <td className="px-6 py-4 text-center text-synapse-500">✓</td>
              <td className="px-6 py-4 text-center text-synapse-500">✓</td>
            </tr>
            <tr>
              <td className="px-6 py-4 text-charcoal-300">Server sees prompt content</td>
              <td className="px-6 py-4 text-center text-red-400">Yes</td>
              <td className="px-6 py-4 text-center text-red-400">Yes</td>
              <td className="px-6 py-4 text-center text-synapse-500">No</td>
            </tr>
            <tr>
              <td className="px-6 py-4 text-charcoal-300">Chat history encrypted at rest</td>
              <td className="px-6 py-4 text-center text-red-400">No</td>
              <td className="px-6 py-4 text-center text-synapse-500">Yes</td>
              <td className="px-6 py-4 text-center text-synapse-500">Yes</td>
            </tr>
            <tr>
              <td className="px-6 py-4 text-charcoal-300">You control encryption keys</td>
              <td className="px-6 py-4 text-center text-red-400">No</td>
              <td className="px-6 py-4 text-center text-synapse-500">Yes</td>
              <td className="px-6 py-4 text-center text-synapse-500">Yes</td>
            </tr>
            <tr>
              <td className="px-6 py-4 text-charcoal-300">Node sees prompt content</td>
              <td className="px-6 py-4 text-center text-red-400">Yes</td>
              <td className="px-6 py-4 text-center text-red-400">Yes</td>
              <td className="px-6 py-4 text-center text-synapse-500">Only E2EE nodes</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Detailed Explanations */}
      <div className="space-y-6">
        <section className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-charcoal-800 rounded-lg flex items-center justify-center">
              <Eye size={20} className="text-charcoal-400" />
            </div>
            <h2 className="text-xl font-medium text-charcoal-100">Standard Mode</h2>
          </div>
          
          <p className="text-charcoal-400 mb-4">
            Standard mode provides TLS encryption in transit, protecting your data from passive 
            network eavesdroppers. However, the Synapse gateway and node operators can see your 
            prompts and responses.
          </p>
          
          <div className="bg-charcoal-950 rounded-lg p-4 space-y-2">
            <p className="text-sm text-charcoal-300"><strong>What we log:</strong></p>
            <ul className="text-sm text-charcoal-500 list-disc list-inside space-y-1">
              <li>Request timestamp and model requested</li>
              <li>Node that served your request</li>
              <li>Success/failure status and latency</li>
              <li>Full prompt and response content</li>
            </ul>
          </div>
          
          <p className="mt-4 text-sm text-charcoal-500">
            <strong>Best for:</strong> General use, non-sensitive queries, when convenience matters more than privacy.
          </p>
        </section>

        <section className="bg-charcoal-900 rounded-xl border border-synapse-800/50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-synapse-900/30 rounded-lg flex items-center justify-center">
              <Lock size={20} className="text-synapse-400" />
            </div>
            <h2 className="text-xl font-medium text-charcoal-100">Encrypted at Rest (Recommended)</h2>
          </div>
          
          <p className="text-charcoal-400 mb-4">
            Your workspace key encrypts chat history client-side before storage. The server receives 
            only cryptographic hashes, not plaintext. You maintain control of the encryption key.
          </p>
          
          <div className="bg-charcoal-950 rounded-lg p-4 space-y-2">
            <p className="text-sm text-charcoal-300"><strong>What we log:</strong></p>
            <ul className="text-sm text-charcoal-500 list-disc list-inside space-y-1">
              <li>Request timestamp and model requested</li>
              <li>Node that served your request</li>
              <li>SHA-256 hash of ciphertext (for deduplication)</li>
              <li><strong>NOT</strong>: Your prompts or responses</li>
            </ul>
          </div>
          
          <div className="mt-4 bg-amber-950/30 border border-amber-900/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-200 font-medium">Important</p>
                <p className="text-sm text-amber-400/80 mt-1">
                  If you lose your workspace key, your encrypted history cannot be recovered. 
                  We strongly recommend backing up your key after enabling this mode.
                </p>
              </div>
            </div>
          </div>
          
          <p className="mt-4 text-sm text-charcoal-500">
            <strong>Best for:</strong> Sensitive conversations, compliance requirements, when you want control over your data.
          </p>
        </section>

        <section className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-charcoal-800 rounded-lg flex items-center justify-center">
              <Shield size={20} className="text-charcoal-400" />
            </div>
            <h2 className="text-xl font-medium text-charcoal-100">End-to-End Encryption (Preview)</h2>
          </div>
          
          <p className="text-charcoal-400 mb-4">
            Your client encrypts prompts with ephemeral session keys before sending. Only 
            E2EE-capable nodes can decrypt. Synapse infrastructure never sees plaintext.
          </p>
          
          <div className="bg-charcoal-950 rounded-lg p-4 space-y-2">
            <p className="text-sm text-charcoal-300"><strong>What we log:</strong></p>
            <ul className="text-sm text-charcoal-500 list-disc list-inside space-y-1">
              <li>Request timestamp only</li>
              <li>Which E2EE node served request</li>
              <li><strong>NOT</strong>: Prompt content, response content, or hashes</li>
            </ul>
          </div>
          
          <div className="mt-4 bg-charcoal-950 rounded-lg p-4">
            <p className="text-sm text-charcoal-400">
              <strong>Limitations:</strong> Only ~30% of nodes support E2EE. Higher latency due to 
              key exchange. Limited to text-only (no file uploads).
            </p>
          </div>
          
          <p className="mt-4 text-sm text-charcoal-500">
            <strong>Best for:</strong> Maximum privacy, sensitive research, when you don't trust the infrastructure.
          </p>
        </section>
      </div>

      {/* Threat Model */}
      <section className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6">
        <h2 className="text-xl font-medium text-charcoal-100 mb-4">Threat Model</h2>
        
        <div className="space-y-4 text-charcoal-400">
          <div>
            <h3 className="text-charcoal-200 font-medium mb-2">What Synapse CANNOT protect against:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li><strong>Network observers:</strong> Can see you're connecting to Synapse (use VPN/Tor)</li>
              <li><strong>Compromised nodes:</strong> Malicious nodes could log or tamper with requests</li>
              <li><strong>Client compromise:</strong> Malware on your device can read messages before encryption</li>
              <li><strong>Metadata correlation:</strong> Request timing patterns can reveal usage patterns</li>
              <li><strong>Legal compulsion:</strong> We comply with valid legal requests</li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-charcoal-200 font-medium mb-2">What we assume about attackers:</h3>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Synapse servers may be compromised (Encrypted/E2EE tiers protect against this)</li>
              <li>Some nodes may be malicious (E2EE tier protects against this)</li>
              <li>Network traffic may be monitored (all tiers use TLS)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Data Retention */}
      <section className="bg-charcoal-900 rounded-xl border border-charcoal-800 p-6">
        <h2 className="text-xl font-medium text-charcoal-100 mb-4">Data Retention</h2>
        
        <div className="space-y-4 text-charcoal-400 text-sm">
          <p>
            <strong>Standard tier:</strong> Chat history retained for 30 days, then deleted. 
            Metadata retained for 90 days for billing and abuse prevention.
          </p>
          <p>
            <strong>Encrypted tier:</strong> Ciphertext retained until you delete it. 
            Hashes retained for 30 days. We cannot decrypt your data even if compelled.
          </p>
          <p>
            <strong>E2EE tier:</strong> No plaintext stored. Ephemeral keys discarded after session. 
            Only timing metadata retained for 7 days.
          </p>
        </div>
      </section>

      {/* Contact */}
      <div className="text-center py-8 text-charcoal-500 text-sm">
        <p>Questions about privacy? Contact: privacy@synapse.sh</p>
      </div>
    </div>
  );
}
