import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Mail, 
  Send, 
  Inbox, 
  Star, 
  Trash2, 
  Archive, 
  RefreshCw, 
  Search,
  Users,
  Plus,
  X,
  ChevronLeft,
  StarOff,
  MailOpen,
  MailCheck,
  Clock,
  AlertCircle
} from 'lucide-react';

interface Email {
  id: number;
  message_id: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  body_html: string | null;
  is_read: boolean;
  is_starred: boolean;
  folder: string;
  sent_at: string;
  received_at: string;
  created_at: string;
}

interface EmailStats {
  folders: Record<string, number>;
  unread: number;
  starred: number;
  today: number;
}

interface Recipient {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
}

type FolderType = 'inbox' | 'sent' | 'drafts' | 'trash' | 'archive' | 'starred';

export default function EmailManagementPage() {
  const [currentFolder, setCurrentFolder] = useState<FolderType>('inbox');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [showBulkSend, setShowBulkSend] = useState(false);
  const [hasAutoSynced, setHasAutoSynced] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Compose state
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');

  // Bulk send state
  const [bulkSubject, setBulkSubject] = useState('');
  const [bulkBody, setBulkBody] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [sendToAll, setSendToAll] = useState(true);

  // Initialize email tables and auto-sync on first load
  useEffect(() => {
    const initAndSync = async () => {
      try {
        // Initialize tables first
        await fetch('/api/emails/initialize', { method: 'POST', credentials: 'include' });
        
        // Auto-sync inbox if not already synced in this session
        if (!hasAutoSynced) {
          setHasAutoSynced(true);
          try {
            const response = await fetch('/api/emails/sync', { method: 'POST', credentials: 'include' });
            if (response.ok) {
              const data = await response.json();
              console.log('[EMAIL] Auto-synced:', data);
            }
          } catch (syncError) {
            console.log('[EMAIL] Auto-sync skipped (IMAP may not be configured)');
          }
        }
      } catch (error) {
        console.error('[EMAIL] Init error:', error);
      }
    };
    
    initAndSync();
  }, [hasAutoSynced]);

  // Fetch emails
  const { data: emailsData, isLoading: emailsLoading, refetch: refetchEmails } = useQuery({
    queryKey: ['emails', currentFolder, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        folder: currentFolder === 'starred' ? 'inbox' : currentFolder,
        limit: '50',
        ...(currentFolder === 'starred' && { is_starred: 'true' }),
        ...(searchQuery && { search: searchQuery }),
      });
      const response = await fetch(`/api/emails?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch emails');
      return response.json();
    },
  });

  // Fetch email stats
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['emailStats'],
    queryFn: async () => {
      const response = await fetch('/api/emails/stats', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json() as Promise<EmailStats>;
    },
  });

  // Fetch recipients for bulk send
  const { data: recipientsData } = useQuery({
    queryKey: ['emailRecipients'],
    queryFn: async () => {
      const response = await fetch('/api/emails/recipients', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch recipients');
      return response.json();
    },
    enabled: showBulkSend,
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (data: { to: string; cc?: string; subject: string; body: string }) => {
      const toList = data.to.split(',').map(e => e.trim()).filter(e => e);
      const ccList = data.cc ? data.cc.split(',').map(e => e.trim()).filter(e => e) : undefined;
      
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          to: toList,
          cc: ccList,
          subject: data.subject,
          body: data.body,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send email');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Email sent successfully' });
      setShowCompose(false);
      resetCompose();
      // Explicitly clear search query to prevent any accidental state bleed
      setSearchQuery('');
      refetchEmails();
      refetchStats();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Bulk send mutation
  const bulkSendMutation = useMutation({
    mutationFn: async (data: { userIds?: number[]; allUsers: boolean; subject: string; body: string }) => {
      const response = await fetch('/api/emails/bulk-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send bulk email');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: 'Bulk Email Sent', 
        description: `Sent to ${data.successCount}/${data.totalRecipients} recipients. ${data.failedCount} failed.` 
      });
      setShowBulkSend(false);
      resetBulkSend();
      refetchStats();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Sync inbox mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/emails/sync', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to sync inbox');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({ 
        title: 'Inbox Synced', 
        description: `${data.newEmails} new emails. Total: ${data.totalEmails}` 
      });
      refetchEmails();
      refetchStats();
    },
    onError: (error: Error) => {
      toast({ title: 'Sync Error', description: error.message, variant: 'destructive' });
    },
  });

  // Mark as read/unread
  const markReadMutation = useMutation({
    mutationFn: async ({ id, isRead }: { id: number; isRead: boolean }) => {
      const response = await fetch(`/api/emails/${id}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isRead }),
      });
      if (!response.ok) throw new Error('Failed to update email');
      return response.json();
    },
    onSuccess: () => {
      refetchEmails();
      refetchStats();
    },
  });

  // Star/unstar email
  const starMutation = useMutation({
    mutationFn: async ({ id, isStarred }: { id: number; isStarred: boolean }) => {
      const response = await fetch(`/api/emails/${id}/star`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isStarred }),
      });
      if (!response.ok) throw new Error('Failed to update email');
      return response.json();
    },
    onSuccess: () => {
      refetchEmails();
      refetchStats();
    },
  });

  // Move to folder
  const moveMutation = useMutation({
    mutationFn: async ({ id, folder }: { id: number; folder: string }) => {
      const response = await fetch(`/api/emails/${id}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ folder }),
      });
      if (!response.ok) throw new Error('Failed to move email');
      return response.json();
    },
    onSuccess: () => {
      setSelectedEmail(null);
      refetchEmails();
      refetchStats();
      toast({ title: 'Email moved' });
    },
  });

  // Delete email
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/emails/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete email');
      return response.json();
    },
    onSuccess: () => {
      setSelectedEmail(null);
      refetchEmails();
      refetchStats();
      toast({ title: 'Email deleted permanently' });
    },
  });

  const resetCompose = () => {
    setComposeTo('');
    setComposeCc('');
    setComposeSubject('');
    setComposeBody('');
  };

  const resetBulkSend = () => {
    setBulkSubject('');
    setBulkBody('');
    setSelectedUserIds([]);
    setSendToAll(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const emails: Email[] = emailsData?.emails || [];
  const recipients: Recipient[] = recipientsData?.recipients || [];

  const folders = [
    { id: 'inbox' as const, name: 'Inbox', icon: Inbox, count: stats?.folders?.inbox || 0 },
    { id: 'sent' as const, name: 'Gesendet', icon: Send, count: stats?.folders?.sent || 0 },
    { id: 'starred' as const, name: 'Markiert', icon: Star, count: stats?.starred || 0 },
    { id: 'drafts' as const, name: 'Entwürfe', icon: Mail, count: stats?.folders?.drafts || 0 },
    { id: 'archive' as const, name: 'Archiv', icon: Archive, count: stats?.folders?.archive || 0 },
    { id: 'trash' as const, name: 'Papierkorb', icon: Trash2, count: stats?.folders?.trash || 0 },
  ];

  return (
    <div className="p-6 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold neon-yellow flex items-center gap-3">
              <Mail className="h-8 w-8" />
              E-Mail-Management
            </h1>
            <p className="text-gray-400 mt-1">
              Verwalten Sie E-Mails über kontakt@rowbooster.com
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              variant="outline"
              className="border-cyan-500/50 hover:bg-cyan-500/10"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
              Synchronisieren
            </Button>
            <Button
              onClick={() => setShowBulkSend(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Users className="h-4 w-4 mr-2" />
              Massen-E-Mail
            </Button>
            <Button
              onClick={() => setShowCompose(true)}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Neue E-Mail
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <Card className="card-cyber border-cyan-500/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-cyan-500/10">
                <Inbox className="h-6 w-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-2xl font-bold neon-cyan">{stats?.unread || 0}</p>
                <p className="text-sm text-gray-400">Ungelesen</p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-cyber border-yellow-500/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/10">
                <Star className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold neon-yellow">{stats?.starred || 0}</p>
                <p className="text-sm text-gray-400">Markiert</p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-cyber border-green-500/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-500/10">
                <Clock className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-400">{stats?.today || 0}</p>
                <p className="text-sm text-gray-400">Heute</p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-cyber border-purple-500/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/10">
                <Send className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-400">{stats?.folders?.sent || 0}</p>
                <p className="text-sm text-gray-400">Gesendet</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-12 gap-4">
          {/* Sidebar */}
          <div className="col-span-2">
            <Card className="card-cyber border-cyan-500/30">
              <CardContent className="p-2">
                <nav className="space-y-1">
                  {folders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => { setCurrentFolder(folder.id); setSelectedEmail(null); }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                        currentFolder === folder.id
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'hover:bg-gray-800 text-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <folder.icon className="h-4 w-4" />
                        <span className="text-sm">{folder.name}</span>
                      </div>
                      {folder.count > 0 && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          currentFolder === folder.id ? 'bg-cyan-500/30' : 'bg-gray-700'
                        }`}>
                          {folder.count}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Email List */}
          <div className="col-span-4">
            <Card className="card-cyber border-cyan-500/30 h-[600px] flex flex-col">
              <CardHeader className="p-3 border-b border-cyan-500/20">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    key="email-search-input"
                    placeholder="E-Mails durchsuchen..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-gray-900 border-gray-700 text-white"
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    data-form-type="other"
                    name={`search-${Date.now()}`}
                    id="email-search-query-input"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-auto">
                {emailsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCw className="h-6 w-6 animate-spin text-cyan-400" />
                  </div>
                ) : emails.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Mail className="h-12 w-12 mb-2" />
                    <p>Keine E-Mails gefunden</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-800">
                    {emails.map((email) => (
                      <button
                        key={email.id}
                        onClick={() => {
                          setSelectedEmail(email);
                          if (!email.is_read) {
                            markReadMutation.mutate({ id: email.id, isRead: true });
                          }
                        }}
                        className={`w-full text-left p-3 hover:bg-gray-800/50 transition-colors ${
                          selectedEmail?.id === email.id ? 'bg-cyan-500/10' : ''
                        } ${!email.is_read ? 'bg-gray-800/30' : ''}`}
                      >
                        <div className="flex items-start gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              starMutation.mutate({ id: email.id, isStarred: !email.is_starred });
                            }}
                            className="mt-1"
                          >
                            <Star className={`h-4 w-4 ${
                              email.is_starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600'
                            }`} />
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-sm truncate ${!email.is_read ? 'font-bold text-white' : 'text-gray-300'}`}>
                                {currentFolder === 'sent' ? (
                                  Array.isArray(email.to) ? email.to.join(', ') : email.to
                                ) : email.from}
                              </span>
                              <span className="text-xs text-gray-500 ml-2">
                                {formatDate(email.sent_at || email.received_at)}
                              </span>
                            </div>
                            <p className={`text-sm truncate ${!email.is_read ? 'text-gray-200' : 'text-gray-400'}`}>
                              {email.subject || '(Kein Betreff)'}
                            </p>
                            <p className="text-xs text-gray-500 truncate mt-1">
                              {email.body?.substring(0, 50)}...
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Email Detail */}
          <div className="col-span-6">
            <Card className="card-cyber border-cyan-500/30 h-[600px] flex flex-col">
              {selectedEmail ? (
                <>
                  <CardHeader className="p-4 border-b border-cyan-500/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEmail(null)}
                          className="md:hidden"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <h3 className="font-semibold text-lg text-white truncate">
                          {selectedEmail.subject || '(Kein Betreff)'}
                        </h3>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markReadMutation.mutate({ 
                            id: selectedEmail.id, 
                            isRead: !selectedEmail.is_read 
                          })}
                          title={selectedEmail.is_read ? 'Als ungelesen markieren' : 'Als gelesen markieren'}
                        >
                          {selectedEmail.is_read ? (
                            <MailOpen className="h-4 w-4" />
                          ) : (
                            <MailCheck className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => starMutation.mutate({ 
                            id: selectedEmail.id, 
                            isStarred: !selectedEmail.is_starred 
                          })}
                          title={selectedEmail.is_starred ? 'Markierung entfernen' : 'Markieren'}
                        >
                          {selectedEmail.is_starred ? (
                            <StarOff className="h-4 w-4 text-yellow-400" />
                          ) : (
                            <Star className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => moveMutation.mutate({ 
                            id: selectedEmail.id, 
                            folder: 'archive' 
                          })}
                          title="Archivieren"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (selectedEmail.folder === 'trash') {
                              deleteMutation.mutate(selectedEmail.id);
                            } else {
                              moveMutation.mutate({ id: selectedEmail.id, folder: 'trash' });
                            }
                          }}
                          title={selectedEmail.folder === 'trash' ? 'Endgültig löschen' : 'Löschen'}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 text-sm text-gray-400 space-y-1">
                      <div className="flex gap-2">
                        <span className="text-gray-500">Von:</span>
                        <span className="text-cyan-400">{selectedEmail.from}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-gray-500">An:</span>
                        <span>{Array.isArray(selectedEmail.to) ? selectedEmail.to.join(', ') : selectedEmail.to}</span>
                      </div>
                      {selectedEmail.cc && Array.isArray(selectedEmail.cc) && selectedEmail.cc.length > 0 && (
                        <div className="flex gap-2">
                          <span className="text-gray-500">CC:</span>
                          <span>{selectedEmail.cc.join(', ')}</span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <span className="text-gray-500">Datum:</span>
                        <span>{new Date(selectedEmail.sent_at || selectedEmail.received_at).toLocaleString('de-DE')}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 flex-1 overflow-auto">
                    {selectedEmail.body_html ? (
                      <div 
                        className="prose prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                      />
                    ) : (
                      <pre className="whitespace-pre-wrap text-gray-300 font-sans">
                        {selectedEmail.body}
                      </pre>
                    )}
                  </CardContent>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Mail className="h-16 w-16 mb-4" />
                  <p>Wählen Sie eine E-Mail aus</p>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Compose Modal */}
        {showCompose && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <Card className="card-cyber border-cyan-500/50 w-full max-w-2xl max-h-[80vh] overflow-auto">
              <CardHeader className="flex flex-row items-center justify-between border-b border-cyan-500/20">
                <CardTitle className="neon-cyan flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Neue E-Mail
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => { setShowCompose(false); resetCompose(); }}>
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">An (mehrere mit Komma trennen)</label>
                  <Input
                    key="compose-to-input"
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    placeholder="empfaenger@example.com"
                    className="bg-gray-900 border-gray-700 text-white"
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    data-form-type="other"
                    name={`compose-to-${Date.now()}`}
                    id="compose-to-field"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">CC (optional)</label>
                  <Input
                    key="compose-cc-input"
                    value={composeCc}
                    onChange={(e) => setComposeCc(e.target.value)}
                    placeholder="cc@example.com"
                    className="bg-gray-900 border-gray-700 text-white"
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    data-form-type="other"
                    name={`compose-cc-${Date.now()}`}
                    id="compose-cc-field"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Betreff</label>
                  <Input
                    key="compose-subject-input"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="Betreff eingeben..."
                    className="bg-gray-900 border-gray-700 text-white"
                    autoComplete="new-password"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    data-form-type="other"
                    name={`compose-subject-${Date.now()}`}
                    id="compose-subject-field"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Nachricht</label>
                  <textarea
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    placeholder="Ihre Nachricht..."
                    rows={10}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => { setShowCompose(false); resetCompose(); }}>
                    Abbrechen
                  </Button>
                  <Button
                    onClick={() => sendEmailMutation.mutate({
                      to: composeTo,
                      cc: composeCc || undefined,
                      subject: composeSubject,
                      body: composeBody,
                    })}
                    disabled={!composeTo || !composeSubject || sendEmailMutation.isPending}
                    className="bg-cyan-600 hover:bg-cyan-700"
                  >
                    {sendEmailMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Senden
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Bulk Send Modal */}
        {showBulkSend && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <Card className="card-cyber border-purple-500/50 w-full max-w-3xl max-h-[80vh] overflow-auto">
              <CardHeader className="flex flex-row items-center justify-between border-b border-purple-500/20">
                <div>
                  <CardTitle className="text-purple-400 flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Massen-E-Mail senden
                  </CardTitle>
                  <CardDescription>
                    Senden Sie eine E-Mail an alle oder ausgewählte Benutzer
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setShowBulkSend(false); resetBulkSend(); }}>
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Recipient Selection */}
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={sendToAll}
                        onChange={() => setSendToAll(true)}
                        className="w-4 h-4 accent-purple-500"
                      />
                      <span className="text-gray-300">An alle Benutzer ({recipients.length})</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={!sendToAll}
                        onChange={() => setSendToAll(false)}
                        className="w-4 h-4 accent-purple-500"
                      />
                      <span className="text-gray-300">Benutzer auswählen</span>
                    </label>
                  </div>

                  {!sendToAll && (
                    <div className="border border-gray-700 rounded-lg p-3 max-h-48 overflow-auto">
                      <div className="space-y-2">
                        {recipients.map((user) => (
                          <label key={user.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(user.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUserIds([...selectedUserIds, user.id]);
                                } else {
                                  setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                                }
                              }}
                              className="w-4 h-4 accent-purple-500"
                            />
                            <span className="text-sm">
                              <span className="text-white">{user.username}</span>
                              <span className="text-gray-500 ml-2">({user.email})</span>
                              {!user.is_active && (
                                <span className="text-red-400 ml-2">(Inaktiv)</span>
                              )}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {!sendToAll && selectedUserIds.length > 0 && (
                    <p className="text-sm text-gray-400">
                      {selectedUserIds.length} Benutzer ausgewählt
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Betreff</label>
                  <Input
                    value={bulkSubject}
                    onChange={(e) => setBulkSubject(e.target.value)}
                    placeholder="Betreff der Massen-E-Mail..."
                    className="bg-gray-900 border-gray-700 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">
                    Nachricht <span className="text-gray-500">(Verwenden Sie {'{name}'} für den Benutzernamen)</span>
                  </label>
                  <textarea
                    value={bulkBody}
                    onChange={(e) => setBulkBody(e.target.value)}
                    placeholder="Hallo {name},&#10;&#10;Ihre Nachricht hier..."
                    rows={10}
                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-white resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="flex items-center gap-2 text-yellow-400 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <span>
                    {sendToAll 
                      ? `Diese E-Mail wird an ${recipients.length} Benutzer gesendet.`
                      : `Diese E-Mail wird an ${selectedUserIds.length} ausgewählte Benutzer gesendet.`
                    }
                  </span>
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => { setShowBulkSend(false); resetBulkSend(); }}>
                    Abbrechen
                  </Button>
                  <Button
                    onClick={() => bulkSendMutation.mutate({
                      userIds: sendToAll ? undefined : selectedUserIds,
                      allUsers: sendToAll,
                      subject: bulkSubject,
                      body: bulkBody,
                    })}
                    disabled={
                      !bulkSubject || 
                      !bulkBody || 
                      (!sendToAll && selectedUserIds.length === 0) ||
                      bulkSendMutation.isPending
                    }
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {bulkSendMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Massen-E-Mail senden
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}