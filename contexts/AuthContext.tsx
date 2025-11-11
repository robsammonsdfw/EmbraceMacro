import React, { createContext, useState, useEffect, useCallback } from 'react';

// This is the shape of the data we'll store in our context
interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
  isLoading: boolean;
}

// FIX: Initialize the context with `undefined` and a specific generic type.
// This prevents TypeScript from inferring the type as `{}`, which was causing
// errors in components consuming this context. The `useAuth` hook will handle
// the `undefined` case to ensure the provider is used.
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = 'macro-vision-ai-auth-token';

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
      localStorage.setItem(AUTH_TOKEN_KEY, tokenFromUrl);
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
    localStorage.setItem(AUTH_TOKEN_KEY, newToken);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }, []);

  const value = {
    token,
    isAuthenticated: !!token,
    login,
    logout,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
