import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
  TextField,
  Button,
  Switch,
  Divider,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import {
  Security as SecurityIcon,
} from '@mui/icons-material';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';
import { notify } from '../../components/NotificationProvider';

const Settings: React.FC = () => {
  const { user, updateUser } = useAuthStore();
  const [isSaving, setIsSaving] = useState(false);
  
  // Profile State
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });

  // Password State
  const [passwords, setPasswords] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [is2FALoading, setIs2FALoading] = useState(false);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const { data } = await api.patch('/api/auth/me', { name: profile.name });
      updateUser(data.user);
      notify('Profile updated successfully', 'success');
    } catch (err) {
      notify('Failed to update profile', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      return notify('New passwords do not match', 'error');
    }
    setIsSaving(true);
    try {
      await api.patch('/api/auth/me', { 
        current_password: passwords.current, 
        password: passwords.new 
      });
      setPasswords({ current: '', new: '', confirm: '' });
      notify('Password updated successfully', 'success');
    } catch (err) {
      notify('Failed to update password', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle2FA = async (enable: boolean) => {
    if (enable) {
      setIs2FALoading(true);
      try {
        const { data } = await api.post('/api/auth/2fa/enable');
        setQrCode(data.qr_code);
        setTwoFactorOpen(true);
      } catch (err) {
        notify('Failed to generate 2FA secret', 'error');
      } finally {
        setIs2FALoading(false);
      }
    } else {
      if (window.confirm('Are you sure you want to disable 2FA? This will make your account less secure.')) {
        try {
          await api.post('/api/auth/2fa/disable');
          updateUser({ ...user!, is_2fa_enabled: false });
          notify('2FA disabled', 'warning');
        } catch (err) {
          notify('Failed to disable 2FA', 'error');
        }
      }
    }
  };

  const handleVerify2FA = async () => {
    setIs2FALoading(true);
    try {
      await api.post('/api/auth/2fa/verify', { code: otpCode });
      updateUser({ ...user!, is_2fa_enabled: true });
      setTwoFactorOpen(false);
      notify('2FA successfully enabled', 'success');
    } catch (err) {
      notify('Invalid verification code', 'error');
    } finally {
      setIs2FALoading(false);
    }
  };

  return (
    <DashboardLayout title="Settings">
      <Stack spacing={4} sx={{ maxWidth: '800px' }}>
        {/* Profile Settings */}
        <Paper sx={{ p: 4, borderRadius: '24px' }}>
          <Stack spacing={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ width: 64, height: 64, bgcolor: 'primary.main', fontWeight: 900, fontSize: '1.5rem' }}>
                {user?.name?.[0]?.toUpperCase()}
              </Avatar>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>Profile Information</Typography>
                <Typography color="text.secondary">Update your personal details</Typography>
              </Box>
            </Box>
            
            <Divider />

            <Box component="form" onSubmit={handleProfileSave}>
              <Stack spacing={3}>
                <TextField
                  label="Full Name"
                  fullWidth
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                />
                <TextField
                  label="Email Address"
                  fullWidth
                  disabled
                  value={profile.email}
                />
                <Box>
                  <LoadingButton 
                    type="submit" 
                    variant="contained" 
                    loading={isSaving}
                    sx={{ borderRadius: '12px', fontWeight: 800, px: 4 }}
                  >
                    Save Changes
                  </LoadingButton>
                </Box>
              </Stack>
            </Box>
          </Stack>
        </Paper>

        {/* Security Settings */}
        <Paper sx={{ p: 4, borderRadius: '24px' }}>
          <Stack spacing={3}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <SecurityIcon color="primary" />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 900 }}>Security</Typography>
                <Typography color="text.secondary">Manage your password and authentication</Typography>
              </Box>
            </Box>
            
            <Divider />

            {/* Password Update */}
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Change Password</Typography>
            <Box component="form" onSubmit={handlePasswordSave}>
              <Stack spacing={3}>
                <TextField
                  label="Current Password"
                  type="password"
                  fullWidth
                  value={passwords.current}
                  onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="New Password"
                    type="password"
                    fullWidth
                    value={passwords.new}
                    onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                  />
                  <TextField
                    label="Confirm New Password"
                    type="password"
                    fullWidth
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  />
                </Stack>
                <Box>
                  <LoadingButton 
                    type="submit" 
                    variant="outlined" 
                    loading={isSaving}
                    sx={{ borderRadius: '12px', fontWeight: 800, px: 4 }}
                  >
                    Update Password
                  </LoadingButton>
                </Box>
              </Stack>
            </Box>

            <Divider />

            {/* 2FA Toggle */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Two-Factor Authentication</Typography>
                <Typography variant="body2" color="text.secondary">Add an extra layer of security to your account</Typography>
              </Box>
              <Switch 
                checked={user?.is_2fa_enabled} 
                onChange={(e) => handleToggle2FA(e.target.checked)}
                color="primary"
              />
            </Box>
          </Stack>
        </Paper>
      </Stack>

      {/* 2FA Setup Dialog */}
      <Dialog open={twoFactorOpen} onClose={() => setTwoFactorOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>Set up Two-Factor Authentication</DialogTitle>
        <DialogContent>
          <Stack spacing={3} alignItems="center" sx={{ mt: 2 }}>
            <Box sx={{ p: 2, bgcolor: 'white', borderRadius: '12px' }}>
              <img src={qrCode} alt="2FA QR Code" style={{ width: '100%' }} />
            </Box>
            <Typography variant="body2" textAlign="center">
              Scan this QR code with your authenticator app (like Google Authenticator or Authy) and enter the 6-digit code below.
            </Typography>
            <TextField
              label="Verification Code"
              fullWidth
              autoFocus
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="000000"
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTwoFactorOpen(false)}>Cancel</Button>
          <LoadingButton 
            variant="contained" 
            onClick={handleVerify2FA} 
            loading={is2FALoading}
            sx={{ borderRadius: '8px' }}
          >
            Verify & Enable
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
};

export default Settings;
