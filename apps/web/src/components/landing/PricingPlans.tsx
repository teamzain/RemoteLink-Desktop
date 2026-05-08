import React from 'react'
import { useNavigate } from 'react-router-dom'

// ── Check icon ────────────────────────────────────────────────────────────────

const CheckIcon: React.FC<{ color?: string }> = ({ color = '#302C2C' }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="8" cy="8" r="8" fill={color} fillOpacity="0.1" />
    <path d="M4.5 8L7 10.5L11.5 5.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// ── Plan icons ─────────────────────────────────────────────────────────────────

const PersonalIcon: React.FC = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <rect x="6" y="14" width="20" height="20" rx="4" fill="#487961" />
    <rect x="18" y="22" width="20" height="20" rx="4" fill="#5F987C" fillOpacity="0.85" />
  </svg>
)

const StarterIcon: React.FC = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <rect x="6" y="10" width="22" height="22" rx="4" fill="#496495" />
    <rect x="16" y="18" width="22" height="22" rx="4" fill="#678AC0" fillOpacity="0.85" />
  </svg>
)

const PremiumIcon: React.FC = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <rect x="6" y="10" width="22" height="22" rx="4" fill="#CCA000" />
    <rect x="16" y="18" width="22" height="22" rx="4" fill="#FADC71" fillOpacity="0.85" />
  </svg>
)

const EnterpriseIcon: React.FC = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <rect x="6" y="10" width="22" height="22" rx="4" fill="#4A3F6B" />
    <rect x="16" y="18" width="22" height="22" rx="4" fill="#7B6EA8" fillOpacity="0.85" />
  </svg>
)

// ── Feature list ──────────────────────────────────────────────────────────────

interface FeatureGroup {
  label: string
  items: string[]
}

const FeatureSection: React.FC<{ group: FeatureGroup; checkColor: string }> = ({ group, checkColor }) => (
  <div style={{ marginBottom: '20px' }}>
    <p style={{
      fontFamily: 'Inter, sans-serif',
      fontWeight: 600,
      fontSize: '11px',
      lineHeight: '16px',
      letterSpacing: '0.6px',
      textTransform: 'uppercase',
      color: 'rgba(48, 44, 44, 0.4)',
      margin: '0 0 10px',
    }}>
      {group.label}
    </p>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {group.items.map(item => (
        <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ marginTop: '2px' }}>
            <CheckIcon color={checkColor} />
          </div>
          <span style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: '13px',
            lineHeight: '19px',
            letterSpacing: '-0.13px',
            color: '#302C2C',
          }}>
            {item}
          </span>
        </div>
      ))}
    </div>
  </div>
)

// ── Card data ──────────────────────────────────────────────────────────────────

const personalFeatures: FeatureGroup[] = [
  {
    label: 'Users and devices',
    items: ['Up to 3 users', 'Up to 100 devices'],
  },
  {
    label: 'Features',
    items: [
      'Peer-To-Peer Connections',
      'MagicDNS',
      'ACLs',
      'User Approval',
      'SSO with standard IdP',
    ],
  },
]

const starterFeatures: FeatureGroup[] = [
  {
    label: 'Users and devices',
    items: ['Unlimited users', '100 + 10 devices per user'],
  },
  {
    label: 'Features',
    items: [
      'Limited ACLs',
      'Standard user roles',
      'ACL tags',
      'Auth keys',
      'SSO with standard IdP',
      'Config audit logging',
      'Webhooks',
    ],
  },
]

const premiumFeatures: FeatureGroup[] = [
  {
    label: 'Users and devices',
    items: ['Unlimited users', '100 + 20 devices per user'],
  },
  {
    label: 'Features',
    items: [
      'Everything in Starter',
      'Advanced ACLs',
      'Custom user roles',
      'SSO with any OIDC IdP',
      'Network flow logs',
      'Multi-owner admin',
      'Priority support',
    ],
  },
]

const enterpriseFeatures: FeatureGroup[] = [
  {
    label: 'Users and devices',
    items: ['Unlimited users', 'Custom device limits'],
  },
  {
    label: 'Features',
    items: [
      'Everything in Premium',
      'SCIM provisioning',
      'Custom contract & billing',
      'Dedicated support',
      'SSO with SAML IdP',
      'SLA guarantees',
    ],
  },
]

// ── Card label ─────────────────────────────────────────────────────────────────

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{
    fontFamily: 'Inter, sans-serif',
    fontWeight: 500,
    fontSize: '13px',
    lineHeight: '19px',
    letterSpacing: '-0.13px',
    color: 'rgba(48, 44, 44, 0.5)',
    margin: '0 0 12px',
  }}>
    {children}
  </p>
)

// ── Individual plan card ───────────────────────────────────────────────────────

interface PlanCardProps {
  Icon: React.FC
  name: string
  description: string
  price: string
  priceSuffix?: string
  ctaText: string
  onCta: () => void
  features: FeatureGroup[]
  checkColor: string
  accentColor: string
  borderRadius?: string
  highlight?: boolean
}

