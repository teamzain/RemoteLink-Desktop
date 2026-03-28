import React, { useState } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  useTheme,
  useMediaQuery,
  ThemeProvider,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard,
  Devices,
  History,
  Settings,
  Logout,
  Notifications,
} from '@mui/icons-material';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { lightTheme } from '../../theme';
import { useAuthStore } from '../../store/authStore';

const drawerWidth = 260;

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
}

// Bypass structural type mismatches
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledListItemButton = ListItemButton as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledTypography = Typography as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledBox = Box as any;

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const menuItems = [
    { text: 'Overview', icon: <Dashboard />, path: '/dashboard' },
    { text: 'Devices', icon: <Devices />, path: '/dashboard/devices' },
    { text: 'Sessions', icon: <History />, path: '/dashboard/sessions' },
    { text: 'Settings', icon: <Settings />, path: '/dashboard/settings' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, color: 'primary.main', letterSpacing: '-1px' }}>
          RemoteLink
        </Typography>
      </Box>
      
      <List sx={{ px: 2, flexGrow: 1 }}>
        {menuItems.map((item) => {
          const isSelected = location.pathname === item.path;
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
              <StyledListItemButton
                component={RouterLink}
                to={item.path}
                selected={isSelected}
                sx={{
                  borderRadius: '12px',
                  '&.Mui-selected': {
                    bgcolor: 'action.selected',
                    color: 'primary.main',
                    '& .MuiListItemIcon-root': { color: 'primary.main' },
                    '&:hover': { bgcolor: 'action.hover' },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  primaryTypographyProps={{ fontWeight: isSelected ? 800 : 500 }} 
                />
              </StyledListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ mx: 2 }} />
      
      <Box sx={{ p: 2 }}>
        <ListItem disablePadding>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', p: 1 }}>
            <Avatar sx={{ bgcolor: 'secondary.main', fontWeight: 900 }}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </Avatar>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <StyledTypography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                {user?.name || 'User'}
              </StyledTypography>
              <StyledTypography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
                {user?.email || 'user@example.com'}
              </StyledTypography>
            </Box>
            <IconButton size="small" onClick={handleLogout} sx={{ color: 'text.secondary' }}>
              <Logout fontSize="small" />
            </IconButton>
          </Box>
        </ListItem>
      </Box>
    </Box>
  );

  return (
    <ThemeProvider theme={lightTheme}>
      <StyledBox sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }} component="div">
        {/* Sidebar */}
        <StyledBox
          component="nav"
          sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
        >
          {/* Mobile Drawer */}
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{ keepMounted: true }}
            sx={{
              display: { xs: 'block', md: 'none' },
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
            }}
          >
            {drawerContent}
          </Drawer>

          {/* Desktop Drawer */}
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', md: 'block' },
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: '1px solid', borderColor: 'divider' },
            }}
            open
          >
            {drawerContent}
          </Drawer>
        </StyledBox>

        {/* Main Content */}
        <StyledBox
          component="main"
          sx={{
            flexGrow: 1,
            width: { md: `calc(100% - ${drawerWidth}px)` },
          }}
        >
          <AppBar
            position="sticky"
            elevation={0}
            sx={{
              bgcolor: 'background.default',
              borderBottom: '1px solid',
              borderColor: 'divider',
              color: 'text.primary',
            }}
          >
            <Toolbar sx={{ justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {isMobile && (
                  <IconButton color="inherit" onClick={handleDrawerToggle} edge="start" sx={{ mr: 2 }}>
                    <MenuIcon />
                  </IconButton>
                )}
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  {title}
                </Typography>
              </Box>
              <IconButton color="inherit">
                <Notifications />
              </IconButton>
            </Toolbar>
          </AppBar>
          
          <StyledBox sx={{ p: { xs: 2, md: 4 } }}>
            {children}
          </StyledBox>
        </StyledBox>
      </StyledBox>
    </ThemeProvider>
  );
};

export default DashboardLayout;
