import React from 'react'

const GREEN_DARK  = '#487961'
const GREEN_MID   = '#91BBA6'
const GREEN_LIGHT = '#CAE6D9'
const CARD_BG     = '#F6F4F2'

// ── Card icons ──────────────────────────────────────────────────────────────
const IconDeploy = () => (
  <svg width="138" height="103" viewBox="0 0 138 103" fill="none">
    {/* Three vertical bars */}
    <rect x="16" y="24" width="26" height="55" rx="4" fill={GREEN_DARK} />
    <rect x="56" y="24" width="26" height="55" rx="4" fill={GREEN_MID} />
    <rect x="96" y="24" width="26" height="55" rx="4" fill={GREEN_LIGHT} />
    {/* Base line */}
    <rect x="10" y="82" width="118" height="3" rx="1.5" fill={GREEN_MID} opacity="0.4" />
  </svg>
)

const IconInfra = () => (
  <svg width="138" height="103" viewBox="0 0 138 103" fill="none">
    {/* 3×2 grid of blocks */}
    {[0, 1, 2].map(col =>
      [0, 1].map(row => {
        const colors = [[GREEN_DARK, GREEN_LIGHT], [GREEN_MID, GREEN_MID], [GREEN_LIGHT, GREEN_DARK]]
        return (
          <rect
            key={`${col}-${row}`}
            x={16 + col * 38} y={18 + row * 34}
            width="30" height="26" rx="4"
            fill={colors[col][row]}
          />
        )
      })
    )}
  </svg>
)

const IconSecure = () => (
  <svg width="138" height="103" viewBox="0 0 138 103" fill="none">
    {/* Shield shape */}
    <path d="M69 8 L108 24 L108 52 C108 72 90 88 69 95 C48 88 30 72 30 52 L30 24 Z"
      fill={GREEN_MID} />
    <path d="M69 18 L98 31 L98 52 C98 67 85 80 69 86 C53 80 40 67 40 52 L40 31 Z"
      fill={GREEN_DARK} />
    {/* Checkmark */}
    <path d="M55 51 L65 61 L83 43" stroke="white" strokeWidth="4"
      strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
)

// ── Card ────────────────────────────────────────────────────────────────────
interface CardProps {
  icon: React.ReactNode
  title: string
  description: string
}

const FeatureCard: React.FC<CardProps> = ({ icon, title, description }) => (
  <div style={{
    flex: 1,
    background: CARD_BG,
    borderRadius: '12px',
    padding: '76px 37px 40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
  }}>
    <div style={{ marginBottom: '24px' }}>{icon}</div>

    <h3 style={{
      fontFamily: 'Inter, sans-serif',
      fontWeight: 400,
      fontSize: '28px',
      lineHeight: '33px',
      letterSpacing: '-0.56px',
      color: '#302C2C',
      margin: '0 0 20px 0',
    }}>
      {title}
    </h3>

    <p style={{
      fontFamily: 'Inter, sans-serif',
      fontWeight: 400,
      fontSize: '18px',
      lineHeight: '27px',
      letterSpacing: '-0.18px',
      color: '#787676',
      margin: 0,
      maxWidth: '326px',
    }}>
      {description}
    </p>
  </div>
)

// ── Stat ────────────────────────────────────────────────────────────────────
interface StatProps { value: string; label: string }
const Stat: React.FC<StatProps> = ({ value, label }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{
      fontFamily: 'Inter, sans-serif',
      fontWeight: 500,
      fontSize: 'clamp(2.5rem, 5vw, 72px)',
      lineHeight: '85px',
      letterSpacing: '-2.16px',
      color: '#000000',
    }}>
      {value}
    </div>
    <div style={{
      fontFamily: 'Inter, sans-serif',
      fontWeight: 400,
      fontSize: '18px',
      lineHeight: '27px',
      letterSpacing: '-0.18px',
      color: '#787676',
    }}>
      {label}
    </div>
  </div>
)

// ── Section ──────────────────────────────────────────────────────────────────
const SimplePowerfulSection: React.FC = () => (
  <section style={{ background: '#FFFFFF' }}>
    <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '112px 40px' }}>

      {/* Heading */}
      <h2 style={{
        fontFamily: 'Inter, sans-serif',
        fontWeight: 500,
        fontSize: 'clamp(2rem, 3.5vw, 48px)',
        lineHeight: '57px',
        letterSpacing: '-0.96px',
        color: '#000000',
        margin: '0 0 56px 0',
        maxWidth: '648px',
      }}>
        Simple, powerful, and reliable
      </h2>

      {/* Three cards */}
      <div style={{ display: 'flex', gap: '40px', marginBottom: '80px' }}>
        <FeatureCard
          icon={<IconDeploy />}
          title="Quick deployment"
          description="Establish private networks in minutes and push out ConnectX to users without having to configure every device."
        />
        <FeatureCard
          icon={<IconInfra />}
          title="Infrastructure agnostic"
          description="ConnectX works wherever you do, on any platform, service, or runtime, anywhere."
        />
        <FeatureCard
          icon={<IconSecure />}
          title="Secure by default"
          description="Authorize which resources are accessible to users, roles, or groups with Access Control Lists (ACLs)."
        />
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: '0 40px',
      }}>
        <Stat value="3 mins"  label="to set up your network" />
        <Stat value="2.5m"    label="devices connected" />
        <Stat value="4k+"     label="companies running ConnectX" />
      </div>

    </div>
  </section>
)

export default SimplePowerfulSection
