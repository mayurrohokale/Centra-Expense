/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Plus Jakarta Sans — headings, numbers, buttons, brand
        jakarta: ["'Plus Jakarta Sans'", 'sans-serif'],
        // Inter — body, labels
        inter: ["'Inter'", 'sans-serif'],
      },
      colors: {
        ink: '#2a2733',
        muted: { DEFAULT: '#7a7387', soft: '#9b94a8', faint: '#b3acc0' },
        appbg: '#FBF8F4',
        cardBorder: '#f1ecf6',
        coral: '#FF8A7A',
        pink: '#FF6FA5',
        purple: '#A78BFA',
        purpleDeep: '#6C5CE7',
        expense: '#FF6B5E',
        teal: '#2BC4B0',
        green: { DEFAULT: '#1FAE63', bright: '#34D39E', dark: '#16a34a' },
        amber: { DEFAULT: '#FFB23E', deep: '#FF9F1C', soft: '#FFC247', pale: '#FFD166' },
      },
      backgroundImage: {
        // Signature brand gradient coral → pink → purple
        'brand-gradient': 'linear-gradient(135deg,#FF8A7A,#FF6FA5 55%,#A78BFA)',
        'teal-strip': 'linear-gradient(120deg,#2BC4B0 0%,#4ECDC4 60%,#7BE3C9 100%)',
        'invest-card': 'linear-gradient(140deg,#6C5CE7 0%,#A78BFA 55%,#C8A2FF 100%)',
      },
      borderRadius: {
        card: '24px',
        bigcard: '30px',
      },
    },
  },
  plugins: [],
};
