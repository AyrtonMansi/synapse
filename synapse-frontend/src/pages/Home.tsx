export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-8">
              <span className="text-xl font-semibold">Synapse</span>
              <div className="hidden md:flex gap-6 text-sm text-gray-600">
                <a href="#models" className="hover:text-gray-900">Models</a>
                <a href="#pricing" className="hover:text-gray-900">Pricing</a>
                <a href="#docs" className="hover:text-gray-900">Docs</a>
              </div>
            </div>
            <div className="flex gap-4">
              <a href="/connect" className="text-sm text-gray-600 hover:text-gray-900">Sign In</a>
              <a href="/connect" className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800">
                Get Started
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-16 text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-5xl md:text-6xl font-semibold text-gray-900 tracking-tight mb-6">
            AI inference API
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Access DeepSeek, Llama, Mistral and more through a single API. 
            Pay per use with crypto. No KYC required.
          </p>
          <div className="flex justify-center gap-4">
            <a href="/connect" className="bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800">
              Start building
            </a>
            <a href="/docs" className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50">
              View docs
            </a>
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-gray-900 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <pre className="p-4 text-sm text-gray-300 overflow-x-auto">
              <code>{`curl https://api.synapse.network/v1/chat/completions \\
  -H "Authorization: Bearer syn_live_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "deepseek-v3",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Models */}
      <section className="py-20" id="models">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-semibold text-center mb-12">Available Models</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: 'DeepSeek V3', price: '$0.0015/1K', context: '128K' },
              { name: 'Llama 3.1 70B', price: '$0.0012/1K', context: '128K' },
              { name: 'Llama 3.1 8B', price: '$0.0003/1K', context: '128K' },
              { name: 'Mistral Large', price: '$0.0020/1K', context: '128K' },
            ].map((model) => (
              <div key={model.name} className="border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                <h3 className="font-semibold text-gray-900 mb-1">{model.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{model.context} context</p>
                <p className="text-sm font-medium">{model.price}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <h3 className="font-semibold text-lg mb-2">Simple API</h3>
              <p className="text-gray-600">Drop-in replacement for OpenAI API. Change one line of code.</p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">No KYC</h3>
              <p className="text-gray-600">Connect wallet and start. No signup, no personal information.</p>
            </div>
            <div>
              <h3 className="font-semibold text-lg mb-2">Pay with Crypto</h3>
              <p className="text-gray-600">Use SYN, ETH, or USDC. Transparent per-token pricing.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 text-center">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="text-3xl font-semibold mb-4">Start building today</h2>
          <p className="text-gray-600 mb-8">1 million free tokens. No credit card required.</p>
          <a href="/connect" className="bg-black text-white px-8 py-3 rounded-lg font-medium hover:bg-gray-800">
            Get API Key
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>© 2024 Synapse Network. Decentralized AI compute.</p>
        </div>
      </footer>
    </div>
  );
}