# Lolos Landing Page — Visual Specification

> **Product:** Lolos — AI-powered ATS resume builder for Indonesian job seekers.
> **Tagline:** "Ngobrol 5 menit sama Kak, CV lo jadi — dan robot HRD langsung baca."
> **Design Influence:** Linear × Vercel × Stripe — modern, elegant, premium SaaS.
> **Primary Language:** Bahasa Indonesia (English toggle available).

---

## Design System Constants

```css
/* === Color Tokens (CSS Custom Properties) === */
:root {
  /* Brand */
  --color-primary: #6366f1;
  --color-primary-hover: #4f46e5;
  --color-primary-light: rgba(99, 102, 241, 0.12);
  --color-primary-glow: rgba(99, 102, 241, 0.35);
  --color-accent: #8b5cf6;
  --color-accent-hover: #7c3aed;
  --color-accent-light: rgba(139, 92, 246, 0.12);

  /* Surfaces */
  --color-bg: #fafafa;
  --color-bg-secondary: #f5f5f5;
  --color-bg-tertiary: #eeeeee;
  --color-surface: #ffffff;
  --color-surface-hover: #fafafa;
  --color-surface-elevated: #ffffff;
  --color-border: #e5e7eb;
  --color-border-light: #f3f4f6;

  /* Text */
  --color-text-primary: #0f0f11;
  --color-text-secondary: #52525b;
  --color-text-tertiary: #a1a1aa;
  --color-text-inverse: #ffffff;

  /* Semantic */
  --color-success: #10b981;
  --color-success-bg: rgba(16, 185, 129, 0.1);
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-error-bg: rgba(239, 68, 68, 0.1);

  /* Gradients */
  --gradient-hero: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.3), transparent);
  --gradient-card: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  --gradient-glow: linear-gradient(135deg, rgba(99, 102, 241, 0.4), rgba(139, 92, 246, 0.1));

  /* Typography */
  --font-display: 'Jakarta Sans', sans-serif;
  --font-body: 'Inter', sans-serif;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;

  /* Layout */
  --max-width: 1280px;
  --page-padding: clamp(16px, 5vw, 64px);
  --section-gap: clamp(64px, 10vw, 128px);

  /* Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
  --shadow-glow: 0 0 40px rgba(99, 102, 241, 0.2);
}

/* === Dark Mode Overrides === */
.dark {
  --color-bg: #0f0f11;
  --color-bg-secondary: #18181b;
  --color-bg-tertiary: #1f1f23;
  --color-surface: #18181b;
  --color-surface-hover: #1f1f23;
  --color-surface-elevated: #27272a;
  --color-border: #27272a;
  --color-border-light: #1f1f23;
  --color-text-primary: #fafafa;
  --color-text-secondary: #a1a1aa;
  --color-text-tertiary: #52525b;
  --color-text-inverse: #0f0f11;
  --gradient-hero: radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.15), transparent);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.4);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
  --shadow-glow: 0 0 40px rgba(99, 102, 241, 0.1);
}

/* === Animation Timing Tokens === */
:root {
  --duration-micro: 150ms;
  --duration-fast: 200ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
  --duration-narrative: 1000ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --spring-gentle: { type: "spring", stiffness: 120, damping: 14 };
  --spring-snappy: { type: "spring", stiffness: 300, damping: 20 };
  --spring-bouncy: { type: "spring", stiffness: 200, damping: 10 };
}
```

---

## Section 1: Hero

### Layout Spec

```tsx
// Full viewport, no header chrome overlay for first 60px
<section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-[var(--color-bg)]">
  {/* Background gradient layer */}
  <div className="absolute inset-0 bg-[var(--gradient-hero)] pointer-events-none" />

  {/* Subtle grid pattern overlay */}
  <div
    className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
    style={{ backgroundImage: `url("data:image/svg+xml,...")`, backgroundSize: '64px 64px' }}
  />

  {/* Content container */}
  <div className="relative z-10 mx-auto w-full max-w-[var(--max-width)] px-[var(--page-padding)] flex flex-col items-center text-center">

    {/* Badge */}
    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-secondary)] mb-8">
      <span className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse" />
      <span>10,000+ CV dibuat bulan ini</span>
    </div>

    {/* Headline */}
    <h1 className="font-display text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] text-[var(--color-text-primary)] max-w-4xl">
      CV ATS-mu,{' '}
      <span className="text-transparent bg-clip-text bg-[var(--gradient-card)]">
        siap dalam hitungan menit
      </span>
    </h1>

    {/* Subheadline */}
    <p className="mt-6 text-lg sm:text-xl text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
      Ngobrol 5 menit sama Kak, AI career assistant-mu. CV langsung jadi,{' '}
      <span className="text-[var(--color-primary)] font-medium">lolos ATS</span>, siap lamar.
    </p>

    {/* CTA Group */}
    <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
      <button className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[var(--color-primary)] text-[var(--color-text-inverse)] font-semibold text-base hover:bg-[var(--color-primary-hover)] shadow-lg shadow-[var(--color-primary-glow)] transition-all duration-[var(--duration-normal)] hover:scale-[1.02] active:scale-[0.98]">
        Buat CV Gratis
        <ArrowRight className="w-4 h-4" />
      </button>
      <button className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] font-medium text-base hover:bg-[var(--color-surface-hover)] transition-all duration-[var(--duration-normal)]">
        <PlayCircle className="w-4 h-4 text-[var(--color-primary)]" />
        Lihat Demo
      </button>
    </div>

    {/* Social Proof Row */}
    <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-[var(--color-text-tertiary)]">
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          {avatars.map(a => (
            <img key={a.id} src={a.src} alt="" className="w-8 h-8 rounded-full border-2 border-[var(--color-surface)]" />
          ))}
        </div>
        <span>Dipake <strong className="text-[var(--color-text-primary)]">10,000+</strong> pencari kerja</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
        <span>Rating <strong className="text-[var(--color-text-primary)]">4.8</strong> dari 2,500+ ulasan</span>
      </div>
    </div>
  </div>

  {/* Floating 3D Resume Cards */}
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    <FloatingCard
      className="top-[15%] right-[5%] w-[280px] rotate-[8deg]"
      depth={0.3}
      offset={{ x: 40, y: -20 }}
    />
    <FloatingCard
      className="bottom-[20%] left-[5%] w-[240px] rotate-[-5deg]"
      depth={0.2}
      offset={{ x: -30, y: 30 }}
    />
    <FloatingCard
      className="top-[40%] left-[8%] w-[200px] rotate-[12deg] opacity-60"
      depth={0.15}
      offset={{ x: -20, y: -40 }}
    />
  </div>
</section>
```

**Grid:** Single column, centered. Content max-width 1280px.
**Spacing:** Section bottom padding 80px. Content gap scale: badge 32px → headline 0 → subheadline 24px → CTA 40px → social proof 48px.

### Animation Spec

```tsx
// === Headline character-by-character reveal ===
const headlineText = "CV ATS-mu, siap dalam hitungan menit";
const charVariants = {
  hidden: { opacity: 0, y: 40, rotateX: -20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: {
      delay: i * 0.03,
      type: "spring",
      stiffness: 100,
      damping: 12,
    },
  }),
};

// Usage: split headline into spans, each animated with custom prop
<h1 className="...">
  {headlineText.split("").map((char, i) => (
    <motion.span
      key={i}
      custom={i}
      variants={charVariants}
      initial="hidden"
      animate="visible"
      className="inline-block"
    >
      {char === " " ? " " : char}
    </motion.span>
  ))}
</h1>

// === Floating 3D Card with parallax ===
function FloatingCard({ className, depth, offset }: FloatingCardProps) {
  const { scrollY } = useScroll();
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Parallax on scroll
  const y = useTransform(scrollY, [0, 500], [0, offset.y]);
  const x = useTransform(scrollY, [0, 500], [0, offset.x]);

  // 3D tilt on mouse move
  const handleMouseMove = (e: MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rotateY = ((e.clientX - centerX) / rect.width) * 15 * depth;
    const rotateX = -((e.clientY - centerY) / rect.height) * 15 * depth;
    setMousePos({ x: rotateX, y: rotateY });
  };

  return (
    <motion.div
      ref={cardRef}
      className={cn("absolute", className)}
      style={{ x, y, perspective: 1000 }}
      animate={{ rotateX: mousePos.x, rotateY: mousePos.y }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      onMouseMove={handleMouseMove}
    >
      <div className="w-full rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-xl p-4">
        {/* Mock CV preview gradient */}
        <div className="h-2 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
        <div className="h-2 w-1/2 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
        <div className="h-2 w-2/3 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        <div className="flex gap-2 mb-3">
          <div className="h-8 w-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30" />
          <div>
            <div className="h-2 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
            <div className="h-2 w-14 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
        <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded mb-1.5" />
        <div className="h-2 w-5/6 bg-gray-200 dark:bg-gray-700 rounded mb-1.5" />
        <div className="h-2 w-4/5 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    </motion.div>
  );
}

// Badge entrance: fade + slide up, 0.5s delay
const badgeVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1, y: 0, scale: 1,
    transition: { delay: 0.3, duration: 0.5, ease: easeOut },
  },
};

// Social proof: stagger children
const socialProofVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 1.0 },
  },
};
```

