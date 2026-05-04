import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'

const SiteToSiteSection: React.FC = () => (
  <section style={{ background: '#FFFFFF' }}>
    <div style={{
      maxWidth: '1360px',
      margin: '0 auto',
      padding: '112px 0 0',
    }}>

      {/* Text block */}
      <div style={{ padding: '0 67px', marginBottom: '56px' }}>
        <h2 style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
          fontSize: 'clamp(1.8rem, 3.5vw, 48px)',
          lineHeight: '57px',
          letterSpacing: '-0.96px',
          color: '#000000',
          margin: '0 0 28px 0',
          maxWidth: '672px',
        }}>
          Unlock site-to-site networking
        </h2>

        <p style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 400,
          fontSize: '18px',
          lineHeight: '27px',
          letterSpacing: '-0.18px',
          color: 'rgba(48, 44, 44, 0.65)',
          margin: '0 0 28px 0',
          maxWidth: '671px',
        }}>
          Connect clouds, VPCs, and on-premises networks without opening firewall ports with NAT traversal.
        </p>

        <RouterLink to="/site-to-site" style={{
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
            Site-to-Site Networking
          </span>
          <ExternalLink size={17} color="#000000" />
        </RouterLink>
      </div>

      {/* Image card */}
      <div style={{
        margin: '0 40px',
        background: '#E0BE43',
        borderRadius: '12px',
        overflow: 'hidden',
        height: '640px',
        position: 'relative',
      }}>
        <img
          src="/image.png"
          alt="Site-to-site networking diagram"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
            display: 'block',
          }}
        />
      </div>

    </div>
  </section>
)

export default SiteToSiteSection
