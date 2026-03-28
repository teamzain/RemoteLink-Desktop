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

const stripePromise = loadStripe('pk_test_mock_key');

const CheckoutForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const stripe = useStripe();
  const elements = useElements();
  const theme = useTheme();
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    // Mock payment processing
    setTimeout(() => {
      setLoading(false);
      onClose();
    }, 2000);
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
          Subscribe Now
        </LoadingButton>
      </DialogActions>
    </form>
  );
};

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ open, onClose }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '24px', p: 2 } }}>
      <DialogTitle sx={{ fontWeight: 900, pb: 0 }}>Upgrade to Pro</DialogTitle>
      <DialogContent>
        <Elements stripe={stripePromise}>
          <CheckoutForm onClose={onClose} />
        </Elements>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutModal;
