// LandingPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Container, Grid, Paper } from '@mui/material';
import { ArrowForward, ShowChart, Security, Speed, Storage, PieChart, Update } from '@mui/icons-material';

// --- Components ---

const FeatureCard = ({ icon, title, desc }) => (
  <Paper sx={{ 
    p: 4, 
    height: '100%', 
    display: 'flex',
    flexDirection: 'column',
    bgcolor: 'rgba(9, 9, 11, 0.4)', 
    border: '1px solid #27272a',
    borderRadius: 0, 
    transition: 'all 0.3s ease',
    '&:hover': { 
      borderColor: '#52525b',
      bgcolor: 'rgba(9, 9, 11, 0.8)',
      transform: 'translateY(-4px)'
    }
  }}>
    <Box sx={{ color: 'white', mb: 2, p: 1, width: 'fit-content', bgcolor: '#18181b', borderRadius: 0 }}>{icon}</Box>
    <Typography variant="h6" sx={{ color: 'white', mb: 1, fontWeight: 600 }}>
      {title}
    </Typography>
    <Typography variant="body2" sx={{ color: '#a1a1aa', lineHeight: 1.6 }}>
      {desc}
    </Typography>
  </Paper>
);

const StatItem = ({ value, label }) => (
  <Box sx={{ textAlign: 'center' }}>
    <Typography variant="h3" sx={{ fontWeight: 700, color: 'white', mb: 1 }}>{value}</Typography>
    <Typography variant="overline" sx={{ color: '#71717a', letterSpacing: '0.1em' }}>{label}</Typography>
  </Box>
);

// CSS Keyframes for the ticker
const tickerKeyframes = `
  @keyframes ticker {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
`;

const FundTicker = () => {
  const funds = ["BRIDGEWATER", "RENAISSANCE", "CITADEL", "BERKSHIRE HATHAWAY", "TWO SIGMA", "MILLENNIUM", "BLACKROCK", "ELLIOTT", "TIGER GLOBAL", "D.E. SHAW"];
  const displayFunds = [...funds, ...funds]; 

  return (
    <Box sx={{ 
      overflow: 'hidden', 
      whiteSpace: 'nowrap', 
      py: 2, 
      borderTop: '1px solid #27272a', 
      borderBottom: '1px solid #27272a',
      bgcolor: '#050505',
      position: 'relative'
    }}>
      <style>{tickerKeyframes}</style>
      <Box sx={{ 
        display: 'inline-block', 
        animation: 'ticker 30s linear infinite',
        whiteSpace: 'nowrap'
      }}>
        {displayFunds.map((fund, i) => (
          <Typography key={i} component="span" sx={{ 
            color: '#52525b', 
            fontWeight: 700, 
            mx: 4, 
            letterSpacing: '0.05em',
            fontSize: '0.875rem'
          }}>
            {fund}
          </Typography>
        ))}
      </Box>
      <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100px', height: '100%', background: 'linear-gradient(90deg, #000, transparent)' }} />
      <Box sx={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100%', background: 'linear-gradient(-90deg, #000, transparent)' }} />
    </Box>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/funds');
  };
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#000', overflow: 'hidden' }}>
      
      {/* Hero Section */}
      <Container maxWidth="lg" sx={{ pt: { xs: 8, md: 15 }, pb: 10, position: 'relative', zIndex: 1 }}>
        <Box sx={{
          position: 'absolute', top: -100, left: 0, right: 0, height: '800px',
          opacity: 0.15,
          backgroundImage: `linear-gradient(#27272a 1px, transparent 1px), linear-gradient(90deg, #27272a 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
          maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
          zIndex: -1
        }} />

        <Box sx={{ maxWidth: '800px', mx: 'auto', textAlign: 'center' }}>
          <Typography variant="h1" sx={{ 
            color: 'white', fontWeight: 800, 
            fontSize: { xs: '2.5rem', md: '5rem' },
            letterSpacing: '-0.02em', mb: 3, lineHeight: 1
          }}>
            Track the <br />
            <span style={{ 
              background: 'linear-gradient(to right, #fff, #71717a)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent' 
            }}>Smart Money.</span>
          </Typography>
          
          <Typography variant="body1" sx={{ color: '#a1a1aa', fontSize: '1.25rem', mb: 5, maxWidth: '600px', mx: 'auto' }}>
            Institutional grade analytics for SEC 13F filings. Visualize portfolio changes, historical returns, and asset allocation trends.
          </Typography>

          <Button
            onClick={handleGetStarted}
            endIcon={<ArrowForward />}
            disableRipple
            sx={{
              bgcolor: '#000', color: '#fff', border: '1px solid #3f3f46',
              borderRadius: 0, px: 6, py: 2, fontSize: '1.1rem',
              transition: 'all 0.3s ease',
              '&:hover': { bgcolor: '#fff', color: '#000', borderColor: '#fff' }
            }}
          >
            Get Started
          </Button>
        </Box>
      </Container>

      {/* Infinite Ticker */}
      <FundTicker />

      {/* Stats Section */}
      <Box sx={{ borderBottom: '1px solid #27272a', bgcolor: '#050505', py: 8 }}>
        <Container maxWidth="lg">
          <Grid container spacing={4} justifyContent="center">
            <Grid item xs={12} md={4}><StatItem value="60+" label="Institutions Analyzed" /></Grid>
            <Grid item xs={12} md={4}><StatItem value="8,600+" label="Assets Tracked" /></Grid>
            <Grid item xs={12} md={4}><StatItem value="Quarterly" label="Data Updates" /></Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features Grid */}
      <Container maxWidth="lg" sx={{ py: 12 }}>
        <Typography variant="h4" sx={{ color: 'white', mb: 6, fontWeight: 600 }}>
          Platform Capabilities
        </Typography>
        {/* Changed Grid to use md={6} for 2 items per row */}
        <Grid container spacing={4} alignItems="stretch">
          <Grid item xs={12} md={6}>
            <FeatureCard 
              icon={<ShowChart />} 
              title="Performance Tracking" 
              desc="Visualize quarterly portfolio value changes and estimate historical returns based on public filings."
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FeatureCard 
              icon={<Storage />} 
              title="Deep History" 
              desc="Access historical archives of 13F filings to analyze long-term holding strategies."
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FeatureCard 
              icon={<PieChart />} 
              title="Allocation Breakdown" 
              desc="See percentage weightings of every asset in a fund's portfolio instantly."
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FeatureCard 
              icon={<Security />} 
              title="Official SEC Data" 
              desc="Direct integration with EDGAR system ensures data accuracy and reliability."
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FeatureCard 
              icon={<Speed />} 
              title="Instant Search" 
              desc="Real-time search indexing for thousands of institutional funds and holding companies."
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FeatureCard 
              icon={<Update />} 
              title="Quarterly Updates" 
              desc="Automated processing of new filings 45 days after quarter end."
            />
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}