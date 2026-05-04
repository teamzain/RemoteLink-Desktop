import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ArrowRight, ExternalLink } from 'lucide-react'

const HomelabSection: React.FC = () => (
  <section style={{ background: '#FFFFFF', overflow: 'hidden' }}>
    <div style={{ maxWidth: '1360px', margin: '0 auto', paddingTop: '112px' }}>

      {/* All text centered */}
      <div style={{ textAlign: 'center' }}>

        <p style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 400,
          fontSize: '18px',
          lineHeight: '27px',
          letterSpacing: '-0.18px',
          color: '#787676',
          margin: '0 0 20px 0',
        }}>
          Homelab
        </p>

        <h2 style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
          fontSize: 'clamp(2rem, 3.5vw, 48px)',
          lineHeight: '57px',
          letterSpacing: '-0.96px',
          color: '#000000',
          margin: '0 auto 24px',
          maxWidth: '617px',
        }}>
          Your home away from home
        </h2>

        <p style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 400,
          fontSize: '20px',
          lineHeight: '30px',
          letterSpacing: '-0.2px',
          color: 'rgba(48, 44, 44, 0.65)',
          margin: '0 auto 48px',
          maxWidth: '583px',
        }}>
          Access your homelab, personal devices, and dev environments wherever
          you are — for free.
        </p>

        {/* CTA row */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '32px' }}>
          <a
            href="http://159.65.84.190/downloads/desktop/Connect-X-Setup.exe"
            style={{ textDecoration: 'none' }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: '#302C2C',
                border: '1px solid #302C2C',
                borderRadius: '8px',
                width: '197px',
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
                Download for free
              </span>
              <ArrowRight size={16} color="#FFFFFF" />
            </div>
          </a>

          <RouterLink to="/homelab" style={{
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
              Learn more
            </span>
            <ExternalLink size={17} color="#000000" />
          </RouterLink>
        </div>
      </div>

      {/* Homelab diagram image */}
      <div style={{ margin: '56px 40px 0', overflow: 'hidden' }}>
        <img
          src="/svg.png"
          alt="Homelab network diagram"
          style={{ width: '100%', display: 'block' }}
        />
      </div>

    </div>
  </section>
)

export default HomelabSection
