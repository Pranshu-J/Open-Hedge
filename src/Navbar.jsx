// Navbar.jsx
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link as RouterLink } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { 
  AppBar, Box, Toolbar, IconButton, Typography, Container, 
  Button, Drawer, List, ListItem, ListItemButton, ListItemText, 
  ListItemIcon, useMediaQuery, useTheme, Autocomplete, TextField,
  InputAdornment, CircularProgress, Avatar, Menu, MenuItem, Divider
} from '@mui/material';
import { 
  Menu as MenuIcon, 
  Close as CloseIcon, 
  ShowChart, 
  Business, 
  TrendingUp, 
  Search as SearchIcon,
  Login as LoginIcon,
  Logout,
  PieChart // Imported for Portfolio
} from '@mui/icons-material';

// --- ADDED PORTFOLIO ITEM HERE ---
const NAV_ITEMS = [
  { label: 'Funds', path: '/funds', icon: <Business /> },
  { label: 'Stocks', path: '/stocks', icon: <ShowChart /> },
  { label: 'Trending', path: '/trending', icon: <TrendingUp /> },
  { label: 'Portfolio', path: '/portfolio', icon: <PieChart /> }, 
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [session, setSession] = useState(null);
  
  // Profile Menu State
  const [anchorElUser, setAnchorElUser] = useState(null);

  // Search State
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // --- Auth Logic ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        ensureProfileExists(session.user);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (_event === 'SIGNED_IN' && session) {
        ensureProfileExists(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const ensureProfileExists = async (user) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (!data || error) {
        console.log("Old user detected. Creating missing profile...");
        await supabase.from('profiles').insert([
          {
            id: user.id,
            user_details: {
              email: user.email,
              full_name: user.user_metadata?.full_name,
              auto_created: true
            }
          }
        ]);
      }
    } catch (err) {
      console.error("Error ensuring profile:", err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setAnchorElUser(null);
    navigate('/');
  };

  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorElUser(null);
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // --- Search Logic (SQL RPC Version) ---
  useEffect(() => {
    let active = true;

    // Minimum char limit
    if (inputValue.length < 2) {
      setOptions(options.length > 0 ? options : []);
      return;
    }

    const toTitleCase = (str) => {
      if (!str) return '';
      return str.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      );
    };

    const fetchResults = async () => {
      setLoading(true);
      
      try {
        // 1. Funds Search (Standard Query)
        const fundsPromise = supabase
          .from('funds_ranked')
          .select('company_name')
          .ilike('company_name', `%${inputValue}%`)
          .limit(5);

        // 2. Stocks Search (SQL Function Call)
        // This calls your new 'search_tickers' function in the database.
        // It handles strict/broad filtering and relevance sorting automatically.
        const stocksPromise = supabase
          .rpc('search_tickers', { keyword: inputValue });

        const [fundsData, stocksData] = await Promise.all([fundsPromise, stocksPromise]);

        if (active) {
          const newOptions = [];

          // Process Funds
          if (fundsData.data) {
            fundsData.data.forEach(fund => {
              newOptions.push({
                type: 'Institutions',
                label: fund.company_name,
                value: fund.company_name,
                subLabel: 'Institutional Fund'
              });
            });
          }

          // Process Stocks (Result is already sorted by relevance from SQL)
          if (stocksData.data) {
            const seenSymbols = new Set();
            
            stocksData.data.forEach(stock => {
              // Deduplicate results
              if (!seenSymbols.has(stock.symbol)) {
                seenSymbols.add(stock.symbol);
                
                const formattedDesc = toTitleCase(stock.description);
                newOptions.push({
                  type: 'Stocks',
                  label: stock.symbol,
                  matchLabel: formattedDesc ? `${stock.symbol} ${formattedDesc}` : stock.symbol,
                  value: stock.symbol,
                  subLabel: formattedDesc || 'Stock Ticker'
                });
              }
            });
          }
          setOptions(newOptions);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchResults();
    }, 300);

    return () => {
      active = false;
      clearTimeout(delayDebounceFn);
    };
  }, [inputValue]);

  const handleSearchSelect = (event, newValue) => {
    if (!newValue) return;
    if (newValue.type === 'Institutions') {
      navigate(`/fund/${newValue.value}`);
    } else if (newValue.type === 'Stocks') {
      navigate(`/stocks/${newValue.value}`);
    }
    setInputValue('');
  };

  const drawerContent = (
    <Box sx={{ height: '100%', bgcolor: '#000', color: 'white' }}>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <IconButton onClick={handleDrawerToggle} sx={{ color: '#a1a1aa' }}>
          <CloseIcon />
        </IconButton>
      </Box>
      <List>
        <ListItem disablePadding>
          <ListItemButton 
            component={RouterLink} 
            to="/search" 
            onClick={handleDrawerToggle}
            sx={{ borderLeft: isActive('/search') ? '2px solid #fff' : '2px solid transparent' }}
          >
            <ListItemIcon sx={{ color: isActive('/search') ? '#fff' : '#a1a1aa' }}>
               <SearchIcon />
            </ListItemIcon>
            <ListItemText primary="Search" />
          </ListItemButton>
        </ListItem>

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
        
        <Divider sx={{ my: 2, borderColor: '#27272a' }} />
        {session ? (
           <ListItem disablePadding>
             <ListItemButton onClick={() => { handleLogout(); handleDrawerToggle(); }}>
               <ListItemIcon sx={{ color: '#ef4444' }}><Logout /></ListItemIcon>
               <ListItemText primary="Sign Out" primaryTypographyProps={{ color: '#ef4444' }} />
             </ListItemButton>
           </ListItem>
        ) : (
           <ListItem disablePadding>
             <ListItemButton component={RouterLink} to="/login" onClick={handleDrawerToggle}>
               <ListItemIcon sx={{ color: '#fff' }}><LoginIcon /></ListItemIcon>
               <ListItemText primary="Login" />
             </ListItemButton>
           </ListItem>
        )}
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #27272a' }}>
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ justifyContent: 'space-between', gap: 2 }}>
            
            <RouterLink to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', minWidth: 'fit-content' }}>
              <Typography variant="h6" noWrap sx={{ mr: 2, fontWeight: 700, letterSpacing: '.05rem', color: 'white' }}>
                OPEN<span style={{ color: '#71717a' }}>HEDGE</span>
              </Typography>
            </RouterLink>

            <Box sx={{ flexGrow: 1, maxWidth: 600, display: { xs: 'none', md: 'block' } }}>
              <Autocomplete
                freeSolo
                disableClearable
                options={options}
                groupBy={(option) => option.type}
                getOptionLabel={(option) => (typeof option === 'string' ? option : option.matchLabel || option.label)}
                loading={loading}
                onInputChange={(event, newInputValue) => setInputValue(newInputValue)}
                onChange={handleSearchSelect}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Search funds or stocks..."
                    size="small"
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon sx={{ color: '#71717a' }} />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <React.Fragment>
                          {loading ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </React.Fragment>
                      ),
                      sx: {
                        bgcolor: 'rgba(255,255,255,0.05)',
                        color: 'white',
                        '& fieldset': { border: '1px solid #27272a' },
                        '&:hover fieldset': { borderColor: '#52525b' },
                        '&.Mui-focused fieldset': { borderColor: '#fff' },
                        borderRadius: 2
                      }
                    }}
                  />
                )}
                renderOption={(props, option) => (
                    <Box component="li" {...props} key={props.key}>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="body2" sx={{ fontWeight: 500, color: 'white' }}>{option.label}</Typography>
                            <Typography variant="caption" sx={{ color: '#71717a' }}>{option.subLabel}</Typography>
                        </Box>
                    </Box>
                )}
                sx={{
                    '& .MuiAutocomplete-listbox': { bgcolor: '#09090b', border: '1px solid #27272a', color: 'white' },
                    '& .MuiAutocomplete-groupLabel': { bgcolor: '#18181b', color: '#a1a1aa' }
                }}
              />
            </Box>

            {!isMobile && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
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
                      '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' }
                    }}
                  >
                    {item.label}
                  </Button>
                ))}

                {session ? (
                  <>
                    <IconButton onClick={handleOpenUserMenu} sx={{ ml: 1, p: 0 }}>
                      <Avatar 
                        alt={session.user.user_metadata.full_name} 
                        src={session.user.user_metadata.avatar_url}
                        sx={{ width: 32, height: 32, border: '1px solid #27272a' }}
                      />
                    </IconButton>
                    <Menu
                      sx={{ mt: '45px', '& .MuiPaper-root': { bgcolor: '#09090b', border: '1px solid #27272a', color: 'white' } }}
                      anchorEl={anchorElUser}
                      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
                      keepMounted
                      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                      open={Boolean(anchorElUser)}
                      onClose={handleCloseUserMenu}
                    >
                      <MenuItem onClick={handleLogout} sx={{ color: '#ef4444' }}>
                        <ListItemIcon sx={{ color: '#ef4444' }}><Logout fontSize="small" /></ListItemIcon>
                        Sign Out
                      </MenuItem>
                    </Menu>
                  </>
                ) : (
                  <Button component={RouterLink} to="/login" startIcon={<LoginIcon />} variant="outlined" sx={{ ml: 1, color: 'white', borderColor: '#27272a', textTransform: 'none', '&:hover': { borderColor: '#fff' } }}>
                    Login
                  </Button>
                )}
              </Box>
            )}

            {isMobile && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <IconButton component={RouterLink} to="/search" sx={{ color: '#a1a1aa' }}><SearchIcon /></IconButton>
                <IconButton color="inherit" onClick={handleDrawerToggle} sx={{ color: '#a1a1aa' }}><MenuIcon /></IconButton>
              </Box>
            )}
          </Toolbar>
        </Container>
      </AppBar>
      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 280, bgcolor: '#000', borderLeft: '1px solid #27272a' } }}
      >
        {drawerContent}
      </Drawer>
    </>
  );
}