### Mobile Adaptation

| Breakpoint | Layout Change |
|---|---|
| **320px — 767px** | Headline: `text-3xl` → `text-4xl`. Subheadline: `text-base`. Floating cards hidden (too much noise). CTA stack vertically, full-width. Social proof badge at top is compact: remove avatar images, keep count text only. Min-height: `min-h-screen` stays, but content padding increased top/bottom. All rotate transforms removed from decorative elements. |
| **768px — 1023px** | Headline: `text-5xl` → `text-6xl`. CTA horizontal again. Floating cards shown but reduced opacity and depth. Grid pattern opacity lowered. |
| **1024px+** | Full hero as described above. Floating cards visible with full parallax and 3D tilt. |

### Dark Mode

- `bg-[var(--color-bg)]` maps to `#0f0f11`.
- Gradient overlay: `rgba(99, 102, 241, 0.15)` instead of `0.3`.
- Grid pattern opacity: `0.05` instead of `0.03`.
- Card borders: `#27272a` (subtle).
- Glow shadows: reduced opacity.
- No other structural changes.

### Key Interactions

| Trigger | Behavior | Timing |
|---|---|---|
| Page load | Characters reveal sequentially (30ms stagger), badges fade up, cards float in from offscreen with spring. | 0–2s |
| Mouse move over hero | Floating cards tilt following cursor (rotateX, rotateY). Inverse direction for depth illusion. | Continuous |
| Scroll down | Cards parallax upward (useTransform mapping 0→500px scroll to 0→40px translateY). | Scroll-driven |
| CTA hover | Scale 1.02, shadow elevation increase, background shifts to primary-hover. | 200ms ease |
| CTA click (active) | Scale 0.98, brief. | 150ms |
| Secondary CTA hover | Border becomes more opaque, subtle background shift. | 200ms |
| Resize to mobile | Floating cards fade out via CSS `hidden` class at breakpoint. No animation needed — abrupt is fine. | Instant |

---

## Section 2: How It Works

### Layout Spec

```tsx
<section className="relative py-[var(--section-gap)] bg-[var(--color-bg-secondary)]">
  <div className="mx-auto max-w-[var(--max-width)] px-[var(--page-padding)]">

    {/* Section header */}
    <div className="text-center mb-16 sm:mb-20">
      <span className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-widest">
        Cara Kerja
      </span>
      <h2 className="mt-4 font-display text-3xl sm:text-4xl md:text-5xl font-bold text-[var(--color-text-primary)] tracking-tight">
        Ngobrol bentar,{' '}
        <span className="text-transparent bg-clip-text bg-[var(--gradient-card)]">
          CV langsung jadi
        </span>
      </h2>
      <p className="mt-4 text-lg text-[var(--color-text-secondary)] max-w-xl mx-auto">
        Tiga langkah sederhana menuju CV yang dilirik HRD dan lolos ATS.
      </p>
    </div>

    {/* Steps container — flex row on desktop, column on mobile */}
    <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 lg:gap-16">

      {/* Animated connecting line — only visible on md+ */}
      <div className="hidden md:block absolute top-[72px] left-[calc(16.67%+24px)] right-[calc(16.67%+24px)] h-0.5 bg-[var(--color-border)]">
        <motion.div
          className="h-full bg-[var(--gradient-card)]"
          initial={{ width: '0%' }}
          whileInView={{ width: '100%' }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
        />
      </div>

      {/* Step 1 */}
      <StepCard
        number="1"
        title="Ngobrol sama Kak"
        description="Chat via WhatsApp atau web. Kak, AI career assistant-mu, tanya pengalaman, skill, dan goals karirmu."
        illustration={<ChatDemo />}
      />

      {/* Step 2 */}
      <StepCard
        number="2"
        title="AI Bikin CV-mu"
        description="Lolos otomatis susun pengalamanmu ke template ATS-friendly. Format rapi, siap pakai dalam 5 menit."
        illustration={<CVBuilderDemo />}
      />

      {/* Step 3 */}
      <StepCard
        number="3"
        title="Lamar & Diterima"
        description="Download PDF, langsung lamar. CV-mu sudah dioptimalkan biar HRD dan robot ATS kasih lampu hijau."
        illustration={<CelebrationDemo />}
      />
    </div>
  </div>
</section>
```

**StepCard Component Layout:**
```tsx
function StepCard({ number, title, description, illustration }: StepCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="relative flex flex-col items-center text-center"
    >
      {/* Step number bubble */}
      <div className="relative z-10 w-14 h-14 rounded-full bg-[var(--gradient-card)] flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-[var(--color-primary-glow)] mb-6">
        {number}
      </div>

      {/* Illustration area */}
      <div className="w-full aspect-[4/3] rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-md overflow-hidden mb-5">
        {illustration}
      </div>

      <h3 className="font-display text-xl font-semibold text-[var(--color-text-primary)] mb-2">
        {title}
      </h3>
      <p className="text-[var(--color-text-secondary)] leading-relaxed max-w-xs">
        {description}
      </p>
    </motion.div>
  );
}
```

**Illustration Details:**

1. **ChatDemo** — Mini chat UI showing 4 bubbles. User messages (gray): "Halo! Aku lulusan S1 Teknik Informatika" / "Aku punya pengalaman 2 tahun di startup". AI messages (indigo): "Wah, keren! Coba ceritain lebih detail" / "Oke, CV-mu sudah mulai tersusun!". Typing indicator at bottom. Pulsing dot animation on last bubble.

2. **CVBuilderDemo** — Animated CV template assembling. Sections fade in sequentially: header → summary → experience (3 items) → education → skills. Progress bar fills from 0 to 100. Checkmark icons appear on completion. Duration: 3 seconds looped on scroll reveal.

3. **CelebrationDemo** — Confetti particles (canvas or div-based). Checkmark in circle. "ATS Score: 94%" badge. Download button pulse. Simple SVG illustration of a document with sparkles.

### Animation Spec

```tsx
// === Staggered card reveals ===
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 60 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 80,
      damping: 15,
      duration: 0.7,
    },
  },
};

// === Connecting line fill ===
const lineVariants = {
  hidden: { scaleX: 0, transformOrigin: 'left' },
  visible: {
    scaleX: 1,
    transition: { duration: 1.5, ease: [0.16, 1, 0.3, 1], delay: 0.3 },
  },
};

// === Chat bubble typing animation (within ChatDemo) ===
const typingVariants = {
  hidden: { width: 0 },
  visible: {
    width: 'auto',
    transition: { duration: 1.5, ease: 'easeInOut' },
  },
};
// Combined with typewriter effect using a state machine:
// 1. Opacity in → 2. Type text char by char → 3. Pause → 4. Next bubble
// useCycle(['typing', 'waiting', 'done']) for each bubble

// === Progress bar (within CVBuilderDemo) ===
const progressVariants = {
  hidden: { scaleX: 0 },
  visible: {
    scaleX: 1,
    transition: { duration: 2.5, ease: [0.16, 1, 0.3, 1] },
  },
};
```

### Mobile Adaptation

| Breakpoint | Layout Change |
|---|---|
| **320px — 767px** | Grid becomes single column. Cards stack vertically. Connecting line hidden. Step numbers shift to inline with title (row layout: number bubble → title). Illustration aspect: `4/3` → `16/9` for more horizontal space. Padding: section padding 48px, grid gap 32px. |
| **768px — 1023px** | 3-column grid retained but narrower. Card text `max-w-[200px]`. Smaller illustrations. Step number bubbles: 48px instead of 56px. |
| **1024px+** | Full layout as described. |

### Dark Mode

- Section background: `var(--color-bg-secondary)` → `#18181b`.
- Cards: `var(--color-surface)` → `#18181b`.
- Chat bubbles: user messages `#27272a`, AI messages `var(--color-primary)` with 20% opacity.
- Connecting line base: `var(--color-border)` → `#27272a`.

### Key Interactions

| Trigger | Behavior | Timing |
|---|---|---|
| Scroll into view | Cards stagger in (top to bottom, 200ms gap). Connecting line fills left to right. Inner illustrations begin their animation loops. | On scroll reveal, once |
| Hover on step number | Gentle scale 1.05 + glow intensifies. | 200ms spring |
| Hover on illustration area | Slight elevation increase (shadow-md → shadow-lg). | 200ms ease |
| Chat bubble loop | Auto-replays on scroll reveal. Each bubble enters with 1s typing effect, then 2s pause. Loops after all 4 bubbles. | 12s per loop |

---

## Section 3: AI Interview Demo

### Layout Spec

