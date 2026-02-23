import { useEffect } from 'react';

interface HelmetProps {
  pathname: string;
}

const defaultMeta = {
  title: 'Synapse | Decentralized AI Compute Network',
  description: 'Access distributed GPU compute power for AI inference and training. 90% cheaper than traditional providers. Run AI inference on a global mesh of GPUs.',
  keywords: 'decentralized AI, GPU compute, blockchain, machine learning, inference, Web3, SYN token',
  ogImage: 'https://synapse.network/og-image.png',
};

const routeMeta: Record<string, Partial<typeof defaultMeta>> = {
  '/': {
    title: 'Synapse | Decentralized AI Compute Network',
    description: 'Run AI inference on a global mesh of GPUs. 90% cheaper than OpenAI. 100% decentralized.',
  },
  '/dashboard': {
    title: 'Dashboard | Synapse',
    description: 'Manage your API keys, view usage statistics, and monitor your SYN token balance.',
  },
  '/nodes': {
    title: 'Node Operator | Synapse',
    description: 'Register compute nodes, track earnings, and manage your AI infrastructure on Synapse.',
  },
  '/governance': {
    title: 'Governance | Synapse',
    description: 'Participate in protocol governance. View proposals, cast votes, and shape the future of Synapse.',
  },
  '/pricing': {
    title: 'Pricing | Synapse',
    description: 'Simple, transparent pricing. Start with 1M free tokens. Only $0.0015 per 1K tokens after.',
  },
  '/docs': {
    title: 'Documentation | Synapse',
    description: 'Everything you need to build with Synapse Protocol. API reference, SDK guides, and node setup instructions.',
  },
  '/docs/api': {
    title: 'API Reference | Synapse',
    description: 'Complete API documentation for the Synapse decentralized AI compute network.',
  },
  '/docs/sdk': {
    title: 'SDK Documentation | Synapse',
    description: 'JavaScript, TypeScript, Python, and Go SDKs for integrating with Synapse Protocol.',
  },
  '/docs/quickstart': {
    title: 'Quick Start | Synapse',
    description: 'Get up and running with Synapse in minutes. Generate your API key and make your first request.',
  },
  '/docs/node-setup': {
    title: 'Node Setup | Synapse',
    description: 'Set up your GPU node and start earning SYN tokens. Hardware requirements and installation guide.',
  },
};

export function Helmet({ pathname }: HelmetProps) {
  const meta = { ...defaultMeta, ...routeMeta[pathname] };

  useEffect(() => {
    // Update title
    document.title = meta.title;

    // Update meta tags
    const updateMetaTag = (name: string, content: string, property = false) => {
      const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
      let element = document.querySelector(selector) as HTMLMetaElement;
      
      if (!element) {
        element = document.createElement('meta');
        if (property) {
          element.setAttribute('property', name);
        } else {
          element.setAttribute('name', name);
        }
        document.head.appendChild(element);
      }
      
      element.setAttribute('content', content);
    };

    updateMetaTag('description', meta.description);
    updateMetaTag('keywords', meta.keywords);
    updateMetaTag('og:title', meta.title, true);
    updateMetaTag('og:description', meta.description, true);
    updateMetaTag('og:image', meta.ogImage, true);
    updateMetaTag('twitter:title', meta.title);
    updateMetaTag('twitter:description', meta.description);
    updateMetaTag('twitter:image', meta.ogImage);

    // Update canonical link
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', `https://synapse.network${pathname}`);

  }, [pathname, meta]);

  return null;
}
