/**
 * SolFoundry Brand Guide — colours, typography, logo usage, tone of voice, design principles.
 */
import React, { useState } from 'react';

// ---------------------------------------------------------------------------
// Brand tokens (derived from tailwind.config.js / index.css)
// ---------------------------------------------------------------------------

const PRIMARY_COLORS = [
  {
    id: 'emerald',
    name: 'Emerald',
    hex: '#00E676',
    role: 'Primary actions, success states, $FNDRY rewards',
    light: '#69F0AE',
    dim: 'rgba(0,230,118,0.7)',
    bg: 'bg-[#00E676]',
  },
  {
    id: 'purple',
    name: 'Purple',
    hex: '#7C3AED',
    role: 'Solana ecosystem, crypto depth, secondary CTAs',
    light: '#A78BFA',
    dim: 'rgba(124,58,237,0.7)',
    bg: 'bg-[#7C3AED]',
  },
  {
    id: 'magenta',
    name: 'Magenta',
    hex: '#E040FB',
    role: 'AI / review indicators, logo accent, gradient terminus',
    light: '#EA80FC',
    dim: 'rgba(224,64,251,0.7)',
    bg: 'bg-[#E040FB]',
  },
];

const FORGE_SHADES = [
  { id: 'forge-950', name: 'Forge 950', hex: '#050505', bg: 'bg-[#050505]', usage: 'App background' },
  { id: 'forge-900', name: 'Forge 900', hex: '#0A0A0F', bg: 'bg-[#0A0A0F]', usage: 'Page canvas' },
  { id: 'forge-850', name: 'Forge 850', hex: '#0F0F18', bg: 'bg-[#0F0F18]', usage: 'Sidebar / nav' },
  { id: 'forge-800', name: 'Forge 800', hex: '#16161F', bg: 'bg-[#16161F]', usage: 'Card surface' },
  { id: 'forge-700', name: 'Forge 700', hex: '#1E1E2A', bg: 'bg-[#1E1E2A]', usage: 'Elevated card' },
  { id: 'forge-600', name: 'Forge 600', hex: '#2A2A3A', bg: 'bg-[#2A2A3A]', usage: 'Input / divider' },
];

const STATUS_COLORS = [
  { id: 'success', name: 'Success', hex: '#00E676', bg: 'bg-[#00E676]' },
  { id: 'warning', name: 'Warning', hex: '#FFB300', bg: 'bg-[#FFB300]' },
  { id: 'error',   name: 'Error',   hex: '#FF5252', bg: 'bg-[#FF5252]' },
  { id: 'info',    name: 'Info',    hex: '#40C4FF', bg: 'bg-[#40C4FF]' },
];

const TEXT_COLORS = [
  { name: 'Primary',   hex: '#F0F0F5', usage: 'Headings, key body text' },
  { name: 'Secondary', hex: '#A0A0B8', usage: 'Supporting body text' },
  { name: 'Muted',     hex: '#5C5C78', usage: 'Placeholder, disabled' },
  { name: 'Inverse',   hex: '#050505', usage: 'Text on light backgrounds' },
];

const FONTS = [
  {
    id: 'display',
    name: 'Orbitron',
    classification: 'Display / Geometric Sans',
    usage: 'Hero headings, brand wordmark, section titles where impact is needed',
    specimen: 'SolFoundry',
    specClass: 'font-display text-4xl font-bold',
    weights: ['400 Regular', '700 Bold', '900 Black'],
  },
  {
    id: 'sans',
    name: 'Inter',
    classification: 'Humanist Sans-Serif',
    usage: 'All UI text — body copy, labels, buttons, navigation, descriptions',
    specimen: 'Build. Earn. Ship.',
    specClass: 'font-sans text-2xl font-medium',
    weights: ['400 Regular', '500 Medium', '600 Semibold', '700 Bold'],
  },
  {
    id: 'mono',
    name: 'JetBrains Mono',
    classification: 'Monospaced / Code',
    usage: 'Wallet addresses, transaction hashes, code snippets, terminal output',
    specimen: '97VihHW2Br7BKUU16c7...',
    specClass: 'font-mono text-lg',
    weights: ['400 Regular', '700 Bold'],
  },
];

const TYPE_SCALE = [
  { id: 'h1',   label: 'H1 — Display',    cls: 'font-display text-4xl font-black', sample: 'Forge the Future' },
  { id: 'h2',   label: 'H2 — Section',    cls: 'font-display text-2xl font-bold',  sample: 'Bounty Marketplace' },
  { id: 'body', label: 'Body — Interface', cls: 'font-sans text-base',              sample: 'Submit a PR and earn $FNDRY rewards for quality contributions.' },
  { id: 'mono', label: 'Mono — Code',      cls: 'font-mono text-sm',                sample: 'fn main() { println!("sol"); }' },
];

