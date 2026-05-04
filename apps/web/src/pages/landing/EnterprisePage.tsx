import React from 'react'
import { Box } from '@mui/material'
import Navbar from '../../components/landing/Navbar'
import Footer from '../../components/landing/Footer'
import EnterpriseTrust from '../../components/landing/EnterpriseTrust'
import EnterpriseZeroTrust from '../../components/landing/EnterpriseZeroTrust'
import EnterpriseScales from '../../components/landing/EnterpriseScales'
import EnterpriseSecurity from '../../components/landing/EnterpriseSecurity'

// ── Arrow-right icon ───────────────────────────────────────────────────────────
const ArrowRightIcon: React.FC = () => (
  <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
    <path
      d="M3 9H13M13 9L8.5 4.5M13 9L8.5 13.5"
      stroke="#302C2C"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

// ── Network illustration SVG ───────────────────────────────────────────────────
// Faithful recreation of the node-graph / network topology from the Figma spec
const NetworkIllustration: React.FC = () => (
  <svg
    viewBox="0 0 1435 502"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: '100%', maxWidth: '1435px', height: 'auto', display: 'block' }}
  >
    {/* Dark background panel */}
    <rect x="0" y="0" width="1435" height="502" fill="#0D0D0D" />

    {/* ── Left network cluster (blue #496495 nodes) ─────────────────────── */}
    {/* Diagonal / organic dot matrix */}
    {[
      [255, 465], [298, 373], [442, 373], [391, 465], [68, 279], [111, 187],
      [25, 187], [43, 94], [162, 373], [255, 187], [205, 279], [391, 0],
      [442, 144], [298, 94], [157, 375],
    ].map(([cx, cy], i) => (
      <circle key={`left-${i}`} cx={cx} cy={cy} r={7} fill="#496495" opacity={0.85} />
    ))}

    {/* Connecting lines – left cluster */}
    {[
      [[255,465],[298,373]], [[298,373],[442,373]], [[442,373],[391,465]],
      [[68,279],[111,187]], [[111,187],[25,187]], [[25,187],[43,94]],
      [[162,373],[255,187]], [[255,187],[205,279]], [[298,373],[255,187]],
      [[391,0],[442,144]], [[298,94],[43,94]], [[162,373],[298,373]],
    ].map(([[x1,y1],[x2,y2]], i) => (
      <line key={`ll-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke="#496495" strokeWidth={1.5} strokeOpacity={0.35} />
    ))}

    {/* ── Main dark platform panel ───────────────────────────────────────── */}
    <rect x="157" y="57" width="1120" height="390" rx="14" fill="#242424" />

    {/* Browser chrome bar */}
    <rect x="157" y="57" width="1120" height="38" rx="14" fill="#343433" />
    <rect x="157" y="75" width="1120" height="20" fill="#343433" />

    {/* Browser dots */}
    {[194, 216, 241, 264, 292].map((cx, i) => (
      <circle key={`dot-${i}`} cx={cx} cy={76} r={5} fill="#FFFFFF" />
    ))}

    {/* Browser tabs (white rectangles) */}
    {[
      [318, 67, 66, 18], [398, 67, 50, 18], [463, 67, 62, 18],
      [541, 67, 40, 18], [597, 67, 45, 18], [660, 67, 34, 18],
      [445, 67, 64, 18], [512, 67, 36, 18], [770, 67, 44, 18],
    ].map(([x, y, w, h], i) => (
      <rect key={`tab-${i}`} x={x} y={y} width={w} height={h} rx={4}
        fill="#FFFFFF" opacity={i > 5 ? 0.85 : 1} />
    ))}

    {/* Address bar area */}
    <rect x="979" y="67" width="173" height="18" rx={4} fill="#191919" />
    <rect x="994" y="69" width="138" height="14" rx={3} fill="#FFFFFF" opacity={0.15} />

    {/* Window control dots (top-right of chrome) */}
    <circle cx="1047" cy="76" r={4.5} fill="rgba(255,255,255,0.85)" />
    <circle cx="1059" cy="76" r={4.5} fill="rgba(255,255,255,0.85)" />

    {/* ── Main content area rows ─────────────────────────────────────────── */}
    {/* Row dividers */}
    {[133, 230, 294, 358, 420].map((y, i) => (
      <line key={`row-${i}`} x1="946" y1={y} x2="1277" y2={y}
        stroke="#474645" strokeWidth={1} />
    ))}

    {/* Row content placeholders */}
    {[
      [947, 140, 250], [947, 237, 390], [947, 301, 320],
      [947, 365, 265], [947, 427, 250],
    ].map(([x, y, w], i) => (
      <rect key={`row-r-${i}`} x={x} y={y} width={w} height={20} rx={4}
        fill="#FFFFFF" opacity={0.9} />
    ))}

    {/* Small accent rect bottom-right of each row */}
    {[140, 237, 301, 365, 427].map((y, i) => (
      <rect key={`row-a-${i}`} x={1215} y={y} width={62} height={20} rx={4}
        fill="#FFFFFF" opacity={i % 2 === 0 ? 1 : 0.4} />
    ))}

    {/* Wider content rows (charts / data) */}
    {[
      [947, 160, 338], [947, 257, 378],
    ].map(([x, y, w], i) => (
      <rect key={`wide-r-${i}`} x={x} y={y} width={w} height={16} rx={4}
        fill="#FFFFFF" opacity={0.45} />
    ))}

    {/* ── Sidebar (left panel within the platform) ───────────────────────── */}
    <rect x="157" y="95" width="160" height="352" fill="#1A1A1A" />

    {/* Sidebar menu items */}
    {[110, 145, 180, 215, 250, 285, 320, 355].map((y, i) => (
      <rect key={`nav-${i}`} x={172} y={y} width={130} height={22} rx={5}
        fill="#474645" opacity={i === 2 ? 1 : 0.5} />
    ))}

    {/* ── Right panel: device/node cards ────────────────────────────────── */}
    <rect x="317" y="95" width="628" height="352" fill="#2A2A2A" />

    {/* Node cards */}
    {[
      [330, 108, 580, 70, "#4D78C8"],
      [330, 190, 580, 65, "#474645"],
      [330, 268, 580, 65, "#474645"],
      [330, 346, 580, 65, "#474645"],
    ].map(([x, y, w, h, bg], i) => (
      <g key={`card-${i}`}>
        <rect x={x as number} y={y as number}
          width={w as number} height={h as number}
          rx={8} fill={bg as string} opacity={0.25} />
        <rect x={(x as number) + 8} y={(y as number) + 8}
          width={40} height={40} rx={6} fill="#FFFFFF" opacity={0.12} />
        <rect x={(x as number) + 58} y={(y as number) + 12}
          width={200} height={14} rx={3} fill="#FFFFFF" opacity={0.8} />
        <rect x={(x as number) + 58} y={(y as number) + 32}
          width={130} height={10} rx={3} fill="#FFFFFF" opacity={0.35} />
        {/* Status dot */}
        <circle
          cx={(x as number) + (w as number) - 20}
          cy={(y as number) + (h as number) / 2}
          r={6}
          fill={i === 0 ? "#4D78C8" : "#474645"}
          opacity={i === 0 ? 1 : 0.6}
        />
      </g>
    ))}

    {/* ── Connection lines between panels ───────────────────────────────── */}
    <line x1="945" y1="152" x2="1277" y2="152"
      stroke="#474645" strokeWidth={1} />

    {/* ── Right-side node graph overlay ─────────────────────────────────── */}
    {[
      [1195, 132], [1218, 132], [1241, 132], [1264, 132],
    ].map(([cx, cy], i) => (
      <circle key={`rn-${i}`} cx={cx} cy={cy} r={4}
        fill="rgba(255,255,255,0.85)" />
    ))}

    {/* ── Floating UI card (top-right corner region) ─────────────────────── */}
    <rect x="1194" y="132" width="83" height="28" rx={6}
      fill="#4D78C8" opacity={0.9} />
    <rect x="1196" y="134" width="79" height="24" rx={5}
      stroke="rgba(0,0,0,0.12)" strokeWidth={0.6} fill="none" />

    {/* Card inner white icon */}
    <rect x="1216" y="138" width="40" height="16" rx={3}
      fill="#FFFFFF" filter="url(#shadow)" />

    {/* ── Bottom connecting lines to the SVG frame ──────────────────────── */}
    <line x1="946" y1="410" x2="1277" y2="410"
      stroke="#474645" strokeWidth={1} />
  </svg>
)

// ── Enterprise Hero ────────────────────────────────────────────────────────────
const EnterpriseHero: React.FC = () => {
  return (
    <section
      style={{
        background: '#111111',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 40px',
        overflow: 'hidden',
      }}
    >
      {/* ── Upper: text + CTA ────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '93px',
          width: '100%',
          maxWidth: '1211px',
          padding: '80px 0 60px',
        }}
      >
        {/* Left: label + heading */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '15px',
            flex: 1,
            maxWidth: '654px',
          }}
        >
          {/* Label */}
          <span
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '16px',
              lineHeight: '24px',
              letterSpacing: '-0.16px',
              color: '#AAC6F1',
            }}
          >
            ConnectX for Enterprise
          </span>

          {/* Heading */}
          <h1
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: 'clamp(2.5rem, 5vw, 72px)',
              lineHeight: '85px',
              letterSpacing: '-2.16px',
              color: '#FFFFFF',
              margin: 0,
              maxWidth: '537px',
            }}
          >
            The zero-trust network for your enterprise
          </h1>
        </div>

        {/* Right: body + CTA */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '25px',
            maxWidth: '464px',
            flexShrink: 0,
          }}
        >
          {/* Body text */}
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: '27px',
              letterSpacing: '-0.18px',
              color: 'rgba(255, 255, 255, 0.7)',
              margin: 0,
              maxWidth: '444px',
            }}
          >
            Organizations of all sizes choose ConnectX to connect their employees, devices, and
            workloads securely across infrastructure spanning the globe.
          </p>

          {/* Contact sales button */}
          <button
            onClick={() => { window.location.href = 'mailto:sales@connectx.com' }}
            style={{
              display: 'inline-flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '11px',
              padding: '8px 18px 9px',
              height: '42px',
              background: '#FFFFFF',
              border: '1px solid #FFFFFF',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <span
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                fontSize: '16px',
                lineHeight: '23px',
                letterSpacing: '-0.16px',
                color: '#302C2C',
              }}
            >
              Contact sales
            </span>
            <ArrowRightIcon />
          </button>
        </div>
      </div>

      {/* ── Lower: network illustration ───────────────────────────────────── */}
      <div
        style={{
          width: '100%',
          maxWidth: '1435px',
          marginBottom: 0,
        }}
      >
        <NetworkIllustration />
      </div>
    </section>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
const EnterprisePage: React.FC = () => (
  <Box sx={{ bgcolor: '#111111', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
    <Navbar heroBg="#111111" heroDark />
    <Box sx={{ flexGrow: 1 }}>
      <EnterpriseHero />
      <EnterpriseTrust />
      <EnterpriseZeroTrust />
      <EnterpriseScales />
      <EnterpriseSecurity />
    </Box>
    <Footer />
  </Box>
)

export default EnterprisePage