```tsx
<section className="relative py-[var(--section-gap)] bg-[var(--color-bg)]">
  <div className="mx-auto max-w-[var(--max-width)] px-[var(--page-padding)]">

    {/* Section header */}
    <div className="text-center mb-12 sm:mb-16">
      <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-[var(--color-text-primary)] tracking-tight">
        Cobain langsung —{' '}
        <span className="text-transparent bg-clip-text bg-[var(--gradient-card)]">
          gratis
        </span>
      </h2>
      <p className="mt-4 text-lg text-[var(--color-text-secondary)] max-w-xl mx-auto">
        Lihat gimana Kak ngobrol sama Rina dan bikin CV ATS-friendly dalam 5 menit.
      </p>
    </div>

    {/* Demo container */}
    <div className="max-w-4xl mx-auto">
      {/* Chat window */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl overflow-hidden">

        {/* Chat header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="w-10 h-10 rounded-full bg-[var(--gradient-card)] flex items-center justify-center text-white font-bold text-sm">
            K
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-[var(--color-text-primary)]">Kak — AI Career Assistant</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">Online</p>
          </div>
          <div className="w-2 h-2 rounded-full bg-[var(--color-success)] animate-pulse" />
        </div>

        {/* Chat messages area */}
        <div className="p-5 sm:p-6 space-y-4 min-h-[400px] max-h-[520px] overflow-y-auto">
          <ChatMessage
            role="assistant"
            message="Halo! Aku Kak, asisten karirmu. Ceritain sedikit tentang dirimu..."
            delay={0.5}
          />
          <ChatMessage
            role="user"
            message="Halo Kak! Aku Rina, lulusan S1 Manajemen. Baru 1 tahun kerja di startup e-commerce sebagai social media specialist."
            delay={2.0}
          />
          <ChatMessage
            role="assistant"
            message="Wah, seru! Pengalaman yang relevan banget. Coba ceritain, achievement apa yang paling kamu banget waktu di startup itu?"
            delay={4.0}
          />
          <ChatMessage
            role="user"
            message="Aku berhasil naikin engagement Instagram dari 2% ke 5.8% dalam 6 bulan, dan manage 3 campaign yang reach-nya 500k+."
            delay={6.0}
          />
          <ChatMessage
            role="assistant"
            message="Keren banget! Oke, CV-mu udah siap. Ini dia preview-nya..."
            delay={8.5}
          />
        </div>

        {/* CV Preview Card — appears after chat ends */}
        <AnimatePresence>
          {showCVPreview && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.5, ease: easeOut }}
              className="border-t border-[var(--color-border)]"
            >
              {/* CV preview content */}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat input bar (non-functional, decorative) */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="flex-1 h-10 rounded-lg bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] px-4 flex items-center text-sm text-[var(--color-text-tertiary)]">
            Ketik pesan...
          </div>
          <button className="w-10 h-10 rounded-lg bg-[var(--color-primary)] flex items-center justify-center text-white">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* CTA below demo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3 }}
        className="mt-10 text-center"
      >
        <button className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[var(--color-primary)] text-white font-semibold text-base hover:bg-[var(--color-primary-hover)] shadow-lg transition-all duration-[var(--duration-normal)]">
          Coba sendiri — gratis!
          <ArrowRight className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  </div>
</section>
```

**ChatMessage Component:**
```tsx
function ChatMessage({ role, message, delay }: ChatMessageProps) {
  const [displayed, setDisplayed] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    // Wait for delay, then type character by character
    const timeout = setTimeout(() => {
      let i = 0;
      const interval = setInterval(() => {
        setDisplayed(message.slice(0, i + 1));
        i++;
        if (i >= message.length) {
          clearInterval(interval);
          setIsTyping(false);
        }
      }, 30); // 30ms per character
    }, delay * 1000);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex gap-3 max-w-[85%]",
        role === 'user' ? 'ml-auto flex-row-reverse' : ''
      )}
    >
      <div className={cn(
        "rounded-2xl px-4 py-3 text-sm leading-relaxed",
        role === 'user'
          ? 'bg-[var(--color-primary)] text-white rounded-tr-md'
          : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] rounded-tl-md'
      )}>
        {displayed}
        {isTyping && (
          <span className="inline-block w-1.5 h-4 ml-0.5 bg-current animate-pulse" />
        )}
      </div>
    </motion.div>
  );
}
```

### Animation Spec

**Typewriter timing:** 30ms per character. Average message 80 chars = 2.4s per message. Total sequence: ~12 seconds. Each message typed linearly, then 1.5s pause before next.

**CV Preview reveal:** After last message finishes, 500ms delay, then animated height transition (0 → auto) over 400ms with `easeOut`. Content inside fades up with opacity 0→1 at 300ms.

**Typing cursor:** Blinking `|` via CSS animation: `@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }`, `animation: blink 0.8s step-end infinite`.

**Auto-restart on scroll:** Use `useInView` with `once: false` (restart each time user scrolls section into view). Wait 2s after mount before starting sequence.

### Mobile Adaptation

| Breakpoint | Layout Change |
|---|---|
| **320px — 767px** | Chat window: rounded corners reduced (`rounded-xl`). Padding: `p-4`. Messages: max-width 90% to fill space. Min-height: 300px (was 400px). Font size: `text-sm`. CV preview becomes full-width card below chat. CTA: full-width button. Smaller Kak avatar: 32px. |
| **768px — 1023px** | Standard padding. Message max-width: 80%. Chat max-height: 400px. |
| **1024px+** | Full layout. |

### Dark Mode

- Chat header bg: `var(--color-bg-secondary)` → `#1f1f23`.
- Chat area bg: `var(--color-surface)` → `#18181b`.
- Assistant messages: `var(--color-bg-tertiary)` → `#27272a`.
- Input bar bg: `var(--color-bg-secondary)` → `#1f1f23`.
- Border colors all map to `var(--color-border)` → `#27272a`.

### Key Interactions

| Trigger | Behavior | Timing |
|---|---|---|
| Scroll section into view | After 2s delay, chat sequence begins: messages appear one by one with typewriter effect | 2s + ~12s sequence |
| Hover on message | Subtle background shift (lighter). No other changes — keep it natural | 150ms |
| CTA hover | Same as hero: scale 1.02, shadow elevation | 200ms |
| Scroll away and back | Sequence resets (all messages cleared, replays from start) | On re-entry |

---

## Section 4: ATS Score Showcase

### Layout Spec

```tsx
<section className="relative py-[var(--section-gap)] bg-[var(--color-bg)]">
  <div className="mx-auto max-w-[var(--max-width)] px-[var(--page-padding)]">

    {/* Section header */}
    <div className="text-center mb-12 sm:mb-16">
      <span className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-widest">
        Skor ATS
      </span>
      <h2 className="mt-4 font-display text-3xl sm:text-4xl md:text-5xl font-bold text-[var(--color-text-primary)] tracking-tight">
        Dari{' '}
        <span className="text-[var(--color-error)]">tak terdeteksi</span>{' '}
        jadi{' '}
        <span className="text-[var(--color-success)]">lolos otomatis</span>
      </h2>
    </div>

    {/* Before/After comparison */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-4xl mx-auto">

      {/* Before Card */}
      <motion.div
        variants={cardVariants}
        className="relative rounded-2xl border-2 border-red-200 dark:border-red-900/30 bg-[var(--color-surface)] p-6 sm:p-8"
      >
        {/* Label */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <X className="w-4 h-4 text-red-500" />
          </div>
          <span className="font-medium text-[var(--color-text-primary)]">CV Biasa</span>
        </div>

        {/* Gauge */}
        <div className="relative w-32 h-32 mx-auto mb-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            {/* Background circle */}
            <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8"
              className="text-red-100 dark:text-red-900/20" />
            {/* Animated arc */}
            <motion.circle
              cx="60" cy="60" r="52" fill="none"
              stroke="currentColor" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 52}
              initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
              whileInView={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - 52/100) }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
              className="text-red-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <AnimatedCounter from={0} to={52} suffix="%" className="text-3xl font-bold text-red-500" />
          </div>
        </div>
        <p className="text-center text-sm text-[var(--color-text-secondary)]">
          Resume tidak dioptimalkan untuk ATS. Keyword dan formatting tidak terbaca.
        </p>
      </motion.div>

      {/* After Card */}
      <motion.div
        variants={cardVariants}
        className="relative rounded-2xl border-2 border-emerald-200 dark:border-emerald-900/30 bg-[var(--color-surface)] p-6 sm:p-8 shadow-xl shadow-emerald-500/5"
      >
        {/* Glow effect */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-2xl opacity-10 blur-xl" />

        {/* Label */}
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center">
            <Check className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="font-medium text-[var(--color-text-primary)]">CV dengan Lolos</span>
        </div>

        {/* Gauge */}
        <div className="relative w-32 h-32 mx-auto mb-4">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8"
              className="text-emerald-100 dark:text-emerald-900/20" />
            <motion.circle
              cx="60" cy="60" r="52" fill="none"
              stroke="currentColor" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 52}
              initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
              whileInView={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - 94/100) }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="text-emerald-500"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <AnimatedCounter from={0} to={94} suffix="%" className="text-3xl font-bold text-emerald-500" />
          </div>
        </div>
        <p className="text-center text-sm text-[var(--color-text-secondary)]">
          Resume dioptimalkan dengan keyword yang tepat. Format ATS-friendly.
        </p>
      </motion.div>
    </div>

    {/* Testimonial quote */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.8, duration: 0.5 }}
      className="relative mt-12 max-w-2xl mx-auto text-center"
    >
      <Quote className="w-8 h-8 text-[var(--color-primary)]/30 mx-auto mb-4" />
      <blockquote className="text-lg sm:text-xl text-[var(--color-text-primary)] italic leading-relaxed">
        "Saya kira CV saya sudah bagus. Ternyata ATS tidak bisa bacanya."
      </blockquote>
      <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
        — Andi Pratama, Pelamar Kerja
      </p>
    </motion.div>
  </div>
</section>
```

