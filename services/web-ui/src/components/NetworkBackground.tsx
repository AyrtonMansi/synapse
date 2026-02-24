import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  connections: number;
  pulse: number;
}

export function NetworkBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Initialize particles (nodes)
    const particleCount = 50;
    particlesRef.current = Array.from({ length: particleCount }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 2 + 1,
      connections: 0,
      pulse: Math.random() * Math.PI * 2,
    }));

    const animate = () => {
      ctx.fillStyle = 'rgba(10, 10, 10, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;

      // Update and draw particles
      particles.forEach((particle, i) => {
        // Move
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.pulse += 0.02;

        // Bounce off edges
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;

        // Draw node
        const alpha = 0.3 + Math.sin(particle.pulse) * 0.2;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 136, ${alpha})`;
        ctx.fill();

        // Glow effect
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 255, 136, ${alpha * 0.1})`;
        ctx.fill();

        // Draw connections
        particle.connections = 0;
        particles.forEach((other, j) => {
          if (i === j) return;
          
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 120 && particle.connections < 3) {
            particle.connections++;
            const connectionAlpha = (1 - distance / 120) * 0.15;
            
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `rgba(0, 255, 136, ${connectionAlpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();

            // Occasional pulse along connection
            if (Math.random() < 0.001) {
              const pulseX = particle.x + (other.x - particle.x) * 0.5;
              const pulseY = particle.y + (other.y - particle.y) * 0.5;
              ctx.beginPath();
              ctx.arc(pulseX, pulseY, 2, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(0, 255, 136, 0.8)';
              ctx.fill();
            }
          }
        });
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.6 }}
    />
  );
}
