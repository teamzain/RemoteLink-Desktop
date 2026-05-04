import React from 'react'
import { Box } from '@mui/material'
import Navbar from '../../components/landing/Navbar'
import Footer from '../../components/landing/Footer'
import PricingPlans from '../../components/landing/PricingPlans'
import PricingFAQ from '../../components/landing/PricingFAQ'

const PricingPage: React.FC = () => {
  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar heroBg="#FAF9F8" />

      {/* Pricing hero */}
      <section style={{
        background: '#FAF9F8',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '175px 40px 80px',
      }}>
        <div style={{ maxWidth: '1280px', width: '100%' }}>
          <h1 style={{
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: 'clamp(2.5rem, 5vw, 72px)',
            lineHeight: '85px',
            letterSpacing: '-2.16px',
            color: '#302C2C',
            margin: 0,
            maxWidth: '523px',
          }}>
            Plans that work for everyone
          </h1>
        </div>
      </section>

      <Box sx={{ flexGrow: 1 }}>
        <PricingPlans />
        <PricingFAQ />
      </Box>

      <Footer />
    </Box>
  )
}

export default PricingPage
