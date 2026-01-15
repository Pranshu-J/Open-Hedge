// StockRankings.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { formatCurrency, formatNumber } from './utils';
import { 
  Box, Typography, Paper, TextField, InputAdornment, Table, 
  TableBody, TableCell, TableContainer, TableHead, TableRow, 
  CircularProgress, Container, Fade, Grid, Chip, List, ListItem, 
  ListItemButton, ListItemText, ClickAwayListener, Link, Breadcrumbs, Divider, Stack
} from '@mui/material';
import { 
  Search, Business, TrendingUp, TrendingDown, WarningAmber, 
  InfoOutlined, AttachMoney, ShowChart, PieChart, Tag, Language, AccessTime
} from '@mui/icons-material';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';
import theme from './theme';

// --- Helper: Fetch Stock Price History ---
const fetchStockPriceHistory = async (symbol) => {
  const apiKey = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY;
  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY&symbol=${symbol}&apikey=${apiKey}`
    );
    const data = await response.json();

    if (data['Note'] || data['Information'] || data['Error Message']) return [];

    const timeSeries = data['Weekly Time Series'];
    if (!timeSeries) return [];

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    return Object.keys(timeSeries)
      .filter(dateStr => new Date(`${dateStr}T12:00:00`) >= oneYearAgo)
      .sort()
      .map(dateStr => ({
        date: dateStr,
        value: parseFloat(timeSeries[dateStr]['4. close'])
      })); 
  } catch (err) {
    console.error('[API] Price History Exception:', err);
    return []; 
  }
};

// --- Helper: Fetch Company Overview ---
const fetchCompanyOverview = async (symbol) => {
  const apiKey = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY_2;
  try {
    const response = await fetch(
      `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${apiKey}`
    );
    const data = await response.json();

    if (Object.keys(data).length === 0 || data['Note'] || data['Information'] || data['Error Message']) {
        return null;
    }
    return data;
  } catch (err) {
    console.error("Overview Fetch Error:", err);
    return null;
  }
};

// --- Helper: Safe Metric Formatting ---
const formatMetric = (value, type = 'number') => {
    if (value === undefined || value === null || value === 'None' || value === '0' || value === '-') return '—';

    const num = parseFloat(value);
    if (isNaN(num)) return '—';

    if (type === 'currency') return formatCurrency(num);
    if (type === 'percent') return `${(num * 100).toFixed(2)}%`;
    if (type === 'decimal') return num.toFixed(2);
    if (type === 'large_currency') {
         if (num >= 1.0e+12) return `$${(num / 1.0e+12).toFixed(2)}T`;
         if (num >= 1.0e+9) return `$${(num / 1.0e+9).toFixed(2)}B`;
         if (num >= 1.0e+6) return `$${(num / 1.0e+6).toFixed(2)}M`;
         return formatCurrency(num);
    }
    
    return num.toLocaleString();
};

// --- Component: Sleek Metric Cell ---
// Visual update: A clean, bordered cell for the "Matrix" look
const MatrixCell = ({ label, value, highlight = false }) => (
    <Box sx={{ p: 2, border: '1px solid #27272a', display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#000' }}>
        <Typography variant="caption" sx={{ color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1, fontSize: '0.7rem' }}>
            {label}
        </Typography>
        <Typography variant="body1" sx={{ color: highlight ? '#fff' : '#e4e4e7', fontFamily: theme.typography.fontFamilyMono, fontWeight: highlight ? 600 : 400 }}>
            {value}
        </Typography>
    </Box>
);

const SortableHeader = ({ label, sortKey, currentSort, onSort, align = "left" }) => (
  <TableCell 
    align={align} 
    sx={{ 
      backgroundColor: '#000', 
      cursor: 'pointer', 
      userSelect: 'none',
      borderBottom: '1px solid #27272a',
      '&:hover': { backgroundColor: '#18181b' } 
    }}
    onClick={() => onSort(sortKey)}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: align === 'center' || align === 'right' ? 'flex-end' : 'flex-start', gap: 0.5 }}>
      {label}
      <Box component="span" sx={{ fontSize: '0.65rem', color: '#52525b', display: 'flex', flexDirection: 'column', lineHeight: 0.8 }}>
           <span style={{ color: currentSort.key === sortKey && currentSort.direction === 'asc' ? '#fff' : '#52525b' }}>▲</span>
           <span style={{ color: currentSort.key === sortKey && currentSort.direction === 'desc' ? '#fff' : '#52525b' }}>▼</span>
      </Box>
    </Box>
  </TableCell>
);

export default function StockRankings() {
  const { ticker } = useParams(); 
  const navigate = useNavigate();

  const [tickerInput, setTickerInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [searchedTicker, setSearchedTicker] = useState('');
  const [holdings, setHoldings] = useState([]);
  const [stockHistory, setStockHistory] = useState([]);
  const [companyOverview, setCompanyOverview] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(0);

  const [sortConfig, setSortConfig] = useState({ key: 'shares_count', direction: 'desc' });
  const [tableSearchTerm, setTableSearchTerm] = useState('');

  useEffect(() => {
    if (ticker) {
        setTickerInput(ticker);
        executeSearch(ticker); 
    } else {
        setTickerInput('');
        setSearchedTicker('');
        setHoldings([]);
        setStockHistory([]);
        setCompanyOverview(null);
    }
  }, [ticker]);

  useEffect(() => {
    if (tickerInput.length < 2) {
        setSuggestions([]);
        return;
    }
    const timeoutId = setTimeout(async () => {
        const { data, error } = await supabase
            .from('holdings')
            .select('symbol, issuer')
            .or(`symbol.ilike.%${tickerInput}%,issuer.ilike.%${tickerInput}%`)
            .limit(10);

        if (!error && data) {
            const unique = [];
            const seen = new Set();
            data.forEach(item => {
                if (!seen.has(item.symbol)) {
                    seen.add(item.symbol);
                    unique.push(item);
                }
            });
            setSuggestions(unique);
            setShowSuggestions(true);
        }
    }, 600); 
    return () => clearTimeout(timeoutId);
  }, [tickerInput]);

  const handleSelectSuggestion = (symbol) => {
    setShowSuggestions(false);
    navigate(`/stocks/${symbol}`);
  };

  const handleManualSearch = () => {
      if (tickerInput) {
          navigate(`/stocks/${tickerInput.toUpperCase()}`);
      }
  };

  const executeSearch = async (symbolToSearch) => {
    if (!symbolToSearch) return;
    
    setLoading(true);
    setSearchedTicker(symbolToSearch.toUpperCase());
    
    setHoldings([]);
    setStockHistory([]); 
    setCompanyOverview(null);
    setSortConfig({ key: 'shares_count', direction: 'desc' });

    try {
      const holdingsPromise = supabase
        .from('holdings')
        .select(`
          shares_count, value_usd,
          funds!inner ( id, company_name, report_date, source_url )
        `)
        .eq('symbol', symbolToSearch.toUpperCase());

      // Fetch external data sequentially to avoid rate limits
      const stockData = await fetchStockPriceHistory(symbolToSearch);
      
      await new Promise(r => setTimeout(r, 500)); 
      
      const overviewData = await fetchCompanyOverview(symbolToSearch);
      const holdingsRes = await holdingsPromise;

      if (stockData && stockData.length > 0) {
        setStockHistory(stockData);
        const last = stockData[stockData.length - 1].value;
        const first = stockData[0].value;
        setCurrentPrice(last);
        setPriceChange(((last - first) / first) * 100);
      }

      if (overviewData) {
        setCompanyOverview(overviewData);
      }

      if (holdingsRes.data) {
        const latestHoldingsMap = new Map();
        holdingsRes.data.forEach(h => {
            const fundName = h.funds.company_name;
            const reportDate = new Date(h.funds.report_date);
            if (!latestHoldingsMap.has(fundName) || reportDate > latestHoldingsMap.get(fundName).parsedDate) {
                latestHoldingsMap.set(fundName, { ...h, parsedDate: reportDate });
            }
        });

        setHoldings(Array.from(latestHoldingsMap.values()).map(h => ({
            id: h.funds.id,
            fundName: h.funds.company_name,
            shares_count: h.shares_count,
            value_usd: h.value_usd,
            reportDate: h.funds.report_date,
            parsedDate: h.parsedDate,
            sourceUrl: h.funds.source_url
        })));
      }
    } catch (err) {
      console.error("Search Execution Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
  };

  const sortedHoldings = useMemo(() => {
    let data = [...holdings];

    // 1. Filter by Table Search Term
    if (tableSearchTerm) {
      const lowerTerm = tableSearchTerm.toLowerCase();
      data = data.filter(h => 
        h.fundName.toLowerCase().includes(lowerTerm)
      );
    }

    // 2. Sort
    data.sort((a, b) => {
      let aV = sortConfig.key === 'reportDate' ? a.parsedDate : a[sortConfig.key];
      let bV = sortConfig.key === 'reportDate' ? b.parsedDate : b[sortConfig.key];
      if (aV < bV) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aV > bV) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return data;
  }, [holdings, sortConfig, tableSearchTerm]);

  // --- VIEW: LOADING / LANDING ---
  // Note: Changed maxWidth from 'md' to 'lg' here as well to be consistent, though 'md' is fine for landing.
  if (!ticker) {
    return (
        <Container maxWidth="lg" sx={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <Box sx={{ width: '100%', maxWidth: '600px', textAlign: 'center' }}>
            <Typography variant="h2" sx={{ color: 'white', mb: 1, fontWeight: 700 }}>Search Stocks</Typography>
            <Typography variant="body1" sx={{ color: '#a1a1aa', mb: 5 }}>Analyze institutional ownership for any US equity.</Typography>
            <ClickAwayListener onClickAway={() => setShowSuggestions(false)}>
                <Box sx={{ position: 'relative', width: '100%' }}>
                  <TextField
                    fullWidth autoFocus placeholder="e.g. TSLA, NVDA, AAPL"
                    value={tickerInput} onChange={(e) => setTickerInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                    variant="outlined"
                    InputProps={{
                      startAdornment: (<InputAdornment position="start"><Search sx={{ color: 'text.secondary', fontSize: 24 }} /></InputAdornment>),
                      sx: { 
                        backgroundColor: '#09090b', fontSize: '1.25rem', py: 1, borderRadius: '8px',
                        '& fieldset': { borderColor: '#27272a' },
                        '&:hover fieldset': { borderColor: '#52525b' },
                        '&.Mui-focused fieldset': { borderColor: '#ffffff' },
                        fontFamily: theme.typography.fontFamilyMono
                      }
                    }}
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <Paper sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1200, mt: 1, maxHeight: 400, overflow: 'auto', border: '1px solid #27272a', bgcolor: '#09090b' }}>
                      <List disablePadding>
                        {suggestions.map((s, i) => (
                          <ListItem key={i} disablePadding>
                            <ListItemButton onClick={() => handleSelectSuggestion(s.symbol)} sx={{ borderBottom: '1px solid #18181b', py: 2 }}>
                                <ListItemText primary={s.symbol} secondary={s.issuer} primaryTypographyProps={{ color: 'white', fontFamily: theme.typography.fontFamilyMono }} secondaryTypographyProps={{ color: '#71717a' }} />
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                    </Paper>
                  )}
                </Box>
            </ClickAwayListener>
          </Box>
        </Container>
    );
  }

  // --- VIEW: DASHBOARD ---
  // Note: This is the main change. maxWidth="xl" -> maxWidth="lg" to match Dashboard.jsx
  return (
    <Fade in={true} timeout={800}>
      <Container maxWidth="lg" sx={{ pt: 5, pb: 10 }}>
        
        <Breadcrumbs sx={{ mb: 2, color: '#71717a' }}>
             <Link component={RouterLink} to="/stocks" color="inherit" underline="hover">Stocks</Link>
             <Typography color="white">{searchedTicker}</Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' }, gap: 2, mb: 4 }}>
          <Box>
            <Typography variant="h4" sx={{ color: 'white', fontWeight: 600, mb: 1 }}>Institutional Holdings</Typography>
            <Typography variant="body1" sx={{ color: '#a1a1aa' }}>Analyze fund positioning for {searchedTicker}.</Typography>
          </Box>
          <ClickAwayListener onClickAway={() => setShowSuggestions(false)}>
            <Box sx={{ position: 'relative', width: { xs: '100%', md: 300 } }}>
              <TextField 
                fullWidth size="small" placeholder="Search Ticker..."
                value={tickerInput} onChange={(e) => setTickerInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Search sx={{ color: '#52525b', fontSize: 20 }} /></InputAdornment>,
                  sx: { bgcolor: '#09090b', borderRadius: '6px', fontFamily: theme.typography.fontFamilyMono, fontSize: '0.875rem' }
                }}
              />
              {showSuggestions && suggestions.length > 0 && (
                <Paper sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, bgcolor: '#09090b', border: '1px solid #27272a', mt: 0.5 }}>
                  <List dense>
                    {suggestions.map((s, i) => (
                      <ListItem key={i} disablePadding>
                        <ListItemButton onClick={() => handleSelectSuggestion(s.symbol)}>
                          <ListItemText primary={<span style={{ color: 'white', fontFamily: theme.typography.fontFamilyMono }}>{s.symbol}</span>} />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              )}
            </Box>
          </ClickAwayListener>
        </Box>

        <Fade in={true}>
            {/* UPDATED: Removed spacing/container redundancy, using standard Grid structure */}
            <Grid container spacing={3}>
              
              {/* Row 1: Price Chart */}
              {/* UPDATED: Replaced 'item xs={12}' with 'size={{ xs: 12 }}' */}
              <Grid size={{ xs: 12 }}>
                <Paper sx={{ p: 3, bgcolor: '#000', border: '1px solid #27272a' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                    <Box>
                      <Typography variant="h2" sx={{ fontFamily: theme.typography.fontFamilyMono }}>{searchedTicker}</Typography>
                      {currentPrice && (
                        <Typography variant="h4" sx={{ color: priceChange >= 0 ? '#4ade80' : '#f87171', mt: 1 }}>
                          {formatCurrency(currentPrice)}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                        <Chip label="1Y Trend" size="small" sx={{ bgcolor: '#27272a', color: '#fff', borderRadius: 1, mb: 1 }} />
                        {priceChange !== 0 && (
                            <Typography variant="body2" sx={{ color: priceChange >= 0 ? '#4ade80' : '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                {priceChange >= 0 ? <TrendingUp fontSize="small"/> : <TrendingDown fontSize="small"/>}
                                {Math.abs(priceChange).toFixed(2)}%
                            </Typography>
                        )}
                    </Box>
                  </Box>
                  {/* FIX: Explicit height and width on parent Box for Recharts */}
                  <Box sx={{ width: '100%', height: 400 }}>
                    {stockHistory.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={stockHistory}>
                              <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.1}/>
                                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid stroke="#27272a" vertical={false} />
                              <XAxis dataKey="date" hide />
                              <YAxis domain={['auto', 'auto']} hide />
                              <RechartsTooltip contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a' }} itemStyle={{ color: '#fff' }} formatter={(val) => [formatCurrency(val), "Price"]} />
                              <Area type="monotone" dataKey="value" stroke="#ffffff" fill="url(#colorValue)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', border: '1px dashed #27272a' }}>
                            <WarningAmber sx={{ color: '#52525b', mb: 1 }} />
                            <Typography variant="caption" sx={{ color: '#52525b' }}>{loading ? 'Loading Chart...' : 'Chart Unavailable'}</Typography>
                        </Box>
                    )}
                  </Box>
                </Paper>
              </Grid>

              {/* Row 2: Holdings Table */}
              <Grid size={{ xs: 12 }}>
                <Paper sx={{ border: '1px solid #27272a', bgcolor: '#000' }}>
                  
                  {/* Updated Header with Search Input */}
                  <Box sx={{ p: 2, borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                    <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Business sx={{ color: '#a1a1aa' }} /> Institutional Holders
                    </Typography>

                    <TextField
                      placeholder="Search Fund"
                      variant="outlined"
                      size="small"
                      value={tableSearchTerm}
                      onChange={(e) => setTableSearchTerm(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search sx={{ color: 'text.secondary', fontSize: 20 }} />
                          </InputAdornment>
                        ),
                        sx: { 
                          width: 240, 
                          backgroundColor: '#09090b', 
                          fontFamily: theme.typography.fontFamilyMono,
                          fontSize: '0.875rem'
                        }
                      }}
                    />
                  </Box>
                  <TableContainer sx={{ maxHeight: 600 }}>
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                            <SortableHeader label="INSTITUTION" sortKey="fundName" currentSort={sortConfig} onSort={handleSort} />
                            <SortableHeader label="SHARES" sortKey="shares_count" currentSort={sortConfig} onSort={handleSort} align="right" />
                            <SortableHeader label="VALUE" sortKey="value_usd" currentSort={sortConfig} onSort={handleSort} align="right" />
                            <SortableHeader label="FILED" sortKey="reportDate" currentSort={sortConfig} onSort={handleSort} align="right" />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={4} align="center" sx={{ py: 8 }}><CircularProgress size={24} /></TableCell></TableRow>
                        ) : sortedHoldings.length > 0 ? (
                            sortedHoldings.map((row) => (
                            <TableRow key={row.id} hover sx={{ '&:hover': { backgroundColor: '#18181b !important' } }}>
                                <TableCell sx={{ color: '#ffffff', borderBottom: '1px solid #27272a' }}>
                                    <Link component={RouterLink} to={`/fund/${encodeURIComponent(row.fundName.replace(/ /g, '-'))}`} sx={{ color: 'inherit', textDecoration: 'none', borderBottom: '1px dotted #52525b', '&:hover': { color: '#60a5fa' } }}>{row.fundName}</Link>
                                </TableCell>
                                <TableCell align="right" sx={{ color: '#a1a1aa', fontFamily: theme.typography.fontFamilyMono, borderBottom: '1px solid #27272a' }}>{formatNumber(row.shares_count)}</TableCell>
                                <TableCell align="right" sx={{ color: '#ffffff', fontFamily: theme.typography.fontFamilyMono, borderBottom: '1px solid #27272a' }}>{formatCurrency(row.value_usd)}</TableCell>
                                <TableCell align="right" sx={{ color: '#71717a', fontFamily: theme.typography.fontFamilyMono, borderBottom: '1px solid #27272a' }}>{row.parsedDate.toLocaleDateString()}</TableCell>
                            </TableRow>
                            ))
                        ) : (
                            <TableRow><TableCell colSpan={4} align="center" sx={{ py: 8 }}><Typography variant="body1" sx={{ color: '#52525b' }}>No funds found.</Typography></TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Grid>

              {/* Row 3: Enhanced Company Overview (Design Overhaul) */}
              <Grid size={{ xs: 12 }}>
                <Paper sx={{ p: 0, overflow: 'hidden', border: '1px solid #27272a', bgcolor: '#000' }}>
                    
                    {/* Header Strip */}
                    <Box sx={{ p: 2, borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: '#09090b' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                             <InfoOutlined sx={{ color: '#a1a1aa' }} />
                             <Typography variant="h6" sx={{ color: 'white' }}>Company Data</Typography>
                        </Box>
                        {companyOverview && (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Chip icon={<Tag style={{fontSize: 14}} />} label={companyOverview.Sector} size="small" sx={{ bgcolor: '#000', color: '#a1a1aa', border: '1px solid #27272a' }} />
                                <Chip icon={<Language style={{fontSize: 14}} />} label={companyOverview.Industry} size="small" sx={{ bgcolor: '#000', color: '#a1a1aa', border: '1px solid #27272a' }} />
                            </Box>
                        )}
                    </Box>
                    
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={24} /></Box>
                    ) : companyOverview ? (
                        <Box>
                             {/* Section 1: Description */}
                             <Box sx={{ p: 3, borderBottom: '1px solid #27272a' }}>
                                <Typography variant="body2" sx={{ color: '#a1a1aa', lineHeight: 1.8, maxWidth: '90%' }}>
                                    {companyOverview.Description}
                                </Typography>
                             </Box>

                             {/* Section 2: Data Matrix */}
                             {/* Using Grid v2 syntax 'size' */}
                             <Grid container>
                                
                                {/* Valuation Column */}
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <MatrixCell label="Market Cap" value={formatMetric(companyOverview.MarketCapitalization, 'large_currency')} highlight />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <MatrixCell label="EBITDA" value={formatMetric(companyOverview.EBITDA, 'large_currency')} />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <MatrixCell label="P/E Ratio" value={formatMetric(companyOverview.PERatio, 'decimal')} />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <MatrixCell label="Price / Book" value={formatMetric(companyOverview.PriceToBookRatio, 'decimal')} />
                                </Grid>

                                {/* Financials Column */}
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <MatrixCell label="Revenue (TTM)" value={formatMetric(companyOverview.RevenueTTM, 'large_currency')} highlight />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <MatrixCell label="EPS (Diluted)" value={formatMetric(companyOverview.DilutedEPSTTM, 'currency')} />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <MatrixCell label="Profit Margin" value={formatMetric(companyOverview.ProfitMargin, 'percent')} />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <MatrixCell label="Rev Growth" value={formatMetric(companyOverview.QuarterlyRevenueGrowthYOY, 'percent')} />
                                </Grid>

                                {/* Market Data Column */}
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <MatrixCell label="52W High" value={formatMetric(companyOverview['52WeekHigh'], 'currency')} />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <MatrixCell label="52W Low" value={formatMetric(companyOverview['52WeekLow'], 'currency')} />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <MatrixCell label="Analyst Target" value={formatMetric(companyOverview.AnalystTargetPrice, 'currency')} />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                    <MatrixCell label="Beta" value={formatMetric(companyOverview.Beta, 'decimal')} />
                                </Grid>
                             </Grid>
                        </Box>
                    ) : (
                        <Box sx={{ py: 6, textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ color: '#52525b' }}>Company overview data currently unavailable.</Typography>
                        </Box>
                    )}
                </Paper>
              </Grid>

            </Grid>
        </Fade>
      </Container>
    </Fade>
  );
}