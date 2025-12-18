import { Switch, Route, Link, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import SettingsPage from "@/pages/SettingsPage";
import LoginPage from "@/pages/LoginPage";
import LandingPage from "@/pages/LandingPage";
import RegisterPage from "@/pages/RegisterPage";
import VerifyEmailPage from "@/pages/VerifyEmailPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import ImpressumPage from "@/pages/ImpressumPage";
import DatenschutzPage from "@/pages/DatenschutzPage";
import AGBPage from "@/pages/AGBPage";
import UeberUnsPage from "@/pages/UeberUnsPage";
// UserManagementPage removed - user CRUD operations only available in monitoring-system
import { Settings, LogOut, User, Shield, BarChart3, HelpCircle, Search, Globe, ExternalLink, Zap, X, ChevronLeft, ChevronRight, Sun, Moon } from "lucide-react";
import { TokenMonitoringDashboard } from "@/components/TokenMonitoringDashboard";
import { HelpModal } from "@/components/HelpModal";
import { useState } from "react";
import rowboosterLogo from "@konzept/Logo/RowBooster_WortBildmarke.png";
import rowboosterBildmarke from "@konzept/Logo/RowBooster_Bildmarke.png";
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
  useSidebar,
} from "@/components/ui/sidebar";

// Mobile Token Stats Bar Component - compact secondary navbar
function MobileTokenBar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user } = useAuth();
  
  // Fetch token stats for mobile bar
  const { data: tokenStats } = useQuery<{ totalTokens: number; todayUsage: { inputTokens: number; outputTokens: number } }>({
    queryKey: user ? [`/api/token-usage/stats/user/${user.id}`] : ["/api/token-usage/stats"],
    enabled: !!user && isOpen,
    staleTime: 30000,
  });
  
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };
  
  const todayTotal = tokenStats?.todayUsage 
    ? tokenStats.todayUsage.inputTokens + tokenStats.todayUsage.outputTokens 
    : 0;
  
  return (
    <div 
      className={`md:hidden fixed top-14 left-0 right-0 z-40 transition-all duration-300 ease-out ${
        isOpen 
          ? 'opacity-100 translate-y-0' 
          : 'opacity-0 -translate-y-full pointer-events-none'
      }`}
    >
      <div className="bg-gradient-to-r from-[#0c2443] to-[#0E1621] border-b border-white/10 shadow-lg">
        {/* Compact Token Stats Bar */}
        <div className="px-3 py-2">
          <div className="flex items-center justify-between">
            {/* Left: Token Icon & Label */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#17c3ce]/20 to-[#c8fa64]/20 flex items-center justify-center">
                <BarChart3 className="h-3.5 w-3.5 text-[#17c3ce]" />
              </div>
              <span className="text-xs font-semibold text-white/90">Token</span>
            </div>
            
            {/* Center: Quick Stats */}
            <div className="flex items-center gap-3">
              <div className="text-center">
                <p className="text-[10px] text-white/50">Heute</p>
                <p className="text-xs font-bold text-[#c8fa64]">{formatNumber(todayTotal)}</p>
              </div>
              <div className="w-px h-6 bg-white/10" />
              <div className="text-center">
                <p className="text-[10px] text-white/50">Gesamt</p>
                <p className="text-xs font-bold text-[#17c3ce]">{formatNumber(tokenStats?.totalTokens || 0)}</p>
              </div>
            </div>
            
            {/* Right: Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-white/60 hover:text-white transition-all"
              aria-label="Schließen"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Token Dashboard Panel Component - uses useSidebar to position correctly
// Mobile: Compact fixed secondary navbar below main navbar
// Desktop: Side panel next to sidebar
function TokenDashboardPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { state } = useSidebar();
  const isSidebarExpanded = state === "expanded";
  
  return (
    <>
      {/* ===== MOBILE VERSION: Compact Secondary Navbar ===== */}
      <MobileTokenBar isOpen={isOpen} onClose={onClose} />
      
      {/* ===== DESKTOP VERSION: Side Panel ===== */}
      <div 
        className={`hidden md:block fixed top-14 z-20 h-[calc(100vh-3.5rem)] transition-all duration-300 ease-out ${
          isOpen 
            ? `opacity-100 ${isSidebarExpanded ? 'left-[calc(var(--sidebar-width)+0.75rem)]' : 'left-3'}` 
            : `opacity-0 pointer-events-none -translate-x-4 ${isSidebarExpanded ? 'left-[calc(var(--sidebar-width)+0.75rem)]' : 'left-3'}`
        }`}
      >
        <div className="h-full w-[280px] py-3">
          <div className="relative h-full overflow-hidden rounded-2xl bg-gradient-to-b from-[#0E1621] to-[#0c2443] border border-white/[0.08] shadow-2xl">
            {/* Header */}
            <div className="relative flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#17c3ce]/20 to-[#c8fa64]/20 flex items-center justify-center">
                  <BarChart3 className="h-4 w-4 text-[#17c3ce]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Token Übersicht</h3>
                  <p className="text-[11px] text-white/50">Verbrauch & Statistiken</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] hover:border-white/[0.15] text-white/60 hover:text-white transition-all duration-200"
                aria-label="Schließen"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Content */}
            <div className="h-[calc(100%-65px)] overflow-y-auto p-4 custom-scrollbar">
              <TokenMonitoringDashboard compact={true} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Custom Sidebar Toggle Button Component - rendered outside sidebar to avoid overflow clipping
