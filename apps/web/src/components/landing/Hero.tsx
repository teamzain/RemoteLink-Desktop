import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ArrowRight, ExternalLink } from 'lucide-react'

interface HeroProps {
  heroImage: string
}

const LOGOS = ['Shopify', 'Duolingo', 'MongoDB', 'GitHub', 'Notion', 'Linear', 'Vercel', 'Stripe', 'Figma', 'Loom']

const Hero: React.FC<HeroProps> = ({ heroImage }) => {
  return (
    <section style={{ background: '#F6F4F2', overflow: 'hidden' }}>
      <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '60px 80px 80px' }}>

        {/* Heading + Description row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '40px' }}>

          {/* Left: Big heading */}
          <div style={{ maxWidth: '613px', flexShrink: 0 }}>
            <h1 style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: 'clamp(2.5rem, 5vw, 72px)',
              lineHeight: '85px',
              letterSpacing: '-2.16px',
              color: '#302C2C',
              margin: 0,
            }}>
              Secure, remote<br />access to{' '}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: '#175134',
                borderRadius: '10px',
                padding: '10px 20px',
                color: '#FFFFFF',
                fontSize: 'clamp(1.8rem, 3.6vw, 52px)',
                lineHeight: '61px',
                letterSpacing: '-1.56px',
                verticalAlign: 'middle',
              }}>
                databases
              </span>
            </h1>
          </div>

          {/* Right: Description + CTA */}
          <div style={{ width: '441px', flexShrink: 0, paddingTop: '8px' }}>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '20px',
              lineHeight: '30px',
              letterSpacing: '-0.2px',
              color: 'rgba(48, 44, 44, 0.65)',
              margin: '0 0 36px 0',
              maxWidth: '394px',
            }}>
              ConnectX makes creating software-defined networks easy: securely connecting users, services, and devices.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '30px', flexWrap: 'wrap' }}>
              {/* Get Started button */}
              <RouterLink to="/register" style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: '#302C2C',
                  border: '1px solid #302C2C',
                  borderRadius: '8px',
                  padding: '9px 18px',
                  height: '41px',
                  boxSizing: 'border-box',
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
                    lineHeight: '23px',
                    letterSpacing: '-0.16px',
                    color: '#FFFFFF',
                  }}>
                    Get Started
                  </span>
                  <ArrowRight size={16} color="#FFFFFF" />
                </div>
              </RouterLink>

              {/* Contact Sales link */}
              <RouterLink to="/contact" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                textDecoration: 'none',
              }}>
                <span style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  fontSize: '16px',
                  lineHeight: '23px',
                  letterSpacing: '-0.17px',
                  color: '#000000',
                }}>
                  Contact Sales
                </span>
                <ExternalLink size={17} color="#000000" />
              </RouterLink>
            </div>
          </div>
        </div>

        {/* Dashboard preview */}
        <div style={{ marginTop: '80px' }}>
          <div style={{
            background: '#242424',
            borderRadius: '16px',
            overflow: 'hidden',
            maxWidth: '1360px',
            margin: '0 auto',
            aspectRatio: '1360 / 725',
          }}>
            <img
              src={heroImage}
              alt="ConnectX Dashboard"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
        </div>

        {/* Trusted by */}
        <div style={{ marginTop: '80px' }}>
          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: '24px',
            lineHeight: '34px',
            letterSpacing: '-0.48px',
            color: '#787676',
            textAlign: 'center',
            margin: '0 0 40px 0',
          }}>
            Trusted by 4,000+ companies
          </p>

          {/* Marquee */}
          <div style={{ position: 'relative', overflow: 'hidden', height: '82px', margin: '0 -80px' }}>
            {/* Fade edges */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(90deg, #F6F4F2 0%, transparent 12%, transparent 88%, #F6F4F2 100%)',
              zIndex: 10,
              pointerEvents: 'none',
            }} />

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0',
              animation: 'marquee 30s linear infinite',
              width: 'max-content',
              height: '100%',
            }}>
              {[...LOGOS, ...LOGOS].map((logo, i) => (
                <div key={i} style={{
                  width: '234px',
                  height: '82px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 700,
                    fontSize: '18px',
                    color: '#302C2C',
                    opacity: 0.35,
                    letterSpacing: '-0.4px',
                    userSelect: 'none',
                  }}>
                    {logo}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (max-width: 1100px) {
          .hero-row { flex-direction: column !important; }
        }
      `}</style>
    </section>
  )
}

export default Hero
