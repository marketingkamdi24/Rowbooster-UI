import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    let response: Response;
    try {
      response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
    } catch {
      throw new Error("Verbindung fehlgeschlagen. Bitte Internetverbindung prüfen und erneut versuchen.");
    }

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.error?.message ||
        "Anmeldung fehlgeschlagen. Bitte erneut versuchen.";
      throw new Error(message);
    }

    const data = payload;
    setUser(data.user);
    
    // CRITICAL: Clear all cached data when user logs in to prevent data leakage
    // This ensures each user sees only their own property tables
    console.log('[AUTH] Clearing React Query cache after login');
    await queryClient.invalidateQueries({ queryKey: ['/api/property-tables'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/property-tables/count'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
    await queryClient.invalidateQueries({ queryKey: ['/api/search-results'] });
    // Force refetch by removing stale data
    queryClient.removeQueries({ queryKey: ['/api/property-tables'] });
    queryClient.removeQueries({ queryKey: ['/api/property-tables/count'] });
    queryClient.removeQueries({ queryKey: ['/api/properties'] });
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      // Ignore logout errors
    } finally {
      // CRITICAL: Clear all cached data when user logs out
      console.log('[AUTH] Clearing React Query cache after logout');
      queryClient.clear();
      setUser(null);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const value = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}