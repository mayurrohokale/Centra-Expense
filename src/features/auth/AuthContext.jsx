'use client';
import { createContext, useContext } from 'react';

// Provides the authenticated user + shell actions to the whole app:
//  - logout(): clears the session.
//  - openProfile() / closeProfile(): navigate to/from the Profile screen.
//  - refreshUser(): re-fetch /api/auth/me and update the shell user so the
//    Header avatar/name and Dashboard greeting reflect edits live.
const AuthContext = createContext({
  user: null,
  logout: () => {},
  openProfile: () => {},
  closeProfile: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ user, logout, openProfile, closeProfile, refreshUser, children }) {
  return (
    <AuthContext.Provider value={{ user, logout, openProfile, closeProfile, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
