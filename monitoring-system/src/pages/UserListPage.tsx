import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Users, Search, Eye,
  TrendingUp, DollarSign, Activity, UserPlus, Edit, Trash2, X, AlertTriangle
} from 'lucide-react';
import { authFetch } from '@/lib/api';

interface ValidationError {
  field: string;
  message: string;
}

export default function UserListPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'user',
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<ValidationError[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Get error message for a specific field
  const getFieldError = (fieldName: string): string | undefined => {
    const error = formErrors.find(e => e.field === fieldName);
    return error?.message;
  };

  // Clear error for a specific field when user starts typing
  const clearFieldError = (fieldName: string) => {
    setFormErrors(prev => prev.filter(e => e.field !== fieldName));
  };

  // Client-side validation
  const validateForm = (isCreate: boolean): ValidationError[] => {
    const errors: ValidationError[] = [];

    // Username validation
    if (!formData.username || formData.username.trim() === '') {
      errors.push({ field: 'username', message: 'Benutzername ist erforderlich' });
    } else if (formData.username.trim().length < 3) {
      errors.push({ field: 'username', message: 'Benutzername muss mindestens 3 Zeichen haben' });
    } else if (formData.username.trim().length > 50) {
      errors.push({ field: 'username', message: 'Benutzername darf maximal 50 Zeichen haben' });
    } else if (!/^[a-zA-Z0-9_.-]+$/.test(formData.username.trim())) {
      errors.push({ field: 'username', message: 'Benutzername darf nur Buchstaben, Zahlen, Unterstriche, Punkte und Bindestriche enthalten' });
    }

    // Email validation
    if (!formData.email || formData.email.trim() === '') {
      errors.push({ field: 'email', message: 'E-Mail ist erforderlich' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.push({ field: 'email', message: 'Bitte geben Sie eine gültige E-Mail-Adresse ein' });
    } else if (formData.email.trim().length > 255) {
      errors.push({ field: 'email', message: 'E-Mail darf maximal 255 Zeichen haben' });
    }

    // Password validation (required for create, optional for edit)
    if (isCreate) {
      if (!formData.password || formData.password === '') {
        errors.push({ field: 'password', message: 'Passwort ist erforderlich' });
      } else if (formData.password.length < 6) {
        errors.push({ field: 'password', message: 'Passwort muss mindestens 6 Zeichen haben' });
      } else if (formData.password.length > 128) {
        errors.push({ field: 'password', message: 'Passwort darf maximal 128 Zeichen haben' });
      }
    } else if (formData.password && formData.password !== '') {
      if (formData.password.length < 6) {
        errors.push({ field: 'password', message: 'Passwort muss mindestens 6 Zeichen haben' });
      } else if (formData.password.length > 128) {
        errors.push({ field: 'password', message: 'Passwort darf maximal 128 Zeichen haben' });
      }
    }

    return errors;
  };

  const fetchUsers = async () => {
    try {
      const response = await authFetch('/api/users');
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    const interval = setInterval(fetchUsers, 30000); // Refresh every 30s
    
    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setFormErrors([]);
    
    // Client-side validation
    const validationErrors = validateForm(true);
    if (validationErrors.length > 0) {
      setFormErrors(validationErrors);
      toast({
        title: 'Validierungsfehler',
        description: validationErrors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const response = await authFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username.trim(),
          email: formData.email.trim(),
          password: formData.password,
          role: formData.role,
          isActive: formData.isActive,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Erfolg',
          description: 'Benutzer erfolgreich erstellt',
        });
        setShowCreateModal(false);
        setFormData({
          username: '',
          email: '',
          password: '',
          role: 'user',
          isActive: true,
        });
        setFormErrors([]);
        fetchUsers();
      } else {
        // Handle server-side validation errors
        if (data.errors && Array.isArray(data.errors)) {
          setFormErrors(data.errors);
        }
        toast({
          title: 'Fehler',
          description: data.message || 'Benutzer konnte nicht erstellt werden',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Netzwerkfehler. Bitte überprüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    // Clear previous errors
    setFormErrors([]);
    
    // Client-side validation
    const validationErrors = validateForm(false);
    if (validationErrors.length > 0) {
      setFormErrors(validationErrors);
      toast({
        title: 'Validierungsfehler',
        description: validationErrors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Only send fields that have values (for optional password)
      const updateData: Record<string, any> = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        role: formData.role,
        isActive: formData.isActive,
      };
      
      // Only include password if it's provided
      if (formData.password && formData.password.trim() !== '') {
        updateData.password = formData.password;
      }

      const response = await authFetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Erfolg',
          description: 'Benutzer erfolgreich aktualisiert',
        });
        setShowEditModal(false);
        setEditingUser(null);
        setFormData({
          username: '',
          email: '',
          password: '',
          role: 'user',
          isActive: true,
        });
        setFormErrors([]);
        fetchUsers();
      } else {
        // Handle server-side validation errors
        if (data.errors && Array.isArray(data.errors)) {
          setFormErrors(data.errors);
        }
        toast({
          title: 'Fehler',
          description: data.message || 'Benutzer konnte nicht aktualisiert werden',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Netzwerkfehler. Bitte überprüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!confirm(`Möchten Sie den Benutzer "${username}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      return;
    }

    try {
      const response = await authFetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Erfolg',
          description: `Benutzer "${username}" erfolgreich gelöscht`,
        });
        fetchUsers();
      } else {
        toast({
          title: 'Fehler',
          description: data.message || 'Benutzer konnte nicht gelöscht werden',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Fehler',
        description: 'Benutzer konnte nicht gelöscht werden',
        variant: 'destructive',
      });
    }
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setFormData({
      username: user.username || '',
      email: user.email || '',
      password: '',
      role: user.role || 'user',
      isActive: user.is_active !== false,
    });
    setFormErrors([]);
    setShowEditModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'user',
      isActive: true,
    });
    setFormErrors([]);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingUser(null);
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'user',
      isActive: true,
    });
    setFormErrors([]);
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-lg neon-yellow">BENUTZERDATENBANK WIRD GELADEN...</div>
      </div>
    );
  }

  return (
    <>
      {/* Stats Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="stat-card-cyber p-3 sm:p-4 rounded glow-yellow">
            <div className="flex items-center justify-between mb-2">
              <div className="text-yellow-400 text-[10px] sm:text-xs font-bold tracking-wide">BENUTZER GESAMT</div>
              <Users className="h-4 w-4 text-yellow-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold neon-cyan">
              {users.length}
            </div>
          </div>

          <div className="stat-card-cyber p-3 sm:p-4 rounded glow-cyan">
            <div className="flex items-center justify-between mb-2">
              <div className="text-yellow-400 text-[10px] sm:text-xs font-bold tracking-wide">AKTIV</div>
              <Activity className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold neon-cyan">
              {users.filter(u => u.is_active).length}
            </div>
          </div>

          <div className="stat-card-cyber p-3 sm:p-4 rounded glow-yellow">
            <div className="flex items-center justify-between mb-2">
              <div className="text-yellow-400 text-[10px] sm:text-xs font-bold tracking-wide">API-AUFRUFE</div>
              <TrendingUp className="h-4 w-4 text-yellow-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold neon-cyan">
              {users.reduce((sum, u) => sum + (u.total_api_calls || 0), 0).toLocaleString()}
            </div>
          </div>

          <div className="stat-card-cyber p-3 sm:p-4 rounded glow-cyan">
            <div className="flex items-center justify-between mb-2">
              <div className="text-yellow-400 text-[10px] sm:text-xs font-bold tracking-wide">KOSTEN</div>
              <DollarSign className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-bold neon-cyan">
              ${users.reduce((sum, u) => sum + parseFloat(u.total_cost || '0'), 0).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-yellow-400" />
            <Input
              type="text"
              placeholder="BENUTZER SUCHEN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 bg-black/50 border-yellow-500/30 text-cyan-400 placeholder:text-yellow-400/40 text-base sm:text-lg"
            />
          </div>
        </div>

        {/* Users Section */}
        <div className="cyber-panel p-4 sm:p-6 rounded">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-lg sm:text-xl font-bold neon-yellow tracking-wide">BENUTZERLISTE</h2>
            <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
              <div className="text-xs sm:text-sm text-cyan-400">
                {filteredUsers.length} BENUTZER
              </div>
              <Button
                onClick={() => setShowCreateModal(true)}
                className="glow-green border-green-500 text-green-400 hover:bg-green-500/10"
                size="sm"
              >
                <UserPlus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">BENUTZER ERSTELLEN</span>
              </Button>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="block lg:hidden space-y-3">
            {filteredUsers.map((user) => (
              <div key={user.id} className="bg-black/40 rounded p-4 border border-yellow-500/10">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-bold text-cyan-400">{user.username}</div>
                    <div className="text-xs text-gray-400">{user.email || '-'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={user.is_active ? 'status-online' : 'status-offline'}></div>
                    <span className="badge-info px-2 py-0.5 rounded text-[10px] font-bold">
                      {user.role?.toUpperCase() || 'USER'}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                  <div>
                    <span className="text-yellow-400/60">API-Aufrufe:</span>
                    <span className="text-cyan-400 ml-1">{user.total_api_calls?.toLocaleString() || 0}</span>
                  </div>
                  <div>
                    <span className="text-yellow-400/60">Tokens:</span>
                    <span className="text-cyan-400 ml-1">{user.total_tokens_used?.toLocaleString() || 0}</span>
                  </div>
                  <div>
                    <span className="text-yellow-400/60">Kosten:</span>
                    <span className="text-green-400 ml-1">${parseFloat(user.total_cost || '0').toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-yellow-400/60">Fehler:</span>
                    <span className={`ml-1 ${(user.total_errors || 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {user.total_errors || 0}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-yellow-500/10">
                  <Link href={`/users/${user.id}`} className="flex-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full glow-cyan border-cyan-500 text-cyan-400 hover:bg-cyan-500/10 text-xs"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      ANSEHEN
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(user)}
                    className="flex-1 glow-yellow border-yellow-500 text-yellow-400 hover:bg-yellow-500/10 text-xs"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    BEARBEITEN
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteUser(user.id, user.username)}
                    className="glow-red border-red-500 text-red-400 hover:bg-red-500/10 text-xs px-3"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block">
            <div className="responsive-table-wrapper">
              <div className="responsive-table-inner">
                <div className="cyber-table rounded overflow-hidden min-w-[1000px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-yellow-500/30">
                        <TableHead className="text-yellow-400 font-bold">BENUTZERNAME</TableHead>
                        <TableHead className="text-yellow-400 font-bold">E-MAIL</TableHead>
                        <TableHead className="text-yellow-400 font-bold">ROLLE</TableHead>
                        <TableHead className="text-yellow-400 font-bold">STATUS</TableHead>
                        <TableHead className="text-yellow-400 font-bold">API-AUFRUFE</TableHead>
                        <TableHead className="text-yellow-400 font-bold">TOKENS</TableHead>
                        <TableHead className="text-yellow-400 font-bold">KOSTEN</TableHead>
                        <TableHead className="text-yellow-400 font-bold">FEHLER</TableHead>
                        <TableHead className="text-yellow-400 font-bold">LETZTE AKTIVITÄT</TableHead>
                        <TableHead className="text-yellow-400 font-bold">AKTIONEN</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.id} className="border-yellow-500/10">
                          <TableCell className="font-bold text-cyan-400">
                            {user.username}
                          </TableCell>
                          <TableCell className="text-gray-300 text-sm">
                            {user.email || '-'}
                          </TableCell>
                          <TableCell>
                            <span className="badge-info px-2 py-1 rounded text-xs font-bold">
                              {user.role?.toUpperCase() || 'USER'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={user.is_active ? 'status-online' : 'status-offline'}></div>
                              <span className={user.is_active ? 'text-green-400' : 'text-red-400'}>
                                {user.is_active ? 'AKTIV' : 'INAKTIV'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-cyan-400">
                            {user.total_api_calls?.toLocaleString() || 0}
                          </TableCell>
                          <TableCell className="text-cyan-400">
                            {user.total_tokens_used?.toLocaleString() || 0}
                          </TableCell>
                          <TableCell className="text-green-400">
                            ${parseFloat(user.total_cost || '0').toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <span className={`${
                              (user.total_errors || 0) > 0 ? 'text-red-400' : 'text-green-400'
                            }`}>
                              {user.total_errors || 0}
                            </span>
                          </TableCell>
                          <TableCell className="text-gray-400 text-xs">
                            {user.last_activity
                              ? new Date(user.last_activity).toLocaleString('de-DE')
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Link href={`/users/${user.id}`} className="inline-block">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="glow-cyan border-cyan-500 text-cyan-400 hover:bg-cyan-500/10"
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  ANSEHEN
                                </Button>
                              </Link>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditModal(user)}
                                className="glow-yellow border-yellow-500 text-yellow-400 hover:bg-yellow-500/10"
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                BEARBEITEN
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteUser(user.id, user.username)}
                                className="glow-red border-red-500 text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                LÖSCHEN
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>
        </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="cyber-panel p-4 sm:p-6 rounded-t-xl sm:rounded w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold neon-yellow tracking-wide">BENUTZER ERSTELLEN</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={closeCreateModal}
                className="border-red-500 text-red-400 hover:bg-red-500/10"
                disabled={isSubmitting}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Form-level error message */}
            {formErrors.some(e => e.field === '_form') && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">
                  {formErrors.find(e => e.field === '_form')?.message}
                </p>
              </div>
            )}
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-yellow-400 text-sm font-bold mb-2">BENUTZERNAME *</label>
                <Input
                  type="text"
                  value={formData.username}
                  onChange={(e) => {
                    setFormData({ ...formData, username: e.target.value });
                    clearFieldError('username');
                  }}
                  className={`bg-black/50 text-cyan-400 ${
                    getFieldError('username')
                      ? 'border-red-500 focus:border-red-400'
                      : 'border-yellow-500/30'
                  }`}
                  placeholder="Benutzername eingeben (3-50 Zeichen)"
                  disabled={isSubmitting}
                />
                {getFieldError('username') && (
                  <p className="mt-1 text-red-400 text-xs flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {getFieldError('username')}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-bold mb-2">EMAIL *</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    clearFieldError('email');
                  }}
                  className={`bg-black/50 text-cyan-400 ${
                    getFieldError('email')
                      ? 'border-red-500 focus:border-red-400'
                      : 'border-yellow-500/30'
                  }`}
                  placeholder="E-Mail-Adresse eingeben"
                  disabled={isSubmitting}
                />
                {getFieldError('email') && (
                  <p className="mt-1 text-red-400 text-xs flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {getFieldError('email')}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-bold mb-2">PASSWORT *</label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value });
                    clearFieldError('password');
                  }}
                  className={`bg-black/50 text-cyan-400 ${
                    getFieldError('password')
                      ? 'border-red-500 focus:border-red-400'
                      : 'border-yellow-500/30'
                  }`}
                  placeholder="Passwort eingeben (min. 6 Zeichen)"
                  disabled={isSubmitting}
                />
                {getFieldError('password') && (
                  <p className="mt-1 text-red-400 text-xs flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {getFieldError('password')}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-bold mb-2">ROLLE</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-black/50 border border-yellow-500/30 text-cyan-400 rounded px-3 py-2"
                  disabled={isSubmitting}
                >
                  <option value="user">BENUTZER</option>
                  <option value="admin">ADMIN</option>
                  <option value="guest">GAST</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4"
                  disabled={isSubmitting}
                />
                <label className="text-yellow-400 text-sm font-bold">AKTIV</label>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  className="flex-1 glow-green border-green-500 text-green-400 hover:bg-green-500/10"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'ERSTELLEN...' : 'BENUTZER ERSTELLEN'}
                </Button>
                <Button
                  type="button"
                  onClick={closeCreateModal}
                  className="flex-1 glow-red border-red-500 text-red-400 hover:bg-red-500/10"
                  disabled={isSubmitting}
                >
                  ABBRECHEN
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="cyber-panel p-4 sm:p-6 rounded-t-xl sm:rounded w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg sm:text-xl font-bold neon-yellow tracking-wide">BENUTZER BEARBEITEN</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={closeEditModal}
                className="border-red-500 text-red-400 hover:bg-red-500/10"
                disabled={isSubmitting}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Display current user info */}
            <div className="mb-4 p-3 bg-cyan-900/20 border border-cyan-500/30 rounded">
              <p className="text-cyan-400 text-xs">
                Benutzer bearbeiten: <span className="font-bold">{editingUser.username}</span> (ID: {editingUser.id})
              </p>
            </div>
            
            {/* Form-level error message */}
            {formErrors.some(e => e.field === '_form') && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-400 text-sm">
                  {formErrors.find(e => e.field === '_form')?.message}
                </p>
              </div>
            )}
            
            <form onSubmit={handleEditUser} className="space-y-4">
              <div>
                <label className="block text-yellow-400 text-sm font-bold mb-2">BENUTZERNAME *</label>
                <Input
                  type="text"
                  value={formData.username}
                  onChange={(e) => {
                    setFormData({ ...formData, username: e.target.value });
                    clearFieldError('username');
                  }}
                  className={`bg-black/50 text-cyan-400 ${
                    getFieldError('username')
                      ? 'border-red-500 focus:border-red-400'
                      : 'border-yellow-500/30'
                  }`}
                  placeholder="Benutzername eingeben (3-50 Zeichen)"
                  disabled={isSubmitting}
                />
                {getFieldError('username') && (
                  <p className="mt-1 text-red-400 text-xs flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {getFieldError('username')}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-bold mb-2">EMAIL *</label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    clearFieldError('email');
                  }}
                  className={`bg-black/50 text-cyan-400 ${
                    getFieldError('email')
                      ? 'border-red-500 focus:border-red-400'
                      : 'border-yellow-500/30'
                  }`}
                  placeholder="E-Mail-Adresse eingeben"
                  disabled={isSubmitting}
                />
                {getFieldError('email') && (
                  <p className="mt-1 text-red-400 text-xs flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {getFieldError('email')}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-bold mb-2">
                  PASSWORT <span className="text-gray-500 font-normal">(leer lassen, um aktuelles zu behalten)</span>
                </label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value });
                    clearFieldError('password');
                  }}
                  className={`bg-black/50 text-cyan-400 ${
                    getFieldError('password')
                      ? 'border-red-500 focus:border-red-400'
                      : 'border-yellow-500/30'
                  }`}
                  placeholder="Neues Passwort eingeben (min. 6 Zeichen)"
                  disabled={isSubmitting}
                />
                {getFieldError('password') && (
                  <p className="mt-1 text-red-400 text-xs flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {getFieldError('password')}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-yellow-400 text-sm font-bold mb-2">ROLLE</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-black/50 border border-yellow-500/30 text-cyan-400 rounded px-3 py-2"
                  disabled={isSubmitting}
                >
                  <option value="user">BENUTZER</option>
                  <option value="admin">ADMIN</option>
                  <option value="guest">GAST</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4"
                  disabled={isSubmitting}
                />
                <label className="text-yellow-400 text-sm font-bold">AKTIV</label>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  className="flex-1 glow-green border-green-500 text-green-400 hover:bg-green-500/10"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'AKTUALISIEREN...' : 'BENUTZER AKTUALISIEREN'}
                </Button>
                <Button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 glow-red border-red-500 text-red-400 hover:bg-red-500/10"
                  disabled={isSubmitting}
                >
                  ABBRECHEN
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}