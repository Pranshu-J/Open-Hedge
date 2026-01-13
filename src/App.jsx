// App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import theme from './theme';
import Navbar from './Navbar';
import LandingPage from './LandingPage';
import Dashboard from './Dashboard';
import SearchPage from './SearchPage';
import FundsList from './FundsList';
import StockRankings from './StockRankings';

// Wrapper to make Navbar aware of current route for conditional rendering
const AppContent = () => {
  const location = useLocation();
  const isLanding = location.pathname === '/';
  
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Show Navbar on all pages except Landing (optional, but standard practice) */}
      <Navbar />

      <Box sx={{ flexGrow: 1 }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/funds" element={<FundsList />} />
          
          {/* Dynamic Routes for URL Navigation */}
          <Route path="/fund/:companyName" element={<Dashboard />} />
          
          <Route path="/stocks" element={<StockRankings />} />
          <Route path="/stocks/:ticker" element={<StockRankings />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
    </Box>
  );
};

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
}