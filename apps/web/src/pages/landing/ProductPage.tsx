import React from 'react'
import { Box } from '@mui/material'
import Navbar from '../../components/landing/Navbar'
import Footer from '../../components/landing/Footer'
import CustomerStoriesHero from '../../components/landing/CustomerStoriesHero'
import ProductIdentitySection from '../../components/landing/ProductIdentitySection'
import ProductSecuritySection from '../../components/landing/ProductSecuritySection'

const ProductPage: React.FC = () => (
  <Box sx={{ bgcolor: '#FFFFFF', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
    <Navbar />
    <Box sx={{ flexGrow: 1 }}>
      <CustomerStoriesHero />
      <ProductIdentitySection />
      <ProductSecuritySection />
    </Box>
    <Footer />
  </Box>
)

export default ProductPage
