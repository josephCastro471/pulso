import { createContext, useContext, useMemo, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const palette = {
  primary: '#0E7C86',
  primaryLight: '#E1F5EE',
  accent: '#D85A30',
  background: '#FBF9F6',
  surface: '#FFFFFF',
  textPrimary: '#2B2A28',
  textSecondary: '#6B6862',
  border: '#E5E1D8',
  success: '#3B8C5A',
  warning: '#C6821F',
  destructive: '#C0392B',
};

function buildTheme(mode) {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: { main: palette.primary, light: palette.primaryLight, contrastText: '#FFFFFF' },
      secondary: { main: palette.accent, contrastText: '#FFFFFF' },
      success: { main: palette.success },
      warning: { main: palette.warning },
      error: { main: palette.destructive },
      background: {
        default: isDark ? '#1E211F' : palette.background,
        paper: isDark ? '#282B29' : palette.surface,
      },
      text: {
        primary: isDark ? '#F2EFEA' : palette.textPrimary,
        secondary: isDark ? '#B7B3AB' : palette.textSecondary,
      },
      divider: isDark ? '#3A3D3B' : palette.border,
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily: 'Inter, sans-serif',
      h1: { fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, fontSize: 24, lineHeight: 1.3 },
      h2: { fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, fontSize: 18, lineHeight: 1.4 },
      body1: { fontSize: 16, fontWeight: 400, lineHeight: 1.6 },
      body2: { fontSize: 13, fontWeight: 500, lineHeight: 1.4 },
    },
    shadows: Object.assign([], createTheme().shadows, {
      1: '0 1px 3px rgba(43,42,40,0.06)',
    }),
    transitions: {
      duration: {
        standard: 200,
      },
      easing: {
        easeOut: 'ease-out',
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            textTransform: 'none',
            transition: 'all 200ms ease-out',
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: 'outlined',
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: '0 1px 3px rgba(43,42,40,0.06)',
          },
        },
      },
      MuiFab: {
        styleOverrides: {
          root: {
            boxShadow: '0 4px 12px rgba(14,124,134,0.25)',
          },
        },
      },
    },
  });
}

const ColorModeContext = createContext({ mode: 'light', toggleColorMode: () => {} });

export function useColorMode() {
  return useContext(ColorModeContext);
}

export function AppThemeProvider({ children }) {
  const [mode, setMode] = useState('light');

  const colorMode = useMemo(
    () => ({
      mode,
      toggleColorMode: () => setMode((prev) => (prev === 'light' ? 'dark' : 'light')),
    }),
    [mode]
  );

  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
