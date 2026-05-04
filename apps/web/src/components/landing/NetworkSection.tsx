import React from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'

const SIZE   = 500   // container px (square for clean orbit)
const RADIUS = 210   // badge orbit radius from center

const BADGES = [
  { ip: '100.78.14.63',   angle: -90  }, // top
  { ip: '100.108.47.7',   angle: 180  }, // left
  { ip: '100.81.144.123', angle: 0    }, // right
  { ip: '100.101.33.15',  angle: 90   }, // bottom
]

interface BadgeProps {
  ip: string
  angle: number  // degrees: 0=right, 90=bottom, 180=left, -90=top
}

const Badge: React.FC<BadgeProps> = ({ ip, angle }) => (
  <div style={{
    position: 'absolute',
    left: '50%',
    top: '50%',
    // Place on orbit ring then centre the badge on that point
    transform: `rotate(${angle}deg) translateX(${RADIUS}px) rotate(${-angle}deg) translate(-50%, -50%)`,
    zIndex: 2,
  }}>
    {/* Counter-rotate so text stays upright as parent spins */}
    <div style={{ animation: 'counter-spin 18s linear infinite' }}>
      <div style={{
        background: '#FFFFFF',
        borderRadius: '9999px',
        padding: '4px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}>
        <div style={{
          background: '#E6E4E2',
          borderRadius: '9999px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 18px',
        }}>
          <span style={{
            fontFamily: '"SF Mono", "Fira Mono", "Consolas", monospace',
            fontWeight: 400,
            fontSize: '16px',
            lineHeight: '24px',
            letterSpacing: '-0.18px',
            color: '#302C2C',
            whiteSpace: 'nowrap',
          }}>
            {ip}
          </span>
        </div>
      </div>
    </div>
  </div>
)

const NetworkSection: React.FC = () => {
  const half = SIZE / 2

  return (
    <section style={{ background: '#FFFFFF', position: 'relative' }}>
      <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '112px 40px' }}>

        {/* Circle orbit diagram */}
        <div style={{
          position: 'relative',
          width: `${SIZE}px`,
          height: `${SIZE}px`,
          margin: '0 auto',
        }}>
          {/* Spinning orbit wrapper */}
          <div style={{
            position: 'absolute',
            inset: 0,
            animation: 'spin 18s linear infinite',
          }}>
            {/* Outer faint ring */}
            <div style={{
              position: 'absolute',
              width: `${RADIUS * 2 + 5}px`,
              height: `${RADIUS * 2 + 5}px`,
              left: `${half - RADIUS - 2}px`,
              top: `${half - RADIUS - 2}px`,
              border: '1px solid #E0DDD9',
              borderRadius: '9999px',
            }} />

            {/* Middle ring */}
            <div style={{
              position: 'absolute',
              width: `${RADIUS * 2 - 30}px`,
              height: `${RADIUS * 2 - 30}px`,
              left: `${half - RADIUS + 15}px`,
              top: `${half - RADIUS + 15}px`,
              border: '1px solid #C8C4BE',
              borderRadius: '9999px',
            }} />

            {/* Inner filled circle */}
            <div style={{
              position: 'absolute',
              width: '225px',
              height: '225px',
              left: `${half - 112}px`,
              top: `${half - 112}px`,
              background: '#F6F4F2',
              borderRadius: '9999px',
            }} />

            {/* Orbiting badges */}
            {BADGES.map((b) => (
              <Badge key={b.ip} ip={b.ip} angle={b.angle} />
            ))}
          </div>
        </div>

        {/* Text content */}
        <div style={{ textAlign: 'center', marginTop: '56px' }}>
          <h2 style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: 'clamp(2rem, 4vw, 58px)',
            lineHeight: '68px',
            letterSpacing: '-1.74px',
            color: '#000000',
            margin: '0 auto 20px',
            maxWidth: '603px',
          }}>
            ConnectX makes secure networking easy
          </h2>

          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: '20px',
            lineHeight: '30px',
            letterSpacing: '-0.2px',
            color: 'rgba(48, 44, 44, 0.65)',
            margin: '0 auto 40px',
            maxWidth: '451px',
          }}>
            Achieve point-to-point network connectivity that enforces least privilege.
          </p>

          <RouterLink to="/how-it-works" style={{
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
              How it works
            </span>
            <ExternalLink size={17} color="#000000" />
          </RouterLink>

          <div style={{
            width: '40px',
            height: '4px',
            background: '#302C2C',
            borderRadius: '4px',
            margin: '48px auto 0',
          }} />
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes counter-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
      `}</style>
    </section>
  )
}

export default NetworkSection
