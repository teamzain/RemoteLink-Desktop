import React, { useState } from 'react'

// ── FAQ data ───────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  'Does RemoteLink have a free trial?',
  'How does monthly active user billing work?',
  'How do we determine who gets access to trials and who stays on the Personal plan?',
  'What differentiates commercial vs personal use?',
  'I am a user with a custom domain (e.g., @myname.com) who plans to use RemoteLink for personal use. Can I opt out of the trial?',
  'How do device limits work?',
  'What if I need more devices than are available with the number of users I have in my plan? How does add-on device pricing work?',
  "What's the benefit of Access Control Lists (ACLs)?",
  'What is the difference between ACLs in Starter and Premium?',
  'Do you offer discounts for non-profits or educational institutions?',
]

// ── Plus / Minus toggle icon ───────────────────────────────────────────────────

const ToggleIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 28 28"
    fill="none"
    style={{ flexShrink: 0, transition: 'transform 0.2s ease' }}
  >
    {/* Background circle */}
    <circle cx="14" cy="14" r="13.55" fill="#E6E4E2" stroke="#E6E4E2" strokeWidth="0.9" />
    {/* Horizontal bar */}
    <line x1="9" y1="14" x2="19" y2="14" stroke="#242424" strokeWidth="1.08" strokeLinecap="round" />
    {/* Vertical bar (hidden when open) */}
    {!open && (
      <line x1="14" y1="9" x2="14" y2="19" stroke="#242424" strokeWidth="1.08" strokeLinecap="round" />
    )}
  </svg>
)

// ── Single FAQ row ─────────────────────────────────────────────────────────────

const FAQRow: React.FC<{ question: string }> = ({ question }) => {
  const [open, setOpen] = useState(false)

  return (
    <div
      style={{
        borderTop: '1px solid rgba(36, 36, 36, 0.12)',
        padding: '20px 0',
        cursor: 'pointer',
      }}
      onClick={() => setOpen(o => !o)}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: '28px',
          width: '100%',
        }}
      >
        {/* Icon */}
        <span style={{ marginTop: '2px', flexShrink: 0 }}>
          <ToggleIcon open={open} />
        </span>

        {/* Question */}
        <span
          style={{
            fontFamily: 'Inter, sans-serif',
            fontStyle: 'normal',
            fontWeight: 400,
            fontSize: '24px',
            lineHeight: '32px',
            letterSpacing: '-0.16px',
            color: '#000000',
            flex: 1,
          }}
        >
          {question}
        </span>
      </div>

      {/* Placeholder answer — expand when open */}
      {open && (
        <div
          style={{
            marginTop: '16px',
            paddingLeft: '56px', // 28px icon + 28px gap
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: '16px',
            lineHeight: '26px',
            letterSpacing: '-0.1px',
            color: 'rgba(0,0,0,0.6)',
          }}
        >
          Please reach out to our support team or visit our documentation for more details on this topic.
        </div>
      )}
    </div>
  )
}

// ── Main FAQ section ───────────────────────────────────────────────────────────

const PricingFAQ: React.FC = () => (
  <section
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '0 40px 120px',
      background: '#FAF9F8',
    }}
  >
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: '283.94px',
        width: '100%',
        maxWidth: '1280px',
      }}
    >
      {/* ── Left: heading ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          paddingTop: '10px',
          flexShrink: 0,
          width: '225px',
        }}
      >
        <h2
          style={{
            fontFamily: 'Inter, sans-serif',
            fontStyle: 'normal',
            fontWeight: 500,
            fontSize: 'clamp(2.5rem, 4vw, 72px)',
            lineHeight: '85px',
            letterSpacing: '-2.16px',
            color: '#000000',
            margin: 0,
          }}
        >
          Pricing FAQs
        </h2>
      </div>

      {/* ── Right: accordion list ───────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          width: '624px',
          flexShrink: 0,
        }}
      >
        {/* Top border */}
        <div style={{ width: '100%', borderTop: '1px solid rgba(36, 36, 36, 0.12)' }} />

        {FAQ_ITEMS.map((q) => (
          <FAQRow key={q} question={q} />
        ))}

        {/* Bottom border */}
        <div style={{ width: '100%', borderTop: '1px solid rgba(36, 36, 36, 0.12)' }} />
      </div>
    </div>
  </section>
)

export default PricingFAQ
