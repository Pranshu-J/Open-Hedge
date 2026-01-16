// LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Box, Button, Container, Typography, Paper, Alert } from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // If user is already logged in, redirect away
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/');
      }
    };
    checkUser();
  }, [navigate]);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Redirect back to this page or root after Google auth
          redirectTo: window.location.origin, 
        },
      });
      if (error) throw error;
    } catch (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  return (
    <Box sx={{ 
      minHeight: '80vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      bgcolor: '#000' 
    }}>
      <Container maxWidth="xs">
        <Paper sx={{ 
          p: 4, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          bgcolor: '#09090b',
          border: '1px solid #27272a',
          borderRadius: 2
        }}>
          <Typography variant="h5" sx={{ color: 'white', fontWeight: 700, mb: 1 }}>
            Welcome Back
          </Typography>
          <Typography variant="body2" sx={{ color: '#a1a1aa', mb: 4, textAlign: 'center' }}>
            Sign in to access your watchlist and personalized portfolio tracking.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3, width: '100%', bgcolor: 'rgba(211, 47, 47, 0.1)', color: '#ffcdd2' }}>
              {error}
            </Alert>
          )}

          <Button
            fullWidth
            variant="outlined"
            startIcon={<GoogleIcon />}
            onClick={handleGoogleLogin}
            disabled={loading}
            sx={{
              color: 'white',
              borderColor: '#27272a',
              py: 1.5,
              textTransform: 'none',
              fontSize: '1rem',
              bgcolor: 'rgba(255,255,255,0.02)',
              '&:hover': {
                borderColor: '#52525b',
                bgcolor: 'rgba(255,255,255,0.05)'
              }
            }}
          >
            {loading ? 'Connecting...' : 'Continue with Google'}
          </Button>
          
          <Typography variant="caption" sx={{ mt: 4, color: '#52525b' }}>
            Secured by Supabase Auth
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
}