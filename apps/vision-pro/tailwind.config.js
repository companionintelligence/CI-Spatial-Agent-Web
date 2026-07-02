/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Canonical CI design tokens — resolve to the CSS custom properties
        // defined in @ci-avatar/core/styles/globals.css (:root / .dark).
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: 'var(--card)',
        'card-foreground': 'var(--card-foreground)',
        popover: 'var(--popover)',
        'popover-foreground': 'var(--popover-foreground)',
        primary: 'var(--primary)',
        'primary-foreground': 'var(--primary-foreground)',
        secondary: 'var(--secondary)',
        'secondary-foreground': 'var(--secondary-foreground)',
        muted: 'var(--muted)',
        'muted-foreground': 'var(--muted-foreground)',
        accent: 'var(--accent)',
        'accent-foreground': 'var(--accent-foreground)',
        destructive: 'var(--destructive)',
        'destructive-foreground': 'var(--destructive-foreground)',
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        // Retained CI teal aliases (used by the first-wave normalization).
        'ci-teal': '#abd4d8',
        'ci-cyan': '#0f717a',
        'dark-bg': '#041620',
        'dark-bg-secondary': '#1B1E20',
      },
      fontFamily: {
        'sans': ['Montserrat', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        'inter': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      backdropBlur: {
        'xs': '0.5rem',
        'sm': '1.25rem',
        'md': '1.5rem',
      },
      boxShadow: {
        'ci': '0 0.125rem 0.25rem rgba(0,0,0,0.04)',
        'ci-lg': '0 0.25rem 0.5rem rgba(0,0,0,0.15)',
        'ci-glow': '0 0 0.5rem rgba(15, 113, 122, 0.5)',
      },
      backgroundImage: {  
        'gradient-radial': 'radial-gradient(circle at top, #041620 0%, #1B1E20 100%)',
        'gradient-panel': 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
        'gradient-panel-light': 'linear-gradient(180deg, rgba(16,25,30,0.3) 0%, rgba(17,43,48,0.0) 100%)',
        'gradient-button': 'linear-gradient(135deg, rgba(0,131,145,0.25) 0%, rgba(0,131,145,0.12) 100%)',
        'gradient-message-user': 'linear-gradient(135deg, rgba(0,131,145,0.25) 0%, rgba(0,131,145,0.12) 100%)',
        'gradient-message-assistant': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
        'gradient-avatar-user': 'linear-gradient(135deg, #0f717a, #abd4d8)',
        'gradient-avatar-assistant': 'linear-gradient(135deg, #abd4d8, #0f717a)',
        'gradient-indicator': 'linear-gradient(45deg, #0f717a, #abd4d8)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        'scale-hover': 'scaleHover 0.2s ease',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        scaleHover: {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.05)' },
        },
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: true, // This includes Tailwind's CSS reset
  }
};
