import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App';
import { SessionProvider } from './lib/session';
import { Toaster } from './components/ui/toast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15e3,
      refetchOnWindowFocus: true,
      // Never hammer the API on client errors; retry transient failures twice.
      retry: (count, err) => (err?.status && err.status < 500 ? false : count < 2),
    },
    mutations: { retry: false }, // money-moving requests are never auto-retried; idempotency keys cover manual retries
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionProvider>
          <App />
          <Toaster />
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
