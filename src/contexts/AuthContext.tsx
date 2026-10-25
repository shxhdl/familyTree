import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile, AuthUser } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  authUser: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async (u: User) => {
    try {
      // Load profile
      let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', u.id)
        .maybeSingle();

      const metaName = (u.user_metadata?.full_name as string) || '';

      // If profile does not exist or full_name is empty but metaName exists, sync it
      if (!profile && metaName) {
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({ user_id: u.id, full_name: metaName, email: u.email || '' })
          .select()
          .maybeSingle();
        if (newProfile) profile = newProfile;
      } else if (profile && !profile.full_name && metaName) {
        await supabase
          .from('profiles')
          .update({ full_name: metaName })
          .eq('user_id', u.id);
        profile.full_name = metaName;
      }

      // Check if admin
      const { data: adminRow } = await supabase
        .from('app_admins')
        .select('is_super_admin')
        .eq('user_id', u.id)
        .maybeSingle();

      const resolvedProfile: Profile = profile || {
        id: u.id,
        user_id: u.id,
        full_name: metaName || u.email?.split('@')[0] || '',
        email: u.email || '',
        created_at: u.created_at,
        updated_at: u.created_at,
      };

      setAuthUser({
        id: u.id,
        email: u.email || '',
        is_admin: adminRow?.is_super_admin === true,
        profile: resolvedProfile,
      });
    } catch (err) {
      console.warn('Error loading user profile:', err);
      const metaName = (u.user_metadata?.full_name as string) || u.email?.split('@')[0] || '';
      setAuthUser({
        id: u.id,
        email: u.email || '',
        is_admin: false,
        profile: {
          id: u.id,
          user_id: u.id,
          full_name: metaName,
          email: u.email || '',
          created_at: u.created_at,
          updated_at: u.created_at,
        },
      });
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadUserData(s.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadUserData(s.user).finally(() => setLoading(false));
      } else {
        setAuthUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, authUser, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
