import React, { useState, useEffect } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const NAV_LINKS = [
  { label: 'Product',    path: '/product'    },
  { label: 'Docs',       path: '/docs'        },
  { label: 'Enterprise', path: '/enterprise'  },
  { label: 'Customers',  path: '/product'    },
  { label: 'Resources',  path: '/resources'   },
  { label: 'Pricing',    path: '/pricing'     },
]

const LogoIcon: React.FC<{ color?: string }> = ({ color = '#242424' }) => (
  <svg width="20" height="21" viewBox="0 0 20 21" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="0"   y="8.2"  width="1" height="4.6" fill={color} />
    <rect x="1.3" y="8.2"  width="1" height="4.6" fill={color} />
    <rect x="0"   y="15.5" width="1" height="4.6" fill={color} opacity="0.2" />
    <rect x="2.7" y="15.5" width="1" height="4.6" fill={color} opacity="0.2" />
    <rect x="1.3" y="15.5" width="1" height="4.6" fill={color} />
    <rect x="2.7" y="8.2"  width="1" height="4.6" fill={color} />
    <rect x="0"   y="0.9"  width="1" height="4.6" fill={color} opacity="0.2" />
    <rect x="1.3" y="0.9"  width="1" height="4.6" fill={color} opacity="0.2" />
    <rect x="2.7" y="0.9"  width="1" height="4.6" fill={color} opacity="0.2" />
    <rect x="5.2"  y="3.6"  width="5.4" height="2"   fill={color} />
    <rect x="6.8"  y="7.1"  width="3.3" height="2"   fill={color} />
    <rect x="8.9"  y="3.1"  width="1"   height="2.2" fill={color} />
    <rect x="9.9"  y="3.4"  width="1"   height="2.2" fill={color} />
    <rect x="10.7" y="7.1"  width="2.1" height="2"   fill={color} />
    <rect x="12.7" y="7.1"  width="2"   height="2"   fill={color} />
    <rect x="14.8" y="7.1"  width="2"   height="2"   fill={color} />
    <rect x="17.0" y="3.4"  width="1.5" height="2.2" fill={color} />
    <rect x="17.8" y="7.1"  width="2.1" height="2"   fill={color} />
  </svg>
)

export interface NavbarProps {
  heroBg?: string
  heroDark?: boolean
}

const Navbar: React.FC<NavbarProps> = ({ heroBg = '#F6F4F2', heroDark = false }) => {
  const { accessToken, user } = useAuthStore()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const isLight = scrolled || !heroDark
  const fg = isLight ? 'rgba(48, 44, 44, 0.8)' : 'rgba(255, 255, 255, 0.85)'
  const logoColor = isLight ? '#242424' : '#FFFFFF'

  const linkStyle: React.CSSProperties = {
    fontFamily: 'Inter, sans-serif',
    fontWeight: 500,
    fontSize: '14px',
    lineHeight: '21px',
    letterSpacing: '-0.28px',
    color: fg,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
    transition: 'color 0.25s ease',
  }

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: scrolled ? '#FFFFFF' : heroBg,
      borderBottom: scrolled ? '1px solid rgba(0,0,0,0.08)' : 'none',
      boxShadow: scrolled ? '0 1px 12px rgba(0,0,0,0.06)' : 'none',
      height: '65.36px',
      display: 'flex',
      alignItems: 'center',
      transition: 'background 0.25s ease, border-bottom 0.25s ease, box-shadow 0.25s ease',
    }}>
      <div style={{
        maxWidth: '1440px',
        width: '100%',
        margin: '0 auto',
        padding: '0 40px',
        display: 'flex',
        alignItems: 'center',
        height: '100%',
      }}>

        {/* Logo */}
        <RouterLink to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', flexShrink: 0 }}>
          <LogoIcon color={logoColor} />
          <span style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 700,
            fontSize: '15px',
            letterSpacing: '-0.3px',
            color: logoColor,
            transition: 'color 0.25s ease',
          }}>
            ConnectX
          </span>
        </RouterLink>

        {/* Nav links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '30px', marginLeft: '35px', flex: 1 }}>
          {NAV_LINKS.map((item) => (
            <RouterLink key={item.label} to={item.path} style={linkStyle}>
              {item.label}
            </RouterLink>
          ))}
        </nav>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0', flexShrink: 0 }}>
          <RouterLink
            to="/downloads"
            style={{ ...linkStyle, opacity: 0.8, marginRight: '30px' }}
          >
            Download
          </RouterLink>

          {accessToken ? (
            <RouterLink to="/dashboard" style={{ ...linkStyle, opacity: 0.8, marginRight: '30px' }}>
              {user?.name ? user.name : 'Dashboard'}
            </RouterLink>
          ) : (
            <RouterLink to="/login" style={{ ...linkStyle, opacity: 0.8, marginRight: '30px' }}>
              Log in
            </RouterLink>
          )}

          <RouterLink to="/register" style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isLight ? '#302C2C' : '#FFFFFF',
              border: `1px solid ${isLight ? '#302C2C' : '#FFFFFF'}`,
              borderRadius: '8px',
              width: '121px',
              height: '41px',
              cursor: 'pointer',
              transition: 'background 0.25s ease, border 0.25s ease, opacity 0.15s',
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
                color: isLight ? '#FFFFFF' : '#302C2C',
                transition: 'color 0.25s ease',
              }}>
                Get started
              </span>
            </div>
          </RouterLink>
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) { nav { display: none !important; } }
        @media (max-width: 768px) {
          nav { display: none !important; }
          header a[href*="downloads"], header a[href="/login"], header a[href="/dashboard"] { display: none !important; }
        }
      `}</style>
    </header>
  )
}

export default Navbar