const LOGO_DOS = [
  'Use on approved dark backgrounds (Forge 950–800)',
  'Maintain minimum clearspace equal to the height of the "S" glyph on all sides',
  'Use the full colour wordmark as the primary brand expression',
  'Use the single-colour white variant on photographic backgrounds',
  'Reproduce at minimum 24 px height for digital, 8 mm for print',
];

const LOGO_DONTS = [
  'Do not recolour the logo outside approved palette variants',
  'Do not stretch, skew, or distort the wordmark',
  'Do not place the logo on backgrounds that reduce contrast below 4.5:1',
  'Do not add drop shadows, outlines, or effects',
  'Do not use the wordmark smaller than the minimum size specification',
  'Do not rotate the logo',
];

const TONE_ATTRS = [
  { id: 'direct',       label: 'Direct',       desc: 'Say what you mean. No filler words or corporate hedge language.' },
  { id: 'technical',    label: 'Technical',     desc: 'Speak the language of developers. Precision over simplification.' },
  { id: 'optimistic',   label: 'Optimistic',    desc: 'The future of open-source collaboration is being built here.' },
  { id: 'credible',     label: 'Credible',      desc: 'Back claims with numbers. Trust is earned through accuracy.' },
  { id: 'inclusive',    label: 'Inclusive',     desc: 'Welcome to newcomers, respectful of expert contributors.' },
];

const PRINCIPLES = [
  {
    id: 'dark-first',
    icon: '🌑',
    title: 'Dark-first',
    desc: 'Every surface defaults to the Forge dark palette. Light mode is never the primary experience. High contrast ratios are non-negotiable.',
  },
  {
    id: 'motion-purposeful',
    icon: '⚡',
    title: 'Motion with purpose',
    desc: 'Animations communicate state, not decoration. The ember-float and pulse-glow keyframes signal live activity; shimmer communicates loading.',
  },
  {
    id: 'hierarchy-color',
    icon: '🎨',
    title: 'Colour carries hierarchy',
    desc: 'Emerald = success / earn. Purple = Solana depth. Magenta = AI / review. Never use brand colours arbitrarily — colour choices are semantic.',
  },
  {
    id: 'grid-consistent',
    icon: '📐',
    title: 'Consistent grid',
    desc: 'The forge-grid background pattern (40 × 40 px) grounds all hero surfaces. Cards use 12 px rounded corners at base, 16 px for modals.',
  },
  {
    id: 'token-driven',
    icon: '🔑',
    title: 'Token-driven design',
    desc: 'All values — colour, spacing, radius, typography — are pulled from the Tailwind token system. Never hard-code a colour that has a token.',
  },
  {
    id: 'accessible',
    icon: '♿',
    title: 'Accessibility first',
    desc: 'All interactive elements meet WCAG AA contrast (4.5:1 for text, 3:1 for UI). Focus rings use the emerald colour on dark backgrounds.',
  },
];

// ---------------------------------------------------------------------------
// Colour copy button
// ---------------------------------------------------------------------------

