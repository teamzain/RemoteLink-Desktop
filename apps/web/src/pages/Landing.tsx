import React from 'react'
import { Box } from '@mui/material'
import Navbar from '../components/landing/Navbar'
import Hero from '../components/landing/Hero'
import NetworkSection from '../components/landing/NetworkSection'
import GlobalVPNSection from '../components/landing/GlobalVPNSection'
import SiteToSiteSection from '../components/landing/SiteToSiteSection'
import HomelabSection from '../components/landing/HomelabSection'
import SimplePowerfulSection from '../components/landing/SimplePowerfulSection'
import SecuritySection from '../components/landing/SecuritySection'
import WorkflowSection from '../components/landing/WorkflowSection'
import Footer from '../components/landing/Footer'
import { ScrollReveal } from '../components/landing/ScrollReveal'

const Landing: React.FC = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Navbar heroBg="#F6F4F2" />
      <Box component="main" sx={{ flexGrow: 1 }}>
        <ScrollReveal delay={0.1}>
          <Hero heroImage="/hero.png" />
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <NetworkSection />
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <GlobalVPNSection />
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <SiteToSiteSection />
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <HomelabSection />
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <SimplePowerfulSection />
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <SecuritySection />
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <WorkflowSection />
        </ScrollReveal>

      </Box>
      <Footer />
    </Box>
  )
}

export default Landing
