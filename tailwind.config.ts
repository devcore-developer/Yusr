import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          dark: 'hsl(var(--primary-dark))',
          50: 'hsl(var(--primary-50))',
          100: 'hsl(var(--primary-100))',
          600: 'hsl(var(--primary-600))',
          700: 'hsl(var(--primary-700))',
          800: 'hsl(var(--primary-800))',
          900: 'hsl(var(--primary-900))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
          50: 'hsl(var(--secondary-50))',
          100: 'hsl(var(--secondary-100))',
          600: 'hsl(var(--secondary-600))',
          700: 'hsl(var(--secondary-700))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
          50: 'hsl(var(--accent-50))',
          100: 'hsl(var(--accent-100))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: '0 0% 100%',
          50: 'hsl(var(--success-50))',
          100: 'hsl(var(--success-100))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: '0 0% 100%',
          50: 'hsl(var(--warning-50))',
          100: 'hsl(var(--warning-100))',
        },
        danger: {
          DEFAULT: 'hsl(var(--danger))',
          foreground: '0 0% 100%',
          50: 'hsl(var(--danger-50))',
          100: 'hsl(var(--danger-100))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: '0 0% 100%',
          50: 'hsl(var(--info-50))',
          100: 'hsl(var(--info-100))',
        },
        violet: {
          DEFAULT: 'hsl(var(--violet))',
          50: 'hsl(var(--violet-50))',
          100: 'hsl(var(--violet-100))',
          600: 'hsl(var(--violet-600))',
        },
        amber: {
          DEFAULT: 'hsl(var(--amber))',
          50: 'hsl(var(--amber-50))',
          100: 'hsl(var(--amber-100))',
          600: 'hsl(var(--amber-600))',
        },
        background: 'hsl(var(--background))',
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          muted: 'hsl(var(--surface-muted))',
          subtle: 'hsl(var(--surface-subtle))',
        },
        border: 'hsl(var(--border))',
        foreground: 'hsl(var(--foreground))',
        'foreground-strong': 'hsl(var(--foreground-strong))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
      },
      fontFamily: {
        sans: ['var(--font-almarai)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        DEFAULT: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        premium: '0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.03)',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
        '250': '250ms',
      },
      fontSize: {
        'page-title': ['1.75rem', { lineHeight: '2.25rem', fontWeight: '700' }], // 28px
        'section': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }], // 20px
        'card-title': ['1.0625rem', { lineHeight: '1.5rem', fontWeight: '600' }], // 17px
        'kpi': ['2.25rem', { lineHeight: '2.5rem', fontWeight: '700' }], // 36px
      },
      maxWidth: {
        sidebar: '17.5rem',
      },
      height: {
        header: '64px', // أكثر ضغطاً واحترافية
      },
    },
  },
  plugins: [],
}
export default config