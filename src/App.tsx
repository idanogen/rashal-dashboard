import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { DriverShell } from '@/components/layout/DriverShell';
import { DashboardPage } from '@/pages/DashboardPage';
import { DeliveriesPage } from '@/pages/DeliveriesPage';
import { ServiceCallsPage } from '@/pages/ServiceCallsPage';
import { InspectionsPage } from '@/pages/InspectionsPage';
import { RouteNavigationPage } from '@/pages/RouteNavigationPage';
import { WhatsAppPage } from '@/pages/WhatsAppPage';
import { AdminUsersPage } from '@/pages/AdminUsersPage';
import { DriverDashboardPage } from '@/pages/DriverDashboardPage';
import { FeedbackPage } from '@/pages/FeedbackPage';
import { LoginPage } from '@/pages/LoginPage';
import { AuthProvider } from '@/lib/auth-context';
import { GlobalChatProvider } from '@/context/GlobalChatContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ProtectedAdminRoute } from '@/components/ProtectedAdminRoute';
import { RoleBasedRoute, RedirectDriversHome } from '@/components/RoleBasedRoute';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

// Non-driver roles use the full admin/dispatcher layout
const STAFF_ROLES = ['admin', 'dispatcher', 'viewer'] as const;

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Driver view — minimal layout, mobile-first */}
            <Route
              path="/driver"
              element={
                <ProtectedRoute>
                  <RoleBasedRoute allow={['driver']}>
                    <DriverShell>
                      <DriverDashboardPage />
                    </DriverShell>
                  </RoleBasedRoute>
                </ProtectedRoute>
              }
            />

            {/* Feedback/notes board — accessible to every authenticated role */}
            <Route
              path="/feedback"
              element={
                <ProtectedRoute>
                  <FeedbackPage />
                </ProtectedRoute>
              }
            />

            {/* Staff (admin / dispatcher / viewer) — full dashboard */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <RedirectDriversHome>
                    <GlobalChatProvider>
                    <AppShell>
                      <Routes>
                        <Route path="/" element={<RoleBasedRoute allow={[...STAFF_ROLES]}><DashboardPage /></RoleBasedRoute>} />
                        <Route path="/routes" element={<RoleBasedRoute allow={[...STAFF_ROLES]}><DeliveriesPage /></RoleBasedRoute>} />
                        <Route path="/service-calls" element={<RoleBasedRoute allow={[...STAFF_ROLES]}><ServiceCallsPage /></RoleBasedRoute>} />
                        <Route path="/inspections" element={<RoleBasedRoute allow={[...STAFF_ROLES]}><InspectionsPage /></RoleBasedRoute>} />
                        <Route path="/whatsapp" element={<RoleBasedRoute allow={[...STAFF_ROLES]}><WhatsAppPage /></RoleBasedRoute>} />
                        <Route
                          path="/admin/users"
                          element={
                            <ProtectedAdminRoute>
                              <AdminUsersPage />
                            </ProtectedAdminRoute>
                          }
                        />
                        <Route path="/route-navigation" element={<RoleBasedRoute allow={[...STAFF_ROLES, 'driver']}><RouteNavigationPage /></RoleBasedRoute>} />
                      </Routes>
                    </AppShell>
                    </GlobalChatProvider>
                  </RedirectDriversHome>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Toaster
        position="bottom-left"
        dir="rtl"
        richColors
        closeButton
        expand
        toastOptions={{
          style: {
            fontFamily: 'Assistant, system-ui, sans-serif',
          },
          classNames: {
            toast:
              'rounded-2xl border shadow-2xl px-5 py-4 gap-3 items-center',
            title: 'text-[15px] font-bold leading-tight',
            description: 'text-sm opacity-90',
            icon: 'scale-125',
            actionButton: 'rounded-lg font-semibold',
            cancelButton: 'rounded-lg',
            closeButton: 'rounded-full',
          },
        }}
      />
    </QueryClientProvider>
  );
}

export default App;
