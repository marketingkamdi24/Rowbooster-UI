import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Activity, DollarSign, Zap, Clock, TrendingUp, ArrowUpRight, Maximize2 } from "lucide-react";
import { TokenUsageStats } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";

interface TokenMonitoringDashboardProps {
  compact?: boolean;
  onExpand?: () => void;
}

export function TokenMonitoringDashboard({ compact = false, onExpand }: TokenMonitoringDashboardProps) {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  
  // Fetch per-user statistics instead of global statistics
  const { data: tokenStats, isLoading, error, isError } = useQuery<TokenUsageStats>({
    queryKey: user ? [`/api/token-usage/stats/user/${user.id}`] : ["/api/token-usage/stats"],
    refetchInterval: false, // No polling - only update via cache invalidation
    refetchOnWindowFocus: true, // Refetch when user returns to tab
    refetchOnMount: true, // Refetch when component mounts
    enabled: !!user, // Only fetch if user is authenticated
    retry: 3, // Retry failed requests
    staleTime: 0, // Data is always considered stale for immediate updates
  });

  // Debug logging
  if (user) {
    console.log('[TOKEN-UI] User:', user.id, user.username);
    console.log('[TOKEN-UI] Loading:', isLoading);
    console.log('[TOKEN-UI] Error:', error);
    console.log('[TOKEN-UI] Stats:', tokenStats);
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('de-DE', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  const getOperationTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'search': return 'bg-blue-100 text-blue-800';
      case 'analyze': return 'bg-green-100 text-green-800';
      case 'extract': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getOperationTypeLabel = (type: string) => {
    switch (type.toLowerCase()) {
      case 'search': return 'Suche';
      case 'analyze': return 'Analyse';
      case 'extract': return 'Extraktion';
      default: return type;
    }
  };

  // Model-specific pricing configuration (must match server-side tokenTracker.ts)
  // These are per-token costs (price per 1M tokens / 1,000,000)
  const MODEL_PRICING = {
    'gpt-4.1': { input: 3.0 / 1000000, output: 12.0 / 1000000 },
    'gpt-4.1-mini': { input: 0.4 / 1000000, output: 1.6 / 1000000 },
    'gpt-4o': { input: 5.0 / 1000000, output: 15.0 / 1000000 },
    'gpt-4o-mini': { input: 0.15 / 1000000, output: 0.60 / 1000000 },
    'default': { input: 3.0 / 1000000, output: 12.0 / 1000000 }  // Default uses gpt-4.1 pricing
  };

  // Calculate estimated cost for a given period based on token counts
  // Note: The actual cost is calculated on the backend with per-call model tracking
  // This is an approximation for display purposes using the most common model pricing
  const estimatePeriodCost = (inputTokens: number, outputTokens: number): number => {
    // Use gpt-4.1-mini pricing as default since it's the most commonly used
    const pricing = MODEL_PRICING['gpt-4.1-mini'];
    return (inputTokens * pricing.input) + (outputTokens * pricing.output);
  };

  // Prepare chart data
  // Note: Cost data uses costEstimate from backend for accuracy when available
  const getUsageComparisonData = () => {
    if (!tokenStats) return [];
    return [
      {
        period: 'Heute',
        inputTokens: tokenStats.todayUsage.inputTokens,
        outputTokens: tokenStats.todayUsage.outputTokens,
        calls: tokenStats.todayUsage.calls,
        // Estimate cost for today's usage (actual costs are stored per-call with correct pricing)
        cost: estimatePeriodCost(tokenStats.todayUsage.inputTokens, tokenStats.todayUsage.outputTokens)
      },
      {
        period: 'Diese Woche',
        inputTokens: tokenStats.weeklyUsage.inputTokens,
        outputTokens: tokenStats.weeklyUsage.outputTokens,
        calls: tokenStats.weeklyUsage.calls,
        cost: estimatePeriodCost(tokenStats.weeklyUsage.inputTokens, tokenStats.weeklyUsage.outputTokens)
      },
      {
        period: 'Dieser Monat',
        inputTokens: tokenStats.monthlyUsage.inputTokens,
        outputTokens: tokenStats.monthlyUsage.outputTokens,
        calls: tokenStats.monthlyUsage.calls,
        cost: estimatePeriodCost(tokenStats.monthlyUsage.inputTokens, tokenStats.monthlyUsage.outputTokens)
      }
    ];
  };

  const getTokenDistributionData = () => {
    if (!tokenStats) return [];
    return [
      {
        name: 'Eingabe-Tokens',
        value: tokenStats.totalInputTokens,
        color: '#3b82f6',
        percentage: Math.round((tokenStats.totalInputTokens / tokenStats.totalTokens) * 100)
      },
      {
        name: 'Ausgabe-Tokens',
        value: tokenStats.totalOutputTokens,
        color: '#10b981',
        percentage: Math.round((tokenStats.totalOutputTokens / tokenStats.totalTokens) * 100)
      }
    ];
  };

  const customTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {formatNumber(entry.value)}
              {entry.name === 'Kosten' && ` (${formatCurrency(entry.value)})`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-20 bg-white/[0.05] rounded-xl border border-white/[0.08]"></div>
        <div className="h-20 bg-white/[0.05] rounded-xl border border-white/[0.08]"></div>
        <div className="h-20 bg-white/[0.05] rounded-xl border border-white/[0.08]"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-red-500/10 flex items-center justify-center">
          <BarChart3 className="h-6 w-6 text-red-400" />
        </div>
        <p className="text-white/80 text-sm">Fehler beim Laden</p>
        <p className="text-white/40 text-xs mt-1">{(error as Error)?.message || 'Unbekannter Fehler'}</p>
      </div>
    );
  }

  if (!tokenStats) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/[0.05] flex items-center justify-center">
          <BarChart3 className="h-6 w-6 text-white/40" />
        </div>
        <p className="text-white/60 text-sm">Keine Daten verfügbar</p>
        <p className="text-white/30 text-xs mt-1">Starten Sie eine Extraktion</p>
      </div>
    );
  }

  // Compact view - Simple & Clean
  if (compact) {
    const todayTokens = tokenStats.todayUsage.inputTokens + tokenStats.todayUsage.outputTokens;
    const weekTokens = tokenStats.weeklyUsage.inputTokens + tokenStats.weeklyUsage.outputTokens;
    const monthTokens = tokenStats.monthlyUsage.inputTokens + tokenStats.monthlyUsage.outputTokens;
    const avgTokensPerCall = tokenStats.totalCalls > 0 ? Math.round(tokenStats.totalTokens / tokenStats.totalCalls) : 0;
    const costPerCall = tokenStats.totalCalls > 0 ? tokenStats.costEstimate / tokenStats.totalCalls : 0;
    const inputOutputRatio = tokenStats.totalOutputTokens > 0 ? (tokenStats.totalInputTokens / tokenStats.totalOutputTokens).toFixed(1) : '0';
    const inputPercent = tokenStats.totalTokens > 0 ? Math.round((tokenStats.totalInputTokens / tokenStats.totalTokens) * 100) : 0;

    return (
      <div className="space-y-3">
        {/* Stats Cards - Vertical Layout for Sidebar */}
        <div className="space-y-3">
          {/* Total Tokens */}
          <div className="rounded-xl border border-[#17c3ce]/20 bg-white/[0.02] p-4 transition-all duration-300 hover:bg-white/[0.04] hover:border-[#17c3ce]/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#17c3ce]/10 flex items-center justify-center flex-shrink-0">
                <Zap className="h-5 w-5 text-[#17c3ce]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Gesamt-Tokens</p>
                <p className="text-xl font-bold text-white">{formatNumber(tokenStats.totalTokens)}</p>
              </div>
            </div>
          </div>

          {/* Total Cost */}
          <div className="rounded-xl border border-[#c8fa64]/20 bg-white/[0.02] p-4 transition-all duration-300 hover:bg-white/[0.04] hover:border-[#c8fa64]/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#c8fa64]/10 flex items-center justify-center flex-shrink-0">
                <DollarSign className="h-5 w-5 text-[#c8fa64]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white/50 uppercase tracking-wider">Gesamtkosten</p>
                <p className="text-xl font-bold text-white">{formatCurrency(tokenStats.costEstimate)}</p>
              </div>
            </div>
          </div>

          {/* API Calls */}
          <div className="rounded-xl border border-[#17c3ce]/20 bg-white/[0.02] p-4 transition-all duration-300 hover:bg-white/[0.04] hover:border-[#17c3ce]/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#17c3ce]/10 flex items-center justify-center flex-shrink-0">
                <Activity className="h-5 w-5 text-[#17c3ce]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white/50 uppercase tracking-wider">API-Aufrufe</p>
                <p className="text-xl font-bold text-white">{formatNumber(tokenStats.totalCalls)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Expand Button */}
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#17c3ce]/20 to-[#c8fa64]/10 border border-white/[0.08] text-white/80 hover:text-white hover:border-white/[0.15] transition-all duration-300"
        >
          <Maximize2 className="h-4 w-4" />
          <span className="text-sm font-medium">Detaillierte Analyse</span>
        </button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto bg-[#0a1628] border-white/[0.08] text-white">
            <DialogHeader className="border-b border-white/[0.06] pb-4">
              <DialogTitle className="flex items-center gap-3 text-white">
                <div className="p-2 rounded-lg bg-[#17c3ce]/10">
                  <BarChart3 className="h-5 w-5 text-[#17c3ce]" />
                </div>
                <div>
                  <span className="text-base font-semibold">Token-Analyse</span>
                  <p className="text-xs text-white/40 font-normal mt-0.5">Detaillierte API-Nutzung</p>
                </div>
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Stats Grid - Dark */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-[#17c3ce]" />
                    <span className="text-xs text-white/50">Tokens</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{formatNumber(tokenStats.totalTokens)}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <ArrowUpRight className="h-3 w-3 text-[#c8fa64]" />
                    <span className="text-[10px] text-[#c8fa64]">+{formatNumber(todayTokens)} heute</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-[#c8fa64]" />
                    <span className="text-xs text-white/50">Kosten</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{formatCurrency(tokenStats.costEstimate)}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <ArrowUpRight className="h-3 w-3 text-[#c8fa64]" />
                    <span className="text-[10px] text-[#c8fa64]">+{formatCurrency(estimatePeriodCost(tokenStats.todayUsage.inputTokens, tokenStats.todayUsage.outputTokens))} heute</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-white/60" />
                    <span className="text-xs text-white/50">Calls</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{formatNumber(tokenStats.totalCalls)}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <ArrowUpRight className="h-3 w-3 text-[#c8fa64]" />
                    <span className="text-[10px] text-[#c8fa64]">+{formatNumber(tokenStats.todayUsage.calls)} heute</span>
                  </div>
                </div>
              </div>

              {/* Efficiency & Performance */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4 text-[#17c3ce]" />
                    <span className="text-sm font-medium text-white/80">Effizienz</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between"><span className="text-xs text-white/50">Ø Tokens/Call</span><span className="text-sm font-semibold text-white">{avgTokensPerCall}</span></div>
                    <div className="flex justify-between"><span className="text-xs text-white/50">Kosten/Call</span><span className="text-sm font-semibold text-white">{formatCurrency(costPerCall)}</span></div>
                    <div className="flex justify-between"><span className="text-xs text-white/50">I/O Ratio</span><span className="text-sm font-semibold text-white">{inputOutputRatio}:1</span></div>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-[#c8fa64]" />
                    <span className="text-sm font-medium text-white/80">Zeitraum</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between"><span className="text-xs text-white/50">Heute</span><span className="text-sm font-semibold text-[#17c3ce]">{formatNumber(todayTokens)}</span></div>
                    <div className="flex justify-between"><span className="text-xs text-white/50">Woche</span><span className="text-sm font-semibold text-[#c8fa64]">{formatNumber(weekTokens)}</span></div>
                    <div className="flex justify-between"><span className="text-xs text-white/50">Monat</span><span className="text-sm font-semibold text-white">{formatNumber(monthTokens)}</span></div>
                  </div>
                </div>
              </div>

              {/* Tabs - Dark */}
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 bg-white/[0.02] border border-white/[0.06] p-1 rounded-lg">
                  <TabsTrigger value="overview" className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-white/50 text-xs rounded-md">Übersicht</TabsTrigger>
                  <TabsTrigger value="activity" className="data-[state=active]:bg-white/[0.08] data-[state=active]:text-white text-white/50 text-xs rounded-md">Aktivitäten</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <div className="flex items-center gap-2 mb-3">
                        <BarChart3 className="h-4 w-4 text-white/50" />
                        <span className="text-sm font-medium text-white/80">Vergleich</span>
                      </div>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={getUsageComparisonData()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="period" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                            <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                            <Tooltip contentStyle={{ backgroundColor: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                            <Bar dataKey="inputTokens" fill="#17c3ce" name="Input" radius={[2, 2, 0, 0]} />
                            <Bar dataKey="outputTokens" fill="#c8fa64" name="Output" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <div className="flex items-center gap-2 mb-3">
                        <Activity className="h-4 w-4 text-white/50" />
                        <span className="text-sm font-medium text-white/80">Calls</span>
                      </div>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={getUsageComparisonData()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                            <XAxis dataKey="period" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                            <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} />
                            <Tooltip contentStyle={{ backgroundColor: '#0a1628', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                            <Area type="monotone" dataKey="calls" stroke="#17c3ce" fill="#17c3ce" fillOpacity={0.2} name="Calls" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="space-y-4">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                    <div className="flex items-center gap-2 mb-3">
                      <Clock className="h-4 w-4 text-white/50" />
                      <span className="text-sm font-medium text-white/80">Letzte Aktivitäten</span>
                    </div>
                    <ScrollArea className="h-64">
                      <div className="space-y-2">
                        {tokenStats.recentCalls && tokenStats.recentCalls.length > 0 ? (
                          tokenStats.recentCalls.map((usage, index) => (
                            <div key={index} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                              <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${usage.apiCallType === 'search' ? 'bg-blue-400' : usage.apiCallType === 'analyze' ? 'bg-green-400' : 'bg-purple-400'}`} />
                                <div>
                                  <p className="text-xs font-medium text-white/80">{getOperationTypeLabel(usage.apiCallType)}</p>
                                  <p className="text-[10px] text-white/40">{formatDate(usage.createdAt)}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-semibold text-white/80">{formatNumber(usage.totalTokens)}</p>
                                <p className="text-[10px] text-white/40">{usage.modelName}</p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-8">
                            <Activity className="h-8 w-8 mx-auto mb-2 text-white/20" />
                            <p className="text-xs text-white/40">Keine Aktivitäten</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Default compact view for navigation bar
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Meine Token-Nutzung Dashboard</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Zap className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Meine Gesamt-Tokens</p>
                <p className="text-lg font-bold text-gray-900">{formatNumber(tokenStats.totalTokens)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Meine Gesamtkosten</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(tokenStats.costEstimate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Activity className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Meine API-Aufrufe</p>
                <p className="text-lg font-bold text-gray-900">{formatNumber(tokenStats.totalCalls)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}