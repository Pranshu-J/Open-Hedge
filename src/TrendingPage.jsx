import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { formatCurrency, formatNumber } from './utils';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, Container, Fade, 
  Breadcrumbs, Link, IconButton, Collapse, Chip, CircularProgress, 
  Grid, Tooltip 
} from '@mui/material';
import { 
  KeyboardArrowDown, KeyboardArrowUp, TrendingUp, 
  Groups, AttachMoney 
} from '@mui/icons-material';
import theme from './theme';

const BATCH_SIZE = 20;

// --- Sub-Component: Expandable Row ---
const TrendingRow = ({ row, isLast, lastElementRef }) => {
  const [open, setOpen] = useState(false);

  // Parse details safely
  const details = typeof row.investor_details === 'string' 
    ? JSON.parse(row.investor_details) 
    : row.investor_details || [];

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
        <TableCell component="th" scope="row">
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
        <TableCell align="right">
            <Chip 
                label={`+${row.new_buyers_count}`} 
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
        <TableCell align="right" sx={{ color: '#4ade80', fontFamily: theme.typography.fontFamilyMono }}>
          {formatCurrency(row.total_value_usd)}
        </TableCell>
        <TableCell align="right" sx={{ color: '#a1a1aa', fontFamily: theme.typography.fontFamilyMono }}>
          {formatNumber(row.total_shares_bought)}
        </TableCell>
      </TableRow>
      
      {/* Collapsible Detail Section */}
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0, borderBottom: open ? '1px solid #27272a' : 'none' }} colSpan={6}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 3, ml: 8, p: 2, bgcolor: '#09090b', border: '1px solid #27272a', borderRadius: 1 }}>
              <Typography variant="caption" gutterBottom component="div" sx={{ color: '#71717a', mb: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Institutions Accumulating {row.symbol}
              </Typography>
              <Table size="small" aria-label="purchases">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>Fund Name</TableCell>
                    <TableCell align="right" sx={{ color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>Shares Added</TableCell>
                    <TableCell align="right" sx={{ color: '#a1a1aa', borderBottom: '1px solid #27272a' }}>Allocated Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {details.map((detail, index) => {
                    // FIX: Prioritize 'shares_held' as requested
                    const shareCount = detail.shares_held || detail.shares || 0;
                    const valueAmount = detail.value || detail.value_usd || 0;
                    const fundName = detail.institution || detail.company_name || 'Unknown Fund';

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
                        <TableCell align="right" sx={{ color: '#d4d4d8', fontFamily: theme.typography.fontFamilyMono }}>
                            {formatNumber(shareCount)}
                        </TableCell>
                        <TableCell align="right" sx={{ color: '#d4d4d8', fontFamily: theme.typography.fontFamilyMono }}>
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

  // -- SORT STATE --
  const [sortConfig, setSortConfig] = useState({ key: 'new_buyers_count', direction: 'desc' });

  // Observer for Infinite Scroll
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

  // -- Handlers --
  const handleSort = (key) => {
    setSortConfig(prev => {
      const isSameKey = prev.key === key;
      return {
        key,
        direction: isSameKey && prev.direction === 'desc' ? 'asc' : 'desc'
      };
    });
    // Reset Data on Sort Change
    setPage(0);
    setTrendingData([]); 
    setHasMore(true);
  };

  // -- Reusable Sort Header Component (Matched to FundsList style) --
  const SortHeader = ({ label, sortKey, align = "right", tooltip }) => {
    const content = (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: (align === 'left' ? 'flex-start' : 'flex-end'), gap: 0.5 }}>
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
          backgroundColor: '#09090b', 
          color: '#71717a', 
          cursor: 'pointer',
          '&:hover': { color: 'white' },
          borderBottom: '1px solid #27272a',
          whiteSpace: 'nowrap',
          userSelect: 'none',
          transition: 'color 0.2s'
        }}
      >
        {tooltip ? (
           <Tooltip title={tooltip} arrow>
             {content}
           </Tooltip>
        ) : content}
      </TableCell>
    );
  };

  // -- Fetch Logic --
  useEffect(() => {
    const fetchTrendingBatch = async () => {
      try {
        if (page === 0) setLoading(true);
        else setLoadingMore(true);

        const rangeStart = page * BATCH_SIZE;
        const rangeEnd = rangeStart + BATCH_SIZE - 1;

        let query = supabase
          .from('trending_tickers')
          .select('*');

        // Apply Dynamic Sort
        query = query.order(sortConfig.key, { ascending: sortConfig.direction === 'asc' });
        
        // Secondary sort for consistent pagination
        if (sortConfig.key !== 'symbol') {
             query = query.order('symbol', { ascending: true });
        }

        query = query.range(rangeStart, rangeEnd);

        const { data, error } = await query;

        if (error) throw error;

        if (data && data.length > 0) {
          setTrendingData(prev => {
             // If page 0, replace entirely. If not, append.
             if (page === 0) return data;

             // Prevent duplicates
             const existingIds = new Set(prev.map(p => p.symbol));
             const newItems = data.filter(d => !existingIds.has(d.symbol));
             return [...prev, ...newItems];
          });
          
          if (data.length < BATCH_SIZE) setHasMore(false);
        } else {
          setHasMore(false);
          // If page 0 and no data, ensure we clear the list
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
  }, [page, sortConfig]); // Re-run when page OR sort changes

  return (
    <Fade in={true} timeout={800}>
      <Container maxWidth="lg" sx={{ pt: 5, pb: 10 }}>
        
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 2, color: '#71717a' }}>
             <Link component={RouterLink} to="/" color="inherit" underline="hover">Home</Link>
             <Typography color="white">Smart Money Flow</Typography>
        </Breadcrumbs>

        {/* Header Section */}
        <Box sx={{ mb: 6 }}>
          <Typography variant="h3" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>
            Institutional Accumulation
          </Typography>
          <Typography variant="body1" sx={{ color: '#a1a1aa', maxWidth: '600px' }}>
            Identifying stocks with the highest velocity of new institutional buyers this quarter.
            Expand rows to see exactly who is buying.
          </Typography>
        </Box>

        {/* Stats Grid (Top Data only - only show if default sort is active for relevance) */}
        {!loading && trendingData.length > 0 && sortConfig.key === 'new_buyers_count' && (
            <Grid container spacing={2} sx={{ mb: 4 }}>
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, bgcolor: '#09090b', border: '1px solid #27272a' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <TrendingUp sx={{ color: '#4ade80' }} />
                            <Typography variant="caption" sx={{ color: '#71717a', textTransform: 'uppercase' }}>Most Accumulation</Typography>
                        </Box>
                        <Typography variant="h5" sx={{ color: '#fff', fontWeight: 600 }}>{trendingData[0].symbol}</Typography>
                        <Typography variant="body2" sx={{ color: '#a1a1aa' }}>
                            {trendingData[0].new_buyers_count} New Funds
                        </Typography>
                    </Paper>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Paper sx={{ p: 3, bgcolor: '#09090b', border: '1px solid #27272a' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                            <AttachMoney sx={{ color: '#60a5fa' }} />
                            <Typography variant="caption" sx={{ color: '#71717a', textTransform: 'uppercase' }}>Highest Inflow</Typography>
                        </Box>
                        {(() => {
                            // Simple client-side check for top value in loaded data
                            const topVal = [...trendingData].sort((a,b) => b.total_value_usd - a.total_value_usd)[0];
                            return (
                                <>
                                    <Typography variant="h5" sx={{ color: '#fff', fontWeight: 600 }}>{topVal?.symbol}</Typography>
                                    <Typography variant="body2" sx={{ color: '#a1a1aa' }}>
                                        {formatCurrency(topVal?.total_value_usd)} Net Inflow
                                    </Typography>
                                </>
                            )
                        })()}
                    </Paper>
                </Grid>
            </Grid>
        )}

        {/* Main Data Table */}
        <Paper sx={{ width: '100%', overflow: 'hidden', border: '1px solid #27272a', bgcolor: '#000' }}>
          <TableContainer sx={{ maxHeight: '80vh' }}>
            <Table stickyHeader aria-label="collapsible table">
              <TableHead>
                <TableRow>
                  <TableCell width={50} sx={{ bgcolor: '#09090b', borderBottom: '1px solid #27272a' }} />
                  
                  {/* Sortable Headers */}
                  <SortHeader label="TICKER" sortKey="symbol" align="left" />
                  
                  <SortHeader 
                    label="NEW BUYERS" 
                    sortKey="new_buyers_count" 
                    tooltip="Number of funds that opened a NEW position"
                  />
                  
                  <SortHeader label="NET INFLOW ($)" sortKey="total_value_usd" />
                  
                  <SortHeader label="SHARES BOUGHT" sortKey="total_shares_bought" />

                </TableRow>
              </TableHead>
              <TableBody>
                {/* Initial Loading State */}
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
                
                {/* Infinite Scroll Loading State */}
                {loadingMore && (
                  <TableRow>
                     <TableCell colSpan={5} align="center" sx={{ py: 2 }}>
                        <CircularProgress size={20} color="inherit" />
                     </TableCell>
                  </TableRow>
                )}

                {/* Empty State */}
                {!loading && trendingData.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 8, color: '#71717a' }}>
                            No trending data found.
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