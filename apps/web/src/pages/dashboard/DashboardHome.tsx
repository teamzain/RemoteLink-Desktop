import React from 'react';
import { Box, Typography, Grid, Card, CardContent, Stack, useTheme, Button } from '@mui/material';
import { People, Devices, Speed, Add, Monitor as MonitorIcon } from '@mui/icons-material';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import DeviceCard from '../../components/dashboard/DeviceCard';
import { useDeviceStore } from '../../store/deviceStore';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';

// Bypass structural type mismatches
const StyledGrid = Grid as any;

const DashboardHome: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { devices, fetchDevices, addDevice, isLoading } = useDeviceStore();
  
  const [addDeviceOpen, setAddDeviceOpen] = React.useState(false);
  const [addKey, setAddKey] = React.useState('');
  const [addPassword, setAddPassword] = React.useState('');
  const [isAdding, setIsAdding] = React.useState(false);

  // Real-time polling
  React.useEffect(() => {
    fetchDevices();
    const interval = setInterval(() => {
      fetchDevices(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchDevices]);

  const handleAddDevice = async () => {
    setIsAdding(true);
    try {
      await addDevice(addKey.replace(/\s/g, ''), addPassword);
      setAddDeviceOpen(false);
      setAddKey('');
      setAddPassword('');
    } catch (err: any) {
      // Error handled silently or via global snackbar
    } finally {
      setIsAdding(false);
    }
  };

  // Stats calculation
  const onlineCount = devices.filter(d => d.is_online).length;
  // TODO: Sessions will be wired later, currently 0
  const stats = [
    { label: 'Total Managed Devices', value: devices.length.toString(), icon: <Devices />, color: theme.palette.primary.main },
    { label: 'Online Now', value: onlineCount.toString(), icon: <Speed />, color: theme.palette.success.main },
    { label: 'Recent Connections', value: '0', icon: <People />, color: theme.palette.secondary.main },
  ];

  return (
    <DashboardLayout title="Overview">
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<MonitorIcon />}
          onClick={() => navigate('/dashboard/host')}
          sx={{ borderRadius: '12px', px: 3, fontWeight: 800, borderWidth: 2, '&:hover': { borderWidth: 2 } }}
        >
          Host from Browser
        </Button>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setAddDeviceOpen(true)}
          sx={{ borderRadius: '12px', px: 3, fontWeight: 800 }}
        >
          Add Device
        </Button>
      </Box>
      {/* Stats Cards */}
      <StyledGrid container spacing={3} sx={{ mb: 6 }}>
        {stats.map((stat: any, index: number) => (
          <StyledGrid size={{ xs: 12, sm: 4 }} key={index}>
            <Card sx={{ borderRadius: '16px' }}>
              <CardContent>
                <Stack direction="row" spacing={3} alignItems="center">
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: `${stat.color}15`,
                      color: stat.color,
                      borderRadius: '16px',
                      display: 'flex',
                    }}
                  >
                    {stat.icon}
                  </Box>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 900 }}>
                      {stat.value}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                      {stat.label}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </StyledGrid>
        ))}
      </StyledGrid>

      {/* Device List */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>
          My Devices
        </Typography>
        
      {devices.length === 0 && !isLoading ? (
        <Box
          sx={{
            mt: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            p: 4,
            borderRadius: '24px',
            bgcolor: 'background.paper',
            border: '1px dashed',
            borderColor: 'divider',
          }}
        >
          <Box
            sx={{
              p: 3,
              borderRadius: '50%',
              bgcolor: 'action.hover',
              mb: 3,
              color: 'text.secondary',
            }}
          >
            <Devices sx={{ fontSize: 64 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
            No devices connected yet
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4, maxWidth: 400 }}>
            Install the RemoteLink agent on your host machine to start managing your devices remotely.
          </Typography>
          <Button
            variant="contained"
            size="large"
            sx={{ borderRadius: '12px', px: 4, fontWeight: 800 }}
          >
            Download Agent
          </Button>
        </Box>
      ) : (
        <StyledGrid container spacing={3}>
          {devices.map((device) => (
            <StyledGrid size={{ xs: 12, md: 6, lg: 4 }} key={device.id}>
              {/* @ts-ignore - mapping snake_case to what DeviceCard expects */}
              <DeviceCard 
                id={device.id}
                name={device.name}
                status={device.is_online ? 'online' : 'offline'}
                lastSeen={device.last_seen}
                accessKey={device.access_key}
              />
            </StyledGrid>
          ))}
        </StyledGrid>
      )}
      </Box>

      {/* Add Device Dialog */}
      <Dialog open={addDeviceOpen} onClose={() => setAddDeviceOpen(false)}>
        <DialogTitle sx={{ fontWeight: 900 }}>Add Remote Device</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Enter the 9-digit Access Key displayed on the host device. If the host has a password set, enter it below.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Access Key"
            placeholder="123 456 789"
            fullWidth
            variant="outlined"
            value={addKey}
            onChange={(e) => setAddKey(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Hardware Password (Optional)"
            type="password"
            placeholder="Enter password if required"
            fullWidth
            variant="outlined"
            value={addPassword}
            onChange={(e) => setAddPassword(e.target.value)}
            sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddDeviceOpen(false)}>Cancel</Button>
          <LoadingButton
            variant="contained"
            onClick={handleAddDevice}
            loading={isAdding}
            disabled={!addKey}
            sx={{ borderRadius: '8px', px: 3 }}
          >
            Link Device
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
};

export default DashboardHome;
