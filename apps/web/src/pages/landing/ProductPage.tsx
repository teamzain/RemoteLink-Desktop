import React from 'react'
import { Box, Typography, Container, Grid, Button } from '@mui/material'
import Navbar from '../../components/landing/Navbar'
import Footer from '../../components/landing/Footer'
import ProductHero from '../../components/landing/ProductHero'
import TrustMarquee from '../../components/landing/TrustMarquee'
import ProductExplainer from '../../components/landing/ProductExplainer'
import ProductShareSection from '../../components/landing/ProductShareSection'
import ProductFeaturesSection from '../../components/landing/ProductFeaturesSection'
import ProductTestimonialsSection from '../../components/landing/ProductTestimonialsSection'
import ProductDownloadSection from '../../components/landing/ProductDownloadSection'
import { ScrollReveal } from '../../components/landing/ScrollReveal'

// Bypass structural type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledGrid = Grid as any;

const FeatureDetail: React.FC<{ title: string; description: string; image: string; reverse?: boolean }> = ({ title, description, image, reverse }) => (
  <Container maxWidth="lg" sx={{ py: 10 }}>
    <StyledGrid container spacing={8} alignItems="center" direction={reverse ? 'row-reverse' : 'row'}>
      <StyledGrid size={{ xs: 12, md: 6 }}>
        <ScrollReveal delay={0.2}>
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 3, letterSpacing: '-1px' }}>
            {title}
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1.2rem', lineHeight: 1.8 }}>
            {description}
          </Typography>
        </ScrollReveal>
      </StyledGrid>
      <StyledGrid size={{ xs: 12, md: 6 }}>
        <ScrollReveal delay={0.3}>
          <Box
            component="img"
            src={image}
            sx={{
              width: '100%',
              borderRadius: '24px',
              boxShadow: '0 24px 48px rgba(0,0,0,0.1)',
              border: '1px solid rgba(0,0,0,0.05)'
            }}
          />
        </ScrollReveal>
      </StyledGrid>
    </StyledGrid>
  </Container>
)

const ProductPage: React.FC = () => (
  <Box sx={{ bgcolor: 'background.default' }}>
    <Navbar />
    <Box component="main">
      <ProductHero
        label="Product"
        heading="Remote access for everyone, everywhere"
        description="Connect to any device, from anywhere. Unique 9-digit device IDs, end-to-end encrypted sessions, and one-click remote support — no VPN, no port forwarding, no setup."
        ctaText="Get started free"
        image="/product.png"
        imageAlt="Remote 365 Dashboard"
      />

      <TrustMarquee />
      <ProductExplainer />
      <ProductShareSection />
      <ProductTestimonialsSection />
      <ProductDownloadSection />
      <ProductFeaturesSection />

      <FeatureDetail
        title="Instant Remote Support"
        description="Help anyone, anywhere with session-based remote support. Generate a unique session code, share it with your client, and connect in seconds — no installation or account required for the guest. End-to-end encryption keeps every session secure."
        image="/features_graphics_remote_admin_png_1774319950155.png"
      />

      <Box sx={{ bgcolor: 'grey.50' }}>
        <FeatureDetail
          title="Always-On Device Access"
          description="Enable auto-host on your devices for 24/7 remote access. Connect using unique device IDs from anywhere in the world — no port forwarding, no VPN configuration, no hassle. Your devices are always reachable when you need them."
          image="/landing_hero_remote_desktop_1774319313320.png"
          reverse
        />
      </Box>

      <FeatureDetail
        title="Team Collaboration"
        description="Built-in chat, video meetings, and team management keep your organization connected. Assign roles, manage device permissions, and run multiple concurrent remote sessions. Everything your team needs in one unified platform."
        image="/hero.png"
      />

      
      <Box sx={{ py: 10, bgcolor: 'primary.main', color: 'white', textAlign: 'center' }}>
        <Container maxWidth="md">
          <ScrollReveal>
            <Typography variant="h4" sx={{ fontWeight: 900, mb: 4 }}>
              Ready to experience the future?
            </Typography>
            <Button
              variant="contained"
              color="secondary"
              size="large"
              sx={{
                borderRadius: '30px',
                px: 6,
                py: 2,
                fontWeight: 900,
                fontSize: '1.1rem',
                textTransform: 'none'
              }}
            >
              Get Started for Free
            </Button>
          </ScrollReveal>
        </Container>
      </Box>
    </Box>
    <Footer />
  </Box>
)

export default ProductPage
