import React from 'react'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Chip,
  Container,
  useTheme,
} from '@mui/material'
import { CheckCircle, RemoveCircle } from '@mui/icons-material'
import Navbar from '../../components/landing/Navbar'
import Footer from '../../components/landing/Footer'
import { ScrollReveal } from '../../components/landing/ScrollReveal'
import CheckoutModal from '../../components/billing/CheckoutModal'
import { useAuthStore } from '../../store/authStore'
import { useNavigate } from 'react-router-dom'

// Bypass structural type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledGrid = Grid as any;

const plans = [
  {
    name: 'Free',
    price: '0',
    features: ['1 Device', 'Standard Speed', 'Basic Security', 'No File Transfer'],
    excluded: ['Dual Monitor Support', 'Mobile Access', 'Admin Tools'],
    buttonText: 'Get Started',
    buttonVariant: 'outlined' as const,
  },
  {
    name: 'Pro',
    price: '19',
    popular: true,
    features: ['5 Devices', 'Ultra Fast Speed', 'Advanced Security', 'File Transfer', 'Dual Monitor Support'],
    excluded: ['Mobile Access', 'Admin Tools'],
    buttonText: 'Try Pro',
    buttonVariant: 'contained' as const,
  },
  {
    name: 'Business',
    price: '49',
    features: ['50 Devices', 'Ultra Fast Speed', 'Enterprise Security', 'File Transfer', 'Admin Dashboard', 'Mobile Access'],
    excluded: ['Custom Integration', 'Dedicated Support'],
    buttonText: 'Contact Sales',
    buttonVariant: 'contained' as const,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    features: ['Unlimited Devices', 'Ultra Fast Speed', 'Maximum Security', 'Custom Integration', 'Dedicated Support', '24/7 Priority'],
    excluded: [],
    buttonText: 'Talk to Enterprise',
    buttonVariant: 'contained' as const,
  },
];

const PricingPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  
  const [modalOpen, setModalOpen] = React.useState(false);
  const [selectedPlan, setSelectedPlan] = React.useState({ name: '', price: '' });

  const handlePlanSelect = (plan: typeof plans[0]) => {
    if (plan.name === 'Free') {
       navigate('/register');
       return;
    }
    
    if (plan.name === 'Enterprise') {
       window.location.href = 'mailto:sales@remotelink.com';
       return;
    }

    if (!user) {
      navigate('/login?redirect=/pricing');
      return;
    }

    setSelectedPlan({ name: plan.name, price: plan.price });
    setModalOpen(true);
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      
      <Container maxWidth="lg" sx={{ py: 12, flexGrow: 1 }}>
        <ScrollReveal>
          <Box sx={{ textAlign: 'center', mb: 8 }}>
            <Typography variant="h3" sx={{ fontWeight: 900, mb: 2 }}>
              Simple transparent pricing
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ maxWidth: 600, mx: 'auto' }}>
              Choose the plan that's right for your teams and infrastructure. No hidden fees.
            </Typography>
          </Box>
        </ScrollReveal>

        <StyledGrid container spacing={4} alignItems="flex-end">
          {plans.map((plan) => (
            <StyledGrid size={{ xs: 12, md: 6, lg: 3 }} key={plan.name}>
              <ScrollReveal delay={0.1}>
                <Card
                  elevation={plan.popular ? 12 : 1}
                  sx={{
                    borderRadius: '24px',
                    height: '100%',
                    position: 'relative',
                    overflow: 'visible',
                    border: plan.popular ? `2px solid ${theme.palette.primary.main}` : 'none',
                    bgcolor: plan.popular ? 'background.paper' : 'background.paper',
                  }}
                >
                  {plan.popular && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 1,
                      }}
                    >
                      <Chip
                        label="MOST POPULAR"
                        color="primary"
                        sx={{ fontWeight: 900, px: 2, height: 32, fontSize: '0.75rem' }}
                      />
                    </Box>
                  )}

                  <CardContent sx={{ p: 4 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {plan.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', mb: 3 }}>
                      <Typography variant="h3" sx={{ fontWeight: 900 }}>
                        {plan.price === 'Custom' ? '' : '$'}{plan.price}
                      </Typography>
                      {plan.price !== 'Custom' && (
                        <Typography variant="body2" color="text.secondary" sx={{ ml: 1, fontWeight: 700 }}>
                          / month
                        </Typography>
                      )}
                    </Box>
                    
                    <Button
                      fullWidth
                      variant={plan.buttonVariant}
                      size="large"
                      onClick={() => handlePlanSelect(plan)}
                      sx={{ py: 1.5, mb: 4, borderRadius: '12px' }}
                    >
                      {plan.buttonText}
                    </Button>

                    <Divider sx={{ mb: 4 }} />

                    <List sx={{ p: 0 }}>
                      {plan.features.map((feature) => (
                        <ListItem key={feature} disablePadding sx={{ mb: 1.5 }}>
                          <ListItemIcon sx={{ minWidth: 32, color: 'success.main' }}>
                            <CheckCircle sx={{ fontSize: 20 }} />
                          </ListItemIcon>
                          <ListItemText 
                            primary={feature} 
                            primaryTypographyProps={{ variant: 'body2', fontWeight: 600 }} 
                          />
                        </ListItem>
                      ))}
                      {plan.excluded.map((feature) => (
                        <ListItem key={feature} disablePadding sx={{ mb: 1.5 }}>
                          <ListItemIcon sx={{ minWidth: 32, color: 'text.disabled' }}>
                            <RemoveCircle sx={{ fontSize: 20 }} />
                          </ListItemIcon>
                          <ListItemText 
                            primary={feature} 
                            primaryTypographyProps={{ variant: 'body2', color: 'text.disabled' }} 
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </ScrollReveal>
            </StyledGrid>
          ))}
        </StyledGrid>
      </Container>

      <Footer />
      
      <CheckoutModal 
        open={modalOpen} 
        onClose={() => setModalOpen(false)} 
        plan={selectedPlan.name}
        price={selectedPlan.price}
      />
    </Box>
  )
}

export default PricingPage