const PlanCard: React.FC<PlanCardProps> = ({
  Icon,
  name,
  description,
  price,
  priceSuffix,
  ctaText,
  onCta,
  features,
  checkColor,
  accentColor,
  borderRadius = '16px',
  highlight = false,
}) => (
  <div style={{
    background: highlight ? '#F4F8FF' : '#FFFFFF',
    border: highlight ? `1.5px solid ${accentColor}` : '1px solid rgba(48, 44, 44, 0.1)',
    borderRadius,
    padding: '32px 28px',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  }}>
    {/* Icon + name */}
    <div style={{ marginBottom: '12px' }}>
      <Icon />
    </div>
    <h3 style={{
      fontFamily: 'Inter, sans-serif',
      fontWeight: 700,
      fontSize: '22px',
      lineHeight: '28px',
      letterSpacing: '-0.44px',
      color: '#302C2C',
      margin: '0 0 6px',
    }}>
      {name}
    </h3>
    <p style={{
      fontFamily: 'Inter, sans-serif',
      fontWeight: 400,
      fontSize: '13px',
      lineHeight: '18px',
      color: 'rgba(48, 44, 44, 0.55)',
      margin: '0 0 24px',
    }}>
      {description}
    </p>

    {/* Price */}
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px' }}>
        {price !== 'Custom' && (
          <span style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: '18px',
            color: '#302C2C',
            lineHeight: '1',
          }}>$</span>
        )}
        <span style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 700,
          fontSize: '42px',
          lineHeight: '1',
          letterSpacing: '-1.5px',
          color: '#302C2C',
        }}>
          {price}
        </span>
      </div>
      {priceSuffix && (
        <p style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
          fontSize: '11px',
          lineHeight: '16px',
          letterSpacing: '0.4px',
          textTransform: 'uppercase',
          color: 'rgba(48, 44, 44, 0.45)',
          margin: '4px 0 0',
        }}>
          {priceSuffix}
        </p>
      )}
    </div>

    {/* CTA */}
    <button
      onClick={onCta}
      style={{
        width: '100%',
        height: '42px',
        background: accentColor,
        border: 'none',
        borderRadius: '10px',
        cursor: 'pointer',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 500,
        fontSize: '14px',
        letterSpacing: '-0.14px',
        color: '#FFFFFF',
        marginBottom: '28px',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      {ctaText}
    </button>

    {/* Divider */}
    <div style={{ borderTop: '1px solid rgba(48, 44, 44, 0.08)', marginBottom: '24px' }} />

    {/* Features */}
    <div style={{ flex: 1 }}>
      {features.map(group => (
        <FeatureSection key={group.label} group={group} checkColor={checkColor} />
      ))}
    </div>
  </div>
)

// ── Main component ─────────────────────────────────────────────────────────────

const PricingPlans: React.FC = () => {
  const navigate = useNavigate()

  return (
    <section style={{ background: '#FAF9F8', padding: '0 clamp(16px, 4vw, 40px) 100px' }}>
      <div className="pricing-plans-outer">

        {/* ── Left: Remote 365 at home ───────────────────────────────────────── */}
        <div className="pricing-home-col">
          <SectionLabel>Remote 365 at home</SectionLabel>
          <PlanCard
            Icon={PersonalIcon}
            name="Personal"
            description="Free forever for personal use and small teams."
            price="0"
            priceSuffix="Free forever"
            ctaText="Get started free"
            onCta={() => navigate('/register')}
            features={personalFeatures}
            checkColor="#487961"
            accentColor="#302C2C"
          />
        </div>

        {/* ── Right: Remote 365 at work ──────────────────────────────────────── */}
        <div className="pricing-work-col">
          <SectionLabel>Remote 365 at work</SectionLabel>
          <div className="pricing-work-cards">
            <PlanCard
              Icon={StarterIcon}
              name="Starter"
              description="For growing teams that need more control."
              price="6"
              priceSuffix="Per active user / month"
              ctaText="Start for free"
              onCta={() => navigate('/register')}
              features={starterFeatures}
              checkColor="#496495"
              accentColor="#496495"
              borderRadius="16px 0 0 16px"
            />
            <PlanCard
              Icon={PremiumIcon}
              name="Premium"
              description="Advanced features for security-conscious teams."
              price="18"
              priceSuffix="Per active user / month"
              ctaText="Start for free"
              onCta={() => navigate('/register')}
              features={premiumFeatures}
              checkColor="#CCA000"
              accentColor="#CCA000"
              borderRadius="0"
              highlight
            />
            <PlanCard
              Icon={EnterpriseIcon}
              name="Enterprise"
              description="Custom plans, dedicated support, and SLA guarantees."
              price="Custom"
              ctaText="Contact sales"
              onCta={() => { window.location.href = 'mailto:sales@remote365.com' }}
              features={enterpriseFeatures}
              checkColor="#4A3F6B"
              accentColor="#4A3F6B"
              borderRadius="0 16px 16px 0"
            />
          </div>
        </div>

      </div>

      <style>{`
        .pricing-plans-outer {
          max-width: 1280px;
          margin: 0 auto;
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }
        .pricing-home-col {
          width: 314px;
          flex-shrink: 0;
        }
        .pricing-work-col {
          flex: 1;
          min-width: 0;
        }
        .pricing-work-cards {
          display: flex;
          gap: 4px;
          align-items: stretch;
        }
        @media (max-width: 1100px) {
          .pricing-plans-outer {
            flex-direction: column;
          }
          .pricing-home-col {
            width: 100%;
          }
          .pricing-work-cards {
            gap: 12px;
          }
        }
        @media (max-width: 768px) {
          .pricing-work-cards {
            flex-direction: column;
            gap: 16px;
          }
          .pricing-work-cards > div {
            border-radius: 16px !important;
          }
        }
      `}</style>
    </section>
  )
}

export default PricingPlans
