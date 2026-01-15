import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link as RouterLink } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { 
  AppBar, Box, Toolbar, IconButton, Typography, Container, 
  Button, Drawer, List, ListItem, ListItemButton, ListItemText, 
  ListItemIcon, useMediaQuery, useTheme, Autocomplete, TextField,
  InputAdornment, CircularProgress
} from '@mui/material';
import { 
  Menu as MenuIcon, 
  Close as CloseIcon, 
  ShowChart, 
  Business, 
  TrendingUp, 
  Search as SearchIcon
} from '@mui/icons-material';

const NAV_ITEMS = [
  { label: 'Funds', path: '/funds', icon: <Business /> },
  { label: 'Stocks', path: '/stocks', icon: <ShowChart /> },
  { label: 'Trending', path: '/trending', icon: <TrendingUp /> },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  
  // Search State
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // --- Search Logic ---
  useEffect(() => {
    let active = true;

    if (inputValue === '') {
      setOptions(options.length > 0 ? options : []);
      return;
    }

    // Helper to format "ORACLE CORP" -> "Oracle Corp"
    const toTitleCase = (str) => {
      return str.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      );
    };

    const fetchResults = async () => {
      setLoading(true);
      
      try {
        // 1. Search Funds
        const fundsPromise = supabase
          .from('funds_ranked')
          .select('company_name')
          .ilike('company_name', `%${inputValue}%`)
          .limit(5);

        // 2. Search Stocks (Check Symbol OR Issuer)
        const stocksPromise = supabase
          .from('holdings')
          .select('symbol, issuer') // Changed 'name' to 'issuer'
          .or(`symbol.ilike.%${inputValue}%,issuer.ilike.%${inputValue}%`) // Search issuer column
          .limit(20);

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

          // Process Stocks
          if (stocksData.data) {
            const seenSymbols = new Set();
            stocksData.data.forEach(stock => {
              if (stock.symbol && !seenSymbols.has(stock.symbol)) {
                seenSymbols.add(stock.symbol);

                // Format the issuer name
                const formattedName = stock.issuer ? toTitleCase(stock.issuer) : '';

                // Use `matchLabel` for matching (includes issuer) but keep `label` as the ticker
                // so the primary text shows only the symbol and the small caption shows the issuer.
                newOptions.push({
                  type: 'Stocks',
                  label: stock.symbol,
                  matchLabel: formattedName ? `${stock.symbol} ${formattedName}` : stock.symbol,
                  value: stock.symbol,
                  subLabel: formattedName || 'Stock Ticker'
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
      // newValue.value is just the ticker (e.g., "ORCL")
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
      </List>
    </Box>
  );

  return (
    <>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid #27272a' }}>
        <Container maxWidth="xl">
          <Toolbar disableGutters sx={{ justifyContent: 'space-between', gap: 2 }}>
            
            <RouterLink to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', minWidth: 'fit-content' }}>
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

            <Box sx={{ flexGrow: 1, maxWidth: 600, display: { xs: 'none', md: 'block' } }}>
              <Autocomplete
                freeSolo
                id="global-search"
                disableClearable
                options={options}
                groupBy={(option) => option.type}
                getOptionLabel={(option) => (typeof option === 'string' ? option : option.matchLabel || option.label)}
                loading={loading}
                onInputChange={(event, newInputValue) => {
                  setInputValue(newInputValue);
                }}
                onChange={handleSearchSelect}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder="Search funds (Bridgewater) or stocks (Oracle)..."
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
                            <Typography variant="body2" sx={{ fontWeight: 500, color: 'white' }}>
                                {option.label}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#71717a' }}>
                                {option.subLabel}
                            </Typography>
                        </Box>
                    </Box>
                )}
                sx={{
                    '& .MuiAutocomplete-listbox': {
                        bgcolor: '#09090b',
                        border: '1px solid #27272a',
                        color: 'white',
                    },
                    '& .MuiAutocomplete-groupLabel': {
                        bgcolor: '#18181b',
                        color: '#a1a1aa',
                    }
                }}
              />
            </Box>

            {!isMobile && (
              <Box sx={{ display: 'flex', gap: 1, minWidth: 'fit-content' }}>
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

            {isMobile && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <IconButton
                    component={RouterLink} 
                    to="/search"
                    sx={{ color: '#a1a1aa' }}
                >
                    <SearchIcon />
                </IconButton>
                <IconButton
                    color="inherit"
                    aria-label="open drawer"
                    edge="start"
                    onClick={handleDrawerToggle}
                    sx={{ color: '#a1a1aa' }}
                >
                    <MenuIcon />
                </IconButton>
              </Box>
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