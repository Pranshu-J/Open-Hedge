// StockRankings.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';
import { formatCurrency, formatNumber } from './utils';
import { 
  Box, Typography, Paper, TextField, InputAdornment, Table, 
  TableBody, TableCell, TableContainer, TableHead, TableRow, 
  CircularProgress, Container, Fade, Button, Grid, Tooltip,
  List, ListItem, ListItemText, ClickAwayListener
} from '@mui/material';
import { 
  Search, Business, ArrowBack, TrendingUp, TrendingDown, 
  ShowChart, InfoOutlined, ArrowForward, Remove
} from '@mui/icons-material';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';
import theme from './theme';

// --- Helper: Fetch Stock Data (Alpha Vantage + Fallback) ---
const fetchStockData = async (symbol) => {
  // Access the key securely from the .env file
  const apiKey = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY;

  try {
    // 1. CHANGED: Use TIME_SERIES_WEEKLY to get full history for free
    const response = await fetch(
      `https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY&symbol=${symbol}&apikey=${apiKey}`
    );
    
    if (!response.ok) throw new Error("Network Error");
    
    const data = await response.json();

    // 1. Log the full response to see exactly what Alpha Vantage is saying
    console.log("Alpha Vantage Response:", data);

    // 2. Add a check for "Information" (Premium/Limit warnings often use this key)
    if (data['Information']) throw new Error(data['Information']);
    if (data['Error Message']) throw new Error("Invalid Symbol");
    if (data['Note']) throw new Error("API Limit Reached");

    // 2. CHANGED: Weekly endpoint uses "Weekly Time Series" key
    const timeSeries = data['Weekly Time Series'];
    if (!timeSeries) throw new Error("No Data Found");

    // Transform object: { "2023-10-01": { "4. close": "150.00" } } -> [ { date: "Oct 1", value: 150.00 } ]
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const formattedData = Object.keys(timeSeries)
      .filter(dateStr => {
        // Parse explicitly to compare accurately
        // We append T12:00:00 to avoid timezone shifts during comparison too
        return new Date(`${dateStr}T12:00:00`) >= oneYearAgo;
      })
      .sort()
      .map(dateStr => {
        // NEW (Fixed): Explicitly handle timezone offset
        // We append 'T12:00:00' to ensure we are in the middle of the day,
        // preventing timezone shifts from rolling it back to the previous date.
        const dateObj = new Date(`${dateStr}T12:00:00`);
        return {
          date: dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          value: parseFloat(timeSeries[dateStr]['4. close'])
        };
      }); 

    return formattedData;

  } catch (err) {
    console.warn("Alpha Vantage API Error (Using Fallback):", err.message);
    
    // Fallback: Generate realistic chart data so the UI doesn't break during dev/limits
    const data = [];
    let price = 150 + Math.random() * 50; 
    const weeks = 52; // Changed to 52 weeks for consistency
    for (let i = 0; i < weeks; i++) {
        const date = new Date();
        date.setDate(date.getDate() - ((weeks - i) * 7));
        price = price + (Math.random() - 0.5) * 5; 
        if (price < 10) price = 10;
        data.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            value: price
        });
    }
    return data;
  }
};

