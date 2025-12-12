import { Route, Switch, Redirect, useLocation } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { useState, useEffect, useCallback } from 'react';
import LoginPage from '@/pages/LoginPage';
import Dashboard from '@/pages/Dashboard';
import UserListPage from '@/pages/UserListPage';
import UserDetailsPage from '@/pages/UserDetailsPage';
import ActivityLogsPage from '@/pages/ActivityLogsPage';
import ErrorLogsPage from '@/pages/ErrorLogsPage';
import ConsoleLogsPage from '@/pages/ConsoleLogsPage';
import SystemSettingsPage from '@/pages/SystemSettingsPage';
import ProductSearchPage from '@/pages/ProductSearchPage';
import EmailManagementPage from '@/pages/EmailManagementPage';
import Layout from '@/components/Layout';
import { onSessionExpired } from '@/lib/api';
import { useInactivityCheck } from '@/hooks/useInactivityCheck';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [location, setLocation] = useLocation();

  // Check auth on mount and when location changes
  useEffect(() => {
    // Prevent double auth check from React StrictMode
    if (authChecked) return;
    
    const abortController = new AbortController();
    
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          credentials: 'include',
          signal: abortController.signal,
        });
        // 401 is expected when not logged in - silently handle it
        if (!abortController.signal.aborted) {
          setIsAuthenticated(response.ok);
          setAuthChecked(true);
        }
      } catch (error: any) {
        // Only handle non-abort errors
        if (error.name !== 'AbortError' && !abortController.signal.aborted) {
          setIsAuthenticated(false);
          setAuthChecked(true);
        }
      }
    };

    checkAuth();

    return () => {
      abortController.abort();
    };
  }, [authChecked]);

  // Listen for session-expired events from API calls
  useEffect(() => {
    const unsubscribe = onSessionExpired(() => {
      console.log('[AUTH] Session expired, redirecting to login');
      setIsAuthenticated(false);
      setLocation('/login');
    });

    return unsubscribe;
  }, [setLocation]);

  // Track inactivity and check session validity
  // Only active when user is authenticated
  useInactivityCheck({
    enabled: isAuthenticated === true,
    inactivityTimeout: 55 * 60 * 1000, // 55 minutes (check before 1 hour server timeout)
    checkInterval: 60 * 1000, // Check every minute during inactivity
  });

  // Handle navigation after authentication changes
  useEffect(() => {
    if (isAuthenticated === true && location === '/login') {
      // Use setTimeout to ensure state is fully updated before navigation
      setTimeout(() => {
        setLocation('/');
      }, 0);
    } else if (isAuthenticated === false && location !== '/login') {
      setTimeout(() => {
        setLocation('/login');
      }, 0);
    }
  }, [isAuthenticated, location, setLocation]);

  const handleLogin = useCallback(async () => {
    // Add a small delay to ensure session is fully saved on server
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Re-verify the session is valid before updating state
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      if (response.ok) {
        setIsAuthenticated(true);
        // Force navigation to home page
        setLocation('/');
      } else {
        console.error('Login verification failed');
      }
    } catch (error) {
      console.error('Login verification error:', error);
    }
  }, [setLocation]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setIsAuthenticated(false);
      setLocation('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-lg neon-yellow">Loading...</div>
      </div>
    );
  }

  // If not authenticated and not on login page, show loading while redirect happens
  if (!isAuthenticated && location !== '/login') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-lg neon-yellow">Redirecting to login...</div>
      </div>
    );
  }

  // If authenticated and on login page, show loading while redirect happens
  if (isAuthenticated && location === '/login') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-lg neon-yellow">Redirecting to dashboard...</div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {!isAuthenticated ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <Switch>
          {/* Handle /login redirect when already authenticated */}
          <Route path="/login">
            <Redirect to="/" />
          </Route>
          <Route path="/users/:userId">
            {(params) => <UserDetailsPage userId={params.userId} onLogout={handleLogout} />}
          </Route>
          <Route path="/users">
            <Layout onLogout={handleLogout} onRefresh={handleRefresh}>
              <UserListPage key={refreshKey} />
            </Layout>
          </Route>
          <Route path="/activity">
            <Layout onLogout={handleLogout} onRefresh={handleRefresh}>
              <ActivityLogsPage key={refreshKey} />
            </Layout>
          </Route>
          <Route path="/errors">
            <Layout onLogout={handleLogout} onRefresh={handleRefresh}>
              <ErrorLogsPage key={refreshKey} />
            </Layout>
          </Route>
          <Route path="/product-searches">
            <Layout onLogout={handleLogout} onRefresh={handleRefresh}>
              <ProductSearchPage key={refreshKey} />
            </Layout>
          </Route>
          <Route path="/console-logs">
            <Layout onLogout={handleLogout} onRefresh={handleRefresh}>
              <ConsoleLogsPage key={refreshKey} />
            </Layout>
          </Route>
          <Route path="/system">
            <Layout onLogout={handleLogout} onRefresh={handleRefresh}>
              <SystemSettingsPage key={refreshKey} />
            </Layout>
          </Route>
          <Route path="/emails">
            <Layout onLogout={handleLogout} onRefresh={handleRefresh}>
              <EmailManagementPage key={refreshKey} />
            </Layout>
          </Route>
          {/* Dashboard route - must be last among specific routes due to "/" prefix matching */}
          <Route path="/">
            <Layout onLogout={handleLogout} onRefresh={handleRefresh}>
              <Dashboard key={refreshKey} />
            </Layout>
          </Route>
        </Switch>
      )}
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;