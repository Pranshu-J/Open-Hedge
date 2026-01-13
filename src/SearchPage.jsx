// SearchPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, TextField, InputAdornment, Paper, List, ListItem, ListItemText, CircularProgress, Container } from '@mui/material';
import { Search as SearchIcon, ArrowForward } from '@mui/icons-material';

export default function SearchPage({ 
  searchTerm, 
  onSearchChange, 
  isSearching, 
  searchResults
}) {
  const [localSearch, setLocalSearch] = useState(searchTerm);

  useEffect(() => {
    setLocalSearch(searchTerm);
  }, [searchTerm]);

  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const newVal = e.target.value;
    setLocalSearch(newVal);

    if (window.searchPageTimer) clearTimeout(window.searchPageTimer);
    window.searchPageTimer = setTimeout(() => {
      onSearchChange({ target: { value: newVal } });
    }, 500);
  };

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
          Search Funds
        </Typography>
        <Typography variant="body1" sx={{ color: '#a1a1aa', mb: 5 }}>
          Enter a fund or holding company name to begin analysis.
        </Typography>

        <Box sx={{ position: 'relative', width: '100%' }}>
          <TextField
            fullWidth
            autoFocus
            placeholder="e.g. Berkshire Hathaway"
            value={localSearch} // Use local state
            onChange={handleInputChange} // Use local handler
            variant="outlined"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  {isSearching ? <CircularProgress size={24} color="inherit" /> : <SearchIcon sx={{ color: 'text.secondary', fontSize: 24 }} />}
                </InputAdornment>
              ),
              sx: { 
                backgroundColor: '#09090b',
                fontSize: '1.25rem',
                py: 1,
                borderRadius: '8px',
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
              bgcolor: '#09090b',
              textAlign: 'left'
            }}>
              <List disablePadding>
                {searchResults.map((name) => (
                  <ListItem 
                    button 
                    key={name} 
                    onClick={() => navigate(`/fund/${encodeURIComponent(name)}`)} 
                    sx={{ 
                      borderBottom: '1px solid #18181b', 
                      '&:hover': { backgroundColor: '#18181b' }, 
                      py: 2
                    }}
                  >
                    <ListItemText 
                      primary={name} 
                      primaryTypographyProps={{ color: 'white', fontSize: '1rem' }} 
                    />
                    <ArrowForward sx={{ fontSize: 16, color: '#52525b' }} />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </Box>
      </Box>
    </Container>
  );
}