// Navbar.jsx
import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, TextField, InputAdornment, Paper, List, 
  ListItem, ListItemText, CircularProgress, ButtonBase 
} from '@mui/material';
import { Search as SearchIcon, ArrowForward, Public } from '@mui/icons-material';

export default function Navbar({ 
  onLogoClick, 
  onRankingsClick,
  onStocksClick,
  searchTerm,      // This is now just the "committed" search term from parent
  onSearchChange,  // This will be called only after user stops typing
  isSearching, 
  searchResults, 
  onSelectCompany,
  hideSearch 
}) {
  // Local state for instant typing response
  const [localSearch, setLocalSearch] = useState(searchTerm);

  // Sync local state if the parent clears the search (e.g. after selection)
  useEffect(() => {
    setLocalSearch(searchTerm);
  }, [searchTerm]);

  const handleInputChange = (e) => {
    const newVal = e.target.value;
    setLocalSearch(newVal); // 1. Instant update UI

    // 2. Debounce the expensive parent update
    // Clear any existing timer to reset the clock
    if (window.searchTimer) clearTimeout(window.searchTimer);
    
    // Set a new timer: only update parent if user stops typing for 500ms
    window.searchTimer = setTimeout(() => {
      onSearchChange({ target: { value: newVal } });
    }, 500);
  };

  return (
    <Box sx={{ 
      borderBottom: '1px solid #27272a', 
      py: 1.5, 
      px: 3, 
      position: 'sticky', 
      top: 0, 
      zIndex: 1100, 
      bgcolor: 'rgba(0,0,0,0.8)', 
      backdropFilter: 'blur(12px)' 
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px', mx: 'auto' }}>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ButtonBase onClick={onLogoClick} disableRipple sx={{ borderRadius: 2, p: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Public sx={{ color: 'white', fontSize: 24 }} />
              <Typography variant="h6" sx={{ letterSpacing: '0.05em', color: 'white', fontWeight: 700 }}>
                OPEN <span style={{ color: '#52525b', fontWeight: 400 }}>HEDGE</span>
              </Typography>
            </Box>
          </ButtonBase>

          <ButtonBase 
            onClick={onRankingsClick} 
            sx={{ color: '#a1a1aa', '&:hover': { color: 'white' }, fontSize: '0.875rem', fontWeight: 500, letterSpacing: '0.05em' }}
          >
            FUNDS
          </ButtonBase>
        <ButtonBase 
            onClick={onStocksClick} 
            sx={{ color: '#a1a1aa', '&:hover': { color: 'white' }, fontSize: '0.875rem', fontWeight: 500, letterSpacing: '0.05em' }}
          >
            STOCKS
          </ButtonBase>

        </Box>

        {!hideSearch ? (
          <Box sx={{ position: 'relative', width: { xs: '200px', md: '300px' } }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search Fund..."
              value={localSearch} 
              onChange={handleInputChange} 
              variant="outlined"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    {isSearching ? <CircularProgress size={16} color="inherit" /> : <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />}
                  </InputAdornment>
                ),
                sx: { 
                  backgroundColor: '#09090b',
                  fontSize: '0.875rem',
                  borderRadius: '6px',
                  '& fieldset': { borderColor: '#27272a' },
                  '&:hover fieldset': { borderColor: '#52525b' },
                  '&.Mui-focused fieldset': { borderColor: '#ffffff' },
                }
              }}
            />
            {searchResults.length > 0 && (
              <Paper sx={{ 
                position: 'absolute', 
                top: '100%', 
                left: 0, 
                right: 0, 
                zIndex: 1200, 
                mt: 1, 
                maxHeight: 400, 
                overflow: 'auto', 
                border: '1px solid #27272a', 
                bgcolor: '#09090b' 
              }}>
                <List disablePadding>
                  {searchResults.map((name) => (
                    <ListItem 
                      button 
                      key={name} 
                      onClick={() => onSelectCompany(name)} 
                      sx={{ 
                        borderBottom: '1px solid #18181b', 
                        '&:hover': { backgroundColor: '#18181b' }, 
                        py: 1 
                      }}
                    >
                      <ListItemText primary={name} primaryTypographyProps={{ color: 'white', fontSize: '0.875rem' }} />
                      <ArrowForward sx={{ fontSize: 14, color: '#52525b' }} />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Box>
        ) : (
           <Box sx={{ width: { xs: '200px', md: '300px' } }} />
        )}
      </Box>
    </Box>
  );
}