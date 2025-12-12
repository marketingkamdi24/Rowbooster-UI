import { Switch, Route, Link, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import SettingsPage from "@/pages/SettingsPage";
import LoginPage from "@/pages/LoginPage";
import LandingPage from "@/pages/LandingPage";
import RegisterPage from "@/pages/RegisterPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
// UserManagementPage removed - user CRUD operations only available in monitoring-system
import { Settings, LogOut, User, Shield, BarChart3, HelpCircle, Search } from "lucide-react";
import { TokenMonitoringDashboard } from "@/components/TokenMonitoringDashboard";
import { HelpModal } from "@/components/HelpModal";
import { useState } from "react";
import rowboosterLogo from "@konzept/Logo/RowBooster_WortBildmarke.png";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";

function Navigation({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [showTokenDashboard, setShowTokenDashboard] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  if (!user) return null;

  return (
    <SidebarProvider defaultOpen={true}>
      <Sidebar
        side="left"
        variant="sidebar"
        collapsible="offcanvas"
        className="bg-[color:var(--rb-primary-dark)] text-white"
      >
        <SidebarHeader className="px-3 py-3">
          <img
            src={rowboosterLogo}
            alt="rowbooster"
            className="h-7 w-auto object-contain"
          />
        </SidebarHeader>

        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location === "/"}>
                <Link href="/">
                  <a className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    <span>Suche</span>
                  </a>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setShowTokenDashboard((v) => !v)}
                isActive={showTokenDashboard}
              >
                <BarChart3 className="h-4 w-4" />
                <span>Token</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setShowHelpModal(true)}>
                <HelpCircle className="h-4 w-4" />
                <span>Hilfe</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarSeparator />

            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={location === "/settings"}>
                <Link href="/settings">
                  <a className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <span>Einstellungen</span>
                  </a>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="px-3 py-3">
          <div className="flex items-center gap-2 rounded-xl bg-white/[0.06] ring-1 ring-white/10 px-2.5 py-2">
            <div className={`p-1.5 rounded-lg shadow-lg ${
              user.role === "admin"
                ? "bg-gradient-to-br from-amber-400 to-orange-500 ring-1 ring-amber-300/30"
                : "bg-gradient-to-br from-blue-400 to-cyan-500 ring-1 ring-blue-300/30"
            }`}>
              {user.role === "admin" ? (
                <Shield className="h-4 w-4 text-white drop-shadow-sm" />
              ) : (
                <User className="h-4 w-4 text-white drop-shadow-sm" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white truncate">{user.username}</div>
              <div className={`text-[11px] font-medium capitalize ${
                user.role === "admin" ? "text-amber-300/80" : "text-cyan-300/80"
              }`}>{user.role}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              className="text-white/70 hover:text-red-300 hover:bg-red-500/10 h-8 w-8 rounded-lg"
              title="Abmelden"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-gradient-to-br from-slate-50 to-blue-50">
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/70 backdrop-blur">
          <div className="flex items-center gap-2 px-4 sm:px-6 py-3">
            <SidebarTrigger className="md:hidden" aria-label="Menü öffnen" />
            <SidebarTrigger className="hidden md:inline-flex" aria-label="Sidebar umschalten" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 truncate">
                {location === "/settings" ? "Einstellungen" : "Suche"}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {location === "/settings" ? "Konfiguration" : "Tabellendatenextraktion"}
              </div>
            </div>
          </div>
        </header>

        {showTokenDashboard && (
          <div className="border-b border-slate-200/80 bg-white">
            <div className="px-4 sm:px-6 py-4">
              <TokenMonitoringDashboard compact={true} />
            </div>
          </div>
        )}

        <HelpModal open={showHelpModal} onOpenChange={setShowHelpModal} />

        <main className="pb-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function AuthenticatedApp() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Laden...</p>
        </div>
      </div>
    );
  }

  // Public routes - accessible without authentication
  const publicRoutes = ['/', '/login', '/register', '/verify-email', '/forgot-password', '/reset-password'];
  const isPublicRoute = publicRoutes.includes(location);

  // If user is not logged in, show public pages
  if (!user) {
    return (
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/verify-email" component={VerifyEmailPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route component={LoginPage} />
      </Switch>
    );
  }

  // Authenticated routes
  return (
    <div className="min-h-screen">
      <Navigation>
        <Switch>
          {/* Redirect authenticated users from public routes to home */}
          <Route path="/login">
            <Redirect to="/" />
          </Route>
          <Route path="/register">
            <Redirect to="/" />
          </Route>
          <Route path="/verify-email">
            <Redirect to="/" />
          </Route>
          <Route path="/forgot-password">
            <Redirect to="/" />
          </Route>
          <Route path="/reset-password">
            <Redirect to="/" />
          </Route>
          <Route path="/" component={Home} />
          <Route path="/settings" component={SettingsPage} />
          {/* User management route removed - only available in monitoring-system */}
          <Route component={NotFound} />
        </Switch>
      </Navigation>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <AuthenticatedApp />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
