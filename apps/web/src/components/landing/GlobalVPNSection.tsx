import React, { useEffect, useRef } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import createGlobe from 'cobe'

type LatLon = [number, number]

const MARKERS: { location: LatLon; size: number }[] = [
  { location: [37.78,  -122.44], size: 0.04 },  // San Francisco
  { location: [40.71,   -74.01], size: 0.04 },  // New York
  { location: [51.51,    -0.13], size: 0.04 },  // London
  { location: [48.86,    2.35 ], size: 0.03 },  // Paris
  { location: [52.52,   13.41 ], size: 0.03 },  // Berlin
  { location: [25.20,   55.27 ], size: 0.03 },  // Dubai
  { location: [28.61,   77.21 ], size: 0.03 },  // Delhi
  { location: [31.23,  121.47 ], size: 0.04 },  // Shanghai
  { location: [35.68,  139.65 ], size: 0.04 },  // Tokyo
  { location: [-33.87, 151.21 ], size: 0.04 },  // Sydney
  { location: [-23.55,  -46.63], size: 0.03 },  // São Paulo
  { location: [  1.35, 103.82 ], size: 0.03 },  // Singapore
]

const ARCS: { from: LatLon; to: LatLon }[] = [
  { from: [37.78, -122.44], to: [51.51,  -0.13 ] },  // SF → London
  { from: [40.71,  -74.01], to: [51.51,  -0.13 ] },  // NYC → London
  { from: [51.51,   -0.13], to: [25.20,  55.27  ] },  // London → Dubai
  { from: [25.20,   55.27], to: [28.61,  77.21  ] },  // Dubai → Delhi
  { from: [28.61,   77.21], to: [31.23, 121.47  ] },  // Delhi → Shanghai
  { from: [31.23,  121.47], to: [35.68, 139.65  ] },  // Shanghai → Tokyo
  { from: [35.68,  139.65], to: [-33.87, 151.21 ] },  // Tokyo → Sydney
  { from: [37.78, -122.44], to: [-23.55,  -46.63] },  // SF → São Paulo
  { from: [40.71,  -74.01], to: [-23.55,  -46.63] },  // NYC → São Paulo
  { from: [31.23,  121.47], to: [  1.35, 103.82  ] },  // Shanghai → Singapore
]

const GlobeCanvas: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Create canvas imperatively — cobe moves the canvas into a new wrapper div,
    // which breaks React's removeChild if the canvas was JSX-managed.
    const canvas = document.createElement('canvas')
    canvas.width = 600 * 2
    canvas.height = 600 * 2
    Object.assign(canvas.style, {
      width: '600px',
      height: '600px',
      maxWidth: '100%',
      opacity: '0',
      transition: 'opacity 1s ease',
    })
    container.appendChild(canvas)

    let phi = 0
    let rafId: number

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width:  600 * 2,
      height: 600 * 2,
      phi:    0,
      theta:  0.25,
      dark:   1,
      diffuse:       1.2,
      mapSamples:    16000,
      mapBrightness: 6,
      baseColor:   [0.1, 0.15, 0.28],
      markerColor: [0.776, 0.345, 0.208],
      glowColor:   [0.8, 0.88, 1.0],
      markers:  MARKERS,
      arcs:     ARCS,
      arcColor: [0.776, 0.345, 0.208],
      arcWidth:  0.5,
      arcHeight: 0.3,
    })

    const animate = () => {
      globe.update({ phi })
      phi += 0.004
      rafId = requestAnimationFrame(animate)
    }
    rafId = requestAnimationFrame(animate)

    setTimeout(() => { canvas.style.opacity = '1' }, 200)

    return () => {
      cancelAnimationFrame(rafId)
      globe.destroy()
      container.innerHTML = ''
    }
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ width: 600, height: 600, maxWidth: '100%' }}
    />
  )
}

const GlobalVPNSection: React.FC = () => (
  <section style={{ background: '#FFFFFF', overflow: 'hidden' }}>
    <div style={{
      maxWidth: '1360px',
      margin: '0 auto',
      padding: '112px 67px 0',
      display: 'flex',
      alignItems: 'center',
      gap: '80px',
    }}>

      {/* Left: text */}
      <div style={{ flex: '0 0 420px', maxWidth: '420px' }}>
        <h2 style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 500,
          fontSize: 'clamp(1.8rem, 3vw, 48px)',
          lineHeight: '57px',
          letterSpacing: '-0.96px',
          color: '#000000',
          margin: '0 0 20px 0',
        }}>
          Deploy a zero-config, no-fuss VPN
        </h2>

        <p style={{
          fontFamily: 'Inter, sans-serif',
          fontWeight: 400,
          fontSize: '18px',
          lineHeight: '27px',
          letterSpacing: '-0.18px',
          color: 'rgba(48, 44, 44, 0.65)',
          margin: '0 0 32px 0',
        }}>
          Deploy a WireGuard®-based VPN that eliminates single points of failure.
        </p>

        <RouterLink to="/business-vpn" style={{
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
            Business VPN
          </span>
          <ExternalLink size={17} color="#000000" />
        </RouterLink>
      </div>

      {/* Right: animated globe */}
      <div style={{
        flex: 1,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: '-60px',
        marginBottom: '-120px',
      }}>
        <GlobeCanvas />
      </div>

    </div>
  </section>
)

export default GlobalVPNSection
