// FundsList.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { formatCurrency, formatPercent } from './utils';
import { 
  Box, Typography, Paper, Table, TableBody, TableCell, 
  TableContainer, TableHead, TableRow, CircularProgress, Fade, Container,
  TextField, InputAdornment
} from '@mui/material';
import { Search } from '@mui/icons-material';
import theme from './theme';

const BATCH_SIZE = 20;

export default function FundsList() {
  const navigate = useNavigate();
  
  // -- State --
  const [fundsData, setFundsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  
  // -- FIX 1: Set default sort to AUM Descending --
  const [sortConfig, setSortConfig] = useState({ key: 'aum', direction: 'desc' });
  const [searchTerm, setSearchTerm] = useState('');

  // -- Refs for Infinite Scroll --
  const observer = useRef();
  const lastElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  // -- Data Fetching --
  useEffect(() => {
    const fetchBatch = async () => {
      setLoading(true);

      try {
        // -- FIX 2: Query the 'funds_ranked' View instead of raw tables --
        // This view already contains the 'aum' column, allowing us to sort by it perfectly.
        let query = supabase
          .from('funds_ranked') 
          .select('id, company_name, report_date, quarterly_return, aum');

        // Apply Search
        if (searchTerm) {
          query = query.ilike('company_name', `%${searchTerm}%`);
        }

        // Apply Sorting
        // Map UI keys to Database columns
        const dbSortKey = sortConfig.key === 'name' ? 'company_name' : sortConfig.key; 
        query = query.order(dbSortKey, { ascending: sortConfig.direction === 'asc' });

        // Apply Pagination
        const from = page * BATCH_SIZE;
        const to = from + BATCH_SIZE - 1;
        query = query.range(from, to);

        const { data, error } = await query;

        if (error) throw error;

        // Update State
        setFundsData(prev => {
          if (page === 0) return data;
          // Deduplicate just in case
          const existingIds = new Set(prev.map(p => p.id));
          const newItems = data.filter(d => !existingIds.has(d.id));
          return [...prev, ...newItems];
        });

        // Check if we reached the end
        if (data.length < BATCH_SIZE) {
          setHasMore(false);
        }

      } catch (err) {
        console.error("Error fetching funds batch:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBatch();
  }, [page, searchTerm, sortConfig]); 

  // -- Handlers --

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setPage(0);
    setFundsData([]);
    setHasMore(true);
  };

  const handleSort = (key) => {
    setSortConfig(prev => {
      const isSame = prev.key === key;
      return {
        key,
        direction: isSame && prev.direction === 'desc' ? 'asc' : 'desc'
      };
    });
    setPage(0);
    setFundsData([]);
    setHasMore(true);
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
        borderBottom: '1px solid #27272a',
        whiteSpace: 'nowrap',
        userSelect: 'none'
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

  return (
    <Fade in={true}>
      <Container maxWidth="lg" sx={{ mt: 5, pb: 10 }}>
        
        {/* Header & Search */}
        <Box sx={{ mb: 4, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'start', md: 'end' }, gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, color: 'white', mb: 1 }}>
              Hedge Fund Rankings
            </Typography>
            <Typography variant="body2" sx={{ color: '#71717a' }}>
              Ranked by Assets Under Management (AUM)
            </Typography>
          </Box>

          <TextField
            variant="outlined"
            size="small"
            placeholder="Search funds..."
            value={searchTerm}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: '#71717a' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              width: { xs: '100%', md: '300px' },
              '& .MuiOutlinedInput-root': {
                color: 'white',
                bgcolor: '#09090b',
                '& fieldset': { borderColor: '#27272a' },
                '&:hover fieldset': { borderColor: '#3f3f46' },
                '&.Mui-focused fieldset': { borderColor: 'white' },
              }
            }}
          />
        </Box>

        {/* Table */}
        <Paper sx={{ width: '100%', overflow: 'hidden', bgcolor: '#000', border: '1px solid #27272a' }}>
          <TableContainer sx={{ maxHeight: '70vh' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <SortHeader label="Fund Name" sortKey="name" align="left" />
                  <SortHeader label="Latest AUM" sortKey="aum" />
                  <SortHeader label="Report Date" sortKey="report_date" />
                  <SortHeader label="Return" sortKey="quarterly_return" />
                </TableRow>
              </TableHead>
              <TableBody>
                {fundsData.map((row, index) => {
                  const isLastElement = index === fundsData.length - 1;
                  
                  return (
                    <TableRow 
                      ref={isLastElement ? lastElementRef : null}
                      key={`${row.id}-${index}`} 
                      hover 
                      onClick={() => navigate(`/fund/${encodeURIComponent(row.company_name)}`)}
                      sx={{ cursor: 'pointer', '&:hover': { backgroundColor: '#18181b !important' } }}
                    >
                      <TableCell sx={{ color: 'white', fontWeight: 600, borderBottom: '1px solid #18181b' }}>
                        {row.company_name}
                      </TableCell>
                      <TableCell align="center" sx={{ color: 'white', fontFamily: theme.typography.fontFamilyMono, borderBottom: '1px solid #18181b' }}>
                        {formatCurrency(row.aum)}
                      </TableCell>
                      <TableCell align="center" sx={{ color: '#a1a1aa', fontFamily: theme.typography.fontFamilyMono, borderBottom: '1px solid #18181b' }}>
                        {row.report_date}
                      </TableCell>
                      <TableCell 
                        align="center" 
                        sx={{ 
                          fontFamily: theme.typography.fontFamilyMono,
                          borderBottom: '1px solid #18181b',
                          color: row.quarterly_return !== null 
                            ? (row.quarterly_return >= 0 ? '#4ade80' : '#f87171') 
                            : '#3f3f46'
                        }}
                      >
                        {row.quarterly_return !== null 
                          ? `${row.quarterly_return > 0 ? "+" : ""}${formatPercent(row.quarterly_return)}` 
                          : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}

                {!loading && fundsData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 8, color: '#71717a' }}>
                      No funds found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2, bgcolor: '#09090b', borderTop: '1px solid #27272a' }}>
              <CircularProgress size={24} color="inherit" sx={{ color: '#71717a' }} />
            </Box>
          )}
        </Paper>
      </Container>
    </Fade>
  );
}