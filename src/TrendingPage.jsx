import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { formatCurrency, formatNumber } from './utils';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Container, Fade, 
  Breadcrumbs, Link, IconButton, Collapse, Chip, CircularProgress, 
  Grid, Tooltip, TextField, InputAdornment 
} from '@mui/material';
import { 
  KeyboardArrowDown, KeyboardArrowUp, TrendingUp, TrendingDown,
  Groups, Search 
} from '@mui/icons-material';
import theme from './theme';

const BATCH_SIZE = 20;

// --- Sub-Component: Expandable Row ---
const TrendingRow = ({ row, isLast, lastElementRef }) => {
  const [open, setOpen] = useState(false);

  // 1. Parse the JSON content
  // We try 'institutions' first if you renamed the column, otherwise fallback to 'investor_details'
  // The JSON structure is now: { "total_value": ..., "institutions": [...], "total_shares": ... }
  let parsedData = {};
  
  try {
    const rawJSON = row.institutions || row.investor_details;
    parsedData = typeof rawJSON === 'string' ? JSON.parse(rawJSON) : (rawJSON || {});
  } catch (e) {
    console.error("Error parsing JSON for row", row.symbol, e);
  }

  // 2. Extract Data from JSON (Display Values)
  const institutionList = parsedData.institutions || [];
  const displayTotalValue = parsedData.total_value || 0;
  const displayTotalShares = parsedData.total_shares || 0;

  // 3. Active Count (Filter out zero shares)
  const activeCount = institutionList.filter(d => (d.shares || 0) !== 0).length;

  // Determine sentiment color based on the JSON value
  const isPositive = displayTotalValue >= 0;
  const valueColor = isPositive ? '#4ade80' : '#ef4444'; 

  return (
    <>
      <TableRow 
        ref={isLast ? lastElementRef : null}
        sx={{ '& > *': { borderBottom: 'unset' }, '&:hover': { bgcolor: '#18181b' } }}
      >
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={() => setOpen(!open)}
            sx={{ color: '#71717a' }}
          >
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell component="th" scope="row" align="center">
          <Link 
            component={RouterLink} 
            to={`/stocks/${row.symbol}`} 
            sx={{ 
              color: '#fff', 
              fontWeight: 700, 
              textDecoration: 'none', 
              fontSize: '1.1rem',
              '&:hover': { color: '#60a5fa' }
            }}
          >
            {row.symbol}
          </Link>
        </TableCell>
        <TableCell align="center">
            <Chip 
                label={activeCount} 
                size="small"
                icon={<Groups style={{ fontSize: 14, color: '#000' }} />}
                sx={{ 
                    bgcolor: '#fff', 
                    color: '#000', 
                    fontWeight: 700,
                    borderRadius: 1
                }} 
            />
        </TableCell>
        {/* DISPLAY: Use value from JSON */}
        <TableCell align="center" sx={{ color: valueColor, fontFamily: theme.typography.fontFamilyMono }}>
          {formatCurrency(displayTotalValue)}
        </TableCell>
        {/* DISPLAY: Use shares from JSON */}
        <TableCell align="center" sx={{ color: '#a1a1aa', fontFamily: theme.typography.fontFamilyMono }}>
          {formatNumber(displayTotalShares)}
        </TableCell>
      </TableRow>
      
      {/* Collapsible Detail Section */}
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0, borderBottom: open ? '1px solid #27272a' : 'none' }} colSpan={6}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 3, ml: 8, p: 2, bgcolor: '#09090b', border: '1px solid #27272a', borderRadius: 1 }}>
              <Typography variant="caption" gutterBottom component="div" sx={{ color: '#71717a', mb: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Institutional Activity for {row.symbol}
              </Typography>
              <Table size="small" aria-label="purchases">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>Fund Name</TableCell>
                    <TableCell align="center" sx={{ color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>Shares Change</TableCell>
                    <TableCell align="center" sx={{ color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>Value Change</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {institutionList
                    .filter(detail => (detail.shares || 0) !== 0)
                    .sort((a, b) => (b.shares || 0) - (a.shares || 0))
                    .map((detail, index) => {
                      const shareCount = detail.shares || 0;
                      const valueAmount = detail.value || 0;
                      const fundName = detail.institution || 'Unknown Fund';
                      
                      const isInnerNegative = shareCount < 0;
                      const innerColor = isInnerNegative ? '#f87171' : '#d4d4d8'; 

                      return (
                        <TableRow key={index} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                          <TableCell component="th" scope="row" sx={{ color: '#fff' }}>
                            <Link 
                                component={RouterLink} 
                                to={fundName !== 'Unknown Fund' ? `/fund/${encodeURIComponent(fundName.replace(/ /g, '-'))}` : '#'}
                                sx={{ color: '#e4e4e7', textDecoration: 'none', '&:hover': { color: '#60a5fa', textDecoration: 'underline' } }}
                            >
                                {fundName}
                            </Link>
                          </TableCell>
                        <TableCell align="center" sx={{ color: innerColor, fontFamily: theme.typography.fontFamilyMono }}>
                              {formatNumber(shareCount)}
                        </TableCell>
                        <TableCell align="center" sx={{ color: innerColor, fontFamily: theme.typography.fontFamilyMono }}>
                              {formatCurrency(valueAmount)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

// --- Main Page Component ---
export default function TrendingPage() {
  const [trendingData, setTrendingData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState(''); 

  // CRITICAL FIX: Sort by the DATABASE column 'total_value_usd', NOT the JSON key 'total_value'
  const [sortConfig, setSortConfig] = useState({ key: 'total_value_usd', direction: 'desc' });
  const observer = useRef();
  
  const lastElementRef = useCallback(node => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, hasMore]);

  const handleSort = (key) => {
    setSortConfig(prev => {
      const isSameKey = prev.key === key;
      return { key, direction: isSameKey && prev.direction === 'desc' ? 'asc' : 'desc' };
    });
    resetData();
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value.toUpperCase());
    resetData();
  };

  const resetData = () => {
    setPage(0);
    setTrendingData([]); 
    setHasMore(true);
  };

  const SortHeader = ({ label, sortKey, align = "right", tooltip }) => {
    let justifyContent = 'flex-end';
    if (align === 'left') justifyContent = 'flex-start';
    if (align === 'center') justifyContent = 'center';

    const content = (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: justifyContent, gap: 0.5 }}>
        {label}
        <Typography variant="caption" sx={{ fontSize: '0.6rem', opacity: sortConfig.key === sortKey ? 1 : 0.3 }}>
          {sortConfig.key === sortKey ? (sortConfig.direction === 'desc' ? '▼' : '▲') : '▼'}
        </Typography>
      </Box>
    );

    return (
      <TableCell 
        align={align}
        onClick={() => handleSort(sortKey)}
        sx={{ 
          backgroundColor: '#09090b', color: '#71717a', cursor: 'pointer',
          '&:hover': { color: 'white' }, borderBottom: '1px solid #27272a',
          whiteSpace: 'nowrap', userSelect: 'none', transition: 'color 0.2s'
        }}
      >
        {tooltip ? <Tooltip title={tooltip} arrow>{content}</Tooltip> : content}
      </TableCell>
    );
  };

  useEffect(() => {
    const fetchTrendingBatch = async () => {
      try {
        if (page === 0) setLoading(true);
        else setLoadingMore(true);

        const rangeStart = page * BATCH_SIZE;
        const rangeEnd = rangeStart + BATCH_SIZE - 1;

        let query = supabase.from('trending_tickers').select('*');

        if (searchTerm) {
          query = query.ilike('symbol', `%${searchTerm}%`);
        }

        // Apply Server-Side Sort
        // Note: This must use a REAL database column. 
        query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' });
        
        if (sortConfig.key !== 'symbol') {
             query = query.order('symbol', { ascending: true });
        }

        query = query.range(rangeStart, rangeEnd);
        const { data, error } = await query;

        if (error) throw error;

        if (data && data.length > 0) {
          setTrendingData(prev => {
             if (page === 0) return data;
             const existingIds = new Set(prev.map(p => p.symbol));
             const newItems = data.filter(d => !existingIds.has(d.symbol));
             return [...prev, ...newItems];
          });
          if (data.length < BATCH_SIZE) setHasMore(false);
        } else {
          setHasMore(false);
          if (page === 0) setTrendingData([]);
        }
      } catch (err) {
        console.error('Error fetching trending data:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    };

    fetchTrendingBatch();
  }, [page, sortConfig, searchTerm]);

  // Helper to get stats safely from the JSON data
  const getStats = () => {
    if (!trendingData || trendingData.length === 0) return { maxInflow: null, maxOutflow: null };
    
    // We sort manually here to find the Max/Min for the Cards at the top
    const sortedByValue = [...trendingData].sort((a, b) => {
        // Parse JSON safely for sorting local stats
        const getVal = (row) => {
            try {
                const json = typeof row.investor_details === 'string' ? JSON.parse(row.investor_details) : (row.investor_details || {});
                return json.total_value || 0;
            } catch { return 0; }
        };
        return getVal(b) - getVal(a);
    });

    return { maxInflow: sortedByValue[0], maxOutflow: sortedByValue[sortedByValue.length - 1] };
  };

  const { maxInflow, maxOutflow } = getStats();

  // Helper to extract value safely for the Top Cards
  const getCardValue = (row) => {
     try {
         const json = typeof row.investor_details === 'string' ? JSON.parse(row.investor_details) : (row.investor_details || {});
         return json.total_value || 0;
     } catch { return 0; }
  };

  return (
    <Fade in={true} timeout={800}>
      <Container maxWidth="lg" sx={{ pt: 5, pb: 10 }}>
        
        <Breadcrumbs sx={{ mb: 2, color: '#71717a' }}>
             <Link component={RouterLink} to="/" color="inherit" underline="hover">Home</Link>
             <Typography color="white">Smart Money Flow</Typography>
        </Breadcrumbs>

        <Box sx={{ mb: 6, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: 'flex-start', gap: 3 }}>
          <Box>
            <Typography variant="h3" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>
              Institutional Flows
            </Typography>
            <Typography variant="body1" sx={{ color: '#a1a1aa', maxWidth: '600px' }}>
              Identifying stocks with the highest velocity of institutional movement.
            </Typography>
          </Box>

          <TextField
            placeholder="Search Ticker..."
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={handleSearchChange}
            sx={{
              width: { xs: '100%', md: '250px' },
              bgcolor: '#09090b',
              borderRadius: 1,
              '& .MuiOutlinedInput-root': {
                color: 'white',
                '& fieldset': { borderColor: '#27272a' },
                '&:hover fieldset': { borderColor: '#3f3f46' },
                '&.Mui-focused fieldset': { borderColor: '#60a5fa' },
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: '#71717a', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {!loading && trendingData.length > 0 && !searchTerm && (
            <Grid container spacing={2} sx={{ mb: 4 }}>
                {maxInflow && getCardValue(maxInflow) > 0 && (
                    <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 3, bgcolor: '#09090b', border: '1px solid #27272a' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <TrendingUp sx={{ color: '#4ade80' }} />
                                <Typography variant="caption" sx={{ color: '#71717a', textTransform: 'uppercase' }}>Highest Inflow</Typography>
                            </Box>
                            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 600 }}>{maxInflow.symbol}</Typography>
                            <Typography variant="body2" sx={{ color: '#4ade80' }}>
                                +{formatCurrency(getCardValue(maxInflow))} Net Buy
                            </Typography>
                        </Paper>
                    </Grid>
                )}
                {maxOutflow && getCardValue(maxOutflow) < 0 && (
                    <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 3, bgcolor: '#09090b', border: '1px solid #27272a' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <TrendingDown sx={{ color: '#ef4444' }} />
                                <Typography variant="caption" sx={{ color: '#71717a', textTransform: 'uppercase' }}>Highest Outflow</Typography>
                            </Box>
                            <Typography variant="h5" sx={{ color: '#fff', fontWeight: 600 }}>{maxOutflow.symbol}</Typography>
                            <Typography variant="body2" sx={{ color: '#ef4444' }}>
                                {formatCurrency(getCardValue(maxOutflow))} Net Sell
                            </Typography>
                        </Paper>
                    </Grid>
                )}
            </Grid>
        )}

        <Paper sx={{ width: '100%', overflow: 'hidden', border: '1px solid #27272a', bgcolor: '#000' }}>
          <TableContainer sx={{ maxHeight: '80vh' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell width={50} sx={{ bgcolor: '#09090b', borderBottom: '1px solid #27272a' }} />
                  <SortHeader label="TICKER" sortKey="symbol" align="center" />
                  <SortHeader label="ACTIVE INSTITUTIONS" sortKey="institution_count" align="center" tooltip="Number of funds that changed their position" />
                  
                  {/* CRITICAL FIX: Sort Key is 'total_value_usd' (DB Column), but Label is generic */}
                  <SortHeader label="NET FLOW ($)" sortKey="total_value_usd" align="center" />
                  
                  {/* CRITICAL FIX: Sort Key is 'total_shares_bought' (DB Column) */}
                  <SortHeader label="SHARES BOUGHT" sortKey="total_shares_bought" align="center" />
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && page === 0 ? (
                    <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 10 }}>
                            <CircularProgress color="inherit" />
                        </TableCell>
                    </TableRow>
                ) : (
                    trendingData.map((row, index) => (
                        <TrendingRow 
                            key={row.symbol} 
                            row={row} 
                            isLast={index === trendingData.length - 1}
                            lastElementRef={lastElementRef}
                        />
                    ))
                )}
                
                {loadingMore && (
                  <TableRow>
                     <TableCell colSpan={5} align="center" sx={{ py: 2 }}>
                        <CircularProgress size={20} color="inherit" />
                     </TableCell>
                  </TableRow>
                )}

                {!loading && trendingData.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 8, color: '#71717a' }}>
                            No results found for "{searchTerm}".
                        </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>
    </Fade>
  );
}