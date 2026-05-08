import React, { useState, useEffect } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const NAV_LINKS = [
  { label: 'Product',    path: '/features'   },
  { label: 'Docs',       path: '/docs'        },
  { label: 'Enterprise', path: '/enterprise'  },
  { label: 'Customers',  path: '/customers'   },
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
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => { setScrolled(window.scrollY > 10); setMenuOpen(false) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const isLight = scrolled || !heroDark || menuOpen
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
    <>
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: scrolled ? '#FFFFFF' : (menuOpen ? '#FFFFFF' : heroBg),
        borderBottom: (scrolled || menuOpen) ? '1px solid rgba(0,0,0,0.08)' : 'none',
        boxShadow: scrolled ? '0 1px 12px rgba(0,0,0,0.06)' : 'none',
        transition: 'background 0.25s ease, border-bottom 0.25s ease, box-shadow 0.25s ease',
      }}>
        <div className="navbar-inner">

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

          {/* Nav links (desktop) */}
          <nav className="navbar-links">
            {NAV_LINKS.map((item) => (
              <RouterLink key={item.label} to={item.path} style={linkStyle}>
                {item.label}
              </RouterLink>
            ))}
          </nav>

          {/* Right side (desktop) */}
          <div className="navbar-actions">
            <RouterLink to="/downloads" style={{ ...linkStyle, opacity: 0.8, marginRight: '30px' }}>
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

          {/* Hamburger button (mobile) */}
          <button
            className="navbar-hamburger"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            <span style={{ background: logoColor }} />
            <span style={{ background: logoColor }} />
            <span style={{ background: logoColor }} />
          </button>
        </div>

        {/* Mobile drawer */}
        {menuOpen && (
          <div style={{
            background: '#FFFFFF',
            borderTop: '1px solid rgba(0,0,0,0.06)',
            padding: '8px 20px 24px',
          }}>
            {[...NAV_LINKS, { label: 'Download', path: '/downloads' }].map(item => (
              <RouterLink
                key={item.label}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: 'block',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  fontSize: '15px',
                  color: 'rgba(48, 44, 44, 0.85)',
                  textDecoration: 'none',
                  padding: '13px 0',
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                }}
              >
                {item.label}
              </RouterLink>
            ))}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <RouterLink
                to="/login"
                onClick={() => setMenuOpen(false)}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '10px',
                  border: '1px solid rgba(48,44,44,0.2)',
                  borderRadius: '8px',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px',
                  color: '#302C2C',
                  textDecoration: 'none',
                }}
              >
                Log in
              </RouterLink>
              <RouterLink
                to="/register"
                onClick={() => setMenuOpen(false)}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  padding: '10px',
                  background: '#302C2C',
                  borderRadius: '8px',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  fontSize: '14px',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                }}
              >
                Get started
              </RouterLink>
            </div>
          </div>
        )}
      </header>

      <style>{`
        .navbar-inner {
          max-width: 1440px;
          width: 100%;
          margin: 0 auto;
          padding: 0 40px;
          display: flex;
          align-items: center;
          height: 65.36px;
        }
        .navbar-links {
          display: flex;
          align-items: center;
          gap: 30px;
          margin-left: 35px;
          flex: 1;
        }
        .navbar-actions {
          display: flex;
          align-items: center;
          gap: 0;
          flex-shrink: 0;
        }
        .navbar-hamburger {
          display: none;
          flex-direction: column;
          gap: 5px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          margin-left: auto;
        }
        .navbar-hamburger span {
          display: block;
          width: 22px;
          height: 2px;
          border-radius: 2px;
          transition: background 0.25s;
        }
        @media (max-width: 1024px) {
          .navbar-links { display: none; }
        }
        @media (max-width: 768px) {
          .navbar-inner { padding: 0 20px; }
          .navbar-actions { display: none; }
          .navbar-hamburger { display: flex; }
        }
      `}</style>
    </>
  )
}

export default Navbar
