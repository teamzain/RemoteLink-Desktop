import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  LinearProgress,
  Button,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  CreditCard as CreditCardIcon,
  Description as DescriptionIcon,
  Upgrade as UpgradeIcon,
} from '@mui/icons-material';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import CheckoutModal from '../../components/billing/CheckoutModal';

// Bypass structural type mismatches
const StyledGrid = Grid as any;

import api from '../../lib/api';

const Billing: React.FC = () => {
  const [checkoutOpen, setCheckoutOpen] = React.useState(false);
  const [billingInfo, setBillingInfo] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchBilling = async () => {
      try {
        const { data } = await api.get('/api/billing/status');
        setBillingInfo(data);
      } catch (err) {
        console.error('Failed to fetch billing status', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBilling();
  }, []);

  const handleManagePortal = async () => {
    try {
      const { data } = await api.post('/api/billing/portal');
      window.location.href = data.url;
    } catch (err) {
      console.error('Failed to open billing portal', err);
    }
  };

  if (loading) return <Box sx={{ p: 4 }}><LinearProgress /></Box>;

  const currentPlan = billingInfo?.plan_name || 'Free';
  const renewalDate = billingInfo?.current_period_end 
    ? new Date(billingInfo.current_period_end * 1000).toLocaleDateString()
    : 'N/A';
  const invoices = billingInfo?.invoices || [];

  return (
    <DashboardLayout title="Billing & Subscription">
      <StyledGrid container spacing={3}>
        {/* Current Plan */}
        <StyledGrid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 4, borderRadius: '24px', position: 'relative', overflow: 'hidden' }}>
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 200,
                height: 200,
                bgcolor: 'primary.main',
                opacity: 0.05,
                borderRadius: '50%',
                transform: 'translate(30%, -30%)',
              }}
            />
            
            <Stack spacing={3}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Stack spacing={1}>
                  <Typography variant="h5" sx={{ fontWeight: 900 }}>
                    Current Plan: {currentPlan} Tier
                  </Typography>
                  <Typography color="text.secondary">
                    Your plan renews on {renewalDate}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Chip label="Active" color="success" sx={{ fontWeight: 800 }} />
                  <Chip label="Monthly" variant="outlined" sx={{ fontWeight: 800 }} />
                </Stack>
              </Box>

              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Plan usage</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {billingInfo?.usage_percentage || 0}% used
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={billingInfo?.usage_percentage || 0} 
                  sx={{ height: 10, borderRadius: 5, bgcolor: 'action.hover' }} 
                />
              </Box>

              <Stack direction="row" spacing={2}>
                {currentPlan === 'Free' && (
                  <Button 
                    variant="contained" 
                    startIcon={<UpgradeIcon />}
                    sx={{ borderRadius: '12px', px: 4, fontWeight: 800 }}
                    onClick={() => setCheckoutOpen(true)}
                  >
                    Upgrade to Pro
                  </Button>
                )}
                <Button 
                  variant="outlined" 
                  onClick={handleManagePortal}
                  sx={{ borderRadius: '12px', fontWeight: 800 }}
                >
                  Manage Subscription
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </StyledGrid>

        {/* Payment Method */}
        <StyledGrid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%', borderRadius: '24px' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>
                Payment Method
              </Typography>
              <Stack spacing={3}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: '12px' }}>
                    <CreditCardIcon color="primary" />
                  </Box>
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 700 }}>
                      {billingInfo?.card_brand 
                        ? `${billingInfo.card_brand.toUpperCase()} ending in ${billingInfo.card_last4}`
                        : 'No payment method'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {billingInfo?.card_exp_month 
                        ? `Expires ${billingInfo.card_exp_month}/${billingInfo.card_exp_year}`
                        : 'Please add a payment method'}
                    </Typography>
                  </Box>
                </Box>
                <Button variant="text" onClick={handleManagePortal} sx={{ fontWeight: 800 }}>Update Card</Button>
              </Stack>
            </CardContent>
          </Card>
        </StyledGrid>

        {/* Invoice History */}
        <StyledGrid size={12}>
          <TableContainer component={Paper} sx={{ borderRadius: '24px', p: 2 }}>
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
              <DescriptionIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>Invoice History</Typography>
            </Box>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Invoice Number</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Amount</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>No invoices found</TableCell>
                  </TableRow>
                ) : (
                  invoices.map((invoice: any) => (
                    <TableRow key={invoice.id}>
                      <TableCell>{invoice.number}</TableCell>
                      <TableCell>{new Date(invoice.created * 1000).toLocaleDateString()}</TableCell>
                      <TableCell>${(invoice.total / 100).toFixed(2)}</TableCell>
                      <TableCell>
                        <Chip 
                          label={invoice.status.toUpperCase()} 
                          size="small" 
                          color={invoice.status === 'paid' ? 'success' : 'warning'} 
                          variant="outlined" 
                          sx={{ fontWeight: 700 }} 
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button 
                          href={invoice.invoice_pdf} 
                          target="_blank"
                          variant="text" 
                          size="small" 
                          sx={{ fontWeight: 700 }}
                        >
                          Download PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </StyledGrid>
      </StyledGrid>

      <CheckoutModal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} />
    </DashboardLayout>
  );
};

export default Billing;
