import React, { useState } from 'react'

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

const ToggleIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="14" cy="14" r="13.55" fill="#E6E4E2" stroke="#E6E4E2" strokeWidth="0.9" />
    <line x1="9" y1="14" x2="19" y2="14" stroke="#242424" strokeWidth="1.08" strokeLinecap="round" />
    {!open && (
      <line x1="14" y1="9" x2="14" y2="19" stroke="#242424" strokeWidth="1.08" strokeLinecap="round" />
    )}
  </svg>
)

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
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '20px', width: '100%' }}>
        <span style={{ marginTop: '2px', flexShrink: 0 }}>
          <ToggleIcon open={open} />
        </span>
        <span style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 400,
          fontSize: 'clamp(16px, 1.8vw, 24px)',
          lineHeight: '1.35',
          letterSpacing: '-0.16px',
          color: '#000000',
          flex: 1,
        }}>
          {question}
        </span>
      </div>

      {open && (
        <div style={{
          marginTop: '16px',
          paddingLeft: '48px',
          fontFamily: 'Inter, sans-serif',
          fontWeight: 400,
          fontSize: '16px',
          lineHeight: '26px',
          letterSpacing: '-0.1px',
          color: 'rgba(0,0,0,0.6)',
        }}>
          Please reach out to our support team or visit our documentation for more details on this topic.
        </div>
      )}
    </div>
  )
}

const PricingFAQ: React.FC = () => (
  <section style={{
    padding: '0 clamp(20px, 4vw, 40px) 100px',
    background: '#FAF9F8',
  }}>
    <div className="faq-container">

      {/* Left: heading */}
      <div className="faq-heading">
        <h2 style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
          fontSize: 'clamp(2rem, 4vw, 72px)',
          lineHeight: '1.18',
          letterSpacing: '-2.16px',
          color: '#000000',
          margin: 0,
        }}>
          Pricing FAQs
        </h2>
      </div>

      {/* Right: accordion list */}
      <div className="faq-list">
        <div style={{ width: '100%', borderTop: '1px solid rgba(36, 36, 36, 0.12)' }} />
        {FAQ_ITEMS.map((q) => (
          <FAQRow key={q} question={q} />
        ))}
        <div style={{ width: '100%', borderTop: '1px solid rgba(36, 36, 36, 0.12)' }} />
      </div>
    </div>

    <style>{`
      .faq-container {
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: flex-start;
        gap: clamp(32px, 8vw, 120px);
        width: 100%;
        max-width: 1280px;
        margin: 0 auto;
      }
      .faq-heading {
        flex-shrink: 0;
        padding-top: 10px;
        width: clamp(160px, 18vw, 225px);
      }
      .faq-list {
        flex: 1;
        min-width: 0;
      }
      @media (max-width: 768px) {
        .faq-container {
          flex-direction: column;
          gap: 32px;
        }
        .faq-heading {
          width: 100%;
          padding-top: 0;
        }
      }
    `}</style>
  </section>
)

export default PricingFAQ