function SidebarToggleButton() {
  const { state, toggleSidebar } = useSidebar();
  const isExpanded = state === "expanded";
  
  // When expanded: position inside sidebar at top-right
  // When collapsed: position at left edge, protruding out
  // On mobile: Hidden - use mobile menu button in header instead
  return (
    <button
      onClick={toggleSidebar}
      className={`hidden md:block fixed z-50 p-2 rounded-lg transition-all duration-300 ${
        isExpanded 
          ? 'top-[5.25rem] left-[13.5rem] bg-white/[0.08] hover:bg-white/[0.15] border border-white/[0.1] hover:border-white/[0.2] text-white/60 hover:text-white' 
          : 'top-[5.25rem] left-0 rounded-l-none bg-gradient-to-r from-[#0c2443] to-[#17c3ce] border-y border-r border-[#17c3ce]/50 text-white shadow-[0_0_20px_rgba(23,195,206,0.4)] hover:shadow-[0_0_30px_rgba(23,195,206,0.6)]'
      }`}
      aria-label={isExpanded ? "Sidebar einklappen" : "Sidebar ausklappen"}
    >
      {isExpanded ? (
        <ChevronLeft className="h-4 w-4" />
      ) : (
        <ChevronRight className="h-5 w-5" />
      )}
    </button>
  );
}

// Mobile Menu Button Component - only visible on mobile
function MobileMenuButton({ onClick, isOpen }: { onClick: () => void; isOpen: boolean }) {
  const { theme } = useTheme();
  
  return (
    <button
      onClick={onClick}
      className={`md:hidden p-2 rounded-lg transition-all duration-300 ${
        theme === 'dark'
          ? 'text-white/70 hover:text-white hover:bg-white/10'
          : 'text-[#0c2443]/70 hover:text-[#0c2443] hover:bg-[#17c3ce]/10'
      }`}
      aria-label={isOpen ? "Menü schließen" : "Menü öffnen"}
    >
      {isOpen ? (
        <X className="h-5 w-5" />
      ) : (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      )}
    </button>
  );
}

function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  
  return (
    <button
      onClick={toggleTheme}
      className={`p-2 rounded-lg transition-all duration-300 ${
        theme === 'dark'
          ? 'text-white/60 hover:text-white hover:bg-white/10'
          : 'text-[#0c2443]/60 hover:text-[#0c2443] hover:bg-[#17c3ce]/10'
      }`}
      title={theme === 'dark' ? 'Zum Light Mode wechseln' : 'Zum Dark Mode wechseln'}
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}

