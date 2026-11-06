import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import './index.css';

import { createTheme, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './i18n';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

// Nepal flag crimson as the primary colour, same as the mobile app.
const theme = createTheme({
  primaryColor: 'crimson',
  colors: {
    crimson: [
      '#ffe9ec', '#fcd3d8', '#f4a5ae', '#ed7482', '#e74b5d',
      '#e33145', '#e2233a', '#c8102e', '#b30628', '#9d0020',
    ],
  },
  fontFamily: "'Noto Sans Devanagari', system-ui, sans-serif",
  defaultRadius: 'md',
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <Notifications position="top-right" />
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
);
