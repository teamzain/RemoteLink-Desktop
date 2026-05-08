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
      <div className="hero-container">

        {/* Heading + Description row */}
        <div className="hero-row">

          {/* Left: Big heading */}
          <div className="hero-left">
            <h1 style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: 'clamp(2rem, 5vw, 72px)',
              lineHeight: '1.18',
              letterSpacing: '-2.16px',
              color: '#302C2C',
              margin: 0,
            }}>
              Remote access<br />to{' '}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: '#175134',
                borderRadius: '10px',
                padding: '8px 16px',
                color: '#FFFFFF',
                fontSize: 'clamp(1.4rem, 3.6vw, 52px)',
                lineHeight: '1.18',
                letterSpacing: '-1.56px',
                verticalAlign: 'middle',
              }}>
                any device
              </span>
            </h1>
          </div>

          {/* Right: Description + CTA */}
          <div className="hero-right">
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: 'clamp(16px, 2vw, 20px)',
              lineHeight: '1.5',
              letterSpacing: '-0.2px',
              color: 'rgba(48, 44, 44, 0.65)',
              margin: '0 0 36px 0',
            }}>
              Remote 365 makes remote access effortless — connect to any device, support anyone, from anywhere, in seconds.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '30px', flexWrap: 'wrap' }}>
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
        <div style={{ marginTop: '60px' }}>
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
              alt="Remote 365 Dashboard"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        </div>

        {/* Trusted by */}
        <div style={{ marginTop: '60px' }}>
          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: 'clamp(16px, 2vw, 24px)',
            lineHeight: '1.4',
            letterSpacing: '-0.48px',
            color: '#787676',
            textAlign: 'center',
            margin: '0 0 32px 0',
          }}>
            Trusted by 4,000+ companies
          </p>

          {/* Marquee */}
          <div className="hero-marquee-track">
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
              animation: 'marquee 30s linear infinite',
              width: 'max-content',
              height: '100%',
            }}>
              {[...LOGOS, ...LOGOS].map((logo, i) => (
                <div key={i} style={{
                  width: '180px',
                  height: '64px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 700,
                    fontSize: '16px',
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

        .hero-container {
          max-width: 1440px;
          margin: 0 auto;
          padding: 60px 80px 80px;
        }

        .hero-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 40px;
        }

        .hero-left {
          max-width: 613px;
          flex-shrink: 0;
        }

        .hero-right {
          width: 441px;
          flex-shrink: 0;
          padding-top: 8px;
        }

        .hero-marquee-track {
          position: relative;
          overflow: hidden;
          height: 64px;
          margin: 0 -80px;
        }

        @media (max-width: 1100px) {
          .hero-row {
            flex-direction: column;
            gap: 32px;
          }
          .hero-left {
            max-width: 100%;
            flex-shrink: 1;
          }
          .hero-right {
            width: 100%;
            flex-shrink: 1;
            padding-top: 0;
          }
        }

        @media (max-width: 768px) {
          .hero-container {
            padding: 40px 24px 60px;
          }
          .hero-marquee-track {
            margin: 0 -24px;
          }
        }

        @media (max-width: 480px) {
          .hero-container {
            padding: 32px 16px 48px;
          }
          .hero-marquee-track {
            margin: 0 -16px;
          }
        }
      `}</style>
    </section>
  )
}

export default Hero
