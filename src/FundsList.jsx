// FundsList.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { formatCurrency, formatPercent } from './utils';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, CircularProgress, Fade, Container 
} from '@mui/material';
import theme from './theme';

export default function FundsList({ onSelectCompany }) {
  const [fundsData, setFundsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'latestAUM', direction: 'desc' });

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);

      // 1. Fetch Funds (Limit increased to 10,000 to ensure we get all companies)
      const fundsReq = supabase
        .from('funds')
        .select('id, company_name, report_date, quarterly_return')
        .order('report_date', { ascending: false })
        .limit(10000); // Increased limit

      // 2. Fetch Valuations (Limit increased to 10,000)
      // We order by valuation_date DESC to ensure we get the newest numbers first
      // even if we hit the limit.
      const valuationsReq = supabase
        .from('fund_valuations')
        .select('fund_id, value_usd, valuation_date, id')
        .order('valuation_date', { ascending: false })
        .limit(10000); 

      const [fundsRes, valuationsRes] = await Promise.all([fundsReq, valuationsReq]);

      // --- DEBUGGING LOGS ---
      if (fundsRes.error) console.error("Error fetching funds:", fundsRes.error);
      if (valuationsRes.error) console.error("Error fetching valuations:", valuationsRes.error);

      if (!fundsRes.error && fundsRes.data) {
        
        // Step A: Map ID -> Company Name
        const fundIdToName = {};
        fundsRes.data.forEach(f => {
          fundIdToName[f.id] = f.company_name;
        });

        // Step B: Map Company Name -> Latest AUM
        const companyAumMap = {};
        
        if (valuationsRes.data) {
          valuationsRes.data.forEach(v => {
            const companyName = fundIdToName[v.fund_id];
            
            if (companyName) {
                // LOG SPECIFIC COMPANIES TO DEBUG

                // Only set if not already set (since we sorted by date DESC, first is newest)
                if (companyAumMap[companyName] === undefined) {
                    companyAumMap[companyName] = v.value_usd;
                }
            } else {
                // Warn if we have a valuation for a fund_id that wasn't found in the funds list
                // This might happen if the funds list query missed some IDs due to limits/filtering
                // console.warn(`Orphaned Valuation found for fund_id: ${v.fund_id}`);
            }
          });
        }

        // Step C: Merge
        const mergedData = fundsRes.data.map(f => ({
          ...f,
          aum: companyAumMap[f.company_name] || 0
        }));

        setFundsData(mergedData);
      }
      setLoading(false);
    };

    fetchAllData();
  }, []);

  const { rows, quarterHeaders } = useMemo(() => {
    if (fundsData.length === 0) return { rows: [], quarterHeaders: [] };

    const uniqueDates = [...new Set(fundsData.map(f => f.report_date))]
      .sort((a, b) => new Date(b) - new Date(a))
      .slice(0, 4);

    const grouped = fundsData.reduce((acc, curr) => {
      if (!acc[curr.company_name]) {
        acc[curr.company_name] = {
          name: curr.company_name,
          latestAUM: 0,
          quarters: {} 
        };
      }
      
      acc[curr.company_name].quarters[curr.report_date] = curr.quarterly_return;
      
      // Ensure we grab the AUM we found
      if (curr.aum > 0) {
        acc[curr.company_name].latestAUM = curr.aum;
      }
      
      return acc;
    }, {});

    let sortedRows = Object.values(grouped);

    if (sortConfig.key) {
      sortedRows.sort((a, b) => {
        let aVal, bVal;
        if (sortConfig.key === 'name') {
          aVal = a.name;
          bVal = b.name;
        } else if (sortConfig.key === 'latestAUM') {
          aVal = a.latestAUM;
          bVal = b.latestAUM;
        } else {
          aVal = a.quarters[sortConfig.key] ?? -Infinity;
          bVal = b.quarters[sortConfig.key] ?? -Infinity;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return { rows: sortedRows, quarterHeaders: uniqueDates };
  }, [fundsData, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const SortHeader = ({ label, sortKey, align = "center" }) => (
    <TableCell 
      align={align}
      onClick={() => handleSort(sortKey)}
      sx={{ 
        backgroundColor: '#09090b', 
        color: '#71717a', 
        cursor: 'pointer',
        '&:hover': { color: 'white' },
        borderBottom: '1px solid #27272a'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: (align === 'left' ? 'flex-start' : 'center'), gap: 0.5 }}>
        {label}
        <Typography variant="caption" sx={{ fontSize: '0.6rem', opacity: sortConfig.key === sortKey ? 1 : 0.3 }}>
          {sortConfig.key === sortKey ? (sortConfig.direction === 'desc' ? '▼' : '▲') : '▼'}
        </Typography>
      </Box>
    </TableCell>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress color="inherit" />
      </Box>
    );
  }

  return (
    <Fade in={true}>
      <Container maxWidth="lg" sx={{ mt: 5, pb: 10 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'white', mb: 1 }}>
            Hedge Fund Rankings
          </Typography>
          <Typography variant="body2" sx={{ color: '#71717a' }}>
            Comparative performance and latest AUM analysis based on SEC 13F filings.
          </Typography>
        </Box>

        <Paper sx={{ width: '100%', overflow: 'hidden', bgcolor: '#000', border: '1px solid #27272a' }}>
          <TableContainer>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <SortHeader label="Fund Name" sortKey="name" align="left" />
                  <SortHeader label="Latest AUM" sortKey="latestAUM" />
                  {quarterHeaders.map(date => (
                    <SortHeader key={date} label={date} sortKey={date} />
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow 
                    key={row.name} 
                    hover 
                    onClick={() => onSelectCompany(row.name)}
                    sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#18181b !important' } }}
                  >
                    <TableCell sx={{ color: 'white', fontWeight: 600, borderBottom: '1px solid #18181b' }}>
                      {row.name}
                    </TableCell>
                    <TableCell align="center" sx={{ color: 'white', fontFamily: theme.typography.fontFamilyMono, borderBottom: '1px solid #18181b' }}>
                      {formatCurrency(row.latestAUM)}
                    </TableCell>
                    {quarterHeaders.map(date => {
                      const ret = row.quarters[date];
                      const isDefined = ret !== undefined && ret !== null;
                      const sign = ret > 0 ? "+" : ""; 
                      return (
                        <TableCell 
                          key={date} 
                          align="center" 
                          sx={{ 
                            fontFamily: theme.typography.fontFamilyMono,
                            borderBottom: '1px solid #18181b',
                            color: isDefined ? (ret >= 0 ? '#4ade80' : '#f87171') : '#3f3f46'
                          }}
                        >
                          {isDefined ? `${sign}${formatPercent(ret)}` : '—'}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>
    </Fade>
  );
}