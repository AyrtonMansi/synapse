import { useState } from 'react';
import { Check, HelpCircle, Zap, Server, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const plans = [
  {
    name: 'Free Trial',
    description: 'Get started with no credit card required',
    price: '$0',
    period: 'forever',
    tokens: '1M',
    features: [
      '1 million free tokens',
      'Access to all models',
      'Standard API rate limits',
      'Community support',
    ],
    cta: 'Get Started',
    href: '/dashboard',
    popular: false,
  },
  {
    name: 'Pay Per Use',
    description: 'Scale as you grow with usage-based pricing',
    price: '$0.0015',
    period: 'per 1K tokens',
    tokens: 'Unlimited',
    features: [
      'Unlimited token usage',
      'Access to all models',
      'Higher rate limits',
      'Priority support',
      'Usage analytics',
    ],
    cta: 'Start Free Trial',
    href: '/dashboard',
    popular: true,
  },
  {
    name: 'Enterprise',
    description: 'Custom solutions for large-scale deployments',
    price: 'Custom',
    period: 'contact us',
    tokens: 'Unlimited',
    features: [
      'Dedicated infrastructure',
      'Custom SLAs',
      '24/7 priority support',
      'Dedicated account manager',
      'Custom model deployment',
    ],
    cta: 'Contact Sales',
    href: 'mailto:enterprise@synapse.network',
    popular: false,
  },
];

const comparisonFeatures = [
  { name: 'Free tokens', free: '1M', payg: '1M then paid', enterprise: 'Custom' },
  { name: 'API rate limit', free: '10 req/min', payg: '100 req/min', enterprise: 'Unlimited' },
  { name: 'Models', free: 'All', payg: 'All', enterprise: 'All + Custom' },
  { name: 'Support', free: 'Community', payg: 'Priority', enterprise: '24/7 Dedicated' },
  { name: 'SLA', free: '-', payg: '99.9%', enterprise: '99.99%' },
  { name: 'Custom deployment', free: '-', payg: '-', enterprise: true },
  { name: 'SSO/SAML', free: '-', payg: '-', enterprise: true },
];

const faqs = [
  {
    question: 'How does the free trial work?',
    answer: 'You get 1 million tokens absolutely free with no credit card required. Use them at your own pace - they never expire. Once you hit the limit, you can upgrade to pay-per-use or contact us for enterprise options.',
  },
  {
    question: 'What counts as a token?',
    answer: 'Tokens are pieces of words used by the AI model. As a rough guide, 1 token is about 4 characters or 0.75 words for English text. Both input (prompt) and output (completion) tokens count toward your usage.',
  },
  {
    question: 'How is billing calculated?',
    answer: 'For pay-per-use, you\'re billed based on the number of tokens processed. We charge $0.0015 per 1,000 tokens for most models. Billing occurs monthly, and you can set usage alerts to stay within budget.',
  },
  {
    question: 'Can I pay with crypto?',
    answer: 'Yes! We accept payments in SYN tokens, ETH, USDC, and other major cryptocurrencies. You can also stake SYN tokens to get discounted rates on API usage.',
  },
  {
    question: 'What happens if I exceed my rate limit?',
    answer: 'If you hit the rate limit, you\'ll receive a 429 error. For free tier, this is 10 requests per minute. Pay-per-use users get 100 requests per minute. Enterprise customers can request higher limits.',
  },
];

export default function Pricing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-sm mb-6">
          <Zap className="w-4 h-4" />
          Simple Pricing
        </div>
        <h1 className="text-4xl md:text-5xl font-bold mb-4">Pay for what you use</h1>
        <p className="text-neutral-400 text-lg max-w-2xl mx-auto">
          Start free with 1 million tokens. Then pay only for what you use. 
          No subscriptions, no minimums, no surprises.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-16">
        {plans.map((plan) => (
          <div 
            key={plan.name}
            className={`relative p-6 rounded-xl border ${
              plan.popular 
                ? 'bg-emerald-500/5 border-emerald-500/30' 
                : 'bg-white/[0.03] border-white/[0.08]'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-black text-xs font-bold px-3 py-1 rounded-full">
                MOST POPULAR
              </div>
            )}
            <div className="mb-6">
              <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
              <p className="text-sm text-neutral-400">{plan.description}</p>
            </div>
            <div className="mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-neutral-500">{plan.period}</span>
              </div>
              <p className="text-sm text-emerald-400 mt-2">{plan.tokens} tokens</p>
            </div>
            <ul className="space-y-3 mb-8">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-emerald-400" />
                  {feature}
                </li>
              ))}
            </ul>
            <Link 
              to={plan.href}
              className={`block text-center py-3 rounded-lg font-medium transition-colors ${
                plan.popular 
                  ? 'bg-emerald-500 text-black hover:bg-emerald-400' 
                  : 'bg-white/[0.05] border border-white/[0.08] text-white hover:bg-white/[0.08]'
              }`}
            >
              {plan.cta}
            </Link>
          </div>
        ))}
      </div>

      {/* Comparison Table */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-center mb-8">Compare Plans</h2>
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-white/[0.03]">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-neutral-400">Feature</th>
                <th className="text-center px-6 py-4 text-sm font-medium text-neutral-400">Free Trial</th>
                <th className="text-center px-6 py-4 text-sm font-medium text-emerald-400">Pay Per Use</th>
                <th className="text-center px-6 py-4 text-sm font-medium text-neutral-400">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {comparisonFeatures.map((feature) => (
                <tr key={feature.name} className="hover:bg-white/[0.02]">
                  <td className="px-6 py-4 text-sm">{feature.name}</td>
                  <td className="px-6 py-4 text-center text-sm text-neutral-400">
                    {typeof feature.free === 'boolean' ? (
                      feature.free ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : '-'
                    ) : feature.free}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-emerald-400">
                    {typeof feature.payg === 'boolean' ? (
                      feature.payg ? <Check className="w-4 h-4 mx-auto" /> : '-'
                    ) : feature.payg}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-neutral-400">
                    {typeof feature.enterprise === 'boolean' ? (
                      feature.enterprise ? <Check className="w-4 h-4 text-emerald-400 mx-auto" /> : '-'
                    ) : feature.enterprise}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((faq, index) => (
            <div 
              key={index}
              className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                <span className="font-medium">{faq.question}</span>
                {openFaq === index ? (
                  <ChevronUp className="w-5 h-5 text-neutral-500" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-neutral-500" />
                )}
              </button>
              {openFaq === index && (
                <div className="px-4 pb-4">
                  <p className="text-neutral-400">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-4">Still have questions?</h2>
        <p className="text-neutral-400 mb-6">Our team is here to help you choose the right plan.</p>
        <div className="flex flex-wrap justify-center gap-4">
          <a 
            href="https://discord.gg/synapse"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-emerald-500 text-black px-6 py-3 rounded-lg font-medium hover:bg-emerald-400 transition-colors"
          >
            Chat with us
          </a>
          <a 
            href="mailto:sales@synapse.network"
            className="bg-white/[0.05] border border-white/[0.08] text-white px-6 py-3 rounded-lg font-medium hover:bg-white/[0.08] transition-colors"
          >
            Contact Sales
          </a>
        </div>
      </div>
    </div>
  );
}
