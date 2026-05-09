import React, { useState, useEffect } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

const NAV_LINKS = [
  { label: 'Product',    path: '/product'   },
  { label: 'Docs',       path: '/docs'        },
  { label: 'Enterprise', path: '/enterprise'  },
  { label: 'Customers',  path: '/customers'   },
  { label: 'Resources',  path: '/resources'   },
  { label: 'Pricing',    path: '/pricing'     },
]

const LogoIcon: React.FC<{ color?: string }> = ({ color = '#242424' }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9.5 14.5L14.5 9.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16.5 12.5L18.5 10.5C20.5 8.5 20.5 5.5 18.5 3.5C16.5 1.5 13.5 1.5 11.5 3.5L9.5 5.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M7.5 11.5L5.5 13.5C3.5 15.5 3.5 18.5 5.5 20.5C7.5 22.5 10.5 22.5 12.5 20.5L14.5 18.5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const isLight = !menuOpen && (scrolled || !heroDark)
  const fg = isLight ? 'rgba(48, 44, 44, 0.8)' : 'rgba(255, 255, 255, 0.85)'
  const logoColor = menuOpen ? '#FFFFFF' : (isLight ? '#242424' : '#FFFFFF')

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
        background: menuOpen ? 'transparent' : (scrolled ? '#FFFFFF' : heroBg),
        borderBottom: (!menuOpen && scrolled) ? '1px solid rgba(0,0,0,0.08)' : 'none',
        boxShadow: (!menuOpen && scrolled) ? '0 1px 12px rgba(0,0,0,0.06)' : 'none',
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
              Remote 365
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

          {/* Hamburger / close button (mobile) */}
          <button
            className={`navbar-hamburger${menuOpen ? ' is-open' : ''}`}
            onClick={() => setMenuOpen(o => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            <span style={{ background: menuOpen ? '#FFFFFF' : logoColor }} />
            <span style={{ background: menuOpen ? '#FFFFFF' : logoColor }} />
            <span style={{ background: menuOpen ? '#FFFFFF' : logoColor }} />
          </button>
        </div>
      </header>

      {/* Triangle mobile overlay */}
      {menuOpen && (
        <div className="tri-overlay">
          {/* Top-right dark triangle (visual only) */}
          <div className="tri-top-right" />

          {/* Bottom-left green triangle (visual only) */}
          <div className="tri-bottom-left" />

          {/* CTA buttons — in the top-right dark zone */}
          <div className="tri-top-right-content">
            <RouterLink
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="tri-link-btn tri-link-outline"
            >
              Log in
            </RouterLink>
            <RouterLink
              to="/register"
              onClick={() => setMenuOpen(false)}
              className="tri-link-btn tri-link-filled"
            >
              Get started
            </RouterLink>
          </div>

          {/* Nav links — in the bottom-left green zone */}
          <div className="tri-bottom-left-content">
            {[...NAV_LINKS, { label: 'Download', path: '/downloads' }].map(item => (
              <RouterLink
                key={item.label}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                className="tri-nav-link"
              >
                {item.label}
              </RouterLink>
            ))}
          </div>
        </div>
      )}

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
          transition: background 0.25s, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s;
        }
        .navbar-hamburger.is-open span:nth-child(1) {
          transform: translateY(7px) rotate(45deg);
        }
        .navbar-hamburger.is-open span:nth-child(2) {
          opacity: 0;
          transform: scaleX(0);
        }
        .navbar-hamburger.is-open span:nth-child(3) {
          transform: translateY(-7px) rotate(-45deg);
        }

        /* ── Triangle overlay ── */
        .tri-overlay {
          position: fixed;
          inset: 0;
          z-index: 98;
          overflow: hidden;
        }
        .tri-top-right {
          position: absolute;
          inset: 0;
          background: #302C2C;
          clip-path: polygon(0% 0%, 100% 0%, 100% 100%);
          animation: slideInTopRight 0.42s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .tri-bottom-left {
          position: absolute;
          inset: 0;
          background: #175134;
          clip-path: polygon(0% 0%, 100% 100%, 0% 100%);
          animation: slideInBottomLeft 0.42s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        /* CTA buttons — top-right safe zone */
        .tri-top-right-content {
          position: absolute;
          top: 90px;
          right: 36px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 12px;
          z-index: 10;
          animation: fadeUpIn 0.35s 0.18s ease-out both;
        }
        .tri-link-btn {
          font-family: Inter, sans-serif;
          font-weight: 600;
          font-size: 15px;
          text-decoration: none;
          padding: 11px 28px;
          border-radius: 8px;
          min-width: 140px;
          text-align: center;
          display: block;
        }
        .tri-link-outline {
          color: rgba(255, 255, 255, 0.82);
          border: 1px solid rgba(255, 255, 255, 0.22);
        }
        .tri-link-filled {
          background: #FFFFFF;
          color: #302C2C;
        }

        /* Nav links — bottom-left safe zone */
        .tri-bottom-left-content {
          position: absolute;
          bottom: 56px;
          left: 36px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0;
          z-index: 10;
          animation: fadeUpIn 0.35s 0.18s ease-out both;
        }
        .tri-nav-link {
          font-family: Inter, sans-serif;
          font-weight: 600;
          font-size: 21px;
          letter-spacing: -0.5px;
          color: rgba(255, 255, 255, 0.8);
          text-decoration: none;
          padding: 9px 0;
          display: block;
          transition: color 0.15s;
        }
        .tri-nav-link:hover { color: #FFFFFF; }

        @keyframes slideInTopRight {
          from { transform: translate(65%, -65%); }
          to   { transform: translate(0, 0); }
        }
        @keyframes slideInBottomLeft {
          from { transform: translate(-65%, 65%); }
          to   { transform: translate(0, 0); }
        }
        @keyframes fadeUpIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
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
