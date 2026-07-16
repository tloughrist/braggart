import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';

import { useAuth } from '@/context/auth';
import { supabase } from '@/lib/supabase';

export type Group = { id: string; name: string };

type GroupContextValue = {
  groups: Group[];
  activeGroup: Group | null;
  activeGroupId: string | null;
  setActiveGroupId: (id: string) => void;
  loading: boolean;
  /** Re-fetch the user's groups (call after creating one). */
  refresh: () => Promise<void>;
};

const STORAGE_KEY = 'braggart.activeGroupId';
const GroupContext = createContext<GroupContextValue | undefined>(undefined);

export function GroupProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroupId, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setGroups([]);
      setActive(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('player_groups')
      .select('group:groups(id, name)')
      .eq('player_id', user.id)
      .eq('status', 'active');

    const list: Group[] = (data ?? [])
      .map((r: any) => (Array.isArray(r.group) ? r.group[0] : r.group))
      .filter(Boolean)
      .sort((a: Group, b: Group) => a.name.localeCompare(b.name));
    setGroups(list);

    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    setActive(list.find((g) => g.id === saved)?.id ?? list[0]?.id ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setActiveGroupId = useCallback((id: string) => {
    setActive(id);
    AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
  }, []);

  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;

  return (
    <GroupContext.Provider
      value={{ groups, activeGroup, activeGroupId, setActiveGroupId, loading, refresh }}>
      {children}
    </GroupContext.Provider>
  );
}

export function useGroup() {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error('useGroup must be used within a GroupProvider');
  return ctx;
}
