import React, { useState } from 'react';
import { useLocation, Link as RouterLink } from 'react-router-dom';
import { 
  AppBar, Box, Toolbar, IconButton, Typography, Container, 
  Button, Drawer, List, ListItem, ListItemButton, ListItemText, 
  ListItemIcon, useMediaQuery, useTheme 
} from '@mui/material';
import { 
  Menu as MenuIcon, 
  Close as CloseIcon, 
  ShowChart, 
  Business, 
  Search, 
  TrendingUp 
} from '@mui/icons-material';

const NAV_ITEMS = [
  { label: 'Funds', path: '/funds', icon: <Business /> },
  { label: 'Stocks', path: '/stocks', icon: <ShowChart /> },
  { label: 'Trending', path: '/trending', icon: <TrendingUp /> },
  { label: 'Search', path: '/search', icon: <Search /> },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const drawerContent = (
    <Box sx={{ height: '100%', bgcolor: '#000', color: 'white' }}>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <IconButton onClick={handleDrawerToggle} sx={{ color: '#a1a1aa' }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <List>
        {NAV_ITEMS.map((item) => (
          <ListItem key={item.label} disablePadding>
            <ListItemButton 
              component={RouterLink} 
              to={item.path}
              onClick={handleDrawerToggle}
              sx={{ 
                borderLeft: isActive(item.path) ? '2px solid #fff' : '2px solid transparent',
                bgcolor: isActive(item.path) ? '#18181b' : 'transparent'
              }}
            >
              <ListItemIcon sx={{ color: isActive(item.path) ? '#fff' : '#a1a1aa' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.label} 
                primaryTypographyProps={{ 
                  fontWeight: isActive(item.path) ? 600 : 400,
                  color: isActive(item.path) ? '#fff' : '#a1a1aa'
                }} 
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #27272a' }}>
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
            
            {/* Logo / Brand - Restored OPEN HEDGE */}
            <RouterLink to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              <Typography
                variant="h6"
                noWrap
                sx={{
                  mr: 2,
                  fontWeight: 700,
                  letterSpacing: '.05rem',
                  color: 'white',
                  textDecoration: 'none',
                }}
              >
                OPEN<span style={{ color: '#71717a' }}>HEDGE</span>
              </Typography>
            </RouterLink>

            {/* Desktop Navigation */}
            {!isMobile && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                {NAV_ITEMS.map((item) => (
                  <Button
                    key={item.label}
                    component={RouterLink}
                    to={item.path}
                    startIcon={item.icon}
                    sx={{
                      color: isActive(item.path) ? '#fff' : '#a1a1aa',
                      fontWeight: isActive(item.path) ? 600 : 400,
                      textTransform: 'none',
                      px: 2,
                      '&:hover': {
                        color: '#fff',
                        bgcolor: 'rgba(255,255,255,0.05)'
                      }
                    }}
                  >
                    {item.label}
                  </Button>
                ))}
              </Box>
            )}

            {/* Mobile Menu Icon */}
            {isMobile && (
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="start"
                onClick={handleDrawerToggle}
                sx={{ color: '#a1a1aa' }}
              >
                <MenuIcon />
              </IconButton>
            )}
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer
        anchor="right"
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 280, bgcolor: '#000', borderLeft: '1px solid #27272a' },
        }}
      >
        {drawerContent}
      </Drawer>
    </>
  );
}