function Navigation({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const [location] = useLocation();
  const [showTokenDashboard, setShowTokenDashboard] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  if (!user) return null;

  return (
    <SidebarProvider defaultOpen={true}>
      {/* Sidebar Toggle Button - fixed outside sidebar (desktop only) */}
      <SidebarToggleButton />

      {/* Top Header Bar for Profile/Search */}
      <div className={`fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-3 sm:px-4 transition-colors duration-300 ${
        theme === 'dark' 
          ? 'bg-[#0E1621]' 
          : 'bg-[#ecf5fa] border-b border-[#17c3ce]/20'
      }`}>
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Mobile Menu Button */}
          <MobileMenuButton onClick={() => setShowMobileMenu(!showMobileMenu)} isOpen={showMobileMenu} />
          <img
            src={rowboosterBildmarke}
            alt="rowbooster"
            className="h-5 sm:h-6 w-auto object-contain sm:hidden"
          />
          <img
            src={rowboosterLogo}
            alt="rowbooster"
            className={`h-6 w-auto object-contain hidden sm:block ${theme === 'light' ? 'brightness-0' : ''}`}
          />
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggleButton />
          <button className={`hidden sm:block p-2 rounded-lg transition-colors ${
            theme === 'dark'
              ? 'text-white/60 hover:text-white hover:bg-white/10'
              : 'text-[#0c2443]/60 hover:text-[#0c2443] hover:bg-[#17c3ce]/10'
          }`}>
            <Search className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className={`p-1 sm:p-1.5 rounded-lg ${user.role === "admin" ? "bg-gradient-to-br from-amber-400 to-orange-500" : "bg-gradient-to-br from-blue-400 to-cyan-500"}`}>
              {user.role === "admin" ? <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" /> : <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <div 
        className={`md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          showMobileMenu ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setShowMobileMenu(false)}
      />
      
      {/* Mobile Menu Panel - Slides in from left */}
      <div 
        className={`md:hidden fixed top-14 left-0 bottom-0 w-64 z-50 transition-all duration-300 ease-out ${
          showMobileMenu 
            ? 'opacity-100 translate-x-0' 
            : 'opacity-0 -translate-x-full pointer-events-none'
        }`}
      >
        <div className="h-full m-3 mr-0 rounded-l-2xl rounded-r-none overflow-hidden bg-gradient-to-b from-[#0c2443] to-[#1a4a6e] border border-white/10 border-r-0 shadow-2xl">
          <nav className="p-3 space-y-1">
            {/* Token */}
            <button
              onClick={() => {
                setShowTokenDashboard(!showTokenDashboard);
                setShowMobileMenu(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all duration-200 ${
                showTokenDashboard 
                  ? 'bg-[#17c3ce]/20 text-[#17c3ce]' 
                  : 'text-white/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <BarChart3 className="h-5 w-5" />
              <span className="font-medium text-sm">Token</span>
            </button>
            
            <div className="h-px bg-white/10 my-2" />
            
            {/* Datenboost */}
            <Link href="/">
              <a 
                onClick={() => setShowMobileMenu(false)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  location === '/' 
                    ? 'bg-[#c8fa64]/20 text-[#c8fa64]' 
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Zap className="h-5 w-5" />
                <span className="font-medium text-sm">Datenboost</span>
              </a>
            </Link>
            
            {/* Hilfe */}
            <button
              onClick={() => {
                setShowHelpModal(true);
                setShowMobileMenu(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-white/80 hover:bg-white/10 hover:text-white transition-all duration-200"
            >
              <HelpCircle className="h-5 w-5" />
              <span className="font-medium text-sm">Hilfe</span>
            </button>
            
            {/* Einstellungen */}
            <Link href="/settings">
              <a 
                onClick={() => setShowMobileMenu(false)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  location === '/settings' 
                    ? 'bg-[#c8fa64]/20 text-[#c8fa64]' 
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Settings className="h-5 w-5" />
                <span className="font-medium text-sm">Einstellungen</span>
              </a>
            </Link>
            
            <div className="h-px bg-white/10 my-2" />
            
            {/* Logout */}
            <button
              onClick={() => {
                logout();
                setShowMobileMenu(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-red-400 hover:bg-red-500/10 transition-all duration-200"
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium text-sm">Abmelden</span>
            </button>
          </nav>
        </div>
      </div>

      <Sidebar
        side="left"
        variant="sidebar"
        collapsible="icon"
        className={`hidden md:flex mt-[4.5rem] ml-3 mb-3 h-[calc(100vh-5.25rem)] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden transition-all duration-300 group-data-[state=collapsed]:ml-0 group-data-[state=collapsed]:rounded-l-none z-30 ${
          theme === 'dark'
            ? 'bg-gradient-to-b from-[#0c2443] to-[#1a4a6e] text-white'
            : 'bg-gradient-to-b from-[#17c3ce] to-[#0ea5b0] text-white'
        }`}
      >

        <SidebarContent className="pt-14 px-3 flex flex-col h-full">
          {/* Token - über der Linie */}
          <SidebarMenu className="space-y-2">
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => setShowTokenDashboard((v) => !v)}
                isActive={showTokenDashboard}
                className="h-12 text-base gap-4 px-4"
              >
                <BarChart3 className="h-5 w-5" />
                <span className="font-medium tracking-wide uppercase text-sm">Token</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          <SidebarSeparator className="my-6" />

          {/* Datenboost / Hilfe / Einstellungen - unter der Linie */}
          <SidebarMenu className="space-y-2">
            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild
                isActive={location === "/"}
                className="h-12 text-base gap-4 px-4"
              >
                <Link href="/">
                  <a className="flex items-center gap-4">
                    <Zap className="h-5 w-5" />
                    <span className="font-medium tracking-wide uppercase text-sm">Datenboost</span>
                  </a>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={() => setShowHelpModal(true)}
                className="h-12 text-base gap-4 px-4"
              >
                <HelpCircle className="h-5 w-5" />
                <span className="font-medium tracking-wide uppercase text-sm">Hilfe</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild 
                isActive={location === "/settings"}
                className="h-12 text-base gap-4 px-4"
              >
                <Link href="/settings">
                  <a className="flex items-center gap-4">
                    <Settings className="h-5 w-5" />
                    <span className="font-medium tracking-wide uppercase text-sm">Einstellungen</span>
                  </a>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Zur Startseite - ganz unten */}
          <SidebarMenu className="mb-4">
            <SidebarMenuItem>
              <SidebarMenuButton 
                asChild
                className="h-12 text-base gap-4 px-4"
              >
                <a href="/landing" className="flex items-center gap-4">
                  <Globe className="h-5 w-5" />
                  <span className="font-medium tracking-wide uppercase text-sm">Zur Startseite</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="px-4 py-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.08] px-3 py-3">
            <div className={`p-2 rounded-lg ${
              user.role === "admin"
                ? "bg-gradient-to-br from-amber-400 to-orange-500"
                : "bg-gradient-to-br from-blue-400 to-cyan-500"
            }`}>
              {user.role === "admin" ? (
                <Shield className="h-4 w-4 text-white" />
              ) : (
                <User className="h-4 w-4 text-white" />
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

      {/* Fixed background effects - completely outside SidebarInset so they never shift */}
      <div className={`pointer-events-none fixed inset-0 opacity-70 -z-10 transition-colors duration-300 ${
        theme === 'dark'
          ? 'bg-[linear-gradient(135deg,#0E1621_0%,#1a2332_100%)]'
          : 'bg-[linear-gradient(135deg,#ecf5fa_0%,#e0f0f5_100%)]'
      }`}>
        <div className={`absolute inset-0 [background-size:60px_60px] ${
          theme === 'dark'
            ? '[background-image:linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)]'
            : '[background-image:linear-gradient(rgba(23,195,206,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(23,195,206,0.08)_1px,transparent_1px)]'
        }`} />
        <div className={`absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full blur-2xl ${
          theme === 'dark'
            ? 'bg-[radial-gradient(circle_at_center,rgba(200,250,100,0.10),transparent_60%)]'
            : 'bg-[radial-gradient(circle_at_center,rgba(23,195,206,0.15),transparent_60%)]'
        }`} />
        <div className={`absolute -bottom-56 -right-56 h-[620px] w-[620px] rounded-full blur-2xl ${
          theme === 'dark'
            ? 'bg-[radial-gradient(circle_at_center,rgba(23,195,206,0.12),transparent_60%)]'
            : 'bg-[radial-gradient(circle_at_center,rgba(23,195,206,0.20),transparent_60%)]'
        }`} />
      </div>

      <SidebarInset className="relative overflow-hidden pt-14 w-full max-w-full">
        <HelpModal open={showHelpModal} onOpenChange={setShowHelpModal} />

        {/* Main Content - shifts right when Token Dashboard is open (desktop only), adds top padding on mobile */}
        <div 
          className={`relative z-10 h-[calc(100vh-3.5rem)] transition-all duration-300 ease-out ${
            showTokenDashboard ? 'md:pl-[292px] pt-12 md:pt-0' : ''
          } pl-0`}
        >
          <main className="relative h-full pb-8 overflow-y-auto">
            {children}
          </main>
        </div>
      </SidebarInset>

      {/* Token Dashboard Side Panel */}
      <TokenDashboardPanel 
        isOpen={showTokenDashboard} 
        onClose={() => setShowTokenDashboard(false)} 
      />
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
        <Route path="/impressum" component={ImpressumPage} />
        <Route path="/datenschutz" component={DatenschutzPage} />
        <Route path="/agb" component={AGBPage} />
        <Route path="/ueber-uns" component={UeberUnsPage} />
        <Route component={LoginPage} />
      </Switch>
    );
  }

  // Authenticated routes
  // Landing page should be shown without sidebar/navigation
  if (location === "/landing") {
    return <LandingPage />;
  }

  // Legal pages should be shown without sidebar/navigation
  if (location === "/impressum") {
    return <ImpressumPage />;
  }
  if (location === "/datenschutz") {
    return <DatenschutzPage />;
  }
  if (location === "/agb") {
    return <AGBPage />;
  }
  if (location === "/ueber-uns") {
    return <UeberUnsPage />;
  }

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
        <ThemeProvider>
          <AuthProvider>
            <Toaster />
            <AuthenticatedApp />
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