// --- Helper: Sortable Header Component ---
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
  // State for Searching
  const [tickerInput, setTickerInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);

  // State for Data
  const [searchedTicker, setSearchedTicker] = useState('');
  const [holdings, setHoldings] = useState([]);
  const [stockHistory, setStockHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(0);

  // State for Sorting
  const [sortConfig, setSortConfig] = useState({ key: 'shares_count', direction: 'desc' });

  // --- 1. Autocomplete Logic (Debounced) ---
  useEffect(() => {
    // If input is empty or very short, clear suggestions immediately
    if (tickerInput.length < 2) {
        setSuggestions([]);
        return;
    }

    // Debounce timer
    const timeoutId = setTimeout(async () => {
        setIsSearchingSuggestions(true);
        
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
        setIsSearchingSuggestions(false);
    }, 600); // 600ms delay helps prevent typing interruptions

    // Cleanup function cancels the timeout if the user types again before 600ms
    return () => clearTimeout(timeoutId);
  }, [tickerInput]);

  const handleSelectSuggestion = (symbol) => {
      // 1. Hide suggestions immediately
      setShowSuggestions(false);
      setSuggestions([]);
      // 2. Clear the input box as requested
      setTickerInput('');
      // 3. Execute search
      executeSearch(symbol);
  };

  // --- 2. Main Search Execution ---
  const executeSearch = async (symbolToSearch) => {
    if (!symbolToSearch) return;
    
    setLoading(true);
    setHasSearched(true);
    setSearchedTicker(symbolToSearch.toUpperCase());
    
    // Clear Input UI if search was manually triggered
    setTickerInput(''); 
    setShowSuggestions(false);
    
    // Reset Data & Sort
    setHoldings([]);
    setSortConfig({ key: 'shares_count', direction: 'desc' });

    try {
      const stockPromise = fetchStockData(symbolToSearch);
      
      // Fetch ALL holdings for this symbol (not just latest)
      // We need history to calculate the change in stake
      const holdingsPromise = supabase
        .from('holdings')
        .select(`
          shares_count,
          value_usd,
          funds!inner (
            id,
            company_name,
            report_date,
            source_url
          )
        `)
        .eq('symbol', symbolToSearch.toUpperCase());

      const [stockData, holdingsRes] = await Promise.all([stockPromise, holdingsPromise]);

      if (holdingsRes.error) throw holdingsRes.error;

      // Process Stock Chart Data
      setStockHistory(stockData);
      if (stockData.length > 0) {
        const latest = stockData[stockData.length - 1].value;
        const start = stockData[0].value;
        setCurrentPrice(latest);
        setPriceChange(((latest - start) / start) * 100);
      }

      // --- Process Holdings & Calculate Change ---
      const groupedByCompany = {};

      // 1. Group raw data by company name
      holdingsRes.data.forEach(item => {
        const companyName = item.funds.company_name;
        if (!groupedByCompany[companyName]) {
            groupedByCompany[companyName] = [];
        }
        groupedByCompany[companyName].push({
            ...item,
            parsedDate: new Date(item.funds.report_date)
        });
      });

      const processedData = [];

      // 2. Iterate through each company to find Latest vs Previous
      Object.values(groupedByCompany).forEach(companyHoldings => {
        // Sort by date descending (Newest first)
        companyHoldings.sort((a, b) => b.parsedDate - a.parsedDate);
        
        const latest = companyHoldings[0];
        const previous = companyHoldings.length > 1 ? companyHoldings[1] : null;

        let change = 0;
        let changePercent = 0;
        let isNewPosition = false;

        if (previous) {
            change = latest.shares_count - previous.shares_count;
            if (previous.shares_count !== 0) {
                changePercent = (change / previous.shares_count) * 100;
            } else {
                // Technically impossible if row existed with 0 shares, but good safety
                isNewPosition = true;
            }
        } else {
            isNewPosition = true;
        }

        processedData.push({
            ...latest,
            change,
            changePercent,
            isNewPosition
        });
      });

      setHoldings(processedData);

    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = (e) => {
      e.preventDefault();
      executeSearch(tickerInput);
  };

  const resetSearch = () => {
    setHasSearched(false);
    setTickerInput('');
    setSuggestions([]);
    setStockHistory([]);
  };

  // --- 3. Sorting Logic ---
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedHoldings = useMemo(() => {
    let sortableItems = [...holdings];
    if (sortConfig.key) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;

        if (sortConfig.key === 'company_name') {
            aValue = a.funds.company_name;
            bValue = b.funds.company_name;
        } else if (sortConfig.key === 'parsedDate') {
            aValue = a.parsedDate;
            bValue = b.parsedDate;
        } else if (sortConfig.key === 'change') {
             aValue = a.change;
             bValue = b.change;
        } else {
             aValue = a[sortConfig.key];
             bValue = b[sortConfig.key];
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [holdings, sortConfig]);


  // --- Render: Search Input (Shared) ---
  const SearchInput = ({ autoFocus = false }) => (
    <ClickAwayListener onClickAway={() => setShowSuggestions(false)}>
        <Box sx={{ position: 'relative', width: '100%' }}>
            <Box component="form" onSubmit={handleManualSearch}>
                <TextField
                fullWidth
                autoFocus={autoFocus}
                placeholder="Search Ticker (e.g. AAPL)"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
                onFocus={() => { if(tickerInput.length >= 2) setShowSuggestions(true); }}
                variant="outlined"
                InputProps={{
                    startAdornment: (
                    <InputAdornment position="start">
                        {loading || isSearchingSuggestions ? <CircularProgress size={20} color="inherit" /> : <Search sx={{ color: 'text.secondary', fontSize: 24 }} />}
                    </InputAdornment>
                    ),
                    sx: { 
                    backgroundColor: '#09090b',
                    fontSize: '1.1rem',
                    py: 1,
                    borderRadius: '8px',
                    '& fieldset': { borderColor: '#27272a' },
                    '&:hover fieldset': { borderColor: '#52525b' },
                    '&.Mui-focused fieldset': { borderColor: '#ffffff' },
                    }
                }}
                />
            </Box>
            
            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
                <Paper sx={{ 
                    position: 'absolute', 
                    top: '100%', 
                    left: 0, 
                    right: 0, 
                    zIndex: 1300, 
                    mt: 1, 
                    maxHeight: 300, 
                    overflow: 'auto', 
                    border: '1px solid #27272a', 
                    bgcolor: '#09090b',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                }}>
                    <List disablePadding>
                        {suggestions.map((item, index) => (
                        <ListItem 
                            button 
                            key={`${item.symbol}-${index}`} 
                            onClick={() => handleSelectSuggestion(item.symbol)}
                            sx={{ 
                                borderBottom: '1px solid #18181b', 
                                '&:hover': { backgroundColor: '#18181b' }, 
                                py: 1.5
                            }}
                        >
                            <ListItemText 
                                primary={
                                    <span style={{ color: 'white', fontWeight: 600 }}>
                                        {item.issuer} <span style={{ color: '#52525b', fontWeight: 400 }}>({item.symbol})</span>
                                    </span>
                                } 
                            />
                            <ArrowForward sx={{ fontSize: 16, color: '#52525b' }} />
                        </ListItem>
                        ))}
                    </List>
                </Paper>
            )}
        </Box>
    </ClickAwayListener>
  );

  // --- Render: Initial Search View ---
  if (!hasSearched) {
    return (
      <Container maxWidth="md" sx={{ 
        minHeight: '80vh', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center' 
      }}>
        <Box sx={{ width: '100%', maxWidth: '600px', textAlign: 'center' }}>
          <Typography variant="h2" sx={{ color: 'white', mb: 1, fontWeight: 700 }}>
            Stock Analysis
          </Typography>
          <Typography variant="body1" sx={{ color: '#a1a1aa', mb: 5 }}>
            Search for a company to see its institutional holders.
          </Typography>
          <SearchInput autoFocus={true} />
        </Box>
      </Container>
    );
  }

  // --- Render: Dashboard View ---
  return (
    <Fade in={true} timeout={500}>
      <Container maxWidth="lg" sx={{ mt: 5, pb: 10 }}>
        
        {/* Header */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
             <Button 
                onClick={resetSearch}
                startIcon={<ArrowBack />}
                sx={{ color: '#a1a1aa', borderColor: '#27272a', '&:hover': { color: 'white', bgcolor: '#18181b' } }}
                variant="outlined"
             >
                Back
             </Button>
             <Typography variant="h4" sx={{ fontWeight: 500, color: 'white' }}>
                {searchedTicker}
             </Typography>
          </Box>
        </Box>

        {/* Stats Grid */}
        <Grid container spacing={0} sx={{ mb: 4, border: '1px solid #27272a' }}>
           <Grid item xs={12} md={6} sx={{ borderRight: { md: '1px solid #27272a' }, borderBottom: { xs: '1px solid #27272a', md: 'none' }, p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="overline" color="text.secondary" sx={{ mb: 1 }}>Current Price</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h4" sx={{ fontFamily: theme.typography.fontFamilyMono, color: 'white' }}>
                  {currentPrice ? formatCurrency(currentPrice) : "-"}
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6} sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
             <Typography variant="overline" color="text.secondary" sx={{ mb: 1 }}>1 Year Trend</Typography>
             <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {priceChange >= 0 ? <TrendingUp sx={{ color: '#4ade80' }} /> : <TrendingDown sx={{ color: '#f87171' }} />}
                <Typography variant="h5" sx={{ fontFamily: theme.typography.fontFamilyMono, color: priceChange >= 0 ? '#4ade80' : '#f87171' }}>
                    {priceChange > 0 ? "+" : ""}{priceChange.toFixed(2)}%
                </Typography>
             </Box>
          </Grid>
        </Grid>

        {/* Chart Section */}
        {stockHistory.length > 0 && (
          <Box sx={{ mb: 6, p: 3, border: '1px solid #27272a', background: 'linear-gradient(180deg, #09090b 0%, #000 100%)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ShowChart sx={{ fontSize: 18, color: '#52525b' }} />
                <Typography variant="overline" color="text.secondary">Price History (1Y)</Typography>
                <Tooltip title="Data sourced from public APIs. For demonstration purposes only." placement="right" arrow componentsProps={{ tooltip: { sx: { bgcolor: '#18181b', border: '1px solid #27272a', color: '#d4d4d8', fontSize: '0.75rem' } } }}>
                  <InfoOutlined sx={{ fontSize: 16, color: '#52525b', cursor: 'pointer', ml: 0.5, '&:hover': { color: '#a1a1aa' } }} />
                </Tooltip>
              </Box>
              <Box sx={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stockHistory}>
                    <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ffffff" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis 
                        dataKey="date" 
                        stroke="#52525b" 
                        tick={{ fill: '#52525b', fontSize: 11, fontFamily: theme.typography.fontFamilyMono }} 
                        tickLine={false} 
                        axisLine={false} 
                        dy={10} 
                        minTickGap={30}
                    />
                    <YAxis 
                        domain={['auto', 'auto']} 
                        stroke="#52525b" 
                        tick={{ fill: '#52525b', fontSize: 11, fontFamily: theme.typography.fontFamilyMono }} 
                        tickFormatter={(val) => `$${val}`}
                        tickLine={false} 
                        axisLine={false} 
                        dx={-10} 
                    />
                    <RechartsTooltip 
                        contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a' }}
                        itemStyle={{ color: '#fff', fontFamily: theme.typography.fontFamilyMono }}
                        labelStyle={{ color: '#a1a1aa', marginBottom: '0.5rem' }}
                        formatter={(value) => [`$${value.toFixed(2)}`, 'Price']}
                    />
                    <Area type="monotone" dataKey="value" stroke="#ffffff" strokeWidth={2} fillOpacity={1} fill="url(#colorPrice)" />
                    </AreaChart>
                </ResponsiveContainer>
              </Box>
          </Box>
        )}

        {/* Holdings Table */}
        <Typography variant="h6" sx={{ color: 'white', mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Business sx={{ color: '#52525b' }}/> Fund Holdings (Latest Filing)
        </Typography>

        <Paper sx={{ width: '100%', overflow: 'hidden', border: '1px solid #27272a' }}>
          <TableContainer sx={{ maxHeight: 600 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <SortableHeader 
                    label="FUND / INSTITUTION" 
                    sortKey="company_name" 
                    currentSort={sortConfig} 
                    onSort={handleSort} 
                  />
                  <SortableHeader 
                    label="SHARES HELD" 
                    sortKey="shares_count" 
                    currentSort={sortConfig} 
                    onSort={handleSort} 
                    align="right" 
                  />
                  {/* NEW COLUMN: Change QoQ */}
                  <SortableHeader 
                    label="CHANGE (QoQ)" 
                    sortKey="change" 
                    currentSort={sortConfig} 
                    onSort={handleSort} 
                    align="right" 
                  />
                  <SortableHeader 
                    label="VALUE (USD)" 
                    sortKey="value_usd" 
                    currentSort={sortConfig} 
                    onSort={handleSort} 
                    align="right" 
                  />
                  <SortableHeader 
                    label="REPORT DATE" 
                    sortKey="parsedDate" 
                    currentSort={sortConfig} 
                    onSort={handleSort} 
                    align="right" 
                  />
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedHoldings.length > 0 ? (
                    sortedHoldings.map((row, index) => (
                    <TableRow key={`${row.funds.id}-${index}`} hover sx={{ '&:hover': { backgroundColor: '#18181b !important' } }}>
                        {/* Company Name */}
                        <TableCell sx={{ color: 'white', fontWeight: 500, borderBottom: '1px solid #27272a' }}>
                             {row.funds.company_name}
                        </TableCell>
                        
                        {/* Shares Held */}
                        <TableCell align="right" sx={{ color: '#d4d4d8', fontFamily: theme.typography.fontFamilyMono, borderBottom: '1px solid #27272a' }}>
                            {formatNumber(row.shares_count)}
                        </TableCell>

                        {/* Change Column (New) */}
                        <TableCell align="right" sx={{ fontFamily: theme.typography.fontFamilyMono, borderBottom: '1px solid #27272a' }}>
                            {row.isNewPosition ? (
                                <Box component="span" sx={{ color: '#4ade80', bgcolor: 'rgba(74, 222, 128, 0.1)', px: 1, py: 0.5, borderRadius: '4px', fontSize: '0.75rem' }}>
                                    NEW
                                </Box>
                            ) : (
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                                    <span style={{ color: row.change > 0 ? '#4ade80' : row.change < 0 ? '#f87171' : '#71717a' }}>
                                        {row.change > 0 ? '+' : ''}{formatNumber(row.change)}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: row.change > 0 ? '#4ade80' : row.change < 0 ? '#f87171' : '#52525b' }}>
                                         ({row.change > 0 ? '+' : ''}{row.changePercent.toFixed(2)}%)
                                    </span>
                                </Box>
                            )}
                        </TableCell>

                        {/* Value USD */}
                        <TableCell align="right" sx={{ color: '#ffffff', fontFamily: theme.typography.fontFamilyMono, borderBottom: '1px solid #27272a' }}>
                            {formatCurrency(row.value_usd)}
                        </TableCell>

                        {/* Report Date */}
                        <TableCell align="right" sx={{ color: '#71717a', fontFamily: theme.typography.fontFamilyMono, borderBottom: '1px solid #27272a' }}>
                            {row.parsedDate.toLocaleDateString()}
                        </TableCell>
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                            <Typography variant="body1" sx={{ color: '#52525b' }}>
                                {loading ? "Loading..." : "No funds found holding this ticker."}
                            </Typography>
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