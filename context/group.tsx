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
import { getMyGroups, type Group } from '@/lib/api';

export type { Group };

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
    const list = await getMyGroups(user.id);
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
