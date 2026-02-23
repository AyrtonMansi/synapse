# Frontend Performance Optimization Guide

## Overview
This guide covers performance optimizations for the Synapse Frontend platform.

## 1. Code Splitting with React.lazy()

### Dynamic Imports Configuration
```typescript
// src/routes/index.tsx
import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// Lazy load route components
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const JobBoard = lazy(() => import('@/pages/JobBoard'));
const NodeStatus = lazy(() => import('@/pages/NodeStatus'));
const Payments = lazy(() => import('@/pages/Payments'));
const Settings = lazy(() => import('@/pages/Settings'));
const Analytics = lazy(() => import('@/pages/Analytics'));

// Preload critical routes
const preloadDashboard = () => {
  const DashboardComponent = import('@/pages/Dashboard');
  return DashboardComponent;
};

export const AppRoutes = () => (
  <BrowserRouter>
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/jobs/*" element={<JobBoard />} />
        <Route path="/nodes/*" element={<NodeStatus />} />
        <Route path="/payments/*" element={<Payments />} />
        <Route path="/settings/*" element={<Settings />} />
        <Route path="/analytics/*" element={<Analytics />} />
      </Routes>
    </Suspense>
  </BrowserRouter>
);
```

### Component-Level Code Splitting
```typescript
// src/components/HeavyComponent/index.tsx
import { lazy, Suspense } from 'react';

const HeavyChart = lazy(() => import('./HeavyChart'));
const HeavyMap = lazy(() => import('./HeavyMap'));

export const AnalyticsDashboard = () => (
  <div>
    <Suspense fallback={<ChartSkeleton />}>
      <HeavyChart />
    </Suspense>
    <Suspense fallback={<MapSkeleton />}>
      <HeavyMap />
    </Suspense>
  </div>
);

// Prefetch on hover
export const JobCard = ({ job }: { job: Job }) => {
  const prefetchJobDetails = () => {
    const JobDetails = import('@/components/JobDetails');
  };

  return (
    <div onMouseEnter={prefetchJobDetails}>
      {/* Job card content */}
    </div>
  );
};
```

## 2. Webpack/Vite Optimization

### Vite Configuration (vite.config.ts)
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import compression from 'vite-plugin-compression';

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ['babel-plugin-transform-remove-console', { exclude: ['error', 'warn'] }]
        ]
      }
    }),
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 1024,
      deleteOriginFile: false
    }),
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024
    }),
    visualizer({
      open: false,
      gzipSize: true,
      brotliSize: true,
      filename: 'dist/stats.html'
    })
  ],
  
  build: {
    target: 'esnext',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info']
      },
      mangle: {
        safari10: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs'],
          'charts': ['recharts', 'd3'],
          'web3': ['ethers', '@web3-react/core', '@web3-react/injected-connector'],
          'utils': ['lodash-es', 'date-fns', 'zod'],
          'state': ['zustand', '@tanstack/react-query']
        },
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(assetInfo.name)) {
            return 'assets/images/[name]-[hash][extname]';
          }
          if (/\.(css)$/.test(assetInfo.name)) {
            return 'assets/css/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    },
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 500
  },
  
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'ethers',
      '@tanstack/react-query',
      'zustand'
    ],
    exclude: ['@synapse/node-client']
  },
  
  server: {
    hmr: {
      overlay: false
    }
  }
});
```

## 3. Tree Shaking

### Package.json Configuration
```json
{
  "sideEffects": [
    "*.css",
    "*.scss",
    "@/styles/*"
  ],
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    },
    "./components": {
      "import": "./dist/components.mjs"
    }
  }
}
```

### Import Best Practices
```typescript
// ❌ Bad - imports entire library
import _ from 'lodash';
import * as Icons from 'react-icons';

// ✅ Good - import only what you need
import { debounce, throttle } from 'lodash-es';
import { FaWallet, FaChartLine } from 'react-icons/fa';

// ✅ Good - use tree-shakeable imports
import { format, addDays } from 'date-fns';
// NOT: import dateFns from 'date-fns';

// Component library imports
import { Button } from '@/components/ui/Button';
// NOT: import { Button } from '@synapse/ui'; // If not tree-shakeable
```

### Barrel File Optimization
```typescript
// src/components/ui/index.ts
// ❌ Bad - re-exports everything
export * from './Button';
export * from './Input';
export * from './Card';
export * from './Dialog'; // Heavy component

// ✅ Good - selective exports with sub-paths
// src/components/ui/Button/index.ts
export { Button, type ButtonProps } from './Button';

// Users import directly
import { Button } from '@/components/ui/Button';
```

## 4. Image Optimization (WebP, Lazy Loading)

### Image Component
```typescript
// src/components/ui/OptimizedImage.tsx
import { useState, useEffect, useRef } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  placeholder?: string;
  priority?: boolean;
}

