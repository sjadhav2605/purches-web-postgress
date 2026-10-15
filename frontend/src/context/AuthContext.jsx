import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '@/services/auth.service.js';
import { 
  ROLE_DEFINITIONS, 
  resolveDirectorKey, 
  resolveRoleKey, 
  STORAGE_KEYS, 
  AUTH_STORAGE_KEYS 
} from '@/constants';

// Re-export role definitions and resolver for complete backward compatibility with existing imports
export { ROLE_DEFINITIONS, resolveDirectorKey };

const AuthContext = createContext(null);

const readStoredToken = () => localStorage.getItem(STORAGE_KEYS.TOKEN) || null;

const readStoredUser = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.USER);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
};

// "View As" selection is only meaningful for administrators; always validated against known roles
const readStoredAdminView = () => {
  const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_ROLE);
  const key = saved === 'director' ? 'director_1' : saved;
  return key && ROLE_DEFINITIONS[key] ? key : 'admin';
};


export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);
  const [token, setToken] = useState(readStoredToken);
  const [loading, setLoading] = useState(() => !(readStoredToken() && readStoredUser()));
  const [adminView, setAdminView] = useState(readStoredAdminView);

  // Active Role Key (e.g. director_1, director_2, director_3, purchase, etc.) derived from the user
  const activeRoleKey = resolveRoleKey(user, adminView);

  // Effective role for permission checks (maps director_1/2/3 -> 'director')
  const activeRole = activeRoleKey && activeRoleKey.startsWith('director') ? 'director' : activeRoleKey;
  const activeDirectorId = ROLE_DEFINITIONS[activeRoleKey]?.directorId || (activeRole === 'director' ? 5 : null);
  const activeDirectorName = ROLE_DEFINITIONS[activeRoleKey]?.title || 'Director';

  // Multi-tab consistency: localStorage is the single shared session. Whenever ANOTHER tab logs in,
  // logs out or changes the admin view, adopt that session here so this tab never keeps showing one
  // user/role in memory while sending API requests with a different user's token.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== null && !AUTH_STORAGE_KEYS.includes(e.key)) return;
      const storedToken = readStoredToken();
      const storedUser = readStoredUser();
      if (!storedToken) {
        // Logged out (or session expired) in another tab
        setToken(null);
        setUser(null);
        setAdminView('admin');
        setLoading(false);
        return;
      }
      if (!storedUser) return; // partial write from another tab; the next event completes it
      setAdminView(readStoredAdminView());
      setToken(storedToken);
      setUser(storedUser);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    let cancelled = false; // token changed (login/logout/other tab) while a profile check was in flight
    // Validate current token if present
    const checkAuth = async () => {
      if (token) {
        try {
          const profile = await authService.getProfile();
          if (cancelled) return;
          if (profile) {
            // Server-verified profile is authoritative; the active role is derived from it
            setUser(profile);
            localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(profile));
          }
        } catch (error) {
          if (cancelled) return;
          // IMPORTANT: Only clear session if server explicitly returned 401 Unauthorized
          if (error.status === 401 || error.response?.status === 401) {
            logout();
          } else {
            console.warn('Auth validation warning (retaining cached session):', error.message || error);
          }
        }
      }
      if (!cancelled) setLoading(false);
    };

    checkAuth();
    return () => { cancelled = true; };
  }, [token]);

  const switchRole = (roleKey) => {
    // STRICT SECURITY: ONLY Administrator can switch roles!
    if (user?.role !== 'admin') {
      console.warn('Unauthorized role switch attempt. Only administrators can switch roles.');
      return;
    }
    const targetKey = roleKey === 'director' ? 'director_1' : roleKey;
    if (ROLE_DEFINITIONS[targetKey]) {
      setAdminView(targetKey);
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ROLE, targetKey);
    }
  };

  const login = async (email, password) => {
    const data = await authService.login(email, password);
    // Persist the session first (shared with other tabs), then update this tab's state
    localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(data.user));
    if (data.user.role === 'admin') {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ROLE, 'admin');
    } else {
      // Only admins have a "View As" selection; never carry one over into another user's session
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_ROLE);
    }
    setAdminView('admin');
    setToken(data.token);
    setUser(data.user);
    setLoading(false);
    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setAdminView('admin');
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_ROLE);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        activeRole,
        activeRoleKey,
        activeDirectorId,
        activeDirectorName,
        switchRole,
        // Unknown/absent role gets a neutral, permissionless profile (never an implicit admin)
        currentRoleInfo: ROLE_DEFINITIONS[activeRoleKey] || {
          id: 'unknown',
          title: user?.role || 'Unknown',
          duty: '',
          color: '#64748b',
          allowedNavs: []
        },
        isAuthenticated: !!token && !!user,
        loading,
        login,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
