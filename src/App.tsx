import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/pages/DashboardPage';
import { DeliveriesPage } from '@/pages/DeliveriesPage';
import { ServiceCallsPage } from '@/pages/ServiceCallsPage';
import { RouteNavigationPage } from '@/pages/RouteNavigationPage';
import { LoginPage } from '@/pages/LoginPage';
import { AuthProvider } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/ProtectedRoute';

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
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Routes>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/routes" element={<DeliveriesPage />} />
                      <Route path="/service-calls" element={<ServiceCallsPage />} />
                      <Route path="/route-navigation" element={<RouteNavigationPage />} />
                    </Routes>
                  </AppShell>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
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
