# Network Performance Optimization Guide

## Overview
This guide covers network performance optimizations for the Synapse platform.

## 1. WebSocket Connection Pooling

### WebSocket Manager
```typescript
// src/network/websocket-pool.ts
import WebSocket from 'ws';
import EventEmitter from 'events';

interface WSConnection {
  id: string;
  ws: WebSocket;
  isAvailable: boolean;
  lastUsed: number;
  metadata: Record<string, any>;
}

export class WebSocketPool extends EventEmitter {
  private connections: Map<string, WSConnection> = new Map();
  private poolSize: number;
  private url: string;
  private reconnectInterval: number;
  private heartbeatInterval: number;
  private messageQueue: Array<{ resolve: Function; reject: Function; message: any }> = [];
  
  constructor(
    url: string,
    options: {
      poolSize?: number;
      reconnectInterval?: number;
      heartbeatInterval?: number;
    } = {}
  ) {
    super();
    this.url = url;
    this.poolSize = options.poolSize || 10;
    this.reconnectInterval = options.reconnectInterval || 5000;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    
    this.initialize();
  }
  
  private async initialize() {
    for (let i = 0; i < this.poolSize; i++) {
      await this.createConnection(`conn-${i}`);
    }
    
    this.startHeartbeat();
    this.processQueue();
  }
  
  private async createConnection(id: string): Promise<WSConnection> {
    const ws = new WebSocket(this.url, {
      handshakeTimeout: 10000,
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        clientMaxWindowBits: 10,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024
      }
    });
    
    const conn: WSConnection = {
      id,
      ws,
      isAvailable: false,
      lastUsed: Date.now(),
      metadata: {}
    };
    
    ws.on('open', () => {
      conn.isAvailable = true;
      this.emit('connection:ready', id);
    });
    
    ws.on('close', () => {
      conn.isAvailable = false;
      this.emit('connection:closed', id);
      setTimeout(() => this.createConnection(id), this.reconnectInterval);
    });
    
    ws.on('error', (error) => {
      this.emit('connection:error', id, error);
    });
    
    ws.on('message', (data) => {
      this.emit('message', id, data);
    });
    
    this.connections.set(id, conn);
    return conn;
  }
  
  async send(message: any, priority: boolean = false): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = { resolve, reject, message };
      if (priority) {
        this.messageQueue.unshift(request);
      } else {
        this.messageQueue.push(request);
      }
    });
  }
  
  private processQueue() {
    setInterval(() => {
      while (this.messageQueue.length > 0) {
        const availableConn = this.getAvailableConnection();
        if (!availableConn) break;
        const request = this.messageQueue.shift();
        if (request) {
          this.executeRequest(availableConn, request);
        }
      }
    }, 10);
  }
  
  private getAvailableConnection(): WSConnection | null {
    for (const conn of this.connections.values()) {
      if (conn.isAvailable && conn.ws.readyState === WebSocket.OPEN) {
        conn.isAvailable = false;
        conn.lastUsed = Date.now();
        return conn;
      }
    }
    return null;
  }
  
  private startHeartbeat() {
    setInterval(() => {
      for (const conn of this.connections.values()) {
        if (conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.ping();
        }
      }
    }, this.heartbeatInterval);
  }
  
  getStats() {
    return {
      totalConnections: this.connections.size,
      availableConnections: Array.from(this.connections.values()).filter(c => c.isAvailable).length,
      queueLength: this.messageQueue.length
    };
  }
}
```

## 2. Gzip and Brotli Compression

```typescript
// src/middleware/compression.ts
import compression from 'compression';
import zlib from 'zlib';
import { Request, Response, NextFunction } from 'express';

export const compressionMiddleware = compression({
  threshold: 1024,
  level: 6,
  filter: (req: Request, res: Response) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
});

export const smartCompression = (req: Request, res: Response, next: NextFunction) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  
  if (acceptEncoding.includes('br')) {
    res.setHeader('Content-Encoding', 'br');
    const brotli = zlib.createBrotliCompress({
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
      }
    });
    brotli.pipe(res);
    res.write = (chunk: any) => brotli.write(chunk);
    res.end = (chunk?: any) => {
      if (chunk) brotli.write(chunk);
      brotli.end();
    };
  }
  
  next();
};
```

## 3. CDN Configuration

