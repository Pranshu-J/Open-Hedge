// App.jsx
import React, { useState, useEffect } from 'react';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { supabase } from './supabaseClient';
import theme from './theme';
import Navbar from './Navbar';
import LandingPage from './LandingPage';
import Dashboard from './Dashboard';
import SearchPage from './SearchPage';
import FundsList from './FundsList'; // Import the new file
import StockRankings from './StockRankings';

export default function App() {
  const [view, setView] = useState('landing'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [fundHistory, setFundHistory] = useState([]);
  const [initialFundId, setInitialFundId] = useState(null);

  useEffect(() => {
      // REMOVED THE TIMEOUT HERE.
      // We now rely on the Navbar/SearchPage to handle the delay.
      // This makes the app feel responsive: typing is instant, 
      // and the moment they stop, the query fires immediately.
      
      if (searchTerm.length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      const fetchFunds = async () => {
        setIsSearching(true);
        const { data, error } = await supabase
          .from('funds')
          .select('company_name')
          .ilike('company_name', `%${searchTerm}%`)
          .limit(10);

        if (!error && data) {
          const uniqueNames = [...new Set(data.map(item => item.company_name))];
          setSearchResults(uniqueNames);
        }
        setIsSearching(false);
      };

      fetchFunds();

    }, [searchTerm]);

  const handleSelectCompany = async (companyName) => {
    // 1. CLEAR EXISTING DATA IMMEDIATELY
    // This forces the browser to dump the old heavy array from memory
    setFundHistory([]); 
    setSelectedCompany(companyName);
    
    // Clear search context
    setSearchTerm(''); 
    setSearchResults([]);
    setIsSearching(false);
    
    // 2. Fetch new data
    const { data, error } = await supabase
      .from('funds')
      .select('*')
      .eq('company_name', companyName)
      .order('report_date', { ascending: false });

    if (!error && data && data.length > 0) {
      setFundHistory(data);
      setInitialFundId(data[0].id);
      setView('dashboard');
    }
  };

  const handleLogoClick = () => {
    setView('landing');
    setSelectedCompany(null);
  };

  const handleGetStarted = () => {
    setView('search');
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      
      <Navbar 
        onLogoClick={handleLogoClick}
        onRankingsClick={() => setView('rankings')} // New view logic
        onStocksClick={() => setView('stocks')}
        searchTerm={searchTerm}
        onSearchChange={(e) => setSearchTerm(e.target.value)}
        isSearching={isSearching}
        searchResults={searchResults}
        onSelectCompany={handleSelectCompany}
        hideSearch={view === 'search'} 
      />

      <Box sx={{ minHeight: 'calc(100vh - 72px)' }}>
        {view === 'landing' && (
          <LandingPage onGetStarted={handleGetStarted} />
        )}

        {view === 'search' && (
           <SearchPage 
             searchTerm={searchTerm}
             onSearchChange={(e) => setSearchTerm(e.target.value)}
             isSearching={isSearching}
             searchResults={searchResults}
             onSelectCompany={handleSelectCompany}
           />
        )}

        {view === 'rankings' && (
          <FundsList onSelectCompany={handleSelectCompany} />
        )}

        {/* 3. Add the new view condition */}
        {view === 'stocks' && (
          <StockRankings />
        )}

        {view === 'dashboard' && selectedCompany && (
          <Dashboard 
            selectedCompany={selectedCompany} 
            fundHistory={fundHistory}
            initialFundId={initialFundId}
          />
        )}
      </Box>
    </ThemeProvider>
  );
}