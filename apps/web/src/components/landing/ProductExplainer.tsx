import React, { useState } from 'react'

const STEPS = [
  {
    title: 'Start a remote session',
    description:
      'Generate a session code and share it with anyone who needs support. Sessions are temporary, end-to-end encrypted, and require no account for the guest. Perfect for one-time remote assistance.',
  },
  {
    title: 'Access any device',
    description:
      'Connect to any registered device using its unique device ID. Control keyboard and mouse, share screens, and collaborate in real-time — as if you were sitting right in front of it.',
  },
  {
    title: 'Manage your team',
    description:
      'Invite teammates to your organization, assign device access by role, and run multiple remote sessions simultaneously. Built-in chat and video meetings keep everyone connected.',
  },
]

const ProductExplainer: React.FC = () => {
  const [active, setActive] = useState(0)

  return (
    <section style={{ background: '#FFFFFF', width: '100%' }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: 'clamp(60px, 8vw, 111px) clamp(20px, 3vw, 40px) clamp(60px, 8vw, 80px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'clamp(48px, 6vw, 80px)',
      }}>

        {/* ── Heading block ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '20px',
          maxWidth: '776px',
          width: '100%',
        }}>
          <h2 style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: 'clamp(2rem, 4vw, 48px)',
            lineHeight: '1.18',
            letterSpacing: '-0.96px',
            color: '#000000',
            margin: 0,
          }}>
            What is Remote 365?
          </h2>
          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: 'clamp(16px, 1.5vw, 18px)',
            lineHeight: '1.5',
            letterSpacing: '-0.18px',
            color: 'rgba(48, 44, 44, 0.65)',
            margin: 0,
          }}>
            Remote 365 is a secure remote access platform that lets you connect to any device, from anywhere. Start a session with a unique code, access devices by ID, or share access with your team — all protected with end-to-end encryption.
          </p>
        </div>

        {/* ── Diagram vector ── */}
        <div style={{
          width: '100%',
          borderRadius: '16px',
          overflow: 'hidden',
          aspectRatio: '1280 / 560',
          flexShrink: 0,
          position: 'relative',
          background: '#5F987C',
        }}>
          <svg width="100%" height="100%" viewBox="0 0 1280 560" preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', top: 0, left: 0 }}>
            {/* Background */}
            <defs>
              <linearGradient id="explainerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#5F987C"/>
                <stop offset="50%" stopColor="#487961"/>
                <stop offset="100%" stopColor="#175134"/>
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur"/>
                <feMerge>
                  <feMergeNode in="blur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <rect width="1280" height="560" fill="url(#explainerGrad)"/>

            {/* Subtle grid pattern */}
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
            </pattern>
            <rect width="1280" height="560" fill="url(#grid)"/>

            {/* Connection lines */}
            <g opacity="0.4">
              <line x1="240" y1="280" x2="540" y2="280" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="8,4"/>
              <line x1="740" y1="280" x2="1040" y2="280" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="8,4"/>
              <line x1="640" y1="120" x2="640" y2="200" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="8,4"/>
              <line x1="640" y1="360" x2="640" y2="440" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="8,4"/>
              <line x1="380" y1="160" x2="540" y2="240" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="6,3" opacity="0.3"/>
              <line x1="740" y1="240" x2="900" y2="160" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="6,3" opacity="0.3"/>
              <line x1="380" y1="400" x2="540" y2="320" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="6,3" opacity="0.3"/>
              <line x1="740" y1="320" x2="900" y2="400" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="6,3" opacity="0.3"/>
            </g>

            {/* Central Hub - Remote 365 */}
            <g transform="translate(590, 230)">
              {/* Outer glow ring */}
              <circle cx="50" cy="50" r="55" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2"/>
              <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"/>
              
              {/* Hub circle */}
              <circle cx="50" cy="50" r="38" fill="#302C2C"/>
              <circle cx="50" cy="50" r="36" fill="#1a1a1a"/>
              
              {/* 3x3 dot grid inside hub */}
              <circle cx="38" cy="38" r="3.5" fill="#FFFFFF" opacity="0.9"/>
              <circle cx="50" cy="38" r="3.5" fill="#FFFFFF" opacity="0.9"/>
              <circle cx="62" cy="38" r="3.5" fill="#FFFFFF" opacity="0.9"/>
              <circle cx="38" cy="50" r="3.5" fill="#FFFFFF" opacity="0.9"/>
              <circle cx="50" cy="50" r="3.5" fill="#FFFFFF" opacity="1"/>
              <circle cx="62" cy="50" r="3.5" fill="#FFFFFF" opacity="0.9"/>
              <circle cx="38" cy="62" r="3.5" fill="#FFFFFF" opacity="0.3"/>
              <circle cx="50" cy="62" r="3.5" fill="#FFFFFF" opacity="0.3"/>
              <circle cx="62" cy="62" r="3.5" fill="#FFFFFF" opacity="0.3"/>
              
              {/* Pulse rings */}
              <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1">
                <animate attributeName="r" values="42;52;42" dur="3s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.3;0;0.3" dur="3s" repeatCount="indefinite"/>
              </circle>
            </g>

            {/* Device A - Left Laptop */}
            <g transform="translate(140, 240)">
              <rect x="0" y="0" width="100" height="65" rx="6" fill="#FFFFFF" opacity="0.95"/>
              <rect x="5" y="5" width="90" height="52" rx="3" fill="#242424"/>
              <rect x="30" y="57" width="40" height="5" rx="2" fill="#FFFFFF" opacity="0.95"/>
              <rect x="20" y="62" width="60" height="3" rx="1" fill="#FFFFFF" opacity="0.7"/>
              {/* Status dot */}
              <circle cx="88" cy="12" r="4" fill="#4ADE80"/>
            </g>

            {/* Device B - Top Phone */}
            <g transform="translate(615, 60)">
              <rect x="0" y="0" width="50" height="90" rx="8" fill="#FFFFFF" opacity="0.95"/>
              <rect x="4" y="8" width="42" height="68" rx="3" fill="#242424"/>
              <rect x="20" y="80" width="10" height="3" rx="1.5" fill="#242424"/>
              <circle cx="25" cy="6" r="2" fill="#242424"/>
              {/* Status dot */}
              <circle cx="42" cy="15" r="3" fill="#4ADE80"/>
            </g>

            {/* Device C - Bottom Left Server */}
            <g transform="translate(160, 400)">
              <rect x="0" y="0" width="80" height="55" rx="5" fill="#FFFFFF" opacity="0.95"/>
              <rect x="8" y="8" width="64" height="8" rx="2" fill="#242424"/>
              <rect x="8" y="20" width="64" height="8" rx="2" fill="#242424"/>
              <rect x="8" y="32" width="64" height="8" rx="2" fill="#242424"/>
              <circle cx="16" cy="12" r="2" fill="#4ADE80"/>
              <circle cx="16" cy="24" r="2" fill="#4ADE80"/>
              <circle cx="16" cy="36" r="2" fill="#F87171"/>
              {/* Status indicator */}
              <rect x="72" y="5" width="6" height="45" rx="3" fill="#4ADE80" opacity="0.8"/>
            </g>

            {/* Device D - Right Desktop */}
            <g transform="translate(1040, 240)">
              <rect x="0" y="0" width="100" height="65" rx="6" fill="#FFFFFF" opacity="0.95"/>
              <rect x="5" y="5" width="90" height="52" rx="3" fill="#242424"/>
              <rect x="30" y="57" width="40" height="5" rx="2" fill="#FFFFFF" opacity="0.95"/>
              <rect x="20" y="62" width="60" height="3" rx="1" fill="#FFFFFF" opacity="0.7"/>
              {/* Status dot */}
              <circle cx="88" cy="12" r="4" fill="#4ADE80"/>
            </g>

            {/* Device E - Top Right Tablet */}
            <g transform="translate(1060, 70)">
              <rect x="0" y="0" width="70" height="90" rx="6" fill="#FFFFFF" opacity="0.95"/>
              <rect x="5" y="8" width="60" height="70" rx="3" fill="#242424"/>
              <circle cx="35" cy="83" r="3" fill="#242424"/>
              {/* Status dot */}
              <circle cx="58" cy="15" r="3" fill="#4ADE80"/>
            </g>

            {/* Device F - Bottom Right */}
            <g transform="translate(1050, 400)">
              <rect x="0" y="0" width="80" height="55" rx="5" fill="#FFFFFF" opacity="0.95"/>
              <rect x="5" y="5" width="70" height="40" rx="3" fill="#242424"/>
              <rect x="25" y="47" width="30" height="5" rx="2" fill="#FFFFFF" opacity="0.95"/>
              {/* Status dot */}
              <circle cx="68" cy="12" r="3" fill="#4ADE80"/>
            </g>

            {/* Connection nodes at line endpoints */}
            <circle cx="240" cy="280" r="6" fill="#175134" stroke="#FFFFFF" strokeWidth="1.5"/>
            <circle cx="1040" cy="280" r="6" fill="#175134" stroke="#FFFFFF" strokeWidth="1.5"/>
            <circle cx="640" cy="120" r="6" fill="#175134" stroke="#FFFFFF" strokeWidth="1.5"/>
            <circle cx="640" cy="440" r="6" fill="#175134" stroke="#FFFFFF" strokeWidth="1.5"/>

            {/* Floating data packet animations */}
            <circle cx="0" cy="0" r="3" fill="#FFFFFF" opacity="0.6">
              <animateMotion path="M240,280 L640,280" dur="2s" repeatCount="indefinite"/>
            </circle>
            <circle cx="0" cy="0" r="3" fill="#FFFFFF" opacity="0.6">
              <animateMotion path="M1040,280 L640,280" dur="2.5s" repeatCount="indefinite"/>
            </circle>
            <circle cx="0" cy="0" r="3" fill="#FFFFFF" opacity="0.6">
              <animateMotion path="M640,120 L640,280" dur="1.8s" repeatCount="indefinite"/>
            </circle>
            <circle cx="0" cy="0" r="3" fill="#FFFFFF" opacity="0.6">
              <animateMotion path="M640,440 L640,280" dur="2.2s" repeatCount="indefinite"/>
            </circle>
          </svg>
        </div>

        {/* ── Step tabs ── */}
        <div className="explainer-steps">
          {STEPS.map((step, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className="explainer-step"
              style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {/* Top bar + green active indicator */}
              <div style={{ position: 'relative', height: '1px', width: '100%', background: 'rgba(48,44,44,0.18)', marginBottom: '17px' }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  height: '2px',
                  background: '#487961',
                  width: active === i ? '100%' : '0%',
                  transition: 'width 0.35s ease',
                  marginTop: '-0.5px',
                }} />
              </div>

              {/* Title */}
              <div style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                fontSize: 'clamp(18px, 1.8vw, 24px)',
                lineHeight: '1.42',
                letterSpacing: '-0.48px',
                color: active === i ? '#000000' : 'rgba(48,44,44,0.45)',
                marginBottom: active === i ? '24px' : '0',
                transition: 'color 0.25s ease',
              }}>
                {step.title}
              </div>

              {/* Description (only visible when active) */}
              <div style={{
                overflow: 'hidden',
                maxHeight: active === i ? '200px' : '0',
                opacity: active === i ? 1 : 0,
                transition: 'max-height 0.35s ease, opacity 0.25s ease',
              }}>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: 'clamp(15px, 1.4vw, 18px)',
                  lineHeight: '1.5',
                  letterSpacing: '-0.18px',
                  color: 'rgba(48, 44, 44, 0.8)',
                  margin: 0,
                }}>
                  {step.description}
                </p>
              </div>
            </button>
          ))}
        </div>

      </div>

      <style>{`
        .explainer-steps {
          display: flex;
          flex-direction: row;
          align-items: flex-start;
          gap: 40px;
          width: 100%;
        }
        .explainer-step {
          flex: 1;
          min-width: 0;
        }
        @media (max-width: 768px) {
          .explainer-steps {
            flex-direction: column;
            gap: 24px;
          }
          .explainer-step {
            width: 100%;
          }
        }
      `}</style>
    </section>
  )
}

export default ProductExplainer
