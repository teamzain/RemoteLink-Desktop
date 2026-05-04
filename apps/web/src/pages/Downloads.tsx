import React, { useState } from 'react'
import { Box } from '@mui/material'
import Navbar from '../components/landing/Navbar'
import Footer from '../components/landing/Footer'

type PlatformId = 'macos' | 'ios' | 'windows' | 'linux' | 'android'

// ── Platform icons ────────────────────────────────────────────────────────────

const AppleIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="44" height="44" viewBox="0 0 24 24" fill={color}>
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
)

const AppleIosIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="39" height="46" viewBox="0 0 24 24" fill={color}>
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
  </svg>
)

const WindowsIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="46" height="46" viewBox="0 0 24 24" fill={color}>
    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
  </svg>
)

const LinuxIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="55" height="40" viewBox="0 0 24 24" fill={color}>
    <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.138 1.14-.52 1.76-1.08.35.12.75.194 1.08.361 1.36.54 2.494 1.96 3.43 1.54.84-.387.581-2.096 1.7-1.867 1.64.344 2.054 2.69 1.9 4.43-.172 1.71-.494 3.3-.494 3.3s.23 1.41 1.08 1.76c.667.276 1.22.16 1.47-.014.253-.176.41-.426.454-.674-.06-.017-.135-.04-.19-.059-.43-.136-.77-.33-1.03-.58-.48-.47-.67-1.1-.67-1.77v-1.23c0-.98-.04-1.87-.12-2.65.11-.03.22-.065.327-.11.46-.184.88-.43 1.23-.73l.115-.117c.43-.45.783-1.016.97-1.614.13-.432.14-.887.04-1.324-.1-.44-.3-.852-.6-1.2-.6-.68-1.49-1.06-2.43-1.06-.55 0-1.08.14-1.55.42-.4.24-.74.58-.98.99-.09-.16-.18-.31-.28-.46-.04-.07-.09-.14-.13-.21.14-.49.17-1.01.07-1.52-.3-1.56-1.64-2.87-3.38-3.37-.49-.14-1.01-.2-1.54-.17-.4.02-.79.1-1.16.23.08-.52.07-1.04-.05-1.53-.28-1.11-1.01-2.06-2.03-2.72-.46-.3-.98-.5-1.53-.58-.13-.02-.27-.03-.41-.03z" />
  </svg>
)

const AndroidIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="63" height="36" viewBox="0 0 24 24" fill={color}>
    <path d="M7 1.888L5.4.288A.5.5 0 104.6.988L6.34 2.728A7.95 7.95 0 004 9h16a7.95 7.95 0 00-2.34-6.272L19.4.988A.5.5 0 1018.6.288L17 1.888A7.93 7.93 0 0012 .5a7.93 7.93 0 00-5 1.388zM8.5 7a1 1 0 110-2 1 1 0 010 2zm7 0a1 1 0 110-2 1 1 0 010 2zM2 10a2 2 0 00-2 2v6a2 2 0 004 0v-6a2 2 0 00-2-2zm20 0a2 2 0 00-2 2v6a2 2 0 004 0v-6a2 2 0 00-2-2zM4 10h16v9a3 3 0 01-3 3h-2v3a2 2 0 01-4 0v-3H9a3 3 0 01-3-3v-9z" />
  </svg>
)

// ── Platform data ─────────────────────────────────────────────────────────────

interface Platform {
  id: PlatformId
  label: string
  Icon: React.FC<{ color: string }>
  href: string
  buttonLabel: string
  requirement: string
}

const PLATFORMS: Platform[] = [
  {
    id: 'macos',
    label: 'macOS',
    Icon: AppleIcon,
    href: '#',
    buttonLabel: 'Download ConnectX for macOS',
    requirement: 'Requires macOS 12 or later.',
  },
  {
    id: 'ios',
    label: 'iOS',
    Icon: AppleIosIcon,
    href: '#',
    buttonLabel: 'Download ConnectX for iOS',
    requirement: 'Requires iOS 15 or later.',
  },
  {
    id: 'windows',
    label: 'Windows',
    Icon: WindowsIcon,
    href: 'http://159.65.84.190/downloads/desktop/Connect-X-Setup.exe',
    buttonLabel: 'Download ConnectX for Windows',
    requirement: 'Requires Windows 10 or later.',
  },
  {
    id: 'linux',
    label: 'Linux',
    Icon: LinuxIcon,
    href: '#',
    buttonLabel: 'Download ConnectX for Linux',
    requirement: 'Various distributions supported.',
  },
  {
    id: 'android',
    label: 'Android',
    Icon: AndroidIcon,
    href: '#',
    buttonLabel: 'Download ConnectX for Android',
    requirement: 'Requires Android 8.0 or later.',
  },
]

// ── Hero ──────────────────────────────────────────────────────────────────────

const DownloadHero: React.FC = () => {
  const [selected, setSelected] = useState<PlatformId>('windows')
  const current = PLATFORMS.find(p => p.id === selected)!

  return (
    <section style={{
      background: '#175134',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '127px 40px 120px',
    }}>
      <div style={{
        maxWidth: '1280px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '64px',
      }}>

        {/* Heading */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <h1 style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: '48px',
            lineHeight: '57px',
            letterSpacing: '-0.96px',
            color: '#FFFFFF',
            textAlign: 'center',
            margin: 0,
          }}>
            Download
          </h1>
          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: '20px',
            lineHeight: '30px',
            letterSpacing: '-0.2px',
            color: '#FFFFFF',
            opacity: 0.7,
            textAlign: 'center',
            margin: 0,
          }}>
            Install the app and sign in to get started.
          </p>
        </div>

        {/* Platform cards */}
        <div style={{ display: 'flex', gap: '30px', justifyContent: 'center', width: '100%' }}>
          {PLATFORMS.map(p => {
            const active = selected === p.id
            return (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '18px',
                  width: '232px',
                  height: '155px',
                  background: active ? '#FFFFFF' : '#487961',
                  border: '1px solid #426F59',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'background 0.2s ease',
                  flexShrink: 0,
                }}
              >
                <p.Icon color={active ? '#302C2C' : '#FFFFFF'} />
                <span style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: '18px',
                  lineHeight: '27px',
                  letterSpacing: '-0.18px',
                  color: active ? '#302C2C' : '#FFFFFF',
                  transition: 'color 0.2s ease',
                }}>
                  {p.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Download button */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <a href={current.href} style={{ textDecoration: 'none' }}>
            <div
              style={{
                display: 'inline-flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: '#FFFFFF',
                borderRadius: '14px',
                padding: '16px 40px',
                height: '59px',
                cursor: 'pointer',
                transition: 'opacity 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <span style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                fontSize: '18px',
                lineHeight: '27px',
                letterSpacing: '-0.18px',
                color: '#302C2C',
              }}>
                {current.buttonLabel}
              </span>
            </div>
          </a>

          <p style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 400,
            fontSize: '14px',
            lineHeight: '19px',
            letterSpacing: '-0.16px',
            color: '#FFFFFF',
            opacity: 0.7,
            textAlign: 'center',
            margin: 0,
          }}>
            {current.requirement}
          </p>
        </div>

      </div>
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

const Downloads: React.FC = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
    <Navbar heroBg="#175134" heroDark={true} />
    <Box component="main" sx={{ flexGrow: 1 }}>
      <DownloadHero />
    </Box>
    <Footer />
  </Box>
)

export default Downloads
