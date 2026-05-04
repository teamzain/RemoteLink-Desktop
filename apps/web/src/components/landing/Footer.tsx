import React from 'react'
import { Link as RouterLink } from 'react-router-dom'

const COL: { heading: string; links: { label: string; to: string }[] }[] = [
  {
    heading: 'Product',
    links: [
      { label: 'How it works',      to: '/how-it-works' },
      { label: 'Pricing',           to: '/pricing' },
      { label: 'Integrations',      to: '/integrations' },
      { label: 'Features',          to: '/features' },
      { label: 'Compare ConnectX',  to: '/compare' },
    ],
  },
  {
    heading: 'Use Cases',
    links: [
      { label: 'Business VPN',          to: '/business-vpn' },
      { label: 'Remote Access',         to: '/remote-access' },
      { label: 'Site-to-Site Networking', to: '/site-to-site' },
      { label: 'Homelab',               to: '/homelab' },
      { label: 'Enterprise',            to: '/enterprise' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Blog',             to: '/blog' },
      { label: 'Events & Webinars', to: '/events' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'Company', to: '/company' },
      { label: 'Careers', to: '/careers' },
      { label: 'Press',   to: '/press' },
    ],
  },
  {
    heading: 'Help & Support',
    links: [
      { label: 'Support',     to: '/support' },
      { label: 'Sales',       to: '/sales' },
      { label: 'Security',    to: '/security' },
      { label: 'Legal',       to: '/legal' },
      { label: 'Open Source', to: '/open-source' },
      { label: 'Changelog',   to: '/changelog' },
    ],
  },
  {
    heading: 'Learn',
    links: [
      { label: 'SSH keys',       to: '/learn/ssh-keys' },
      { label: 'Docker SSH',     to: '/learn/docker-ssh' },
      { label: 'DevSecOps',      to: '/learn/devsecops' },
      { label: 'Multicloud',     to: '/learn/multicloud' },
      { label: 'NAT Traversal',  to: '/learn/nat-traversal' },
      { label: 'MagicDNS',       to: '/learn/magicdns' },
      { label: 'PAM',            to: '/learn/pam' },
      { label: 'PoLP',           to: '/learn/polp' },
      { label: 'All articles',   to: '/learn' },
    ],
  },
]

// Social icons as inline SVGs
const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.836L2.25 2.25h6.986l4.265 5.64L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
  </svg>
)
const IconFacebook = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.791-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
  </svg>
)
const IconLinkedIn = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
)
const IconYouTube = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
)

const LINK_STYLE: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif',
  fontWeight: 400,
  fontSize: '14px',
  lineHeight: '22px',
  color: 'rgba(48, 44, 44, 0.65)',
  textDecoration: 'none',
  display: 'block',
}

const Footer: React.FC = () => (
  <footer style={{ background: '#FFFFFF', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
    <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '64px 67px 0' }}>

      {/* Link columns grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '24px',
        paddingBottom: '56px',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
      }}>
        {COL.map(col => (
          <div key={col.heading}>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: '14px',
              lineHeight: '20px',
              color: '#000000',
              margin: '0 0 16px 0',
            }}>
              {col.heading}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {col.links.map(link => (
                <RouterLink key={link.label} to={link.to} style={LINK_STYLE}
                  onMouseEnter={e => (e.currentTarget.style.color = '#000')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(48,44,44,0.65)')}
                >
                  {link.label}
                </RouterLink>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '24px 0',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="16" fill="#302C2C" />
            <circle cx="16" cy="16" r="6" fill="white" />
          </svg>
          <span style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: '16px',
            color: '#302C2C',
            letterSpacing: '-0.3px',
          }}>
            connectx
          </span>
        </div>

        {/* Legal links */}
        <div style={{ display: 'flex', gap: '24px' }}>
          {[
            { label: 'Terms of Service', to: '/terms' },
            { label: 'Privacy Policy',   to: '/privacy' },
          ].map(l => (
            <RouterLink key={l.label} to={l.to} style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '14px',
              color: 'rgba(48, 44, 44, 0.65)',
              textDecoration: 'none',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = '#000')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(48,44,44,0.65)')}
            >
              {l.label}
            </RouterLink>
          ))}
        </div>

        {/* WireGuard note + social icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: '12px',
            color: 'rgba(48, 44, 44, 0.5)',
            maxWidth: '220px',
          }}>
            WireGuard® is a registered trademark of Jason A. Donenfeld.
          </span>
          <div style={{ display: 'flex', gap: '12px', color: 'rgba(48,44,44,0.55)' }}>
            {[IconX, IconFacebook, IconLinkedIn, IconYouTube].map((Icon, i) => (
              <a key={i} href="#" style={{ color: 'inherit', transition: 'color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#000')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(48,44,44,0.55)')}
              >
                <Icon />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div style={{ padding: '16px 0 24px' }}>
        <span style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 400,
          fontSize: '12px',
          color: 'rgba(48, 44, 44, 0.45)',
        }}>
          © {new Date().getFullYear()} ConnectX Inc. All rights reserved. ConnectX is a registered trademark of ConnectX Inc.
        </span>
      </div>

    </div>
  </footer>
)

export default Footer
