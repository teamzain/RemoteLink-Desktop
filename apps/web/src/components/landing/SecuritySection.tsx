import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ArrowRight, ExternalLink } from 'lucide-react'

const PhoneMockup: React.FC = () => (
  <div style={{
    width: '180px',
    height: '340px',
    background: '#FFFFFF',
    borderRadius: '28px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.07)',
    overflow: 'hidden',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
  }}>
    {/* Status bar */}
    <div style={{
      height: '32px',
      background: '#111827',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ width: '72px', height: '8px', background: '#1F2937', borderRadius: '4px' }} />
    </div>

    {/* Screen content */}
    <div style={{ flex: 1, background: '#111827', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ height: '10px', background: '#1F2937', borderRadius: '4px', width: '70%' }} />
      <div style={{ height: '8px', background: '#1F2937', borderRadius: '4px', width: '90%' }} />
      <div style={{ height: '8px', background: '#1F2937', borderRadius: '4px', width: '55%' }} />
      <div style={{ height: '40px', background: '#1A2E22', borderRadius: '8px', marginTop: '8px' }} />
      <div style={{ height: '40px', background: '#1A2535', borderRadius: '8px' }} />
      <div style={{ height: '40px', background: '#2A1A1A', borderRadius: '8px' }} />
    </div>

    {/* Home indicator */}
    <div style={{
      height: '28px',
      background: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ width: '56px', height: '4px', background: '#D0D0D0', borderRadius: '2px' }} />
    </div>
  </div>
)

const SecuritySection: React.FC = () => (
  <section style={{ background: '#F6F4F2', overflow: 'hidden' }}>
    <div style={{
      maxWidth: '1360px',
      margin: '0 auto',
      padding: '112px 67px',
      display: 'flex',
      alignItems: 'center',
      gap: '80px',
    }}>

      {/* Left: text */}
      <div style={{ flex: '0 0 460px', maxWidth: '460px' }}>
        <h2 style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
          fontSize: 'clamp(2rem, 4vw, 58px)',
          lineHeight: '1.1',
          letterSpacing: '-1.16px',
          color: '#000000',
          margin: '0 0 24px 0',
        }}>
          Our commitment to security
        </h2>

        <p style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 400,
          fontSize: '18px',
          lineHeight: '27px',
          letterSpacing: '-0.18px',
          color: 'rgba(48, 44, 44, 0.65)',
          margin: '0 0 40px 0',
        }}>
          ConnectX is built on zero-trust architecture with end-to-end encryption and rigorous compliance standards to protect your network at every layer.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'flex-start' }}>
          <a href="#" style={{ textDecoration: 'none' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#302C2C',
                border: '1px solid #302C2C',
                borderRadius: '8px',
                padding: '0 20px',
                height: '41px',
                cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                fontSize: '16px',
                letterSpacing: '-0.16px',
                color: '#FFFFFF',
              }}>
                Learn more
              </span>
              <ArrowRight size={16} color="#FFFFFF" />
            </div>
          </a>

          <RouterLink to="/security-bulletins" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            textDecoration: 'none',
          }}>
            <span style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: '16px',
              letterSpacing: '-0.17px',
              color: '#000000',
            }}>
              Security bulletins
            </span>
            <ExternalLink size={17} color="#000000" />
          </RouterLink>
        </div>
      </div>

      {/* Right: staggered phone columns */}
      <div style={{
        flex: 1,
        display: 'flex',
        gap: '16px',
        justifyContent: 'center',
        overflow: 'hidden',
        height: '560px',
        alignItems: 'flex-start',
      }}>
        {/* Left column — shifted down */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '40px' }}>
          <PhoneMockup />
          <PhoneMockup />
          <PhoneMockup />
        </div>

        {/* Right column — shifted up */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '-20px' }}>
          <PhoneMockup />
          <PhoneMockup />
          <PhoneMockup />
        </div>
      </div>

    </div>
  </section>
)

export default SecuritySection
