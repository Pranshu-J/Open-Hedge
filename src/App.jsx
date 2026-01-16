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
import TrendingPage from './TrendingPage';
import LoginPage from './LoginPage'; // <--- Import here
import MyPortfolio from './MyPortfolio'; // <--- Import here

// Wrapper to make Navbar aware of current route for conditional rendering
const AppContent = () => {
  const location = useLocation();
  
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <Box sx={{ flexGrow: 1 }}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} /> {/* <--- Add Route here */}
          <Route path="/search" element={<SearchPage />} />
          <Route path="/funds" element={<FundsList />} />
          <Route path="/trending" element={<TrendingPage />} />
          <Route path="/portfolio" element={<MyPortfolio />} /> {/* <--- Add Route here */}
          
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