// Dashboard.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { formatCurrency, formatNumber, formatPercent } from './utils';
import { 
  Box, Typography, Paper, Grid, Select, MenuItem, Table, TableBody, 
  TableCell, TableContainer, TableHead, TableRow, Link, CircularProgress, 
  Fade, Container, Tooltip
} from '@mui/material';
import { TrendingUp, TrendingDown, CalendarToday, ShowChart, InfoOutlined } from '@mui/icons-material';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';
import theme from './theme';

const formatLargeCurrency = (value) => {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value}`;
};

export default function Dashboard({ selectedCompany, fundHistory, initialFundId }) {
  const [selectedFundId, setSelectedFundId] = useState(initialFundId);
  const [holdings, setHoldings] = useState([]);
  const [valuations, setValuations] = useState([]);
  const [prevHoldingsMap, setPrevHoldingsMap] = useState({}); 
  const [hasPrevFund, setHasPrevFund] = useState(false);
  const [loadingHoldings, setLoadingHoldings] = useState(false);

  // Sorting State: { key: 'symbol' | 'shares_count' | etc, direction: 'asc' | 'desc' | null }
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });

  useEffect(() => {
    if (initialFundId) setSelectedFundId(initialFundId);
  }, [initialFundId]);

  useEffect(() => {
    if (!selectedFundId) return;
    
    const fetchData = async () => {
      setLoadingHoldings(true);
      // Reset sort when changing quarters
      setSortConfig({ key: null, direction: null });
      
      console.log("--- START FETCH ---");

      const sortedHistory = [...fundHistory].sort((a, b) => 
        new Date(b.report_date) - new Date(a.report_date)
      );
      const currentIndex = sortedHistory.findIndex(f => f.id === parseInt(selectedFundId));
      const prevFund = sortedHistory[currentIndex + 1];

      setHasPrevFund(!!prevFund);

      const holdingsReq = supabase
        .from('holdings')
        .select('*')
        .eq('fund_id', selectedFundId)
        .order('value_usd', { ascending: false });
        
      const valuationsReq = supabase
        .from('fund_valuations')
        .select('valuation_date, value_usd')
        .eq('fund_id', selectedFundId)
        .order('valuation_date', { ascending: true });

      const prevHoldingsReq = prevFund 
        ? supabase
            .from('holdings')
            .select('*')
            .eq('fund_id', prevFund.id)
            .order('value_usd', { ascending: false })
        : Promise.resolve({ data: null });

      const [holdingsRes, valuationsRes, prevRes] = await Promise.all([holdingsReq, valuationsReq, prevHoldingsReq]);

      if (!holdingsRes.error) {
        setHoldings(holdingsRes.data);
      }
      
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
        prevRes.data.forEach(h => {
          map[h.symbol] = h.shares_count;
        });
        setPrevHoldingsMap(map);
      } else {
        setPrevHoldingsMap({});
      }

      setLoadingHoldings(false);
    };

    fetchData();
  }, [selectedFundId, fundHistory]);

  const currentFundData = fundHistory.find(f => f.id === parseInt(selectedFundId));

  // --- Sorting Logic ---
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    } else if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = null; // Reset to default
    }
    setSortConfig({ key: direction ? key : null, direction });
  };

  const sortedHoldings = useMemo(() => {
    let sortableItems = [...holdings];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;

        // Custom handling for computed columns like 'change' or '% port'
        if (sortConfig.key === 'change') {
            const prevA = prevHoldingsMap[a.symbol] || 0;
            const prevB = prevHoldingsMap[b.symbol] || 0;
            // We sort by the raw numeric difference
            aValue = a.shares_count - prevA;
            bValue = b.shares_count - prevB;
        } else if (sortConfig.key === 'weight') {
            // Re-calculate weight for sorting since it's not in the DB row directly
            // (Note: Optimization would be calculating weights once during fetch)
            const totalValue = holdings.reduce((acc, curr) => acc + (curr.value_usd || 0), 0);
            aValue = totalValue > 0 ? (a.value_usd / totalValue) : 0;
            bValue = totalValue > 0 ? (b.value_usd / totalValue) : 0;
        } else {
             // Standard columns
             aValue = a[sortConfig.key];
             bValue = b[sortConfig.key];
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [holdings, sortConfig, prevHoldingsMap]);

  // Helper for Headers
  const SortableHeader = ({ label, sortKey, align = "left" }) => (
    <TableCell 
      align={align} 
      sx={{ 
        backgroundColor: '#000', 
        cursor: 'pointer', 
        userSelect: 'none',
        '&:hover': { backgroundColor: '#18181b' } // Visual feedback
      }}
      onClick={() => handleSort(sortKey)}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: align === 'center' || align === 'right' ? 'flex-end' : 'flex-start', gap: 0.5 }}>
        {align === 'center' && <span style={{flex: 1}}></span>} {/* Spacer for true center alignment */}
        {label}
        <Box component="span" sx={{ fontSize: '0.65rem', color: '#52525b', display: 'flex', flexDirection: 'column', lineHeight: 0.8 }}>
             {/* Show active arrow based on state, or faint arrows if inactive */}
             <span style={{ color: sortConfig.key === sortKey && sortConfig.direction === 'asc' ? '#fff' : '#52525b' }}>▲</span>
             <span style={{ color: sortConfig.key === sortKey && sortConfig.direction === 'desc' ? '#fff' : '#52525b' }}>▼</span>
        </Box>
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

  if (!selectedCompany || !currentFundData) return null;

  return (
    <Fade in={true} timeout={500}>
      <Container maxWidth="lg" sx={{ mt: 5, pb: 10 }}>
        {/* Header Info */}
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
          <Typography variant="h4" sx={{ fontWeight: 500, color: 'white' }}>{selectedCompany}</Typography>
          <Link href={currentFundData.source_url} target="_blank" underline="hover" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>Source Filing ↗</Link>
        </Box>

        {/* Stats Grid */}
        <Grid container spacing={0} sx={{ mb: 4, border: '1px solid #27272a' }}>
          <Grid item xs={12} md={4} sx={{ borderRight: { md: '1px solid #27272a' }, borderBottom: { xs: '1px solid #27272a', md: 'none' }, p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="overline" color="text.secondary" sx={{ mb: 1 }}>Report Period</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarToday sx={{ fontSize: 16, color: '#52525b' }} />
              <Select
                value={selectedFundId}
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
              {currentFundData.holdings_count || holdings.length}
            </Typography>
          </Grid>
        </Grid>

        {/* Chart */}
        {valuations.length > 0 && (
          <Box sx={{ mb: 6, p: 3, border: '1px solid #27272a', background: 'linear-gradient(180deg, #09090b 0%, #000 100%)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ShowChart sx={{ fontSize: 18, color: '#52525b' }} />
                <Typography variant="overline" color="text.secondary">Portfolio Valuation</Typography>
                <Tooltip title="Valuations are estimates based on public 13F filings. Methodology may vary across quarters and does not reflect real-time market value." placement="right" arrow componentsProps={{ tooltip: { sx: { bgcolor: '#18181b', border: '1px solid #27272a', color: '#d4d4d8', fontSize: '0.75rem' } } }}>
                  <InfoOutlined sx={{ fontSize: 16, color: '#52525b', cursor: 'pointer', ml: 0.5, '&:hover': { color: '#a1a1aa' } }} />
                </Tooltip>
              </Box>
              <Box sx={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={valuations}>
                  <defs>
                    <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="dateStr" stroke="#52525b" tick={{ fill: '#52525b', fontSize: 11, fontFamily: theme.typography.fontFamilyMono }} tickLine={false} axisLine={false} dy={10} />
                  <YAxis domain={['auto', 'auto']} stroke="#52525b" tick={{ fill: '#52525b', fontSize: 11, fontFamily: theme.typography.fontFamilyMono }} tickFormatter={formatLargeCurrency} tickLine={false} axisLine={false} dx={-10} />
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
                  <SortableHeader label="Change (Shares)" sortKey="change" align="center" />
                  <SortableHeader label="Value (USD)" sortKey="value_usd" align="center" />
                  <SortableHeader label="% Port" sortKey="weight" align="center" />
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingHoldings ? (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 8 }}><CircularProgress size={24} color="inherit" /></TableCell></TableRow>
                ) : (
                  sortedHoldings.map((holding) => {
                    const totalValue = holdings.reduce((acc, curr) => acc + (curr.value_usd || 0), 0);
                    const weight = totalValue > 0 ? (holding.value_usd / totalValue) * 100 : 0;
                    
                    const prevShares = prevHoldingsMap[holding.symbol];
                    let changeContent = "-";
                    let changeColor = "#71717a";

                    if (hasPrevFund) {
                        if (prevShares === undefined) {
                            changeContent = "NEW";
                            changeColor = "#60a5fa"; 
                        } else {
                            const diff = holding.shares_count - prevShares;
                            const percent = prevShares !== 0 ? (diff / prevShares) * 100 : 0;
                            
                            if (diff !== 0) {
                                const isPositive = diff > 0;
                                const sign = isPositive ? "+" : "";
                                changeColor = isPositive ? "#4ade80" : "#f87171";
                                const absPercent = Math.abs(percent);
                                changeContent = `${sign}${formatNumber(diff)} (${sign}${percent.toFixed(2)}%)`;
                            } else {
                                changeContent = "0 (0.00%)";
                            }
                        }
                    }

                    return (
                      <TableRow key={holding.id} hover sx={{ '&:hover': { backgroundColor: '#18181b !important' } }}>
                        <TableCell sx={{ color: 'white', fontWeight: 600 }}>{holding.symbol}</TableCell>
                        <TableCell sx={{ color: '#a1a1aa' }}>{holding.issuer}</TableCell>
                        <TableCell align="center" sx={{ color: '#d4d4d8' }}>{formatNumber(holding.shares_count)}</TableCell>
                        <TableCell align="center" sx={{ color: changeColor, fontFamily: theme.typography.fontFamilyMono, fontWeight: changeContent === "NEW" ? 700 : 400 }}>
                           {changeContent}
                        </TableCell>
                        <TableCell align="center" sx={{ color: 'white' }}>{formatCurrency(holding.value_usd)}</TableCell>
                        <TableCell align="center" sx={{ color: '#71717a' }}>{formatPercent(weight)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>
    </Fade>
  );
}