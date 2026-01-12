// theme.js
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#000000', // True black like Cursor/Terminal
      paper: '#09090b',   // Very dark zinc for cards
    },
    primary: {
      main: '#ffffff',
    },
    secondary: {
      main: '#A1A1AA', // Zinc-400
    },
    divider: '#27272a', // Zinc-800 for subtle borders
    text: {
      primary: '#ffffff',
      secondary: '#a1a1aa',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontSize: '2rem', fontWeight: 600, letterSpacing: '-0.02em' },
    h2: { fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h6: { fontSize: '0.875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
    body1: { fontSize: '1rem', lineHeight: 1.6 },
    fontFamilyMono: '"JetBrains Mono", "Fira Code", monospace', // For financial data
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 6,
          fontWeight: 500,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 0, // Sharp corners like terminal windows
          border: '1px solid #27272a',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #27272a',
          fontFamily: '"JetBrains Mono", "Fira Code", monospace', // Data looks like code
          padding: '12px 16px',
        },
        head: {
          fontWeight: 600,
          color: '#71717a', // Zinc-500
          textTransform: 'uppercase',
          fontSize: '0.75rem',
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          '& fieldset': { borderColor: '#27272a' },
          '&:hover fieldset': { borderColor: '#52525b' },
          '&.Mui-focused fieldset': { borderColor: '#ffffff' },
        },
      },
    },
  },
});

export default theme;