import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Divider,
  Link,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import { Google, Visibility, VisibilityOff } from '@mui/icons-material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '../../store/authStore';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();
  const [showPassword, setShowPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      const result = await login(data.email, data.password);
      if (result?.twoFactorRequired) {
        navigate('/2fa', { state: { email: data.email } });
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      // API Interceptor handles the snackbar, so we just log or handle local UI state
      console.error('Login failed', error);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/api/auth/oauth/google`;
  };

  // Redirect if already logged in
  React.useEffect(() => {
    if (useAuthStore.getState().accessToken) {
      navigate('/dashboard');
    }
  }, [navigate]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%', borderRadius: '20px' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography
            variant="h4"
            color="primary"
            sx={{ fontWeight: 900, mb: 1, textAlign: 'center' }}
          >
            RemoteLink
          </Typography>
          <Typography
            variant="h6"
            sx={{ mb: 4, textAlign: 'center', fontWeight: 700 }}
          >
            Sign in to your account
          </Typography>

          <form onSubmit={handleSubmit(onSubmit)}>
            <TextField
              fullWidth
              label="Email Address"
              variant="outlined"
              margin="normal"
              {...register('email')}
              error={!!errors.email}
              helperText={errors.email?.message}
            />
            <TextField
              fullWidth
              label="Password"
              variant="outlined"
              type={showPassword ? 'text' : 'password'}
              margin="normal"
              {...register('password')}
              error={!!errors.password}
              helperText={errors.password?.message}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Box sx={{ mt: 1, mb: 3, textAlign: 'right' }}>
              <Link component={RouterLink as any} to="/forgot-password" variant="body2" sx={{ fontWeight: 700 }}>
                Forgot password?
              </Link>
            </Box>

            <LoadingButton
              fullWidth
              size="large"
              type="submit"
              variant="contained"
              loading={isLoading}
              sx={{ py: 1.5, borderRadius: '12px' }}
            >
              Sign in
            </LoadingButton>

            <Divider sx={{ my: 3 }}>OR</Divider>

            <Button
              fullWidth
              variant="outlined"
              startIcon={<Google />}
              onClick={handleGoogleLogin}
              sx={{ py: 1.5, borderRadius: '12px', fontWeight: 700 }}
            >
              Continue with Google
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <Box sx={{ position: 'absolute', bottom: 32 }}>
        <Typography variant="body2">
          Don't have an account?{' '}
          <Link component={RouterLink as any} to="/register" sx={{ fontWeight: 700 }}>
            Sign up
          </Link>
        </Typography>
      </Box>
    </Box>
  );
};

export default Login;
