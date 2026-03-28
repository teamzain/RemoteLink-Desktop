import { Box, Container, Grid, Typography, Stack, Link, Divider } from '@mui/material'

// Bypass structural type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledGrid = Grid as any

const Footer: React.FC = () => {
  return (
    <Box sx={{ bgcolor: 'background.paper', pt: 10, pb: 4, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
      <Container maxWidth="lg">
        <StyledGrid container spacing={8}>
          <StyledGrid size={{ xs: 12, md: 4 }}>
            <Stack spacing={3}>
              <Typography variant="h5" sx={{ fontWeight: 900, color: 'primary.main' }}>
                RemoteLink
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8, maxWidth: '300px' }}>
                Connecting the world, one screen at a time. The most trusted remote access solution for businesses of all sizes.
              </Typography>
            </Stack>
          </StyledGrid>

          <StyledGrid size={{ xs: 6, md: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 3 }}>
              Products
            </Typography>
            <Stack spacing={2}>
              {['Remote Support', 'Remote Access', 'Free Version', 'Pricing'].map((item) => (
                <Link key={item} href="#" underline="none" color="text.secondary" variant="body2" sx={{ '&:hover': { color: 'primary.main' } }}>
                  {item}
                </Link>
              ))}
            </Stack>
          </StyledGrid>

          <StyledGrid size={{ xs: 6, md: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 3 }}>
              Company
            </Typography>
            <Stack spacing={2}>
              {['About Us', 'Careers', 'Partners', 'News'].map((item) => (
                <Link key={item} href="#" underline="none" color="text.secondary" variant="body2" sx={{ '&:hover': { color: 'primary.main' } }}>
                  {item}
                </Link>
              ))}
            </Stack>
          </StyledGrid>

          <StyledGrid size={{ xs: 6, md: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 3 }}>
              Resources
            </Typography>
            <Stack spacing={2}>
              {['Support Hub', 'Download', 'Security', 'Contact'].map((item) => (
                <Link key={item} href="#" underline="none" color="text.secondary" variant="body2" sx={{ '&:hover': { color: 'primary.main' } }}>
                  {item}
                </Link>
              ))}
            </Stack>
          </StyledGrid>
          
          <StyledGrid size={{ xs: 6, md: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 3 }}>
              Legal
            </Typography>
            <Stack spacing={2}>
              {['Privacy Policy', 'Terms of Use', 'Security Disclosure'].map((item) => (
                <Link key={item} href="#" underline="none" color="text.secondary" variant="body2" sx={{ '&:hover': { color: 'primary.main' } }}>
                  {item}
                </Link>
              ))}
            </Stack>
          </StyledGrid>
        </StyledGrid>

        <Divider sx={{ my: 6, opacity: 0.5 }} />

        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
          <Typography variant="caption" color="text.secondary">
            © {new Date().getFullYear()} RemoteLink. All rights reserved.
          </Typography>
          <Stack direction="row" spacing={3}>
            {['Twitter', 'LinkedIn', 'Facebook', 'Instagram'].map((social) => (
              <Link key={social} href="#" color="text.secondary" variant="caption" sx={{ '&:hover': { color: 'primary.main' } }}>
                {social}
              </Link>
            ))}
          </Stack>
        </Stack>
      </Container>
    </Box>
  )
}

export default Footer
