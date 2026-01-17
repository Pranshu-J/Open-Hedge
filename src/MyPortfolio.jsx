// MyPortfolio.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  Box, Container, Typography, Paper, Grid, TextField, 
  Button, Table, TableBody, TableCell, TableContainer, 
  TableHead, TableRow, Autocomplete, CircularProgress,
  IconButton, Breadcrumbs, Link, Fade, InputAdornment,
  Tooltip
} from '@mui/material';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon, 
  Lock as LockIcon,
  Login as LoginIcon,
  Search as SearchIcon,
  AttachMoney
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import theme from './theme';

// --- Helper Component: Apple Watch Style Ring ---
const SentimentRing = ({ increased = 0, decreased = 0 }) => {
  const total = increased + decreased;
  const score = total === 0 ? 0 : Math.round((increased / total) * 100);
  
  // Animation State
  const [offset, setOffset] = useState(0);

  // SVG Config
  const size = 45;
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (score / 100) * circumference;

  useEffect(() => {
    // Start at full circumference (empty) and animate to target
    setOffset(circumference);
    const timer = setTimeout(() => {
      setOffset(targetOffset);
    }, 100); // Small delay to ensure transition triggers
    return () => clearTimeout(timer);
  }, [score, circumference, targetOffset]);

  return (
    <Tooltip title={`Increased: ${increased} | Decreased: ${decreased}`} arrow placement="top">
      <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, margin: 'auto', cursor: 'help' }}>
        {/* Score Text */}
        <Typography
          variant="caption"
          component="div"
          sx={{
            position: 'absolute',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '0.7rem',
            fontFamily: theme.typography.fontFamilyMono
          }}
        >
          {score}
        </Typography>

        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background Ring (Red - represents Decreased) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#ef4444" // Red color
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Foreground Ring (Green - represents Increased) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#22c55e" // Green color
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 1.5s ease-out', // Smooth spin animation
              filter: 'drop-shadow(0px 0px 2px rgba(34, 197, 94, 0.5))'
            }}
          />
        </svg>
      </Box>
    </Tooltip>
  );
};

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
      // 1. Fetch User Portfolio from Profile
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('user_details')
        .eq('id', userId)
        .single();

      if (error) throw error;
      
      let items = profileData?.user_details?.portfolio || [];

      // 2. Fetch Institutional Data if items exist
      if (items.length > 0) {
        const symbols = items.map(p => p.symbol);
        
        // Fetch raw JSON from trending_tickers
        const { data: trendData } = await supabase
          .from('trending_tickers')
          .select('symbol, investor_details') 
          .in('symbol', symbols);

        // 3. Process JSON to calculate sentiment
        const sentimentMap = (trendData || []).reduce((acc, curr) => {
          const rawData = curr.investor_details || {};
          const institutionsList = rawData.institutions || [];

          let increasedCount = 0;
          let decreasedCount = 0;

          // Iterate through institutions array
          institutionsList.forEach(inst => {
            if (inst.shares > 0) increasedCount++;
            else if (inst.shares < 0) decreasedCount++;
          });

          acc[curr.symbol] = { increased: increasedCount, decreased: decreasedCount };
          return acc;
        }, {});

        // 4. Merge sentiment into portfolio items
        items = items.map(item => ({
          ...item,
          sentiment: sentimentMap[item.symbol] || { increased: 0, decreased: 0 }
        }));
      }

      setPortfolio(items);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. Search Logic (Smart Sort) ---
  useEffect(() => {
    let active = true;

    // 1. Minimum Character Limit
    if (inputValue.length < 2) {
      setOptions(selectedAsset ? [selectedAsset] : []);
      return;
    }

    const toTitleCase = (str) => {
      if (!str) return '';
      return str.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      );
    };

    const fetchSecurities = async () => {
      setSearchLoading(true);
      try {
        // Call the SQL function directly ("rpc")
        const { data, error } = await supabase
          .rpc('search_tickers', { keyword: inputValue });

        if (error) throw error;

        if (active && data) {
           // No manual sorting or filtering needed anymore!
           const formattedOptions = data.map((stock) => ({
            cusip: stock.cusip,
            symbol: stock.symbol,
            description: toTitleCase(stock.description) || 'Unknown Security',
            label: `${stock.symbol} ${stock.description || ''}`
          }));
          
          // Remove duplicates
          const uniqueOptions = formattedOptions.filter((v, i, a) => 
            a.findIndex(t => (t.symbol === v.symbol)) === i
          );

          setOptions(uniqueOptions);
        }
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setSearchLoading(false);
      }
    };

    const debounce = setTimeout(fetchSecurities, 300);
    return () => { active = false; clearTimeout(debounce); };
  }, [inputValue, selectedAsset]);

  // --- 3. Add / Remove Logic ---
  const handleAddPosition = async () => {
    if (!selectedAsset || !shares || !price || !session) return;
    setSubmitting(true);
    try {
      const newEntry = {
        id: crypto.randomUUID(),
        // We store symbol and description for display
        symbol: selectedAsset.symbol,
        name: selectedAsset.description,
        // We can optionally store CUSIP if needed for deep linking later
        cusip: selectedAsset.cusip, 
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
      
      // Re-fetch to get the sentiment data for the new ticker
      await fetchPortfolio(session.user.id);
      
      // Reset Inputs
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
    setPortfolio(updatedPortfolio); // Optimistic UI update

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

        {/* Summary Grid */}
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

        {/* Add Position Form */}
        <Paper sx={{ p: 3, mb: 4, bgcolor: '#09090b', border: '1px solid #27272a' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item size={{ xs: 12, md: 4 }}>
                <Autocomplete
                  options={options}
                  // Ensures React can track unique items correctly
                  loading={searchLoading}
                  getOptionLabel={(option) => option.symbol}
                  isOptionEqualToValue={(option, value) => option.symbol === value.symbol}
                  filterOptions={(x) => x} 
                  value={selectedAsset}
                  onChange={(e, v) => setSelectedAsset(v)}
                  onInputChange={(e, v) => setInputValue(v)}
                  noOptionsText={inputValue.length < 2 ? "Type to search..." : "No securities found"}
                  renderInput={(params) => (
                    <TextField 
                      {...params} 
                      placeholder="Search Ticker (e.g. AAPL)" 
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
                    <Box component="li" {...props} key={option.cusip || option.symbol} sx={{ bgcolor: '#09090b !important', color: 'white', '&:hover': { bgcolor: '#18181b !important' }, borderBottom: '1px solid #18181b' }}>
                        <Box sx={{ width: '100%' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#fff' }}>{option.symbol}</Typography>
                                {/* Optional: Show CUSIP in tooltip or small text if relevant for debugging */}
                            </Box>
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

        {/* Portfolio Table */}
        <Paper sx={{ width: '100%', overflow: 'hidden', border: '1px solid #27272a', borderRadius: 0 }}>
          <TableContainer sx={{ maxHeight: 800 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ bgcolor: '#000', color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>Ticker</TableCell>
                  <TableCell sx={{ bgcolor: '#000', color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>Company</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#000', color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>Inst. Sentiment</TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#000', color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>Shares</TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#000', color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>Avg Price</TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#000', color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>Total Cost</TableCell>
                  <TableCell align="right" sx={{ bgcolor: '#000', color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {portfolio.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={7} align="center" sx={{ py: 8, color: '#52525b' }}>
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
                        
                        {/* Sentiment Ring Column */}
                        <TableCell align="center">
                          <SentimentRing 
                            increased={row.sentiment?.increased || 0} 
                            decreased={row.sentiment?.decreased || 0} 
                          />
                        </TableCell>

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