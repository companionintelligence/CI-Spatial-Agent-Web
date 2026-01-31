/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'ci-blue': '#4a90e2',
        'ci-purple': '#7b68ee',
        'ci-teal': '#00A0AF',
        'ci-cyan': '#13C4D1',
        'ci-orange': '#FF6B35',
        'dark-bg': '#0F1113',
        'dark-bg-secondary': '#1B1E20',
      },
      fontFamily: {
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
        'ci-glow': '0 0 0.5rem rgba(74, 144, 226, 0.5)',
      },
      backgroundImage: {  
        'gradient-radial': 'radial-gradient(circle at top, #0F1113 0%, #1B1E20 100%)',
        'gradient-panel': 'linear-gradient(180deg, rgba(16,25,30,0.6) 0%, rgba(17,43,48,0.6) 100%)',
        'gradient-panel-light': 'linear-gradient(180deg, rgba(16,25,30,0.3) 0%, rgba(17,43,48,0.0) 100%)',
        'gradient-button': 'linear-gradient(135deg, rgba(0,131,145,0.25) 0%, rgba(0,131,145,0.12) 100%)',
        'gradient-message-user': 'linear-gradient(135deg, rgba(0,131,145,0.25) 0%, rgba(0,131,145,0.12) 100%)',
        'gradient-message-assistant': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
        'gradient-avatar-user': 'linear-gradient(135deg, #4a90e2, #7b68ee)',
        'gradient-avatar-assistant': 'linear-gradient(135deg, #00A0AF, #13C4D1)',
        'gradient-indicator': 'linear-gradient(45deg, #4a90e2, #7b68ee)',
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
