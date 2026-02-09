import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/pages/DashboardPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell>
        <DashboardPage />
      </AppShell>
      <Toaster
        position="bottom-left"
        toastOptions={{
          style: {
            fontFamily: 'Assistant, system-ui, sans-serif',
          },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;
