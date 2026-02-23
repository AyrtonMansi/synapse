# Quick Reference: Performance Checklist

## Frontend Performance

### Build Optimizations
- [ ] Code splitting with React.lazy()
- [ ] Tree shaking enabled
- [ ] Webpack/Vite optimization
- [ ] Gzip/Brotli compression
- [ ] Asset minification
- [ ] CSS extraction and minification

### Runtime Optimizations
- [ ] Service Worker caching
- [ ] Image optimization (WebP, lazy loading)
- [ ] Font optimization (subset, preload)
- [ ] Third-party script optimization
- [ ] Intersection Observer for lazy loading
- [ ] Debounce/throttle scroll/resize events

### Network Optimizations
- [ ] HTTP/2 or HTTP/3 enabled
- [ ] Resource hints (dns-prefetch, preconnect)
- [ ] Critical CSS inlined
- [ ] Lazy load non-critical CSS
- [ ] Prefetch critical routes

## Backend Performance

### Database
- [ ] Connection pooling configured
- [ ] Query optimization (indexes, EXPLAIN)
- [ ] Read replicas for scaling
- [ ] Query result caching
- [ ] Batch operations
- [ ] Prepared statements

### Caching
- [ ] Redis caching layer
- [ ] HTTP caching headers
- [ ] CDN configuration
- [ ] Edge caching (Varnish)
- [ ] Cache warming for hot data
- [ ] Cache invalidation strategy

### API Optimization
- [ ] Pagination implemented
- [ ] Response compression
- [ ] Rate limiting
- [ ] Request batching
- [ ] Async processing for heavy tasks
- [ ] Connection keep-alive

## Node Performance

### GPU Optimization
- [ ] CUDA kernel optimization
- [ ] Mixed precision (FP16)
- [ ] Memory pool management
- [ ] Stream parallelization
- [ ] TensorRT optimization

### Model Optimization
- [ ] Model quantization (INT8)
- [ ] Batch inference
- [ ] Model pruning
- [ ] Dynamic batching
- [ ] Model caching

### Resource Management
- [ ] Gradient checkpointing
- [ ] CPU offloading
- [ ] Memory-efficient attention
- [ ] Garbage collection tuning
- [ ] Async I/O operations

## Network Performance

### WebSocket Optimization
- [ ] Connection pooling
- [ ] Message compression
- [ ] Heartbeat mechanism
- [ ] Reconnection logic
- [ ] Rate limiting per connection

### Infrastructure
- [ ] Load balancer configured
- [ ] Health checks enabled
- [ ] Circuit breaker pattern
- [ ] Auto-scaling configured
- [ ] Geographic distribution

## Monitoring Checklist

### Metrics Collection
- [ ] Prometheus scraping configured
- [ ] Custom business metrics
- [ ] Infrastructure metrics
- [ ] Application metrics (latency, errors)
- [ ] Resource utilization metrics

### Alerting
- [ ] Critical alerts configured
- [ ] Warning alerts configured
- [ ] Alert routing rules
- [ ] On-call rotation
- [ ] Alert threshold tuning

### Dashboards
- [ ] Platform overview dashboard
- [ ] Service-specific dashboards
- [ ] Business metrics dashboard
- [ ] Infrastructure dashboard
- [ ] Mobile-friendly dashboards

### Logging
- [ ] Structured logging
- [ ] Log aggregation
- [ ] Error tracking
- [ ] Audit logging
- [ ] Log retention policy

## Performance Targets

### Frontend
- First Contentful Paint: < 1.8s
- Largest Contentful Paint: < 2.5s
- Time to Interactive: < 3.8s
- Cumulative Layout Shift: < 0.1
- Total Bundle Size: < 200KB (gzipped)

### Backend
- API Response Time (p99): < 500ms
- Database Query Time (p99): < 100ms
- Cache Hit Rate: > 90%
- Error Rate: < 0.1%
- Throughput: > 1000 req/s

### Node
- Inference Latency (p99): < 100ms
- GPU Utilization: > 70%
- Memory Usage: < 80%
- Job Processing Rate: > 100/min
- Queue Depth: < 50