function CopyButton({ hex }: { hex: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard?.writeText(hex).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button
      aria-label={`Copy ${hex}`}
      onClick={handleCopy}
      className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/60 hover:bg-white/20 transition-colors"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section data-testid={`section-${id}`} id={id} className="scroll-mt-24">
      <h2 className="font-display text-xl font-bold text-white mb-6 pb-3 border-b border-white/10">
        {title}
      </h2>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// BrandGuidePage
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { id: 'colors',      label: 'Colours' },
  { id: 'typography',  label: 'Typography' },
  { id: 'logo',        label: 'Logo' },
  { id: 'tone',        label: 'Tone of Voice' },
  { id: 'principles',  label: 'Design Principles' },
];

export function BrandGuidePage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-7xl mx-auto px-6 py-16 flex gap-12">

        {/* Sticky sidebar nav */}
        <aside className="hidden lg:block w-48 shrink-0">
          <nav data-testid="brand-nav" className="sticky top-24 space-y-1">
            <p className="text-xs text-white/30 font-semibold uppercase tracking-wider mb-3">Contents</p>
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="block text-sm text-white/50 hover:text-[#00E676] py-1 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 space-y-16">
          {/* Page header */}
          <div>
            <h1 className="font-display text-4xl font-black text-white mb-3">Brand Guide</h1>
            <p className="text-white/60 text-lg max-w-2xl">
              The SolFoundry visual identity system — colour, typography, logo, voice, and principles for consistent cross-surface expression.
            </p>
          </div>

          {/* ── COLOURS ─────────────────────────────────────────────────── */}
          <Section id="colors" title="Colour Palette">
            {/* Primary brand colours */}
            <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">Primary</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
              {PRIMARY_COLORS.map((c) => (
                <div key={c.id} className="bg-[#0A0A0F] border border-white/10 rounded-xl overflow-hidden">
                  <div
                    data-testid={`swatch-${c.id}`}
                    className="h-20"
                    style={{ backgroundColor: c.hex }}
                  />
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-white">{c.name}</p>
                      <CopyButton hex={c.hex} />
                    </div>
                    <p className="font-mono text-sm text-white/60">{c.hex}</p>
                    <p className="font-mono text-xs text-white/30">{c.light} (light)</p>
                    <p
                      data-testid={`usage-${c.id}`}
                      className="text-xs text-white/50 leading-relaxed border-t border-white/5 pt-2"
                    >
                      {c.role}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Forge backgrounds */}
            <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">Forge Backgrounds</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-10">
              {FORGE_SHADES.map((s) => (
                <div key={s.id} className="bg-[#0A0A0F] border border-white/10 rounded-xl overflow-hidden">
                  <div
                    data-testid={`swatch-${s.id}`}
                    className="h-12 border-b border-white/5"
                    style={{ backgroundColor: s.hex }}
                  />
                  <div className="p-2">
                    <p className="font-mono text-xs text-white/60">{s.hex}</p>
                    <p className="text-xs text-white/40 mt-0.5">{s.usage}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Text colours */}
            <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">Text</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
              {TEXT_COLORS.map((t) => (
                <div key={t.name} className="bg-[#0A0A0F] border border-white/10 rounded-xl p-3">
                  <p className="font-semibold mb-1" style={{ color: t.hex }}>{t.name}</p>
                  <p className="font-mono text-xs text-white/40">{t.hex}</p>
                  <p className="text-xs text-white/30 mt-1">{t.usage}</p>
                </div>
              ))}
            </div>

            {/* Status colours */}
            <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">Status</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {STATUS_COLORS.map((s) => (
                <div key={s.id} className="bg-[#0A0A0F] border border-white/10 rounded-xl overflow-hidden">
                  <div
                    data-testid={`swatch-${s.id}`}
                    className="h-10"
                    style={{ backgroundColor: s.hex }}
                  />
                  <div className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{s.name}</p>
                      <p className="font-mono text-xs text-white/40">{s.hex}</p>
                    </div>
                    <CopyButton hex={s.hex} />
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* ── TYPOGRAPHY ──────────────────────────────────────────────── */}
          <Section id="typography" title="Typography">
            {/* Font families */}
            <div className="space-y-5 mb-10">
              {FONTS.map((f) => (
                <div
                  key={f.id}
                  data-testid={`font-${f.id}`}
                  className="bg-[#0A0A0F] border border-white/10 rounded-xl p-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-semibold text-white text-lg">{f.name}</p>
                        <span className="text-xs bg-white/10 text-white/50 px-2 py-0.5 rounded-full">
                          {f.classification}
                        </span>
                      </div>
                      <p
                        data-testid={`font-usage-${f.id}`}
                        className="text-sm text-white/50 mb-4"
                      >
                        {f.usage}
                      </p>
                      <p className={`${f.specClass} text-white`}>{f.specimen}</p>
                    </div>
                    <div className="shrink-0">
                      <p className="text-xs text-white/30 mb-1">Weights</p>
                      {f.weights.map((w) => (
                        <p key={w} className="text-xs text-white/50">{w}</p>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Type scale */}
            <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">Type Scale</h3>
            <div className="space-y-4">
              {TYPE_SCALE.map((t) => (
                <div
                  key={t.id}
                  data-testid={`type-scale-${t.id}`}
                  className="bg-[#0A0A0F] border border-white/10 rounded-xl p-5"
                >
                  <p className="text-xs text-white/30 mb-3 font-mono">{t.label}</p>
                  <p className={`${t.cls} text-white`}>{t.sample}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* ── LOGO ────────────────────────────────────────────────────── */}
          <Section id="logo" title="Logo">
            {/* Variants */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
              {/* Primary */}
              <div className="bg-[#0A0A0F] border border-white/10 rounded-xl p-6 flex flex-col items-center gap-3">
                <div
                  data-testid="logo-primary"
                  className="w-full h-20 flex items-center justify-center"
                >
                  <span className="font-display text-2xl font-black bg-gradient-to-r from-[#00E676] via-[#7C3AED] to-[#E040FB] bg-clip-text text-transparent">
                    SolFoundry
                  </span>
                </div>
                <p className="text-xs text-white/40">Primary (Gradient)</p>
              </div>

              {/* Dark */}
              <div className="bg-[#0A0A0F] border border-white/10 rounded-xl p-6 flex flex-col items-center gap-3">
                <div
                  data-testid="logo-dark"
                  className="w-full h-20 flex items-center justify-center"
                >
                  <span className="font-display text-2xl font-black text-white">
                    SolFoundry
                  </span>
                </div>
                <p className="text-xs text-white/40">Single-colour White</p>
              </div>

              {/* Light */}
              <div className="bg-white rounded-xl p-6 flex flex-col items-center gap-3">
                <div
                  data-testid="logo-light"
                  className="w-full h-20 flex items-center justify-center"
                >
                  <span className="font-display text-2xl font-black text-[#050505]">
                    SolFoundry
                  </span>
                </div>
                <p className="text-xs text-black/40">Single-colour Black (light bg)</p>
              </div>
            </div>

            {/* Clearspace & min size */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
              <div
                data-testid="logo-clearspace"
                className="bg-[#0A0A0F] border border-white/10 rounded-xl p-5"
              >
                <h4 className="font-semibold text-white mb-2">Clearspace</h4>
                <p className="text-sm text-white/60 leading-relaxed">
                  Maintain a minimum clearspace equal to the cap-height of the "S" glyph on all four sides. No text, imagery, or graphic elements may intrude into this zone.
                </p>
              </div>
              <div
                data-testid="logo-min-size"
                className="bg-[#0A0A0F] border border-white/10 rounded-xl p-5"
              >
                <h4 className="font-semibold text-white mb-2">Minimum Size</h4>
                <div className="space-y-1 text-sm text-white/60">
                  <p>Digital: <span className="text-white font-medium">24 px height</span></p>
                  <p>Print: <span className="text-white font-medium">8 mm height</span></p>
                  <p>Favicon: <span className="text-white font-medium">Symbol only (≥ 16 × 16 px)</span></p>
                </div>
              </div>
            </div>

            {/* Do's and Don'ts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-[#00E676]/5 border border-[#00E676]/20 rounded-xl p-5">
                <h4 className="font-semibold text-[#00E676] mb-3">✓ Do</h4>
                <ul data-testid="logo-dos" className="space-y-2">
                  {LOGO_DOS.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-white/70">
                      <span className="text-[#00E676] mt-0.5 shrink-0">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
                <h4 className="font-semibold text-red-400 mb-3">✗ Don't</h4>
                <ul data-testid="logo-donts" className="space-y-2">
                  {LOGO_DONTS.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-white/70">
                      <span className="text-red-400 mt-0.5 shrink-0">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Section>

          {/* ── TONE OF VOICE ───────────────────────────────────────────── */}
          <Section id="tone" title="Tone of Voice">
            <p className="text-white/60 text-sm mb-6 max-w-2xl">
              SolFoundry speaks to developers and open-source contributors. Every word should feel like it comes from a peer who builds, not a brand manager who markets.
            </p>

            {/* Attributes */}
            <div data-testid="tone-attributes" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {TONE_ATTRS.map((attr) => (
                <div
                  key={attr.id}
                  data-testid={`tone-attr-${attr.id}`}
                  className="bg-[#0A0A0F] border border-white/10 rounded-xl p-4"
                >
                  <p className="font-semibold text-[#00E676] mb-1">{attr.label}</p>
                  <p className="text-sm text-white/60 leading-relaxed">{attr.desc}</p>
                </div>
              ))}
            </div>

            {/* Writing examples */}
            <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">Writing Examples</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div
                data-testid="tone-example-do"
                className="bg-[#00E676]/5 border border-[#00E676]/20 rounded-xl p-4"
              >
                <p className="text-xs text-[#00E676] font-semibold mb-2 uppercase tracking-wider">✓ Do write like this</p>
                <p className="text-sm text-white/80 italic">"Submit your PR. Get reviewed by Claude, Codex, and Gemini. Earn $FNDRY on-chain — no intermediaries."</p>
              </div>
              <div
                data-testid="tone-example-dont"
                className="bg-red-500/5 border border-red-500/20 rounded-xl p-4"
              >
                <p className="text-xs text-red-400 font-semibold mb-2 uppercase tracking-wider">✗ Avoid this</p>
                <p className="text-sm text-white/60 italic">"We are proud to offer a comprehensive, industry-leading solution that empowers developers to leverage their potential in a synergistic ecosystem."</p>
              </div>
            </div>
          </Section>

          {/* ── DESIGN PRINCIPLES ───────────────────────────────────────── */}
          <Section id="principles" title="Design Principles">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {PRINCIPLES.map((p) => (
                <div
                  key={p.id}
                  data-testid={`principle-${p.id}`}
                  className="bg-[#0A0A0F] border border-white/10 rounded-xl p-5"
                >
                  <div className="text-2xl mb-3">{p.icon}</div>
                  <p
                    data-testid={`principle-${p.id}-title`}
                    className="font-semibold text-white mb-2"
                  >
                    {p.title}
                  </p>
                  <p className="text-sm text-white/60 leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </Section>
        </main>
      </div>
    </div>
  );
}
