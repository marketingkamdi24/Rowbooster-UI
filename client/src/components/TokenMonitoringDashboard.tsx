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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
        <div className="h-20 bg-gray-200 rounded-lg"></div>
        <div className="h-20 bg-gray-200 rounded-lg"></div>
        <div className="h-20 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-8 text-red-500">
        <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Fehler beim Laden der Token-Nutzung</p>
        <p className="text-xs mt-2">{(error as Error)?.message || 'Unbekannter Fehler'}</p>
      </div>
    );
  }

  if (!tokenStats) {
    return (
      <div className="text-center py-8 text-gray-500">
        <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Keine Token-Nutzungsdaten verfügbar</p>
        <p className="text-xs mt-2">Benutzer-ID: {user?.id}</p>
      </div>
    );
  }

  // Compact view for the navigation dropdown
  if (compact) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Meine Token-Nutzung</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            className="flex items-center gap-2"
          >
            <Maximize2 className="h-4 w-4" />
            Erweitern
          </Button>
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

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-blue-600" />
                Meine Token-Nutzungsanalyse
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 overflow-x-auto">
              {/* Quick Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Meine Gesamt-Tokens</p>
                        <p className="text-2xl font-bold text-gray-900">{formatNumber(tokenStats.totalTokens)}</p>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <div className="flex items-center">
                            <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                            +{formatNumber(tokenStats.todayUsage.inputTokens + tokenStats.todayUsage.outputTokens)} heute
                          </div>
                        </div>
                      </div>
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <Zap className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Meine Gesamtkosten</p>
                        <p className="text-2xl font-bold text-gray-900">{formatCurrency(tokenStats.costEstimate)}</p>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <div className="flex items-center">
                            <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                            +{formatCurrency(estimatePeriodCost(tokenStats.todayUsage.inputTokens, tokenStats.todayUsage.outputTokens))} heute
                          </div>
                        </div>
                      </div>
                      <div className="p-3 bg-green-100 rounded-lg">
                        <DollarSign className="h-6 w-6 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Meine API-Aufrufe</p>
                        <p className="text-2xl font-bold text-gray-900">{formatNumber(tokenStats.totalCalls)}</p>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <div className="flex items-center">
                            <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                            +{formatNumber(tokenStats.todayUsage.calls)} heute
                          </div>
                        </div>
                      </div>
                      <div className="p-3 bg-purple-100 rounded-lg">
                        <Activity className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Usage Trend and Efficiency Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      Nutzungseffizienz
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Durchschn. Tokens pro Aufruf</span>
                        <span className="font-semibold">{Math.round(tokenStats.totalTokens / tokenStats.totalCalls)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Kosten pro Aufruf</span>
                        <span className="font-semibold">{formatCurrency(tokenStats.costEstimate / tokenStats.totalCalls)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Eingabe/Ausgabe-Verhältnis</span>
                        <span className="font-semibold">{(tokenStats.totalInputTokens / tokenStats.totalOutputTokens).toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-green-600" />
                      Aktuelle Leistung
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Heutige Nutzung</span>
                        <Badge variant="outline" className="text-blue-600 border-blue-200">
                          {formatNumber(tokenStats.todayUsage.inputTokens + tokenStats.todayUsage.outputTokens)} Tokens
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Diese Woche</span>
                        <Badge variant="outline" className="text-green-600 border-green-200">
                          {formatNumber(tokenStats.weeklyUsage.inputTokens + tokenStats.weeklyUsage.outputTokens)} Tokens
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Dieser Monat</span>
                        <Badge variant="outline" className="text-purple-600 border-purple-200">
                          {formatNumber(tokenStats.monthlyUsage.inputTokens + tokenStats.monthlyUsage.outputTokens)} Tokens
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Tabs defaultValue="overview" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="overview">Nutzungsübersicht</TabsTrigger>
                  <TabsTrigger value="activity">Letzte Aktivitäten</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  {/* Usage Comparison Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                        Nutzungsvergleich
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={getUsageComparisonData()}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="period" stroke="#666" fontSize={12} />
                            <YAxis stroke="#666" fontSize={12} />
                            <Tooltip content={customTooltip} />
                            <Legend />
                            <Bar dataKey="inputTokens" fill="#3b82f6" name="Eingabe-Tokens" radius={[2, 2, 0, 0]} />
                            <Bar dataKey="outputTokens" fill="#10b981" name="Ausgabe-Tokens" radius={[2, 2, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Token Distribution and API Calls */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded-full bg-gradient-to-r from-blue-500 to-green-500"></div>
                          Token-Verteilung
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={getTokenDistributionData()}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                {getTokenDistributionData().map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip 
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const data = payload[0].payload;
                                    return (
                                      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                                        <p className="font-semibold text-gray-900">{data.name}</p>
                                        <p className="text-blue-600">Tokens: {formatNumber(data.value)}</p>
                                        <p className="text-gray-600">{data.percentage}% vom Gesamt</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Legend 
                                verticalAlign="bottom" 
                                height={36}
                                formatter={(value, entry) => (
                                  <span style={{ color: entry.color }}>{value}</span>
                                )}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Activity className="h-5 w-5 text-purple-600" />
                          Nutzungszeitstrahl
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={getUsageComparisonData()}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="period" stroke="#666" fontSize={12} />
                              <YAxis stroke="#666" fontSize={12} />
                              <Tooltip content={customTooltip} />
                              <Area
                                type="monotone"
                                dataKey="calls"
                                stroke="#8b5cf6"
                                fill="#8b5cf6"
                                fillOpacity={0.3}
                                name="API-Aufrufe"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-green-600" />
                        Letzte Token-Nutzungsaktivitäten
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-96">
                        <div className="space-y-4">
                          {tokenStats.recentCalls && tokenStats.recentCalls.length > 0 ? (
                            tokenStats.recentCalls.map((usage, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                                <div className="flex items-center space-x-3">
                                  <div className={`p-2 rounded-lg ${getOperationTypeColor(usage.apiCallType)}`}>
                                    <Activity className="h-4 w-4" />
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">{getOperationTypeLabel(usage.apiCallType)}</p>
                                    <p className="text-sm text-gray-600">{formatDate(usage.createdAt)}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="flex items-center space-x-4">
                                    <div className="text-sm">
                                      <span className="text-blue-600 font-medium">{formatNumber(usage.inputTokens)}</span>
                                      <span className="text-gray-500 mx-1">+</span>
                                      <span className="text-green-600 font-medium">{formatNumber(usage.outputTokens)}</span>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold text-gray-900">{formatNumber(usage.totalTokens)} Tokens</p>
                                      <Badge variant="outline" className={getOperationTypeColor(usage.apiCallType).replace('bg-', 'border-').replace('-100', '-200')}>
                                        {usage.modelName}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
                              <p>Keine aktuellen Aktivitäten vorhanden</p>
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
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