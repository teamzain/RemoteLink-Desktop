import { AppBar, Toolbar, Typography, Button, Stack, Container } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

// Bypass structural type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledStack = Stack as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledButton = Button as any

import { useAuthStore } from '../../store/authStore'

const Navbar: React.FC = () => {
  const { accessToken, user } = useAuthStore()

  return (
    <AppBar position="sticky" color="default" elevation={0} sx={{ bgcolor: 'background.paper', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
          <StyledStack direction="row" alignItems="center" spacing={1} component={RouterLink} to="/" sx={{ textDecoration: 'none' }}>
            <Typography variant="h5" sx={{ fontWeight: 900, color: 'primary.main', letterSpacing: '-1px' }}>
              RemoteLink
            </Typography>
          </StyledStack>

          <Stack direction="row" spacing={3} sx={{ display: { xs: 'none', md: 'flex' } }}>
            {[
              { label: 'Features', path: '/features' },
              { label: 'Solutions', path: '/solutions' },
              { label: 'Pricing', path: '/pricing' },
              { label: 'Resources', path: '/resources' },
            ].map((item) => (
              <StyledButton
                key={item.label}
                component={RouterLink}
                to={item.path}
                variant="text"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': { color: 'primary.main', bgcolor: 'transparent' },
                }}
              >
                {item.label}
              </StyledButton>
            ))}
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center">
            {accessToken ? (
              <StyledButton 
                component={RouterLink} 
                to="/dashboard" 
                variant="outlined" 
                color="primary"
                sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 700 }}
              >
                Dashboard {user?.name ? `(${user.name})` : ''}
              </StyledButton>
            ) : (
              <StyledButton 
                component={RouterLink} 
                to="/login" 
                variant="text" 
                color="inherit"
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                Sign In
              </StyledButton>
            )}
            <Button variant="contained" color="primary" sx={{ borderRadius: '20px', px: 3, textTransform: 'none', fontWeight: 700 }}>
              Download
            </Button>
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  )
}

export default Navbar
