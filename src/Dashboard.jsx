// Dashboard.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { formatCurrency, formatNumber, formatPercent } from './utils';
import { 
  Box, Typography, Paper, Grid, Select, MenuItem, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, Link, CircularProgress, 
  Fade, Container, Breadcrumbs
} from '@mui/material';
import { TrendingUp, TrendingDown, CalendarToday } from '@mui/icons-material';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';
import theme from './theme';

// Constants
const ITEMS_PER_PAGE = 50;

const formatLargeCurrency = (value) => {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value}`;
};

export default function Dashboard() {
  const { companyName } = useParams();
  const decodedCompany = decodeURIComponent(companyName).replace(/-/g, ' ');

  // Fund History State
  const [fundHistory, setFundHistory] = useState([]);
  const [selectedFundId, setSelectedFundId] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Holdings Data State
  const [holdings, setHoldings] = useState([]);
  const [valuations, setValuations] = useState([]);
  const [prevHoldingsMap, setPrevHoldingsMap] = useState({}); 
  const [hasPrevFund, setHasPrevFund] = useState(false);
  const [totalFundValue, setTotalFundValue] = useState(0); // Needed for weight calc

  // Pagination & Sorting State
  const [loadingHoldings, setLoadingHoldings] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'value_usd', direction: 'desc' });

  // Infinite Scroll Observer
  const observer = useRef();
  const lastHoldingElementRef = useCallback(node => {
    if (loadingHoldings) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loadingHoldings, hasMore]);

  // 1. Fetch Fund History based on URL param
  useEffect(() => {
    const fetchHistory = async () => {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('funds')
        .select('*')
        .eq('company_name', decodedCompany)
        .order('report_date', { ascending: false });

      if (!error && data && data.length > 0) {
        setFundHistory(data);
        setSelectedFundId(data[0].id);
      }
      setLoadingHistory(false);
    };

    if (decodedCompany) {
        fetchHistory();
    }
  }, [decodedCompany]);

  // 2. Fetch "Context" (Valuations, Totals, Previous Fund Map)
  // This runs once when the selected fund changes to prepare the environment.
  useEffect(() => {
    if (!selectedFundId) return;
    
    const fetchContext = async () => {
      setHoldings([]); // Clear current list
      setPage(0);      // Reset page
      setHasMore(true);
      setLoadingHoldings(true);

      const sortedHistory = [...fundHistory].sort((a, b) => 
        new Date(b.report_date) - new Date(a.report_date)
      );
      const currentIndex = sortedHistory.findIndex(f => f.id === parseInt(selectedFundId));
      const prevFund = sortedHistory[currentIndex + 1];

      setHasPrevFund(!!prevFund);

      // A. Fetch Valuations
      const valuationsReq = supabase
        .from('fund_valuations')
        .select('valuation_date, value_usd')
        .eq('fund_id', selectedFundId)
        .order('valuation_date', { ascending: true });

      // B. Fetch Previous Fund (Optimized: only symbols & shares)
      const prevHoldingsReq = prevFund 
        ? supabase
            .from('holdings')
            .select('symbol, shares_count') // Fetch only what's needed for the map
            .eq('fund_id', prevFund.id)
        : Promise.resolve({ data: null });

      // C. Get Total Value for this fund (for weight calc)
      // We can sum the current holdings or use a metadata field if available.
      // Here we assume we sum it, but to avoid fetching all, we use a DB aggregate if possible, 
      // or fallback to the most recent valuation point.
      const totalValueReq = supabase
        .from('holdings') // Quick hack: usually funds table has total_value, using sum here might be slow if not optimized, but better than fetching all rows.
        .select('value_usd')
        .eq('fund_id', selectedFundId);
        
      const [valuationsRes, prevRes, totalRes] = await Promise.all([valuationsReq, prevHoldingsReq, totalValueReq]);

      if (!valuationsRes.error) {
        const formattedVals = valuationsRes.data.map(v => ({
          ...v,
          dateStr: new Date(v.valuation_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value_usd: Number(v.value_usd)
        }));
        setValuations(formattedVals);
      }

      if (prevRes.data) {
        const map = {};
        prevRes.data.forEach(h => { map[h.symbol] = h.shares_count; });
        setPrevHoldingsMap(map);
      } else {
        setPrevHoldingsMap({});
      }

      if (totalRes.data) {
          const sum = totalRes.data.reduce((acc, curr) => acc + (curr.value_usd || 0), 0);
          setTotalFundValue(sum);
      }
      
      // Trigger the first batch fetch
      setLoadingHoldings(false);
    };

    fetchContext();
  }, [selectedFundId, fundHistory]);


  // 3. Fetch Holdings Batch (Triggered by page or sort changes)
  useEffect(() => {
    if (!selectedFundId) return;
    
    const fetchBatch = async () => {
      setLoadingHoldings(true);

      // Map "weight" to "value_usd" for DB sorting
      let sortColumn = sortConfig.key;
      if (sortColumn === 'weight') sortColumn = 'value_usd';
      // If user tries to sort by "change", we default to value_usd because we can't easily sort by diff server-side
      if (sortColumn === 'change') sortColumn = 'value_usd'; 

      const from = page * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error } = await supabase
        .from('holdings')
        .select('*')
        .eq('fund_id', selectedFundId)
        .order(sortColumn, { ascending: sortConfig.direction === 'asc' })
        .range(from, to);

      if (!error && data) {
        setHoldings(prev => {
            // If page 0, replace. If page > 0, append.
            return page === 0 ? data : [...prev, ...data];
        });
        
        // If we got fewer items than requested, we reached the end
        if (data.length < ITEMS_PER_PAGE) {
            setHasMore(false);
        }
      }
      setLoadingHoldings(false);
    };

    fetchBatch();
  }, [selectedFundId, page, sortConfig]);

  // Handle Sort
  const handleSort = (key) => {
    // "Change" is calculated client-side based on previous fund. 
    // Server-side sorting for this is complex. We disable it or reset to default for now.
    if (key === 'change') return; 

    let direction = 'desc'; // Default to high-to-low
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    
    setSortConfig({ key, direction });
    setPage(0); // Reset to first page
    setHasMore(true);
    setHoldings([]); // Clear visuals immediately
  };

  const SortableHeader = ({ label, sortKey, align = "left" }) => (
    <TableCell 
      align={align} 
      sx={{ 
        backgroundColor: '#000', cursor: sortKey === 'change' ? 'default' : 'pointer', userSelect: 'none', '&:hover': { backgroundColor: '#18181b' } 
      }}
      onClick={() => handleSort(sortKey)}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: align === 'center' || align === 'right' ? 'flex-end' : 'flex-start', gap: 0.5 }}>
        {align === 'center' && <span style={{flex: 1}}></span>}
        {label}
        {sortKey !== 'change' && (
            <Box component="span" sx={{ fontSize: '0.65rem', color: '#52525b', display: 'flex', flexDirection: 'column', lineHeight: 0.8 }}>
                <span style={{ color: sortConfig.key === sortKey && sortConfig.direction === 'asc' ? '#fff' : '#52525b' }}>▲</span>
                <span style={{ color: sortConfig.key === sortKey && sortConfig.direction === 'desc' ? '#fff' : '#52525b' }}>▼</span>
            </Box>
        )}
        {align === 'center' && <span style={{flex: 1}}></span>}
      </Box>
    </TableCell>
  );

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <Box sx={{ bgcolor: '#09090b', border: '1px solid #27272a', p: 1.5 }}>
          <Typography variant="caption" sx={{ color: '#a1a1aa', mb: 0.5, display: 'block' }}>{payload[0].payload.valuation_date}</Typography>
          <Typography variant="body2" sx={{ color: '#fff', fontFamily: theme.typography.fontFamilyMono, fontWeight: 600 }}>{formatLargeCurrency(payload[0].value)}</Typography>
        </Box>
      );
    }
    return null;
  };

  if (loadingHistory) return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 10 }}><CircularProgress /></Box>
  );

  if (!fundHistory.length) return (
      <Container sx={{ pt: 10 }}><Typography color="white">Fund not found.</Typography></Container>
  );

  const currentFundData = fundHistory.find(f => f.id === parseInt(selectedFundId)) || fundHistory[0];

  return (
    <Fade in={true} timeout={500}>
      <Container maxWidth="lg" sx={{ mt: 5, pb: 10 }}>
        
        {/* Breadcrumb Navigation */}
        <Breadcrumbs sx={{ mb: 2, color: '#71717a' }}>
             <Link component={RouterLink} to="/funds" color="inherit" underline="hover">Funds</Link>
             <Typography color="white">{decodedCompany}</Typography>
        </Breadcrumbs>

        {/* Header Info */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
          <Typography variant="h4" sx={{ fontWeight: 500, color: 'white' }}>{decodedCompany}</Typography>
          <Link href={currentFundData.source_url} target="_blank" underline="hover" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>Source Filing ↗</Link>
        </Box>

        {/* Stats Grid */}
        <Grid container spacing={0} sx={{ mb: 4, border: '1px solid #27272a' }}>
          <Grid item xs={12} md={4} sx={{ borderRight: { md: '1px solid #27272a' }, borderBottom: { xs: '1px solid #27272a', md: 'none' }, p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="overline" color="text.secondary" sx={{ mb: 1 }}>Report Period</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarToday sx={{ fontSize: 16, color: '#52525b' }} />
              <Select
                value={selectedFundId || ''}
                onChange={(e) => setSelectedFundId(e.target.value)}
                variant="standard"
                disableUnderline
                sx={{ color: 'white', fontFamily: theme.typography.fontFamilyMono, fontSize: '1.25rem', '& .MuiSelect-icon': { color: 'white' } }}
              >
                {[...fundHistory].sort((a, b) => new Date(b.report_date) - new Date(a.report_date)).map(fund => (
                  <MenuItem key={fund.id} value={fund.id}>{fund.report_date}</MenuItem>
                ))}
              </Select>
            </Box>
          </Grid>
           <Grid item xs={12} md={4} sx={{ borderRight: { md: '1px solid #27272a' }, borderBottom: { xs: '1px solid #27272a', md: 'none' }, p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="overline" color="text.secondary" sx={{ mb: 1 }}>Quarterly Return</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {currentFundData.quarterly_return >= 0 ? <TrendingUp sx={{ color: 'white' }} /> : <TrendingDown sx={{ color: 'white' }} />}
              <Typography variant="h5" sx={{ fontFamily: theme.typography.fontFamilyMono, color: 'white' }}>
                  {currentFundData.quarterly_return > 0 ? "+" : ""}{formatPercent(currentFundData.quarterly_return)}
              </Typography>
            </Box>
          </Grid>

          <Grid item xs={12} md={4} sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="overline" color="text.secondary" sx={{ mb: 1 }}>Holdings Count</Typography>
            <Typography variant="h5" sx={{ fontFamily: theme.typography.fontFamilyMono, color: 'white' }}>
              {currentFundData.holdings_count}
            </Typography>
          </Grid>
        </Grid>

        {/* Chart Section */}
        {valuations.length > 0 && (
          <Box sx={{ mb: 6, p: 3, border: '1px solid #27272a', background: 'linear-gradient(180deg, #09090b 0%, #000 100%)' }}>
               <Box sx={{ height: 300 }}>
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={valuations}>
                      <defs>
                        <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ffffff" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                      <XAxis dataKey="dateStr" stroke="#52525b" tick={{ fill: '#52525b', fontSize: 11 }} tickLine={false} axisLine={false} dy={10} />
                      <YAxis domain={['auto', 'auto']} stroke="#52525b" tick={{ fill: '#52525b', fontSize: 11 }} tickFormatter={formatLargeCurrency} tickLine={false} axisLine={false} dx={-10} />
                      <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#52525b', strokeWidth: 1, strokeDasharray: '4 4' }} />
                      <Area type="monotone" dataKey="value_usd" stroke="#ffffff" strokeWidth={2} fillOpacity={1} fill="url(#colorVal)" />
                    </AreaChart>
                 </ResponsiveContainer>
               </Box>
          </Box>
        )}

        {/* Table */}
        <Paper sx={{ width: '100%', overflow: 'hidden' }}>
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <SortableHeader label="Ticker" sortKey="symbol" />
                  <SortableHeader label="Issuer" sortKey="issuer" />
                  <SortableHeader label="Shares" sortKey="shares_count" align="center" />
                  <SortableHeader label="Change" sortKey="change" align="center" />
                  <SortableHeader label="Value" sortKey="value_usd" align="center" />
                  <SortableHeader label="% Port" sortKey="weight" align="center" />
                </TableRow>
              </TableHead>
              <TableBody>
                {holdings.map((holding, index) => {
                    const weight = totalFundValue > 0 ? (holding.value_usd / totalFundValue) * 100 : 0;
                    const prevShares = prevHoldingsMap[holding.symbol];
                    let changeContent = "-"; let changeColor = "#71717a";

                    if (hasPrevFund) {
                        if (prevShares === undefined) { changeContent = "NEW"; changeColor = "#60a5fa"; } 
                        else {
                            const diff = holding.shares_count - prevShares;
                            const percent = prevShares !== 0 ? (diff / prevShares) * 100 : 0;
                            if (diff !== 0) {
                                const isPositive = diff > 0; const sign = isPositive ? "+" : "";
                                changeColor = isPositive ? "#4ade80" : "#f87171";
                                changeContent = `${sign}${formatNumber(diff)} (${sign}${percent.toFixed(2)}%)`;
                            } else { changeContent = "0 (0.00%)"; }
                        }
                    }

                    // Attach ref to the last element
                    const isLastElement = index === holdings.length - 1;
                    
                    return (
                      <TableRow 
                        key={`${holding.id}-${index}`} 
                        hover 
                        ref={isLastElement ? lastHoldingElementRef : null}
                        sx={{ '&:hover': { backgroundColor: '#18181b !important' } }}
                      >
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>
                            <Link component={RouterLink} to={`/stocks/${holding.symbol}`} sx={{ color: 'white', textDecoration: 'none', borderBottom: '1px dotted #52525b', '&:hover': { color: '#60a5fa' } }}>
                                {holding.symbol}
                            </Link>
                        </TableCell>
                        <TableCell sx={{ color: '#a1a1aa' }}>{holding.issuer}</TableCell>
                        <TableCell align="center" sx={{ color: '#d4d4d8' }}>{formatNumber(holding.shares_count)}</TableCell>
                        <TableCell align="center" sx={{ color: changeColor, fontFamily: theme.typography.fontFamilyMono }}>{changeContent}</TableCell>
                        <TableCell align="center" sx={{ color: 'white' }}>{formatCurrency(holding.value_usd)}</TableCell>
                        <TableCell align="center" sx={{ color: '#71717a' }}>{formatPercent(weight)}</TableCell>
                      </TableRow>
                    );
                })}
                {loadingHoldings && (
                  <TableRow>
                     <TableCell colSpan={6} align="center" sx={{ py: 2 }}>
                        <CircularProgress size={20} color="inherit" />
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