**AnimatedCounter Component:**
```tsx
function AnimatedCounter({ from, to, suffix, className }: CounterProps) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(from);

  useEffect(() => {
    if (!inView) return;
    const duration = 1500; // ms
    const steps = 60;
    const increment = (to - from) / steps;
    const interval = duration / steps;
    let current = from;
    const timer = setInterval(() => {
      current += increment;
      if (current >= to) {
        setCount(to);
        clearInterval(timer);
      } else {
        setCount(Math.round(current));
      }
    }, interval);
    return () => clearInterval(timer);
  }, [inView, from, to]);

  return (
    <span className={className}>
      {count}{suffix}
    </span>
  );
}
```

### Animation Spec

**Gauge fill:** SVG `strokeDashoffset` animates from full circumference to target percentage. Before card fills to 52%, after card fills to 94%. After card has 300ms delay (starts after before card finishes).

**Counter:** Numerical count-up using `setInterval` at ~40ms per step. Duration: 1.5s total. Spring-like easing: start fast, slow near end.

**Card entrance:** Staggered entrance: before card enters first (opacity 0→1, y 30→0), after card follows 200ms later.

**Quote:** Fades up 800ms after cards, subtle float animation.

```tsx
const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.2,
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
    },
  }),
};
```

### Mobile Adaptation

| Breakpoint | Layout Change |
|---|---|
| **320px — 767px** | Single column, stack before/after vertically. Gauges: 96px (was 128px). Counter font: `text-2xl`. Cards: `p-5`, border width 1px (was 2px). Quote: `text-base`. After card (bottom) gets the glow treatment. Gap between cards: 24px. |
| **768px — 1023px** | 2-column grid but narrower. Gauges: 112px. |
| **1024px+** | Full layout. |

### Dark Mode

- Before card border: `dark:border-red-900/30` with subdued red.
- After card border: `dark:border-emerald-900/30`.
- Gauge background circles: `dark:text-red-900/20` / `dark:text-emerald-900/20`.
- Glow on after card: opacity 0.05 (was 0.3 light).
- Surface colors map to dark vars.

### Key Interactions

| Trigger | Behavior | Timing |
|---|---|---|
| Scroll into view | Both cards slide up (before first, after 200ms later). Gauges fill. Counters tick up simultaneously with gauge. Quote fades in last. | 0–2.5s |
| Hover on after card | Glow intensifies (opacity 0.1 → 0.2), subtle scale 1.01, shadow-xl → shadow-2xl. | 300ms ease |

---

## Section 5: Template Gallery Preview

### Layout Spec

```tsx
<section className="relative py-[var(--section-gap)] bg-[var(--color-bg-secondary)]">
  <div className="mx-auto max-w-[var(--max-width)] px-[var(--page-padding)]">

    {/* Section header */}
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
      <div>
        <span className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-widest">
          Template
        </span>
        <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)] tracking-tight">
          Pilih template favoritmu
        </h2>
      </div>
      <a href="/templates" className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors whitespace-nowrap">
        Lihat Semua Template
        <ArrowRight className="w-3.5 h-3.5" />
      </a>
    </div>

    {/* Category filter chips */}
    <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
      {['Semua', 'Professional', 'Modern', 'ATS-Friendly', 'Kreatif', 'Minimalis'].map(cat => (
        <button
          key={cat}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-[var(--duration-fast)]",
            activeCategory === cat
              ? "bg-[var(--color-primary)] text-white shadow-sm"
              : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 hover:text-[var(--color-text-primary)]"
          )}
        >
          {cat}
        </button>
      ))}
    </div>

    {/* Template cards — horizontal scroll on mobile, grid on desktop */}
    <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-5">
      {templates.map((template, i) => (
        <TemplateCard key={template.id} template={template} index={i} />
      ))}
    </div>

    {/* Mobile: horizontal drag scroll */}
    <div className="md:hidden">
      <motion.div
        drag="x"
        dragConstraints={{ left: -(templates.length * 280 - windowWidth + 32), right: 0 }}
        className="flex gap-4 cursor-grab active:cursor-grabbing"
      >
        {templates.map((template, i) => (
          <motion.div
            key={template.id}
            className="w-[260px] flex-shrink-0"
            whileTap={{ scale: 0.98 }}
          >
            <TemplateCard template={template} index={i} />
          </motion.div>
        ))}
      </motion.div>
      {/* Snap dots */}
      <div className="flex justify-center gap-2 mt-6">
        {templates.map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-[var(--duration-normal)]",
              activeIndex === i ? "bg-[var(--color-primary)] w-6" : "bg-[var(--color-border)]"
            )}
          />
        ))}
      </div>
    </div>
  </div>
</section>
```

**TemplateCard Component:**
```tsx
function TemplateCard({ template, index }: TemplateCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="group relative rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-[var(--duration-normal)]"
    >
      {/* Template preview */}
      <div className="aspect-[210/297] bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 p-4">
        {/* Mock CV content */}
        <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
        <div className="h-2 w-1/2 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-2">
              <div className="h-2 w-2 rounded-full bg-gray-200 dark:bg-gray-700 mt-1" />
              <div className="flex-1">
                <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded mb-1" />
                <div className="h-2 w-4/5 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--duration-normal)] flex items-center justify-center">
        <button className="px-4 py-2 bg-white text-gray-900 rounded-lg text-sm font-semibold shadow-lg transform scale-90 group-hover:scale-100 transition-transform duration-[var(--duration-normal)]">
          Gunakan Template
        </button>
      </div>

      {/* Label */}
      <div className="p-3 border-t border-[var(--color-border)]">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{template.name}</p>
        <p className="text-xs text-[var(--color-text-tertiary)]">{template.category}</p>
      </div>
    </motion.div>
  );
}
```

### Animation Spec

```tsx
// Card stagger: 80ms delay per card
// Desktop: animate into grid with fade + slide up
// Mobile: drag scroll with snap detection

// Hover overlay: opacity 0→0.4 bg-black, button scale 0.9→1.0
const cardHoverVariants = {
  rest: { scale: 1, boxShadow: 'var(--shadow-sm)' },
  hover: {
    scale: 1.02,
    boxShadow: 'var(--shadow-xl)',
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};
```

### Mobile Adaptation

| Breakpoint | Layout Change |
|---|---|
| **320px — 767px** | Grid hidden. Horizontal drag scroll with snap points. Card width: 260px. 16px gap. Category chips: horizontal scroll with padding on sides. "Lihat Semua" link moves below chips. Snap indicator dots below cards. |
| **768px — 1023px** | 2-column grid. Use horizontal scroll hidden. Cards: standard size. Filter chips wrap to 2 rows. |
| **1024px+** | 4-column grid. Hover overlay with "Gunakan Template" CTA. |

### Dark Mode

- Preview background: `from-gray-800 to-gray-900`.
- Mock content: `gray-700` instead of `gray-200`.
- Surface: `var(--color-surface)` → `#18181b`.
- Overlay: `bg-black/50` (slightly more opaque in dark).

### Key Interactions

| Trigger | Behavior | Timing |
|---|---|---|
| Card hover | Scale 1.02, shadow-xl elevation. Dark overlay appears at 40% opacity. "Gunakan Template" button scales up 0.9→1.0. | 300ms |
| Click "Gunakan Template" | Navigate to template editor with that template selected | Instant |
| Filter chip click | Active chip becomes filled primary. Other chips become default. Cards filter with AnimatePresence exit/enter animations (fade + scale). | 300ms |
| Mobile drag | Snap scrolling. Spring physics on release. Dots update to reflect active card. | Spring |

---

## Section 6: Features Grid (Bento Layout)

### Layout Spec

