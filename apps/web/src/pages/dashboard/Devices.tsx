import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Stack,
  Button,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { LoadingButton } from '@mui/lab';
import {
  Search,
  SettingsRemote,
  FiberManualRecord,
  ContentCopy,
  Edit,
} from '@mui/icons-material';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { useDeviceStore } from '../../store/deviceStore';
import { useNavigate } from 'react-router-dom';
import { notify } from '../../components/NotificationProvider';
import api from '../../lib/api';

const Devices: React.FC = () => {
  const navigate = useNavigate();
  const { devices } = useDeviceStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // Filter logic
  const filteredDevices = useMemo(() => {
    return devices.filter((device) => {
      const matchesSearch = 
        device.name.toLowerCase().includes(search.toLowerCase()) || 
        device.access_key.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = 
        statusFilter === 'all' || 
        (statusFilter === 'online' && device.is_online) || 
        (statusFilter === 'offline' && !device.is_online);

      return matchesSearch && matchesStatus;
    });
  }, [devices, search, statusFilter]);

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    notify('Access key copied to clipboard', 'info');
  };

  const handleConnect = async (device: any, providedPassword = '') => {
    if (!device.is_online) {
      notify('Device is offline', 'warning');
      return;
    }

    setIsConnecting(true);
    try {
      const { data } = await api.post('/api/devices/verify-access', { 
        accessKey: device.access_key, 
        password: providedPassword 
      });
      
      setPasswordDialogOpen(false);
      setPassword('');
      
      navigate(`/session/${device.access_key}`, { 
        state: { 
          accessToken: data.token,
          deviceName: device.name,
          accessKey: device.access_key
        } 
      });
    } catch (err: any) {
      if (err.response?.status === 401) {
        setSelectedDevice(device);
        setPasswordDialogOpen(true);
      } else {
        notify(err.response?.data?.error || 'Connection failed', 'error');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <DashboardLayout title="My Devices">
      <Box sx={{ mb: 4 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
          <TextField
            placeholder="Search by name or access key..."
            variant="outlined"
            size="small"
            fullWidth
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
              sx: { borderRadius: '12px' }
            }}
          />
          <Stack direction="row" spacing={2} sx={{ minWidth: { md: '300px' } }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
                sx={{ borderRadius: '12px' }}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="online">Online</MenuItem>
                <MenuItem value="offline">Offline</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Stack>

        <TableContainer component={Paper} sx={{ borderRadius: '24px', overflow: 'hidden', border: '1px solid', borderColor: 'divider', boxShadow: 'none' }}>
          <Table>
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>Device Name</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Access Key</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Last Seen</TableCell>
                <TableCell sx={{ fontWeight: 800 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredDevices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary">No devices found matching your filters.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDevices.map((device) => (
                  <TableRow key={device.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box sx={{ p: 1, bgcolor: 'primary.main', color: 'white', borderRadius: '10px', display: 'flex' }}>
                          <SettingsRemote fontSize="small" />
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{device.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{device.os_type || 'Unknown OS'}</Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, letterSpacing: '1px' }}>
                          {device.access_key}
                        </Typography>
                        <IconButton size="small" onClick={() => handleCopyKey(device.access_key)}>
                          <ContentCopy sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={<FiberManualRecord sx={{ fontSize: '12px !important' }} />}
                        label={device.is_online ? 'Online' : 'Offline'}
                        size="small"
                        color={device.is_online ? 'success' : 'default'}
                        variant="outlined"
                        sx={{ 
                          fontWeight: 700, 
                          borderRadius: '8px',
                          bgcolor: device.is_online ? 'success.50' : 'transparent',
                          borderColor: device.is_online ? 'success.200' : 'divider'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {device.last_seen}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <LoadingButton
                          variant="contained"
                          size="small"
                          loading={isConnecting && selectedDevice?.id === device.id}
                          disabled={!device.is_online || (isConnecting && selectedDevice?.id !== device.id)}
                          onClick={() => handleConnect(device)}
                          sx={{ borderRadius: '8px', fontWeight: 800, textTransform: 'none' }}
                        >
                          Connect
                        </LoadingButton>
                        <Tooltip title="Device Settings">
                            <IconButton size="small">
                                <Edit fontSize="small" />
                            </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
      {/* Password Dialog */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)} PaperProps={{ sx: { borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 900 }}>Device Password Required</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This host is protected by a hardware password. Please enter it to establish a secure connection.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            label="Hardware Password"
            type="password"
            fullWidth
            variant="outlined"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleConnect(selectedDevice, password)}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
          <LoadingButton
            variant="contained"
            onClick={() => handleConnect(selectedDevice, password)}
            loading={isConnecting}
            disabled={!password}
            sx={{ borderRadius: '8px', px: 3 }}
          >
            Connect to Host
          </LoadingButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
};

export default Devices;
