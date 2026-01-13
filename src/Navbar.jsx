// Navbar.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom'; // Import Router hooks
import { 
  Box, Typography, TextField, InputAdornment, Paper, List, 
  ListItem, ListItemText, CircularProgress, ButtonBase 
} from '@mui/material';
import { Search as SearchIcon, ArrowForward, Public } from '@mui/icons-material';

export default function Navbar() {
  const navigate = useNavigate();
  const [localSearch, setLocalSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  // Fetch Logic (internal to navbar now)
  useEffect(() => {
    if (localSearch.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      // NOTE: We need supabase imported here or passed as context. 
      // For simplicity, assuming supabase is available or passed via props. 
      // If props are removed from App.jsx, import supabase directly here:
      const { supabase } = await import('./supabaseClient'); 
      
      const { data, error } = await supabase
        .from('funds')
        .select('company_name')
        .ilike('company_name', `%${localSearch}%`)
        .limit(5);

      if (!error && data) {
        const uniqueNames = [...new Set(data.map(item => item.company_name))];
        setSearchResults(uniqueNames);
      }
      setIsSearching(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [localSearch]);

  const handleSelect = (name) => {
    setLocalSearch('');
    setSearchResults([]);
    navigate(`/fund/${encodeURIComponent(name)}`);
  };

  return (
    <Box sx={{ borderBottom: '1px solid #27272a', py: 1.5, px: 3, position: 'sticky', top: 0, zIndex: 1100, bgcolor: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', mx: 'auto' }}>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* LOGO */}
          <ButtonBase component={RouterLink} to="/" disableRipple sx={{ borderRadius: 2, p: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Public sx={{ color: 'white', fontSize: 24 }} />
              <Typography variant="h6" sx={{ letterSpacing: '0.05em', color: 'white', fontWeight: 700 }}>
                OPEN <span style={{ color: '#52525b', fontWeight: 400 }}>HEDGE</span>
              </Typography>
            </Box>
          </ButtonBase>

          {/* NAV LINKS */}
          <ButtonBase component={RouterLink} to="/funds" sx={{ color: '#a1a1aa', '&:hover': { color: 'white' }, fontSize: '0.875rem', fontWeight: 500, letterSpacing: '0.05em' }}>
            FUNDS
          </ButtonBase>
          <ButtonBase component={RouterLink} to="/stocks" sx={{ color: '#a1a1aa', '&:hover': { color: 'white' }, fontSize: '0.875rem', fontWeight: 500, letterSpacing: '0.05em' }}>
            STOCKS
          </ButtonBase>
        </Box>

        {/* SEARCH */}
        <Box sx={{ position: 'relative', width: { xs: '200px', md: '300px' } }}>
            <TextField
              fullWidth size="small" placeholder="Search Fund..." value={localSearch} 
              onChange={(e) => setLocalSearch(e.target.value)} 
              variant="outlined"
              InputProps={{
                startAdornment: ( <InputAdornment position="start"> {isSearching ? <CircularProgress size={16} color="inherit" /> : <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />} </InputAdornment> ),
                sx: { backgroundColor: '#09090b', fontSize: '0.875rem', borderRadius: '6px', '& fieldset': { borderColor: '#27272a' }, '&:hover fieldset': { borderColor: '#52525b' }, '&.Mui-focused fieldset': { borderColor: '#ffffff' } }
              }}
            />
            {searchResults.length > 0 && (
              <Paper sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1200, mt: 1, maxHeight: 400, overflow: 'auto', border: '1px solid #27272a', bgcolor: '#09090b' }}>
                <List disablePadding>
                  {searchResults.map((name) => (
                    <ListItem button key={name} onClick={() => handleSelect(name)} sx={{ borderBottom: '1px solid #18181b', '&:hover': { backgroundColor: '#18181b' }, py: 1 }}>
                      <ListItemText primary={name} primaryTypographyProps={{ color: 'white', fontSize: '0.875rem' }} />
                      <ArrowForward sx={{ fontSize: 14, color: '#52525b' }} />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
        </Box>
      </Box>
    </Box>
  );
}