```tsx
<section className="relative py-[var(--section-gap)] bg-[var(--color-bg)]">
  <div className="mx-auto max-w-[var(--max-width)] px-[var(--page-padding)]">

    {/* Section header */}
    <div className="text-center mb-12 sm:mb-16">
      <span className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-widest">
        Fitur
      </span>
      <h2 className="mt-4 font-display text-3xl sm:text-4xl md:text-5xl font-bold text-[var(--color-text-primary)] tracking-tight">
        Lebih dari sekadar{' '}
        <span className="text-transparent bg-clip-text bg-[var(--gradient-card)]">
          pembuat CV
        </span>
      </h2>
    </div>

    {/* Bento Grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">

      {/* Main feature card — spans 2x2 */}
      <FeatureCard
        size="lg" // col-span-2 row-span-2
        icon={<Bot />}
        title="AI Career Coach"
        description="Kak bukan cuma bikin CV. Dia bisa jawab pertanyaan karir, simulasi wawancara, dan kasih saran karir yang personal."
        gradient
      />

      {/* Standard cards (col-span-1) */}
      <FeatureCard
        size="sm"
        icon={<ScanSearch />}
        title="ATS Check Otomatis"
        description="Scan real-time. Tahu persis di mana CV-mu kurang keywords-nya."
      />
      <FeatureCard
        size="sm"
        icon={<FileText />}
        title="20+ Template ATS"
        description="Desain modern yang tetap terbaca ATS. Bukan template cantik tapi kosong."
      />
      <FeatureCard
        size="sm"
        icon={<MessageCircle />}
        title="Chat ke WhatsApp"
        description="Bikin CV lewat WhatsApp tanpa buka web. Canggih tapi tetap low-tech friendly."
      />
      <FeatureCard
        size="sm"
        icon={<Globe />}
        title="Export ke PDF/ DOCX"
        description("Download dalam format apapun. Siap attach di email atau portal kerja.")
      />
      <FeatureCard
        size="sm"
        icon={<Zap />}
        title="5 Menit Selesai"
        description="Ngobrol 5 menit, CV siap. Bikin 10 versi CV dalam sehari tanpa capek."
      />
      <FeatureCard
        size="sm"
        icon={<Shield />}
        title="Data Aman"
        description="Data lo dienkripsi. Lo pegang kendali penuh — hapus kapan aja."
      />
    </div>
  </div>
</section>
```

**FeatureCard Component:**
```tsx
function FeatureCard({ size, icon, title, description, gradient }: FeatureCardProps) {
  return (
    <motion.div
      variants={featureCardVariants}
      className={cn(
        "group relative rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8 overflow-hidden transition-all duration-[var(--duration-normal)]",
        size === 'lg' ? 'sm:col-span-2 sm:row-span-2' : 'sm:col-span-1 sm:row-span-1',
        gradient && 'border-[var(--color-primary)]/20'
      )}
    >
      {/* Gradient border glow on hover */}
      <div className={cn(
        "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-[var(--duration-normal)] pointer-events-none",
        gradient
          ? "bg-gradient-to-br from-[var(--color-primary)]/5 to-[var(--color-accent)]/5"
          : "bg-gradient-to-br from-[var(--color-primary)]/3 to-transparent"
      )} />

      {/* Icon container */}
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center mb-4",
        gradient
          ? "bg-[var(--gradient-card)] text-white shadow-lg shadow-[var(--color-primary-glow)]"
          : "bg-[var(--color-primary-light)] text-[var(--color-primary)]"
      )}>
        {icon}
      </div>

      {/* Content */}
      <h3 className="font-display text-lg font-semibold text-[var(--color-text-primary)] mb-2">
        {title}
      </h3>
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}
```

### Animation Spec

```tsx
// Staggered reveal: cards enter in visual order (left to right, top to bottom)
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const featureCardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
};

// Large card: slightly different entrance (from below, more dramatic)
const largeCardVariants = {
  hidden: { opacity: 0, y: 60, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 80,
      damping: 12,
      delay: 0.05,
    },
  },
};

// Hover gradient overlay: opacity 0 → 0.12 (indigo/violet gradient)
// Large card gets additional glow shadow on hover
```

### Bento Grid Layout (Desktop)

```
┌─────────────────┬──────────┬──────────┐
│                 │          │          │
│   AI Career     │  ATS     │  20+     │
│   Coach         │  Check   │  Temp.   │
│   (2×2)         │  (1×1)   │  (1×1)   │
│                 │          │          │
│                 ├──────────┼──────────┤
│                 │  Chat    │  Export  │
│                 │  WA      │  PDF     │
│                 │  (1×1)   │  (1×1)   │
├─────────────────┼──────────┴──────────┤
│   5 Menit       │                     │
│   Selesai       │    Data Aman        │
│   (1×1)         │    (1×1)            │
└─────────────────┴─────────────────────┘
```

### Mobile Adaptation

| Breakpoint | Layout Change |
|---|---|
| **320px — 767px** | Single column. All cards stack vertically. Large card no longer spans 2 columns. Cards: `p-5` (was `p-6 sm:p-8`). Gap: 12px. Stagger still applies but order is natural top-to-bottom. Full-width cards. |
| **768px — 1023px** | 2-column grid. Large card spans full width (col-span-2). Other cards fill 2 columns. |
| **1024px+** | 4-column bento grid as shown. |

### Dark Mode

- Cards: `var(--color-surface)` → `#18181b`.
- Icon backgrounds (non-gradient): `var(--color-primary-light)` → `rgba(99, 102, 241, 0.15)`.
- Gradient cards: border becomes `var(--color-primary)/30` in dark.
- Hover gradient overlay: opacity increased to compensate (dark needs more visibility).

### Key Interactions

| Trigger | Behavior | Timing |
|---|---|---|
| Scroll into view | Cards stagger in with spring animation (80ms between each). Large card first, then smaller cards row by row. | 0–1s total |
| Card hover | Subtle elevation increase. Gradient overlay appears (indigo/violet gradient at low opacity). Large card gets extra glow. | 300ms ease |
| Click card | Navigate to relevant feature page or scroll to section (if anchor link) | Instant |

---

## Section 7: Pricing

### Layout Spec

```tsx
<section className="relative py-[var(--section-gap)] bg-[var(--color-bg-secondary)]">
  <div className="mx-auto max-w-[var(--max-width)] px-[var(--page-padding)]">

    {/* Section header */}
    <div className="text-center mb-10 sm:mb-12">
      <span className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-widest">
        Harga
      </span>
      <h2 className="mt-4 font-display text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)] tracking-tight">
        Investasi karir yang{' '}
        <span className="text-transparent bg-clip-text bg-[var(--gradient-card)]">
          worth it
        </span>
      </h2>
    </div>

    {/* Monthly/Annual toggle */}
    <div className="flex items-center justify-center gap-4 mb-10">
      <span className={cn("text-sm font-medium transition-colors", !annual ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-tertiary)]")}>
        Bulanan
      </span>
      <button
        onClick={() => setAnnual(!annual)}
        className={cn(
          "relative w-12 h-6 rounded-full transition-colors duration-[var(--duration-fast)]",
          annual ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
        )}
      >
        <motion.div
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm"
          animate={{ x: annual ? 24 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        />
      </button>
      <div className="flex items-center gap-1.5">
        <span className={cn("text-sm font-medium transition-colors", annual ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-tertiary)]")}>
          Tahunan
        </span>
        <span className="text-xs font-semibold text-[var(--color-success)] bg-[var(--color-success-bg)] px-2 py-0.5 rounded-full">
          Hemat 40%
        </span>
      </div>
    </div>

    {/* Pricing cards grid */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">

      {/* Free tier */}
      <PricingCard
        name="Gratis"
        price={annual ? 0 : 0}
        description="Coba dulu, lihat hasilnya"
        features={[
          '1 template CV',
          'ATS scan dasar',
          'Export PDF',
          'Chat dengan Kak (3x)',
        ]}
        cta="Mulai Gratis"
        popular={false}
      />

      {/* Pro tier — most popular */}
      <PricingCard
        name="Pro"
        price={annual ? 35000 : 49000}
        description="Paling populer. Untuk pencari kerja serius."
        features={[
          'Semua template ATS',
          'ATS scan lanjutan + saran',
          'Export PDF + DOCX',
          'Chat dengan Kak (unlimited)',
          'AI Career Coach',
          'Simulasi wawancara',
          'Multiple CV versions',
        ]}
        cta="Langganan Pro"
        popular={true}
      />

      {/* Premium tier */}
      <PricingCard
        name="Premium"
        price={annual ? 79000 : 119000}
        description("Untuk profesional dan pencari kerja aktif.")
        features={[
          'Semua fitur Pro',
          'ATS scan dengan benchmark industri',
          'Cover letter otomatis',
          'Prioritas support',
          'Data export ke semua format',
          'LinkedIn optimization',
          'Konsultasi karir 1-on-1',
        ]}
        cta="Langganan Premium"
        popular={false}
      />
    </div>

    {/* Bottom text */}
    <p className="text-center text-sm text-[var(--color-text-tertiary)] mt-8">
      Mulai gratis — tidak perlu kartu kredit.
    </p>
  </div>
</section>
```

