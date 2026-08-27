import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { DriverShell } from '@/components/layout/DriverShell';
import { DashboardPage } from '@/pages/DashboardPage';
import { ManagementDashboard } from '@/pages/ManagementDashboard';
import { SurveysPage } from '@/pages/SurveysPage';
import { CollectionsPage } from '@/pages/CollectionsPage';
import { DispatchPage } from '@/pages/DispatchPage';
import { InspectionsPage } from '@/pages/InspectionsPage';
import { RouteNavigationPage } from '@/pages/RouteNavigationPage';
import { WhatsAppPage } from '@/pages/WhatsAppPage';
import { InboxPage } from '@/pages/InboxPage';
import { CustomerPage } from '@/pages/CustomerPage';
import { AdminUsersPage } from '@/pages/AdminUsersPage';
import { TeamPage } from '@/pages/TeamPage';
import { WhatsAppTemplatesPage } from '@/pages/WhatsAppTemplatesPage';
import { DriverDashboardPage } from '@/pages/DriverDashboardPage';
import { FeedbackPage } from '@/pages/FeedbackPage';
import { LoginPage } from '@/pages/LoginPage';
import { SurveyPage } from '@/pages/SurveyPage';
import { AuthProvider } from '@/lib/auth-context';
import { screenAllow } from '@/lib/screen-access';
import { PermissionsPage } from '@/pages/PermissionsPage';
import { GlobalChatProvider } from '@/context/GlobalChatContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { ProtectedAdminRoute } from '@/components/ProtectedAdminRoute';
import { RoleBasedRoute, RedirectDriversHome, HomeByRole } from '@/components/RoleBasedRoute';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      // Freshness comes from the realtime channel (useRealtimeSync), which
      // invalidates the affected key the moment a row changes. Refetching whole
      // tables again on every window focus only duplicated that work — with
      // ~6k orders and ~5.5k service calls it meant multi-MB refetches each
      // time the user switched tabs.
      refetchOnWindowFocus: false,
      staleTime: 60 * 1000,
    },
  },
});

// 🔴 מי מגיע לאיזה מסך יושב ב-`lib/screen-access.ts`, מקור יחיד שגם
// הנתב וגם מסך ההרשאות קוראים ממנו.

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* סקר שביעות רצון — המסך היחיד שנפתח בלי משתמש. הלקוח מגיע אליו
                מקישור בוואטסאפ, והטוקן שבכתובת הוא כל הזיהוי. חייב לשבת מעל
                ה-catch-all, אחרת ProtectedRoute יזרוק אותו למסך התחברות. */}
            <Route path="/s/:token" element={<SurveyPage />} />

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
                        {/* שורש: סדרן ממשיך למסך הסדרן, שאר הצוות רואה את הדשבורד */}
                        <Route path="/" element={<RoleBasedRoute allow={screenAllow('/')}><HomeByRole><DashboardPage /></HomeByRole></RoleBasedRoute>} />
                        {/* אותו דשבורד בכתובת קבועה, כדי שגם לסדרן תהיה דרך אליו */}
                        <Route path="/orders" element={<RoleBasedRoute allow={screenAllow('/orders')}><DashboardPage /></RoleBasedRoute>} />
                        <Route path="/overview" element={<RoleBasedRoute allow={screenAllow('/overview')}><ManagementDashboard /></RoleBasedRoute>} />
                        <Route path="/surveys" element={<RoleBasedRoute allow={screenAllow('/surveys')}><SurveysPage /></RoleBasedRoute>} />
                        <Route path="/collections" element={<RoleBasedRoute allow={screenAllow('/collections')}><CollectionsPage /></RoleBasedRoute>} />
                        <Route path="/dispatch" element={<RoleBasedRoute allow={screenAllow('/dispatch')}><DispatchPage /></RoleBasedRoute>} />
                        {/* הראוטים הישנים מפנים למסך הסדרן המאוחד עם הטאב המתאים */}
                        <Route path="/routes" element={<Navigate to="/dispatch?tab=deliveries" replace />} />
                        <Route path="/service-calls" element={<Navigate to="/dispatch?tab=service" replace />} />
                        <Route path="/pickups" element={<Navigate to="/dispatch?tab=pickups" replace />} />
                        <Route path="/inspections" element={<RoleBasedRoute allow={screenAllow('/inspections')}><InspectionsPage /></RoleBasedRoute>} />
                        <Route path="/whatsapp" element={<RoleBasedRoute allow={screenAllow('/whatsapp')}><WhatsAppPage /></RoleBasedRoute>} />
                        <Route path="/inbox" element={<RoleBasedRoute allow={screenAllow('/inbox')}><InboxPage /></RoleBasedRoute>} />
                        <Route path="/customer" element={<RoleBasedRoute allow={screenAllow('/customer')}><CustomerPage /></RoleBasedRoute>} />
                        <Route
                          path="/admin/wa-templates"
                          element={
                            <ProtectedAdminRoute allow={screenAllow('/admin/wa-templates')}>
                              <WhatsAppTemplatesPage />
                            </ProtectedAdminRoute>
                          }
                        />
                        <Route
                          path="/admin/users"
                          element={
                            <ProtectedAdminRoute allow={screenAllow('/admin/users')}>
                              <AdminUsersPage />
                            </ProtectedAdminRoute>
                          }
                        />
                        <Route
                          path="/admin/permissions"
                          element={
                            <ProtectedAdminRoute allow={screenAllow('/admin/permissions')}>
                              <PermissionsPage />
                            </ProtectedAdminRoute>
                          }
                        />
                        <Route
                          path="/admin/team"
                          element={
                            <ProtectedAdminRoute allow={screenAllow('/admin/team')}>
                              <TeamPage />
                            </ProtectedAdminRoute>
                          }
                        />
                        <Route path="/route-navigation" element={<RoleBasedRoute allow={screenAllow('/route-navigation')}><RouteNavigationPage /></RoleBasedRoute>} />
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