```yaml
# cloudfront-config.yaml
DistributionConfig:
  Enabled: true
  Comment: Synapse API CDN
  DefaultCacheBehavior:
    TargetOriginId: synapse-api
    ViewerProtocolPolicy: https-only
    CachePolicyId: 658327ea-f89d-4fab-a63d-7e88639e58f6
    Compress: true
    AllowedMethods:
      - GET
      - HEAD
      - OPTIONS
      - PUT
      - POST
      - PATCH
      - DELETE
    MinTTL: 0
    DefaultTTL: 86400
    MaxTTL: 31536000
  
  CacheBehaviors:
    - PathPattern: /static/*
      TargetOriginId: synapse-api
      ViewerProtocolPolicy: https-only
      MinTTL: 86400
      DefaultTTL: 604800
      MaxTTL: 31536000
```

## 4. Edge Caching with Varnish

```vcl
# varnish.vcl
vcl 4.1;

backend default {
    .host = "api.synapse.network";
    .port = "80";
    .probe = {
        .url = "/health";
        .timeout = 2s;
        .interval = 5s;
        .window = 5;
        .threshold = 3;
    }
}

sub vcl_recv {
    # Normalize query string
    set req.url = regsuball(req.url, "[?&](utm_|fbclid|gclid)=[^&]+", "");
    
    # Don't cache authenticated requests
    if (req.http.Authorization) {
        return (pass);
    }
    
    # Don't cache non-GET/HEAD
    if (req.method != "GET" && req.method != "HEAD") {
        return (pass);
    }
    
    # Cache static assets
    if (req.url ~ "\.(css|js|png|jpg|jpeg|gif|ico|svg)$") {
        unset req.http.Cookie;
        return (hash);
    }
    
    unset req.http.Cookie;
    return (hash);
}

sub vcl_backend_response {
    if (bereq.url ~ "\.(css|js)$") {
        set beresp.ttl = 1y;
        set beresp.grace = 7d;
    } elsif (bereq.url ~ "\.(png|jpg|jpeg|gif)$") {
        set beresp.ttl = 6M;
        set beresp.grace = 1M;
    }
    return (deliver);
}
```

## 5. HTTP/2 and HTTP/3 Configuration

```typescript
// src/server/http2.ts
import http2 from 'http2';
import fs from 'fs';

export const createHTTP2Server = (port: number) => {
  const server = http2.createSecureServer({
    key: fs.readFileSync('./ssl/key.pem'),
    cert: fs.readFileSync('./ssl/cert.pem'),
    allowHTTP1: true,
    settings: {
      headerTableSize: 4096,
      enablePush: false,
      initialWindowSize: 65535,
      maxFrameSize: 16384,
      maxConcurrentStreams: 100,
      maxHeaderListSize: 65535
    }
  });
  
  server.on('stream', (stream, headers) => {
    const path = headers[':path'];
    
    stream.respond({
      ':status': 200,
      'content-type': 'application/json'
    });
    stream.end(JSON.stringify({ path, status: 'ok' }));
  });
  
  server.listen(port);
  return server;
};
```

## 6. Connection Keep-Alive

```typescript
// src/network/keepalive.ts
import http from 'http';
import https from 'https';

export const createKeepAliveAgent = () => {
  return new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 60000,
    freeSocketTimeout: 30000
  });
};

export const createHttpsKeepAliveAgent = () => {
  return new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 60000,
    freeSocketTimeout: 30000
  });
};
```

## 7. DNS Prefetch and Preconnect

```html
<!-- Add to HTML head -->
<link rel="dns-prefetch" href="//api.synapse.network">
<link rel="preconnect" href="https://api.synapse.network" crossorigin>
<link rel="prefetch" href="//cdn.synapse.network/critical.js">
```

## 8. Network Optimization Checklist

- [ ] Enable HTTP/2 or HTTP/3
- [ ] Implement WebSocket connection pooling
- [ ] Use Brotli compression (better than gzip)
- [ ] Configure CDN with proper cache headers
- [ ] Implement edge caching (Varnish/CloudFront)
- [ ] Enable keep-alive connections
- [ ] Use connection pooling for external APIs
- [ ] Implement DNS prefetching
- [ ] Configure TLS 1.3
- [ ] Use OCSP stapling