**PricingCard Component:**
```tsx
function PricingCard({ name, price, description, features, cta, popular }: PricingCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.5, ease: easeOut }}
      className={cn(
        "relative rounded-2xl border p-6 sm:p-8 flex flex-col transition-all duration-[var(--duration-normal)]",
        popular
          ? "border-[var(--color-primary)]/30 bg-[var(--color-surface)] shadow-xl shadow-[var(--color-primary-glow)] scale-[1.02] md:scale-105"
          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]/20"
      )}
    >
      {/* Popular badge */}
      {popular && (
        <>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[var(--gradient-card)] text-white text-xs font-semibold shadow-lg">
            Paling Populer
          </div>
          {/* Subtle glow behind card */}
          <div className="absolute -inset-1 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] rounded-2xl opacity-10 blur-xl -z-10" />
        </>
      )}

      <div>
        <h3 className="font-display text-xl font-semibold text-[var(--color-text-primary)]">{name}</h3>
        <div className="mt-4 flex items-baseline gap-1">
          <AnimatePresence mode="wait">
            <motion.span
              key={price}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="text-4xl font-bold text-[var(--color-text-primary)]"
            >
              {price === 0 ? 'Gratis' : `Rp${price.toLocaleString('id-ID')}`}
            </motion.span>
          </AnimatePresence>
          {price > 0 && <span className="text-sm text-[var(--color-text-tertiary)]">/bulan</span>}
        </div>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{description}</p>
      </div>

      {/* Features */}
      <ul className="mt-6 space-y-3 flex-1">
        {features.map((feature, i) => (
          <motion.li
            key={feature}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="flex items-start gap-3 text-sm"
          >
            <Check className="w-4 h-4 text-[var(--color-success)] mt-0.5 flex-shrink-0" />
            <span className="text-[var(--color-text-primary)]">{feature}</span>
          </motion.li>
        ))}
      </ul>

      {/* CTA */}
      <button className={cn(
        "mt-8 w-full py-3 rounded-xl font-semibold text-sm transition-all duration-[var(--duration-normal)]",
        popular
          ? "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] shadow-lg shadow-[var(--color-primary-glow)]"
          : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-border)]"
      )}>
        {cta}
      </button>
    </motion.div>
  );
}
```

### Animation Spec

```tsx
// Price toggle animation:
// AnimatePresence mode="wait" — old price fades up and out, new price fades down and in
// 200ms total, no layout shift (fixed height container for price area)

// Toggle switch: spring physics, x: 0 ↔ 24
const toggleVariants = {
  monthly: { x: 0 },
  annual: { x: 24 },
};

// Card stagger: 150ms between cards, Free → Pro → Premium
const cardContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
};

const cardItem = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 100, damping: 15 },
  },
};

// Feature list checkmarks: stagger in after card entrance
const featureContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.3 },
  },
};
```

### Mobile Adaptation

| Breakpoint | Layout Change |
|---|---|
| **320px — 767px** | Single column. Pro card appears 2nd in flow (not centered/scale). No scale transform on Pro card. Cards: full-width. Price: `text-3xl`. Toggle: centered. Feature checkmarks: left-aligned. Gap between cards: 20px. Pro card retains glow border but no scale. |
| **768px — 1023px** | 3-column grid. Pro card at `scale-[1.02]`. Tighter padding. |
| **1024px+** | Full layout. Pro card at `scale-105`. |

### Dark Mode

- Cards: `var(--color-surface)` → `#18181b`.
- Non-popular card hover border: `var(--color-primary)/30`.
- Pro card glow: opacity 0.15 (was 0.10 light).
- Toggle inactive: `var(--color-border)` → `#27272a`.
- CTA secondary bg: `var(--color-bg-tertiary)` → `#1f1f23`.

### Key Interactions

| Trigger | Behavior | Timing |
|---|---|---|
| Monthly/Annual toggle | Toggle switch slides with spring. Price text animates (AnimatePresence fade). "Hemat 40%" badge appears/disappears. | 200ms + 200ms |
| Card hover | Non-popular: border becomes primary tint, shadow increases. Popular: glow intensifies, slight scale increase | 300ms |
| Feature item entrance | Checkmarks stagger in from left (fade + slide). | 50ms per item |
| CTA hover | Primary: bg shift + subtle shadow increase. Secondary: bg lightens. | 200ms |
| Annual toggle click | Animates price from monthly to annual (divided by 12 * 10 for ~40% savings). | 300ms |

---

## Section 8: Testimonials

### Layout Spec

```tsx
<section className="relative py-[var(--section-gap)] bg-[var(--color-bg)]">
  <div className="mx-auto max-w-[var(--max-width)] px-[var(--page-padding)]">

    {/* Section header */}
    <div className="text-center mb-12">
      <span className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-widest">
        Testimonial
      </span>
      <h2 className="mt-4 font-display text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)] tracking-tight">
        Yang mereka rasakan
      </h2>
    </div>

    {/* Featured testimonials carousel */}
    <div className="relative max-w-3xl mx-auto">
      {/* Navigation arrows */}
      <button onClick={prev} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 lg:-translate-x-16 w-10 h-10 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center hover:bg-[var(--color-surface-hover)] transition-colors z-10">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button onClick={next} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 lg:translate-x-16 w-10 h-10 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center hover:bg-[var(--color-surface-hover)] transition-colors z-10">
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Carousel */}
      <div className="overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.4, ease: easeOut }}
            className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6 sm:p-8 md:p-10 shadow-md"
          >
            {/* Quote */}
            <Quote className="w-6 h-6 sm:w-8 sm:h-8 text-[var(--color-primary)]/20 mb-4" />
            <blockquote className="text-base sm:text-lg md:text-xl text-[var(--color-text-primary)] leading-relaxed">
              "{testimonials[currentIndex].quote}"
            </blockquote>

            {/* ATS score transformation */}
            <div className="mt-6 flex items-center gap-4 text-sm">
              <span className="px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/20 text-red-500 font-semibold">
                {testimonials[currentIndex].beforeScore}%
              </span>
              <ArrowRight className="w-4 h-4 text-[var(--color-text-tertiary)]" />
              <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/20 text-emerald-500 font-semibold">
                {testimonials[currentIndex].afterScore}%
              </span>
            </div>

            {/* Author + rating */}
            <div className="mt-6 flex items-center gap-4 pt-6 border-t border-[var(--color-border)]">
              <img
                src={testimonials[currentIndex].avatar}
                alt={testimonials[currentIndex].name}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div className="flex-1">
                <p className="font-semibold text-[var(--color-text-primary)]">
                  {testimonials[currentIndex].name}
                </p>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {testimonials[currentIndex].role}
                </p>
              </div>
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "w-4 h-4",
                      i < testimonials[currentIndex].stars
                        ? "text-yellow-500 fill-yellow-500"
                        : "text-[var(--color-border)]"
                    )}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-2 mt-8">
        {testimonials.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentIndex(i)}
            className={cn(
              "w-2 h-2 rounded-full transition-all duration-[var(--duration-normal)]",
              i === currentIndex
                ? "bg-[var(--color-primary)] w-6"
                : "bg-[var(--color-border)] hover:bg-[var(--color-text-tertiary)]"
            )}
          />
        ))}
      </div>
    </div>

    {/* Featured in / Trusted by */}
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ delay: 0.5 }}
      className="mt-16 text-center"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)] mb-6">
        Diliput oleh
      </p>
      <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 opacity-40 dark:opacity-30">
        {/* Logo placeholders — use SVG grayscale logos */}
        {logos.map(logo => (
          <div key={logo.id} className="h-6 sm:h-8 text-[var(--color-text-tertiary)] font-semibold text-sm tracking-tight">
            {logo.name}
          </div>
        ))}
      </div>
    </motion.div>
  </div>
</section>
```

### Animation Spec

```tsx
// === Carousel transition ===
// AnimatePresence mode="wait" with directional slide
// Forward: x: 50 → 0 (enter), 0 → -50 (exit)
// Backward: x: -50 → 0 (enter), 0 → 50 (exit)

const carouselVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.4, ease: easeOut },
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -50 : 50,
    opacity: 0,
    transition: { duration: 0.3, ease: easeOut },
  }),
};

// === Auto-advance ===
// useEffect with setInterval 5000ms
// Clear on hover (onMouseEnter/onMouseLeave)
// Track direction for animation

const [direction, setDirection] = useState(0);
const [isPaused, setIsPaused] = useState(false);

useEffect(() => {
  if (isPaused) return;
  const interval = setInterval(() => {
    setDirection(1);
    setCurrentIndex(prev => (prev + 1) % testimonials.length);
  }, 5000);
  return () => clearInterval(interval);
}, [isPaused]);
```

### Mobile Adaptation