export const OptimizedImage = ({
  src,
  alt,
  width,
  height,
  className,
  placeholder = '/images/placeholder.svg',
  priority = false
}: OptimizedImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (priority) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [priority]);

  // Generate responsive srcset
  const generateSrcSet = (baseSrc: string) => {
    const widths = [320, 640, 960, 1280, 1920];
    return widths
      .map(w => `/cdn/image/${baseSrc}?w=${w}&format=webp ${w}w`)
      .join(', ');
  };

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden ${className}`}
      style={{ width, height }}
    >
      {!isLoaded && (
        <img
          src={placeholder}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-sm"
        />
      )}
      {(isInView || isLoaded) && (
        <picture>
          <source
            srcSet={generateSrcSet(src)}
            type="image/webp"
          />
          <source
            srcSet={generateSrcSet(src).replace(/format=webp/g, 'format=jpeg')}
            type="image/jpeg"
          />
          <img
            src={`/cdn/image/${src}?w=800&format=jpeg`}
            alt={alt}
            width={width}
            height={height}
            loading={priority ? 'eager' : 'lazy'}
            decoding={priority ? 'sync' : 'async'}
            onLoad={() => setIsLoaded(true)}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </picture>
      )}
    </div>
  );
};
```

### Build-time Image Optimization Script
```typescript
// scripts/optimize-images.ts
import sharp from 'sharp';
import { glob } from 'glob';
import path from 'path';
import fs from 'fs/promises';

const IMAGE_DIR = './public/images';
const OUTPUT_DIR = './public/images/optimized';

async function optimizeImages() {
  const images = await glob(`${IMAGE_DIR}/**/*.{jpg,jpeg,png}`);
  
  for (const imagePath of images) {
    const filename = path.basename(imagePath, path.extname(imagePath));
    const outputDir = path.join(OUTPUT_DIR, path.relative(IMAGE_DIR, path.dirname(imagePath)));
    
    await fs.mkdir(outputDir, { recursive: true });
    
    // Generate WebP variants
    const sizes = [320, 640, 960, 1280, 1920];
    
    for (const width of sizes) {
      await sharp(imagePath)
        .resize(width, null, { withoutEnlargement: true })
        .webp({ quality: 85, effort: 6 })
        .toFile(path.join(outputDir, `${filename}-${width}.webp`));
    }
    
    // Generate AVIF variants (smaller but slower to encode)
    for (const width of [640, 1280]) {
      await sharp(imagePath)
        .resize(width, null, { withoutEnlargement: true })
        .avif({ quality: 80, effort: 4 })
        .toFile(path.join(outputDir, `${filename}-${width}.avif`));
    }
    
    // Generate blur placeholder
    const blurBuffer = await sharp(imagePath)
      .resize(20, null, { withoutEnlargement: true })
      .blur()
      .webp({ quality: 20 })
      .toBuffer();
    
    const blurDataUrl = `data:image/webp;base64,${blurBuffer.toString('base64')}`;
    
    await fs.writeFile(
      path.join(outputDir, `${filename}-blur.json`),
      JSON.stringify({ blurDataUrl })
    );
  }
  
  console.log(`Optimized ${images.length} images`);
}

optimizeImages().catch(console.error);
```

## 5. Service Worker for Caching

### Service Worker Registration
```typescript
// src/utils/serviceWorker.ts
export const registerSW = () => {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('SW registered:', registration.scope);
          
          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version available
                  showUpdateNotification(newWorker);
                }
              });
            }
          });
        })
        .catch((error) => {
          console.log('SW registration failed:', error);
        });
    });
  }
};

const showUpdateNotification = (worker: ServiceWorker) => {
  // Show "Update Available" toast
  if (confirm('New version available! Update now?')) {
    worker.postMessage({ type: 'SKIP_WAITING' });
    window.location.reload();
  }
};
```

### Service Worker (sw.js)
```javascript
// public/sw.js
const CACHE_NAME = 'synapse-v1';
const STATIC_CACHE = 'synapse-static-v1';
const DYNAMIC_CACHE = 'synapse-dynamic-v1';
const IMAGE_CACHE = 'synapse-images-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/assets/main.js',
  '/assets/main.css',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install - Cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate - Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !name.includes(CACHE_NAME))
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - Serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip external requests
  if (!url.origin.includes(self.location.origin)) return;
  
  // API requests - Network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }
  
  // Images - Cache first, network fallback
  if (request.destination === 'image') {
    event.respondWith(imageCache(request));
    return;
  }
  
  // Static assets - Cache first
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  
  // Default - Stale while revalidate
  event.respondWith(staleWhileRevalidate(request));
});

// Cache strategies
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  
  const response = await fetch(request);
  const cache = await caches.open(STATIC_CACHE);
  cache.put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    const cache = await caches.open(DYNAMIC_CACHE);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  
  const fetchPromise = fetch(request).then((response) => {
    const cache = await caches.open(DYNAMIC_CACHE);
    cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  
  return cached || fetchPromise;
}

async function imageCache(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  
  const response = await fetch(request);
  const cache = await caches.open(IMAGE_CACHE);
  cache.put(request, response.clone());
  return response;
}

// Background sync for offline mutations
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-jobs') {
    event.waitUntil(syncPendingJobs());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      data: data.url
    })
  );
});
```

## 6. Critical CSS Inlining

