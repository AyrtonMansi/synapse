/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Terminal color palette
        terminal: {
          bg: '#0a0a0a',
          surface: '#111111',
          elevated: '#1a1a1a',
          border: '#262626',
          muted: '#404040',
          text: '#e5e5e5',
          dim: '#a3a3a3',
          accent: '#10b981', // Emerald green
          accentDim: '#059669',
          accentGlow: 'rgba(16, 185, 129, 0.3)',
          cyan: '#22d3ee',
          amber: '#f59e0b',
          red: '#ef4444',
          purple: '#a855f7',
        },
        synapse: {
          black: '#0a0a0a',
          dark: '#111111',
          gray: '#1a1a1a',
          light: '#2a2a2a',
          green: '#10b981',
          cyan: '#22d3ee',
          amber: '#f59e0b',
          red: '#ef4444',
          white: '#e5e5e5',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': '0.625rem',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      animation: {
        // Terminal cursor
        'cursor-blink': 'blink 1s step-end infinite',
        'cursor-blink-slow': 'blink 1.5s step-end infinite',
        // Scanline effect
        'scanline': 'scanline 8s linear infinite',
        // Glow effects
        'glow': 'glow 2s ease-in-out infinite alternate',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        // Loading states
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        // Fade in
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        // Typing effect
        'typing': 'typing 2s steps(40, end)',
        // Grid animation
        'grid-move': 'gridMove 20s linear infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(16, 185, 129, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(16, 185, 129, 0.8), 0 0 40px rgba(16, 185, 129, 0.4)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)' },
          '50%': { opacity: '0.8', boxShadow: '0 0 20px rgba(16, 185, 129, 0.8)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        typing: {
          'from': { width: '0' },
          'to': { width: '100%' },
        },
        gridMove: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '50px 50px' },
        },
      },
      backgroundImage: {
        'grid-pattern': 'radial-gradient(circle, #262626 1px, transparent 1px)',
        'grid-pattern-dense': 'radial-gradient(circle, #333333 1px, transparent 1px)',
        'dot-pattern': 'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)',
        'terminal-gradient': 'linear-gradient(180deg, rgba(16, 185, 129, 0.05) 0%, transparent 100%)',
      },
      boxShadow: {
        'terminal': '0 0 0 1px rgba(38, 38, 38, 1)',
        'terminal-glow': '0 0 20px rgba(16, 185, 129, 0.3)',
        'terminal-glow-sm': '0 0 10px rgba(16, 185, 129, 0.2)',
      },
      transitionTimingFunction: {
        'terminal': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [
    // Custom plugin for terminal-specific utilities
    function({ addComponents, addUtilities }: { addComponents: Function; addUtilities: Function }) {
      addComponents({
        '.terminal-window': {
          '@apply bg-terminal-surface border border-terminal-border rounded-lg overflow-hidden': {},
        },
        '.terminal-header': {
          '@apply bg-terminal-elevated border-b border-terminal-border px-4 py-2 flex items-center justify-between': {},
        },
        '.terminal-body': {
          '@apply p-4 font-mono text-sm': {},
        },
        '.terminal-prompt': {
          '@apply text-terminal-accent': {},
        },
        '.terminal-input': {
          '@apply bg-terminal-bg border border-terminal-border rounded px-3 py-2 font-mono text-sm focus:border-terminal-accent focus:outline-none transition-colors': {},
        },
        '.terminal-button': {
          '@apply bg-terminal-accent/10 border border-terminal-accent/50 text-terminal-accent px-4 py-2 rounded font-mono text-sm hover:bg-terminal-accent/20 transition-all': {},
        },
        '.terminal-button-primary': {
          '@apply bg-terminal-accent text-terminal-bg px-4 py-2 rounded font-medium hover:bg-terminal-accentDim transition-colors': {},
        },
        '.terminal-card': {
          '@apply bg-terminal-surface/50 border border-terminal-border rounded-lg p-6 hover:border-terminal-accent/30 transition-all duration-300': {},
        },
        '.terminal-code': {
          '@apply bg-terminal-bg border border-terminal-border rounded-lg p-4 font-mono text-sm overflow-x-auto': {},
        },
      });

      addUtilities({
        '.text-glow': {
          'text-shadow': '0 0 10px currentColor',
        },
        '.text-glow-sm': {
          'text-shadow': '0 0 5px currentColor',
        },
        '.terminal-scrollbar': {
          'scrollbar-width': 'thin',
          'scrollbar-color': '#404040 #0a0a0a',
        },
        '.terminal-scrollbar::-webkit-scrollbar': {
          width: '6px',
          height: '6px',
        },
        '.terminal-scrollbar::-webkit-scrollbar-track': {
          background: '#0a0a0a',
        },
        '.terminal-scrollbar::-webkit-scrollbar-thumb': {
          background: '#404040',
          borderRadius: '3px',
        },
        '.terminal-scrollbar::-webkit-scrollbar-thumb:hover': {
          background: '#525252',
        },
      });
    },
  ],
}
