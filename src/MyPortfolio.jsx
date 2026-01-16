// MyPortfolio.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  Box, Container, Typography, Paper, Grid, TextField, 
  Button, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Autocomplete, CircularProgress,
  IconButton, Breadcrumbs, Link, Fade, InputAdornment
} from '@mui/material';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon, 
  PieChart as PieChartIcon, 
  Lock as LockIcon,
  Login as LoginIcon,
  Search as SearchIcon,
  AttachMoney
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import theme from './theme'; // Using your theme for font consistency

export default function MyPortfolio() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [portfolio, setPortfolio] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  // Search State
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  
  // Input State
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');

  // --- 1. Auth & Data ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchPortfolio(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchPortfolio(session.user.id);
      else {
        setPortfolio([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchPortfolio = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_details')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setPortfolio(data?.user_details?.portfolio || []);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. Search Logic ---
  useEffect(() => {
    let active = true;
    if (inputValue === '') {
      setOptions([]);
      return;
    }

    const fetchSecurities = async () => {
      setSearchLoading(true);
      try {
        const { data } = await supabase
          .from('securities_reference')
          .select('symbol, description')
          .or(`symbol.ilike.%${inputValue}%,description.ilike.%${inputValue}%`)
          .limit(10);

        if (active && data) setOptions(data);
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setSearchLoading(false);
      }
    };

    const debounce = setTimeout(fetchSecurities, 300);
    return () => { active = false; clearTimeout(debounce); };
  }, [inputValue]);

  // --- 3. Add / Remove Logic ---
  const handleAddPosition = async () => {
    if (!selectedAsset || !shares || !price || !session) return;
    setSubmitting(true);
    try {
      const newEntry = {
        id: crypto.randomUUID(),
        symbol: selectedAsset.symbol,
        name: selectedAsset.description,
        shares: parseFloat(shares),
        avg_price: parseFloat(price),
        date_added: new Date().toISOString()
      };

      const { data: currentData } = await supabase
        .from('profiles').select('user_details').eq('id', session.user.id).single();

      const currentDetails = currentData?.user_details || {};
      const updatedPortfolio = [...(currentDetails.portfolio || []), newEntry];

      const { error } = await supabase
        .from('profiles')
        .update({ user_details: { ...currentDetails, portfolio: updatedPortfolio } })
        .eq('id', session.user.id);

      if (error) throw error;
      setPortfolio(updatedPortfolio);
      
      // Reset
      setSelectedAsset(null);
      setShares('');
      setPrice('');
      setInputValue('');
    } catch (error) {
      console.error("Error adding:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (entryId) => {
    const updatedPortfolio = portfolio.filter(p => p.id !== entryId);
    setPortfolio(updatedPortfolio); // Optimistic

    const { data: currentData } = await supabase
      .from('profiles').select('user_details').eq('id', session.user.id).single();

    await supabase
      .from('profiles')
      .update({ user_details: { ...currentData.user_details, portfolio: updatedPortfolio } })
      .eq('id', session.user.id);
  };

  // --- 4. Render Helpers ---
  const totalValue = portfolio.reduce((acc, curr) => acc + (curr.shares * curr.avg_price), 0);
  
  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  if (loading) return <Box sx={{ minHeight: '80vh', display: 'flex', justifyContent: 'center', alignItems: 'center', bgcolor: '#000' }}><CircularProgress /></Box>;

  // Not Logged In
  if (!session) {
    return (
      <Box sx={{ bgcolor: '#000', minHeight: '90vh', pt: 10, px: 2 }}>
        <Container maxWidth="sm">
          <Paper sx={{ p: 6, textAlign: 'center', bgcolor: '#09090b', border: '1px solid #27272a', borderRadius: 2 }}>
            <LockIcon sx={{ fontSize: 60, color: '#71717a', mb: 2 }} />
            <Typography variant="h4" gutterBottom sx={{ color: 'white', fontWeight: 700 }}>Portfolio Tracking</Typography>
            <Typography variant="body1" sx={{ color: '#a1a1aa', mb: 4 }}>
              Sign in to build your watchlist and track position performance.
            </Typography>
            <Button variant="contained" startIcon={<LoginIcon />} onClick={() => navigate('/login')} sx={{ bgcolor: 'white', color: 'black', fontWeight: 600, '&:hover': { bgcolor: '#e4e4e7' } }}>
              Log In
            </Button>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Fade in={true} timeout={500}>
      <Container maxWidth="lg" sx={{ mt: 5, pb: 10 }}>
        
        {/* Header Section */}
        <Breadcrumbs sx={{ mb: 2, color: '#71717a' }}>
            <Link component={RouterLink} to="/" color="inherit" underline="hover">Home</Link>
            <Typography color="white">My Portfolio</Typography>
        </Breadcrumbs>

        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
          <Typography variant="h4" sx={{ fontWeight: 500, color: 'white' }}>My Portfolio</Typography>
        </Box>

        {/* Summary Grid (Matches Dashboard Style) */}
        <Grid container spacing={0} sx={{ mb: 4, border: '1px solid #27272a' }}>
          <Grid item size={{ xs: 12, md: 6 }} sx={{ borderRight: { md: '1px solid #27272a' }, borderBottom: { xs: '1px solid #27272a', md: 'none' }, p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="overline" color="text.secondary" sx={{ mb: 1 }}>Position Size</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AttachMoney sx={{ color: '#52525b' }} />
              <Typography variant="h4" sx={{ fontFamily: theme.typography.fontFamilyMono, color: 'white' }}>
                 {formatCurrency(totalValue).replace('$', '')}
              </Typography>
            </Box>
          </Grid>
          
          <Grid item size={{ xs: 12, md: 6 }} sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="overline" color="text.secondary" sx={{ mb: 1 }}>Positions Held</Typography>
            <Typography variant="h4" sx={{ fontFamily: theme.typography.fontFamilyMono, color: 'white' }}>
              {portfolio.length}
            </Typography>
          </Grid>
        </Grid>

        {/* Add Position Form - Styled like a Toolbar */}
        <Paper sx={{ p: 3, mb: 4, bgcolor: '#09090b', border: '1px solid #27272a' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item size={{ xs: 12, md: 4 }}>
                <Autocomplete
                  options={options}
                  loading={searchLoading}
                  getOptionLabel={(option) => `${option.symbol} - ${option.description}`}
                  filterOptions={(x) => x} 
                  value={selectedAsset}
                  onChange={(e, v) => setSelectedAsset(v)}
                  onInputChange={(e, v) => setInputValue(v)}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      placeholder="Search Ticker to Add..." 
                      size="small"
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                            <InputAdornment position="start">
                              <SearchIcon sx={{ color: '#71717a' }} />
                            </InputAdornment>
                        ),
                        sx: { 
                           bgcolor: '#000', color: 'white', fontFamily: theme.typography.fontFamilyMono,
                           '& fieldset': { borderColor: '#27272a' },
                        }
                      }}
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props} sx={{ bgcolor: '#09090b !important', color: 'white', '&:hover': { bgcolor: '#18181b !important' } }}>
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{option.symbol}</Typography>
                            <Typography variant="caption" sx={{ color: '#a1a1aa' }}>{option.description}</Typography>
                        </Box>
                    </Box>
                  )}
                />
              </Grid>
              <Grid item size={{ xs: 6, md: 3 }}>
                 <TextField 
                    placeholder="Shares"
                    type="number"
                    size="small"
                    value={shares}
                    onChange={(e) => setShares(e.target.value)}
                    InputProps={{ sx: { bgcolor: '#000', color: 'white', fontFamily: theme.typography.fontFamilyMono, '& fieldset': { borderColor: '#27272a' } } }}
                    fullWidth
                 />
              </Grid>
              <Grid item size={{ xs: 6, md: 3 }}>
                 <TextField 
                    placeholder="Average Price"
                    type="number"
                    size="small"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    InputProps={{ 
                        startAdornment: <InputAdornment position="start"><Typography sx={{ color: '#52525b' }}>$</Typography></InputAdornment>,
                        sx: { bgcolor: '#000', color: 'white', fontFamily: theme.typography.fontFamilyMono, '& fieldset': { borderColor: '#27272a' } } 
                    }}
                    fullWidth
                 />
              </Grid>
              <Grid item size={{ xs: 12, md: 2 }}>
                 <Button 
                   fullWidth 
                   variant="contained" 
                   onClick={handleAddPosition}
                   disabled={!selectedAsset || !shares || !price || submitting}
                   startIcon={submitting ? <CircularProgress size={16} color="inherit"/> : <AddIcon />}
                   sx={{ bgcolor: 'white', color: 'black', fontWeight: 600, '&:hover': { bgcolor: '#e4e4e7' }, '&.Mui-disabled': { bgcolor: '#27272a', color: '#52525b' } }}
                 >
                    Add
                 </Button>
              </Grid>
            </Grid>
        </Paper>

        {/* Portfolio Table (Matches Dashboard Table) */}
        <Paper sx={{ width: '100%', overflow: 'hidden', border: '1px solid #27272a', borderRadius: 0 }}>
          <TableContainer sx={{ maxHeight: 800 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: '#000', color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>Ticker</TableCell>
                  <TableCell sx={{ bgcolor: '#000', color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>Company</TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#000', color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>Shares</TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#000', color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>Avg Price</TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#000', color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>Total Cost</TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#000', color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {portfolio.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={6} align="center" sx={{ py: 8, color: '#52525b' }}>
                            Your portfolio is empty. Add a position above.
                        </TableCell>
                    </TableRow>
                ) : (
                    portfolio.map((row) => (
                      <TableRow key={row.id} hover sx={{ '&:hover': { backgroundColor: '#18181b !important' } }}>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>
                             <Link component={RouterLink} to={`/stocks/${row.symbol}`} sx={{ color: 'white', textDecoration: 'none', borderBottom: '1px dotted #52525b', '&:hover': { color: '#60a5fa' } }}>
                                {row.symbol}
                             </Link>
                        </TableCell>
                        <TableCell sx={{ color: '#a1a1aa' }}>{row.name}</TableCell>
                        <TableCell align="right" sx={{ color: '#d4d4d8', fontFamily: theme.typography.fontFamilyMono }}>{row.shares}</TableCell>
                        <TableCell align="right" sx={{ color: '#d4d4d8', fontFamily: theme.typography.fontFamilyMono }}>${row.avg_price.toFixed(2)}</TableCell>
                        <TableCell align="right" sx={{ color: '#fff', fontWeight: 600, fontFamily: theme.typography.fontFamilyMono }}>
                            {formatCurrency(row.shares * row.avg_price)}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton onClick={() => handleRemove(row.id)} sx={{ color: '#52525b', '&:hover': { color: '#ef4444' } }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>
    </Fade>
  );
}