### Critical CSS Extraction
```typescript
// vite-plugin-critical-css.ts
import type { Plugin } from 'vite';
import { critical } from 'critical';
import { glob } from 'glob';
import path from 'path';

export function criticalCSS(): Plugin {
  return {
    name: 'critical-css',
    apply: 'build',
    enforce: 'post',
    async closeBundle() {
      const htmlFiles = await glob('dist/**/*.html');
      
      for (const file of htmlFiles) {
        await critical.generate({
          base: 'dist/',
          src: path.basename(file),
          target: {
            css: 'critical.css',
            html: path.basename(file),
            uncritical: 'uncritical.css'
          },
          width: 1920,
          height: 1080,
          extract: true,
          inline: true
        });
      }
    }
  };
}
```

### Build Script for Critical CSS
```javascript
// scripts/generate-critical-css.js
const { critical } = require('critical');
const fs = require('fs');
const path = require('path');

async function generateCriticalCSS() {
  const config = {
    base: 'dist/',
    src: 'index.html',
    dimensions: [
      { width: 375, height: 667 },   // Mobile
      { width: 768, height: 1024 },  // Tablet
      { width: 1920, height: 1080 }  // Desktop
    ],
    css: [
      'dist/assets/main-*.css'
    ],
    extract: false,
    inline: true,
    ignore: {
      atrule: ['@font-face'],
      rule: [/\.lazy/],
      decl: (node, value) => /url\(/.test(value)
    }
  };

  try {
    const { html } = await critical.generate(config);
    fs.writeFileSync('dist/index.html', html);
    console.log('✅ Critical CSS inlined successfully');
  } catch (error) {
    console.error('❌ Critical CSS generation failed:', error);
  }
}

generateCriticalCSS();
```

### HTML Template with Critical CSS
```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Synapse - Decentralized Compute Platform</title>
  
  <!-- Critical CSS (inlined) -->
  <style>
    /* Critical: Above-fold styles */
    :root {
      --color-primary: #3b82f6;
      --color-bg: #0f172a;
      --color-text: #f8fafc;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: var(--color-bg);
      color: var(--color-text);
      min-height: 100vh;
    }
    
    #root {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    /* Loading spinner (above fold) */
    .app-loader {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    
    .spinner {
      width: 48px;
      height: 48px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
  
  <!-- Preload critical fonts -->
  <link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
  
  <!-- Preload critical JavaScript -->
  <link rel="modulepreload" href="/assets/main.js">
  
  <!-- Deferred non-critical CSS -->
  <link rel="preload" href="/assets/main.css" as="style" onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="/assets/main.css"></noscript>
</head>
<body>
  <div id="root">
    <div class="app-loader">
      <div class="spinner"></div>
    </div>
  </div>
  
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

## Performance Budget Configuration

```typescript
// performance-budget.json
{
  "budgets": [
    {
      "type": "bundle",
      "name": "main",
      "maximumWarningSize": "150kb",
      "maximumErrorSize": "250kb"
    },
    {
      "type": "bundle",
      "name": "react-vendor",
      "maximumWarningSize": "100kb",
      "maximumErrorSize": "150kb"
    },
    {
      "type": "bundle",
      "name": "web3",
      "maximumWarningSize": "200kb",
      "maximumErrorSize": "300kb"
    },
    {
      "type": "asset",
      "name": "*.jpg",
      "maximumWarningSize": "100kb",
      "maximumErrorSize": "250kb"
    },
    {
      "type": "asset",
      "name": "*.png",
      "maximumWarningSize": "100kb",
      "maximumErrorSize": "250kb"
    }
  ]
}
```

## Performance Monitoring

```typescript
// src/utils/performance.ts
export const initPerformanceMonitoring = () => {
  // Web Vitals
  import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    getCLS(sendToAnalytics);
    getFID(sendToAnalytics);
    getFCP(sendToAnalytics);
    getLCP(sendToAnalytics);
    getTTFB(sendToAnalytics);
  });
  
  // Custom metrics
  observeLongTasks();
  observeLayoutShifts();
  observeResourceLoading();
};

const sendToAnalytics = (metric) => {
  // Send to analytics endpoint
  fetch('/api/analytics/web-vitals', {
    method: 'POST',
    body: JSON.stringify(metric),
    headers: { 'Content-Type': 'application/json' },
    keepalive: true
  });
};

const observeLongTasks = () => {
  if ('PerformanceObserver' in window) {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          console.warn('Long task detected:', entry.duration, 'ms');
        }
      }
    });
    observer.observe({ entryTypes: ['longtask'] });
  }
};
```

## Quick Wins Checklist

- [ ] Enable gzip/brotli compression on CDN/server
- [ ] Set proper cache headers for static assets
- [ ] Use HTTP/2 or HTTP/3
- [ ] Implement resource hints (preconnect, dns-prefetch)
- [ ] Defer non-critical JavaScript
- [ ] Use CSS containment for complex components
- [ ] Virtualize long lists
- [ ] Memoize expensive computations
- [ ] Use React.memo for pure components
- [ ] Implement proper error boundaries
