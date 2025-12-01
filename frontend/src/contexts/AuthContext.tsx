
import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';

interface User {
  userId: string;
  email: string;
  firstName?: string;
  [key: string]: any;
}

// This is the shape of the data we'll store in our context
interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  user: User | null;
  login: (token: string) => void;
  logout: () => void;
  isLoading: boolean;
}

// Initialize the context with `undefined` and a specific generic type.
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = 'embracehealth-api-token';

const parseJwt = (token: string): User | null => {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On initial load, check for a token in localStorage and from URL parameters
  useEffect(() => {
    // Check for a token returned in the URL from the Shopify callback
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('token');

    if (tokenFromUrl) {
      setToken(tokenFromUrl);
      try {
        localStorage.setItem(AUTH_TOKEN_KEY, tokenFromUrl);
      } catch (e) {
        console.error("Failed to save token to localStorage:", e);
      }
      // Clean the URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      // Otherwise, check localStorage for an existing session
      const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      if (storedToken) {
        setToken(storedToken);
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((newToken: string) => {
    setToken(newToken);
    try {
        localStorage.setItem(AUTH_TOKEN_KEY, newToken);
    } catch (e) {
        console.error("Failed to save token to localStorage:", e);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    try {
        localStorage.removeItem(AUTH_TOKEN_KEY);
    } catch (e) {
        console.error("Failed to remove token from localStorage:", e);
    }
  }, []);

  const user = useMemo(() => {
    if (!token) return null;
    return parseJwt(token);
  }, [token]);

  const value = {
    token,
    isAuthenticated: !!token,
    user,
    login,
    logout,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
