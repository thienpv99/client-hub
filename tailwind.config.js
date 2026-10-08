// Single source of truth for design tokens.
// Used by Vite/PostCSS builds AND by nobuild.html (Tailwind Play CDN) — keep it a plain object (no require/plugins).
const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // `hover:` (and group-/peer-hover) only on devices that really hover: a tap on iPad / phones never leaves a card
  // lifted or a row filled (iOS keeps :hover after a tap). Touch keeps its own affordances (pointer:coarse rules).
  future: { hoverOnlyWhenSupported: true },
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1440px' } },
    // Shadow-COLOUR utilities from the palette, minus the colour names that are also box-shadow tokens: `colors.card`
    // would otherwise generate a second `.shadow-card` rule (--tw-shadow-color: white) that repaints the card shadow
    // white. No shadow-colour utility is used in src; the rest of the palette stays available.
    boxShadowColor: ({ theme }) => {
      const { card: _card, popover: _popover, ...rest } = theme('colors');
      return rest;
    },
    extend: {
      colors: {
        border: c('border'),
        input: c('border'),
        ring: c('primary'),
        background: c('background'),
        foreground: c('foreground'),
        card: { DEFAULT: c('card'), foreground: c('foreground') },
        popover: { DEFAULT: c('card'), foreground: c('foreground') },
        primary: {
          DEFAULT: c('primary'),
          foreground: c('primary-foreground'),
          hover: c('primary-hover'),
          soft: c('primary-soft'),
          border: c('primary-border'),
        },
        secondary: { DEFAULT: c('muted'), foreground: c('foreground') },
        muted: { DEFAULT: c('muted'), foreground: c('muted-foreground') },
        caption: c('caption'),
        accent: { DEFAULT: c('primary-soft'), foreground: c('primary') },
        destructive: { DEFAULT: c('danger'), foreground: c('primary-foreground') },
        success: { DEFAULT: c('success'), soft: c('success-soft') },
        warning: { DEFAULT: c('warning'), soft: c('warning-soft') },
        danger: { DEFAULT: c('danger'), soft: c('danger-soft') },
        note: { DEFAULT: c('note'), border: c('note-border') },
        // Executive Calm refresh (DESIGN.md)
        subtle: c('subtle'),
        sidebar: c('sidebar'),
        'border-strong': c('border-strong'),
        ink: c('ink'),
        chart: { 1: c('chart-1'), 2: c('chart-2'), 3: c('chart-3'), 4: c('chart-4') },
      },
      letterSpacing: { tightish: '-0.011em', display: '-0.022em' },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        micro: ['12px', '16px'],
        caption: ['13px', '18px'],
        table: ['14px', '20px'],
        body: ['15px', '24px'],
        heading: ['17px', '24px'],
        title: ['20px', '28px'],
        display: ['28px', '34px'],
        kpi: ['30px', '36px'],
        'kpi-lg': ['36px', '40px'],
      },
      borderRadius: { md: '6px', lg: '8px', xl: '12px', '2xl': '16px' },
      boxShadow: {
        xs: '0 1px 2px rgba(15, 23, 42, 0.05)',
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 0 0 1px rgba(15, 23, 42, 0.02)',
        'card-hover': '0 6px 16px -4px rgba(15, 23, 42, 0.10), 0 2px 4px -2px rgba(15, 23, 42, 0.05)',
        pop: '0 16px 40px -12px rgba(15, 23, 42, 0.22), 0 4px 10px -4px rgba(15, 23, 42, 0.08)',
        drawer: '-16px 0 40px -12px rgba(15, 23, 42, 0.18)',
        btn: 'inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 1px 2px rgba(29, 78, 216, 0.30)',
        'btn-secondary': '0 1px 2px rgba(15, 23, 42, 0.06)',
        focus: '0 0 0 3px rgba(29, 78, 216, 0.18)',
        // active segment of a segmented control (Tabs / ToggleGroup): soft lift + hairline. A shadow, not a ring, so
        // the keyboard focus ring (ring-2 primary) still shows on the active segment.
        segment: '0 1px 2px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(15, 23, 42, 0.05)',
      },
      // Motion v3 (DESIGN.md §8): out-quart = UI default (hover, colour, page enter, indicators); spring = things that
      // travel (dialogs, sheets, switch thumb); in-quart = quick exits.
      transitionTimingFunction: {
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
        spring: 'cubic-bezier(0.32, 0.72, 0, 1)',
        'in-quart': 'cubic-bezier(0.5, 0, 0.75, 0)',
      },
      // 120 micro (press, menus out) · 150/200 hover & colour · 220 page enter / dialog · 250 indicators · 280 sheets
      transitionDuration: { 120: '120ms', 220: '220ms', 250: '250ms', 280: '280ms' },
      maxWidth: { page: '1440px', reading: '760px' },
      spacing: { 18: '4.5rem', 'safe-b': 'env(safe-area-inset-bottom)' },
      minHeight: { tap: '44px' },
      minWidth: { tap: '44px' },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-out': { from: { opacity: '1' }, to: { opacity: '0' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        'slide-out-right': { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(100%)' } },
        'slide-in-bottom': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'slide-out-bottom': { from: { transform: 'translateY(0)' }, to: { transform: 'translateY(100%)' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'slide-out-left': { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-100%)' } },
        'slide-in-top': { from: { transform: 'translateY(-100%)' }, to: { transform: 'translateY(0)' } },
        'slide-out-top': { from: { transform: 'translateY(0)' }, to: { transform: 'translateY(-100%)' } },
        'zoom-in': { from: { opacity: '0', transform: 'scale(0.97)' }, to: { opacity: '1', transform: 'scale(1)' } },
        // floating panels (popover, menu, select, tooltip): scale + fade from the Radix transform origin, nudged 4px
        // away from the trigger side (--pop-x / --pop-y are set per side by the panel classes)
        'pop-in': {
          from: { opacity: '0', transform: 'translate(var(--pop-x, 0), var(--pop-y, 4px)) scale(0.96)' },
          to: { opacity: '1', transform: 'translate(0, 0) scale(1)' },
        },
        'pop-out': { from: { opacity: '1', transform: 'scale(1)' }, to: { opacity: '0', transform: 'scale(0.97)' } },
        'dialog-in': { from: { opacity: '0', transform: 'scale(0.96)' }, to: { opacity: '1', transform: 'scale(1)' } },
        'dialog-out': { from: { opacity: '1', transform: 'scale(1)' }, to: { opacity: '0', transform: 'scale(0.98)' } },
        'check-in': { from: { opacity: '0', transform: 'scale(0.5)' }, to: { opacity: '1', transform: 'scale(1)' } },
        // page enter and the stagger recipe (`animate-rise` + style --i)
        'page-enter': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        rise: { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        // a progress fill grows from empty on first mount (no `to`: it ends on the element's own inline transform)
        'progress-grow': { from: { transform: 'translateX(-100%)' } },
        shimmer: { '0%': { backgroundPosition: '-480px 0' }, '100%': { backgroundPosition: '480px 0' } },
      },
      animation: {
        'fade-in': 'fade-in 150ms cubic-bezier(0.25, 1, 0.5, 1)',
        'fade-out': 'fade-out 120ms ease-in',
        'slide-in-right': 'slide-in-right 280ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-out-right': 'slide-out-right 200ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-in-bottom': 'slide-in-bottom 280ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-out-bottom': 'slide-out-bottom 200ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-in-left': 'slide-in-left 280ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-out-left': 'slide-out-left 200ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-in-top': 'slide-in-top 280ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-out-top': 'slide-out-top 200ms cubic-bezier(0.32, 0.72, 0, 1)',
        'zoom-in': 'zoom-in 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        'pop-in': 'pop-in 150ms cubic-bezier(0.25, 1, 0.5, 1)',
        'pop-out': 'pop-out 120ms ease-in',
        'dialog-in': 'dialog-in 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        'dialog-out': 'dialog-out 150ms cubic-bezier(0.5, 0, 0.75, 0)',
        'check-in': 'check-in 200ms cubic-bezier(0.32, 0.72, 0, 1)',
        // `backwards`, never `both`: a transform left on after the end would trap fixed children / stacking contexts
        'page-enter': 'page-enter 220ms cubic-bezier(0.25, 1, 0.5, 1) backwards',
        rise: 'rise 320ms cubic-bezier(0.25, 1, 0.5, 1) backwards',
        'progress-grow': 'progress-grow 700ms cubic-bezier(0.25, 1, 0.5, 1)',
        shimmer: 'shimmer 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
