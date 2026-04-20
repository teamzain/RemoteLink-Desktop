import React from 'react'
import { Box, Container, Typography, Button, Grid, Stack } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

interface HeroProps {
  heroImage: string
}

// Bypass structural type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledButton = Button as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledGrid = Grid as any

const Hero: React.FC<HeroProps> = ({ heroImage }) => {
  return (
    <Box sx={{ bgcolor: 'background.paper', py: { xs: 8, md: 12 }, overflow: 'hidden' }}>
      <Container maxWidth="lg">
        <StyledGrid container spacing={6} sx={{ alignItems: 'center' }}>
          <StyledGrid size={{ xs: 12, md: 6 }}>
            <Box>
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '2.5rem', md: '3.75rem' },
                  fontWeight: 900,
                  color: 'text.primary',
                  lineHeight: 1.1,
                  mb: 2,
                }}
              >
                The World's Favorite <br />
                <Box component="span" sx={{ color: 'primary.main' }}>
                  Remote Access
                </Box> Solutions
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  fontSize: '1.2rem',
                  color: 'text.secondary',
                  mb: 4,
                  maxWidth: '500px',
                  lineHeight: 1.6,
                }}
              >
                Connect to any device, anywhere, at any time. Secure, fast, and remarkably easy to use. Join 600,000+ companies worldwide.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <StyledButton
                  component={RouterLink}
                  to="/register"
                  variant="contained"
                  size="large"
                  sx={{
                    px: 4,
                    py: 1.5,
                    fontSize: '1.1rem',
                    borderRadius: '30px',
                    boxShadow: '0 10px 20px rgba(30, 64, 175, 0.2)',
                  }}
                >
                  Start for Free
                </StyledButton>
                <StyledButton
                  component="a"
                  href="http://159.65.84.190/downloads/desktop/Connect-X-Setup.exe"
                  variant="outlined"
                  size="large"
                  sx={{
                    px: 4,
                    py: 1.5,
                    fontSize: '1.1rem',
                    borderRadius: '30px',
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    '&:hover': {
                        bgcolor: 'primary.main',
                        color: 'white',
                    }
                  }}
                >
                  Download for Windows
                </StyledButton>
              </Stack>
            </Box>
          </StyledGrid>
          <StyledGrid size={{ xs: 12, md: 6 }}>
            <Box
              sx={{
                position: 'relative',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: '-10%',
                  right: '-10%',
                  width: '120%',
                  height: '120%',
                  background: 'radial-gradient(circle, rgba(30, 64, 175, 0.05) 0%, transparent 70%)',
                  zIndex: 0,
                },
              }}
            >
              <Box
                component="img"
                src={heroImage}
                alt="Remote Desktop Access"
                sx={{
                  width: '100%',
                  height: 'auto',
                  borderRadius: '20px',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                  position: 'relative',
                  zIndex: 1,
                  transform: { md: 'perspective(1000px) rotateY(-5deg)' },
                }}
              />
            </Box>
          </StyledGrid>
        </StyledGrid>
      </Container>
    </Box>
  )
}

export default Hero