| Breakpoint | Layout Change |
|---|---|
| **320px — 767px** | Navigation arrows hidden (swipe instead). Card: `p-6`, `text-base`. ATS scores: stacked vertically on small screens. Quote icon: smaller (20px). Author section: stack vertically if needed. Dots: larger tap targets (12px). Featured-in logos: 4 per row, smaller. Swipe left/right to navigate (implement via Framer Motion drag="x" with constraints). |
| **768px — 1023px** | Arrows visible. Standard padding. |
| **1024px+** | Full layout. Arrow buttons outside card bounds (offset by 48px). |

### Dark Mode

- Card: `var(--color-surface)` → `#18181b`.
- Quote icon opacity: 0.15.
- Score badges: red-900/30 and emerald-900/30 backgrounds.
- Featured-in: opacity 0.3 (was 0.4 light).
- Dots inactive: `var(--color-border)` → `#27272a`.

### Key Interactions

| Trigger | Behavior | Timing |
|---|---|---|
| Auto-advance | Every 5s, slides to next testimonial with directional slide | 5s interval |
| Hover on carousel | Pause auto-advance | On hover |
| Arrow click | Instant slide transition, resets auto-advance timer | 400ms |
| Dot click | Jump to that testimonial, directional slide based on index delta | 400ms |
| Mobile swipe | Drag left/right with snap. Threshold: 50px drag triggers next/prev | Spring |

---

## Section 9: FAQ

### Layout Spec

```tsx
<section className="relative py-[var(--section-gap)] bg-[var(--color-bg-secondary)]">
  <div className="mx-auto max-w-3xl px-[var(--page-padding)]">

    {/* Section header */}
    <div className="text-center mb-10">
      <span className="text-sm font-semibold text-[var(--color-primary)] uppercase tracking-widest">
        FAQ
      </span>
      <h2 className="mt-4 font-display text-3xl sm:text-4xl font-bold text-[var(--color-text-primary)] tracking-tight">
        Pertanyaan umum
      </h2>
    </div>

    {/* Search bar */}
    <div className="relative mb-8">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
      <input
        type="text"
        placeholder="Cari pertanyaan..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="w-full h-12 pl-11 pr-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-[var(--duration-fast)]"
      />
    </div>

    {/* Category tabs */}
    <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-none">
      {['Semua', 'Produk', 'ATS', 'Harga', 'Privasi', 'Teknis'].map(cat => (
        <button
          key={cat}
          onClick={() => setActiveCategory(cat)}
          className={cn(
            "px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-[var(--duration-fast)]",
            activeCategory === cat
              ? "bg-[var(--color-primary)] text-white shadow-sm"
              : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]"
          )}
        >
          {cat}
        </button>
      ))}
    </div>

    {/* FAQ Accordion */}
    <AnimatePresence mode="wait">
      <motion.div
        key={activeCategory + searchQuery}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="space-y-3"
      >
        {filteredFAQs.map((faq, i) => (
          <FAQItem key={faq.id} faq={faq} index={i} />
        ))}
      </motion.div>
    </AnimatePresence>
  </div>
</section>
```

**FAQItem Component:**
```tsx
function FAQItem({ faq, index }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.03 }}
      className={cn(
        "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden transition-colors duration-[var(--duration-fast)]",
        isOpen && "border-[var(--color-primary)]/20"
      )}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="text-sm font-medium text-[var(--color-text-primary)]">
          {faq.question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2, ease: easeOut }}
          className="flex-shrink-0"
        >
          <ChevronDown className="w-4 h-4 text-[var(--color-text-tertiary)]" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: easeOut }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {faq.answer}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
```

### Animation Spec

```tsx
// === Accordion open/close ===
// height: 0 → auto with AnimatePresence
// Chevron rotates 180° on open
// Content fades in (opacity 0→1) on open

const accordionVariants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: { duration: 0.3, ease: easeOut },
  },
};

// === Search filter animation ===
// AnimatePresence mode="wait" on FAQ list
// Items animate out (fade, scale 0.95) and new items animate in
// 200ms duration

// === Category filter ===
// Similar to search — AnimatePresence on filtered list
// Active category chip: filled primary, others: outline

// === FAQ item stagger ===
// 30ms between each item on initial reveal
```

### Schema Markup (SEO)

```tsx
// Inject into <head> or as JSON-LD script
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(faq => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
};
```

### Mobile Adaptation

| Breakpoint | Layout Change |
|---|---|
| **320px — 767px** | Full-width accordion. Category chips: horizontal scroll (same as template filter). Search bar: full-width. FAQ items: `px-4 py-3.5` (slightly tighter). Container padding: `px-4`. No max-width constraint changes. |
| **768px — 1023px** | Standard layout. Chips may wrap to 2 rows. |
| **1024px+** | Full layout. 3xl max-width centered. |

### Dark Mode

- Items: `var(--color-surface)` → `#18181b`.
- Open item border: `var(--color-primary)/30`.
- Search input: `var(--color-surface)` → `#18181b`.
- Category chips active/inactive map to dark colors.

### Key Interactions

| Trigger | Behavior | Timing |
|---|---|---|
| FAQ click | Accordion expands with height animation. Chevron rotates 180deg. Content fades in. | 300ms |
| FAQ click (open → close) | Reverse animation. Height animates to 0, content fades out. | 250ms |
| Search input | Real-time filter. As user types, FAQ items filter with AnimatePresence. Non-matching items exit (fade + scale). | 200ms per item |
| Category click | Filter FAQ items by category with AnimatePresence transition. Chips update active state. | 200ms |
| Focus on search | Ring appears: `focus:ring-2 focus:ring-primary/30`. | 150ms |

---

## Section 10: Final CTA

### Layout Spec

```tsx
<section className="relative py-20 sm:py-24 lg:py-32 overflow-hidden bg-[var(--color-bg)]">
  {/* Background decoration */}
  <div className="absolute inset-0 bg-[var(--gradient-hero)] pointer-events-none" />
  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[var(--color-primary)]/5 blur-3xl pointer-events-none" />

  <div className="relative z-10 mx-auto max-w-3xl px-[var(--page-padding)] text-center">

    {/* Headline */}
    <motion.h2
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: easeOut }}
      className="font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[var(--color-text-primary)] tracking-tight leading-[1.1]"
    >
      CV impianmu tinggal{' '}
      <span className="text-transparent bg-clip-text bg-[var(--gradient-card)]">
        5 menit lagi
      </span>
    </motion.h2>

    {/* Subheadline */}
    <motion.p
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="mt-4 sm:mt-6 text-lg sm:text-xl text-[var(--color-text-secondary)]"
    >
      Ribuan pencari kerja sudah lolos ATS dan dipanggil interview. Giliran lo.
    </motion.p>

    {/* Primary CTA */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className="mt-8 sm:mt-10"
    >
      <button className="group inline-flex items-center gap-2.5 px-8 sm:px-10 py-4 sm:py-5 rounded-xl bg-[var(--color-primary)] text-white font-semibold text-base sm:text-lg shadow-xl shadow-[var(--color-primary-glow)] hover:shadow-2xl hover:shadow-[var(--color-primary-glow)] hover:bg-[var(--color-primary-hover)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-[var(--duration-normal)]">
        Buat CV Gratis — Mulai Sekarang
        <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-[var(--duration-normal)] group-hover:translate-x-0.5" />
      </button>
    </motion.div>

    {/* WhatsApp CTA */}
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ delay: 0.6, duration: 0.4 }}
      className="mt-6"
    >
      <button className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] font-medium text-sm hover:bg-[var(--color-surface-hover)] transition-all duration-[var(--duration-normal)]">
        <MessageCircle className="w-4 h-4 text-[#25D366]" />
        Atau chat kami di WhatsApp
      </button>
    </motion.div>
  </div>
</section>
```

### Footer Layout

