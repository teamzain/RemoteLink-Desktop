import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

const BrandIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9.5 14.5L14.5 9.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16.5 12.5L18.5 10.5C20.5 8.5 20.5 5.5 18.5 3.5C16.5 1.5 13.5 1.5 11.5 3.5L9.5 5.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7.5 11.5L5.5 13.5C3.5 15.5 3.5 18.5 5.5 20.5C7.5 22.5 10.5 22.5 12.5 20.5L14.5 18.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

interface ProductHeroProps {
  label?: string
  heading: string
  description: string
  ctaText?: string
  ctaHref?: string
  image?: string
  imageAlt?: string
}

const ProductHero: React.FC<ProductHeroProps> = ({
  label = 'Product',
  heading = 'Remote access for everyone, everywhere',
  description = 'Connect to any device, from anywhere. Unique device IDs, end-to-end encrypted sessions, and one-click remote support — no VPN, no port forwarding, no setup.',
  ctaText = 'Get started free',
  ctaHref = '/register',
  image = '/hero.png',
  imageAlt = 'Remote 365 Dashboard',
}) => {
  return (
    <section style={{ background: '#175134', overflow: 'hidden' }}>
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: 'clamp(60px, 8vw, 100px) clamp(20px, 3vw, 40px) clamp(60px, 8vw, 100px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 'clamp(48px, 7vw, 90px)',
      }}>

        {/* ── Text section ── */}
        <div style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}>

          {/* Label row */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '6px',
            marginBottom: 'clamp(20px, 3vw, 32px)',
          }}>
            <BrandIcon />
            <span style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: '27px',
              letterSpacing: '-0.18px',
              color: '#FFFFFF',
            }}>
              {label}
            </span>
          </div>

          {/* Heading */}
          <h1 style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: 'clamp(2rem, 5.5vw, 72px)',
            lineHeight: '1.18',
            letterSpacing: '-2.16px',
            color: '#FFFFFF',
            margin: '0 0 clamp(20px, 3vw, 32px) 0',
            maxWidth: '1057px',
          }}>
            {heading}
          </h1>

          {/* Description */}
          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: 'clamp(16px, 1.8vw, 20px)',
            lineHeight: '1.5',
            letterSpacing: '-0.2px',
            color: 'rgba(255,255,255,0.7)',
            margin: '0 0 clamp(28px, 4vw, 44px) 0',
            maxWidth: '863px',
          }}>
            {description}
          </p>

          {/* CTA */}
          <RouterLink to={ctaHref} style={{ textDecoration: 'none' }}>
            <div
              style={{
                display: 'inline-flex',
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '11px',
                padding: '9px 20px',
                background: '#FFFFFF',
                border: '1px solid #FFFFFF',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                fontSize: '16px',
                lineHeight: '23px',
                letterSpacing: '-0.16px',
                color: '#302C2C',
              }}>
                {ctaText}
              </span>
              <ArrowRight size={16} color="#302C2C" />
            </div>
          </RouterLink>
        </div>

        {/* ── Screenshot ── */}
        <div style={{
          width: '100%',
          borderRadius: '16px',
          overflow: 'hidden',
          aspectRatio: '1280 / 657',
          background: '#0D2A1C',
          flexShrink: 0,
        }}>
          <img
            src={image}
            alt={imageAlt}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>

      </div>
    </section>
  )
}

export default ProductHero
