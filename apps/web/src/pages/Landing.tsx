import React from 'react'
import { Box } from '@mui/material'
import Navbar from '../components/landing/Navbar'
import Hero from '../components/landing/Hero'
import Features from '../components/landing/Features'
import Stats from '../components/landing/Stats'
import SolutionsGrid from '../components/landing/SolutionsGrid'
import FinalCTA from '../components/landing/FinalCTA'
import Footer from '../components/landing/Footer'
import { ScrollReveal } from '../components/landing/ScrollReveal'

const Landing: React.FC = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Navbar />
      <Box component="main" sx={{ flexGrow: 1 }}>
        <ScrollReveal delay={0.1}>
          <Hero heroImage="/hero.png" />
        </ScrollReveal>
        
        <ScrollReveal delay={0.2}>
          <Stats />
        </ScrollReveal>
        
        <ScrollReveal delay={0.2}>
          <Features />
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <SolutionsGrid />
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <FinalCTA />
        </ScrollReveal>
      </Box>
      <Footer />
    </Box>
  )
}

export default Landing
