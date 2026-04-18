import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  useTheme,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import api from '../../lib/api';
import { notify } from '../NotificationProvider';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_mock_key');

const CheckoutForm: React.FC<{ plan: string, price: string, onClose: () => void }> = ({ plan, price, onClose }) => {
  const stripe = useStripe();
  const elements = useElements();
  const theme = useTheme();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Create Payment Method
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      });

      if (pmError) {
        throw new Error(pmError.message);
      }

      // 2. Call backend to subscribe
      const billingUrl = import.meta.env.VITE_BILLING_URL || import.meta.env.VITE_API_URL;
      const { data } = await api.post(`${billingUrl}/billing/subscribe`, {
        plan: plan.toUpperCase(),
        paymentMethodId: paymentMethod.id,
      });

      if (data.requiresAction) {
        // 3. Handle 3DS if required
        const { error: confirmError } = await stripe.confirmCardPayment(data.clientSecret);
        if (confirmError) {
          throw new Error(confirmError.message);
        }
      }

      notify(`Successfully subscribed to ${plan} plan!`, 'success');
      onClose();
      // Refresh page to show updated status
      window.location.reload();
    } catch (err: any) {
      console.error('Subscription error:', err);
      setError(err.message || 'An unexpected error occurred during subscription.');
    } finally {
      setLoading(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        color: theme.palette.text.primary,
        fontFamily: theme.typography.fontFamily,
        fontSize: '16px',
        '::placeholder': {
          color: theme.palette.text.secondary,
        },
      },
      invalid: {
        color: theme.palette.error.main,
      },
    },
  };

  return (
    <form onSubmit={handleSubmit}>
      <Box sx={{ p: 1, mb: 3 }}>
        <Typography variant="body1" sx={{ fontWeight: 700, mb: 1 }}>
          Plan: {plan}
        </Typography>
        <Typography variant="h5" color="primary" sx={{ fontWeight: 900, mb: 3 }}>
          ${price}/month
        </Typography>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Secure payment processing by Stripe.
        </Typography>
        <Box
          sx={{
            p: 2,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '12px',
            bgcolor: 'background.default',
          }}
        >
          <CardElement options={cardElementOptions} />
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <DialogActions sx={{ px: 0 }}>
        <Button onClick={onClose} disabled={loading} sx={{ fontWeight: 700 }}>
          Cancel
        </Button>
        <LoadingButton
          type="submit"
          variant="contained"
          loading={loading}
          disabled={!stripe}
          sx={{ borderRadius: '12px', px: 4, fontWeight: 800 }}
        >
          Pay & Subscribe
        </LoadingButton>
      </DialogActions>
    </form>
  );
};

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  plan: string;
  price: string;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ open, onClose, plan, price }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '24px', p: 2 } }}>
      <DialogTitle sx={{ fontWeight: 900, pb: 0 }}>Upgrade Your Plan</DialogTitle>
      <DialogContent>
        <Elements stripe={stripePromise}>
          <CheckoutForm plan={plan} price={price} onClose={onClose} />
        </Elements>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutModal;