```tsx
<footer className="border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
  <div className="mx-auto max-w-[var(--max-width)] px-[var(--page-padding)] py-12 sm:py-16">

    {/* Top row: grid of link groups */}
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8">

      {/* Brand column */}
      <div className="col-span-2 sm:col-span-3 lg:col-span-2">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[var(--gradient-card)] flex items-center justify-center text-white font-bold text-sm">
            L
          </div>
          <span className="font-display font-bold text-lg text-[var(--color-text-primary)]">Lolos</span>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] max-w-xs leading-relaxed">
          AI-powered ATS resume builder. Bantu pencari kerja Indonesia lolos seleksi HRD dan ATS.
        </p>
        {/* Social icons */}
        <div className="flex gap-3 mt-6">
          {[Instagram, Linkedin, Youtube, Twitter].map((Icon, i) => (
            <a key={i} href="#" className="w-9 h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]/30 transition-all duration-[var(--duration-fast)]">
              <Icon className="w-4 h-4" />
            </a>
          ))}
        </div>
      </div>

      {/* Link groups */}
      {[
        { title: 'Produk', links: ['Fitur', 'Template', 'Harga', 'ATS Checker'] },
        { title: 'Sumber Daya', links: ['Blog', 'Panduan CV', 'Tips Karir', 'Riset ATS'] },
        { title: 'Perusahaan', links: ['Tentang', 'Kontak', 'Privacy', 'Syarat & Ketentuan'] },
      ].map(group => (
        <div key={group.title}>
          <h4 className="font-semibold text-sm text-[var(--color-text-primary)] mb-4">{group.title}</h4>
          <ul className="space-y-3">
            {group.links.map(link => (
              <li key={link}>
                <a href="#" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] transition-colors duration-[var(--duration-fast)]">
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>

    {/* Bottom row: language switcher + copyright */}
    <div className="mt-12 pt-8 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between gap-4">
      {/* Language switcher */}
      <div className="flex items-center gap-2">
        <button className={cn(
          "text-sm font-medium px-2 py-1 rounded transition-colors",
          lang === 'id' ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
        )}>
          Indonesia
        </button>
        <span className="text-[var(--color-border)]">|</span>
        <button className={cn(
          "text-sm font-medium px-2 py-1 rounded transition-colors",
          lang === 'en' ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
        )}>
          English
        </button>
      </div>

      {/* Copyright */}
      <p className="text-xs text-[var(--color-text-tertiary)]">
        &copy; {new Date().getFullYear()} Lolos. All rights reserved.
      </p>
    </div>
  </div>
</footer>
```

### Animation Spec

```tsx
// === Section entrance ===
// Staggered: headline → subheadline → primary CTA → WhatsApp CTA
// Each 200ms apart
// Simple fade + slide up (y: 30→0)

const ctaSectionVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.1,
    },
  },
};

const ctaItemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: easeOut },
  },
};

// === Footer ===
// No entrance animation — always visible. Hover effects only.
```

### Mobile Adaptation

| Breakpoint | Layout Change |
|---|---|
| **320px — 767px** | CTA buttons: full-width (w-full). Headline: `text-3xl`. WhatsApp CTA below primary. Footer: 2-column grid for link groups. Brand column spans full width. Social icons: centered. Language switcher: centered, full-width. Copyright: centered below. |
| **768px — 1023px** | 3-column footer grid. Standard CTA sizing. |
| **1024px+** | Full 5-column footer layout (brand spanns 2). CTA horizontal with proper sizing. |

### Dark Mode

- Section bg: `var(--color-bg)` → `#0f0f11`.
- Gradient overlay: `rgba(99, 102, 241, 0.08)` (reduced).
- Footer bg: `var(--color-bg-secondary)` → `#18181b`.
- Footer border: `var(--color-border)` → `#27272a`.
- Social icons: border and hover states map to dark.

### Key Interactions

| Trigger | Behavior | Timing |
|---|---|---|
| CTA hover | Scale 1.02, shadow elevation increases from xl to 2xl. Arrow translates right 2px. | 300ms |
| CTA click (active) | Scale 0.98 | 150ms |
| WhatsApp CTA hover | Border becomes primary tint, background shift | 200ms |
| Social icon hover | Icon color shifts to primary, border gets primary tint | 200ms |
| Footer link hover | Color transitions from secondary to primary | 200ms |
| Language switcher click | Active state toggles. Reloads page content in selected language | Instant |

---

## Global Components

### Navbar

```tsx
<header className={cn(
  "fixed top-0 left-0 right-0 z-50 transition-all duration-[var(--duration-normal)]",
  isScrolled
    ? "bg-[var(--color-bg)]/80 backdrop-blur-xl border-b border-[var(--color-border)] shadow-sm"
    : "bg-transparent"
)}>
  <nav className="mx-auto max-w-[var(--max-width)] px-[var(--page-padding)] h-16 sm:h-18 flex items-center justify-between">
    {/* Logo */}
    <a href="/" className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-[var(--gradient-card)] flex items-center justify-center text-white font-bold text-sm">
        L
      </div>
      <span className="font-display font-bold text-lg text-[var(--color-text-primary)]">Lolos</span>
    </a>

    {/* Nav links — hidden on mobile */}
    <div className="hidden md:flex items-center gap-8">
      <a href="#features" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">Fitur</a>
      <a href="#templates" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">Template</a>
      <a href="#harga" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">Harga</a>
      <a href="#faq" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">FAQ</a>
    </div>

    {/* Right side */}
    <div className="flex items-center gap-3">
      {/* Dark mode toggle */}
      <button onClick={toggleDarkMode} className="w-9 h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-all">
        {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>

      {/* Language toggle (desktop) */}
      <button className="hidden sm:flex text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors px-2 py-1 rounded border border-transparent hover:border-[var(--color-border)]">
        {lang === 'id' ? 'EN' : 'ID'}
      </button>

      {/* CTA (desktop) */}
      <button className="hidden sm:inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold hover:bg-[var(--color-primary-hover)] transition-all">
        Buat CV Gratis
      </button>

      {/* Mobile hamburger */}
      <button className="md:hidden w-9 h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-center">
        <Menu className="w-4 h-4" />
      </button>
    </div>
  </nav>
</header>
```

**Navbar Animation Spec:**
- Background transition: transparent → `bg-bg/80 backdrop-blur-xl` when `scrollY > 60px`. 300ms ease.
- Link hover: color transition 200ms.
- Dark mode toggle: icon swap with rotation animation (180deg over 300ms).

### Mobile Adaptation

| Breakpoint | Layout Change |
|---|---|
| **320px — 767px** | Nav links hidden. Language toggle hidden. CTA hidden. Hamburger menu visible. Logo + dark mode toggle + hamburger visible. Mobile menu: full-screen overlay with AnimatePresence slide from right. Backdrop blur behind. |
| **768px+** | Full navbar visible. Hamburger hidden. |

### Dark Mode Toggle

- Moon icon in light mode, Sun icon in dark mode.
- Animation: rotate 180deg + scale 0→1 on swap, 300ms spring.
- Transition on `<html>` element: `transition: background-color 300ms ease, color 300ms ease`.

---

## Performance Considerations

```tsx
// === Animation performance ===
// - Use will-change: transform for animated elements
// - GPU-accelerated properties only: transform, opacity
// - No animating width, height, top, left (use scale + translate)
// - Layout animations use AnimatePresence + height: auto (Framer Motion handles this)

// === Intersection Observer ===
// - useInView with once: true for most sections (no re-trigger)
// - margin: '-50px' to trigger slightly before element enters viewport
// - Chat demo uses once: false (restart on re-entry)

// === Image loading ===
// - All images: loading="lazy"
// - Template previews: blur placeholder → full resolve
// - Avatar images: preloaded, small (48px)

// === Code splitting ===
// - Lazy load Framer Motion components per section
// - Dynamic import for heavy animation sections (demo, carousel)
// - CSS custom properties for theme — no JS theme flicker

// === Reduced motion ===
const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
// If true: disable all staggered reveals, parallax, typewriter.
// Keep basic fade transitions only. Duration 0ms or 100ms max.
```

---

## Responsive Breakpoints Summary

| Breakpoint | Width | Key Changes |
|---|---|---|
| **Mobile** | 320px — 767px | Single column stack. Full-width CTAs. Hidden decorative elements (floating cards, parallax). Smaller typography (3→2 scale). Horizontal drag scroll for galleries. Hamburger nav. Section padding reduced. |
| **Tablet** | 768px — 1023px | 2-3 column grids. Standard typography. Visible but subdued decorative elements. Full navbar visible. |
| **Desktop** | 1024px+ | Full layout. 4-column bento. 3-column pricing. 5-column footer. Floating 3D elements. Full parallax. Hover overlays visible. |

---

## Accessibility

```tsx
// === Focus management ===
// - All interactive elements keyboard-focusable
// - Skip-to-content link
// - Focus-visible ring: outline-2 outline-primary offset-2
// - Carousel: aria-live="polite", role="region", aria-roledescription="carousel"

// === Color contrast ===
// - All text: 4.5:1 minimum contrast ratio
// - Badge text on primary: white on #6366f1 = 4.8:1
// - Success text on success-bg: #10b981 on rgba(16,185,129,0.1) = passes
// - Error text on error-bg: same

// === Screen readers ===
// - aria-label on all icon-only buttons
// - aria-expanded on accordion buttons
// - role="button" on interactive divs
// - alt text on all images
// - Announcements for carousel slide changes: aria-live="polite"

// === Touch targets ===
// - Minimum 44px × 44px on mobile
// - FAQ items: 48px tall touch target
// - Category chips: 40px tall minimum
```

---

This document serves as the single source of truth for the Lolos landing page implementation. Every Tailwind class, Framer Motion variant, animation timing, responsive breakpoint, interaction behavior, and dark mode override is specified above. The design is mobile-first, animation-rich, and conversion-optimized — targeting the unique needs of Indonesian job seekers while delivering a world-class premium SaaS feel.
