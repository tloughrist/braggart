import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { PlayerPicker, type PlayerOption } from '@/components/PlayerPicker';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { MAX_CONTENT_WIDTH } from '@/constants/layout';
import { useAuth } from '@/context/auth';
import { useGroup } from '@/context/group';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  addGroupMember,
  createGroup as createGroupApi,
  getAllPlayers,
  getGroupMembers,
  setGroupAdmin,
  type GroupMember,
} from '@/lib/api';

type Msg = { type: 'error' | 'success'; text: string };

export default function GroupScreen() {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const { user } = useAuth();
  const { activeGroup, activeGroupId, setActiveGroupId, refresh } = useGroup();

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [allPlayers, setAllPlayers] = useState<PlayerOption[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Msg | null>(null);

  const loadMembers = useCallback(async () => {
    if (!activeGroupId) {
      setMembers([]);
      return;
    }
    setLoadingMembers(true);
    setMembers(await getGroupMembers(activeGroupId));
    setLoadingMembers(false);
  }, [activeGroupId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  useEffect(() => {
    let active = true;
    getAllPlayers().then((players) => {
      if (active) setAllPlayers(players);
    });
    return () => {
      active = false;
    };
  }, []);

  const myRole = members.find((m) => m.id === user?.id)?.role;
  const canManage = myRole === 'owner' || myRole === 'admin';

  const availableToAdd = useMemo(() => {
    const taken = new Set(members.map((m) => m.id));
    return allPlayers.filter((p) => !taken.has(p.id));
  }, [allPlayers, members]);

  async function createGroup() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setMessage(null);
    const { data, error } = await createGroupApi(name);
    setBusy(false);
    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }
    setNewName('');
    await refresh();
    if (data) setActiveGroupId(data);
    setMessage({ type: 'success', text: 'Group created!' });
  }

  async function addMember(p: PlayerOption) {
    if (!activeGroupId) return;
    setMessage(null);
    const { error } = await addGroupMember(activeGroupId, p.id);
    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }
    loadMembers();
  }

  async function toggleAdmin(m: GroupMember, makeAdmin: boolean) {
    if (!activeGroupId) return;
    setMessage(null);
    const { error } = await setGroupAdmin(activeGroupId, m.id, makeAdmin);
    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }
    loadMembers();
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {activeGroupId ? (
          <Card>
            <ThemedText type="subtitle" style={styles.title}>
              {activeGroup?.name ?? 'Group'}
            </ThemedText>
            <ThemedText style={styles.label}>Members</ThemedText>
            {loadingMembers ? (
              <ActivityIndicator color={theme.primary} style={styles.loader} />
            ) : (
              members.map((m) => {
                const canToggle = canManage && m.role !== 'owner' && m.id !== user?.id;
                return (
                  <View key={m.id} style={styles.memberRow}>
                    <ThemedText style={styles.memberName} numberOfLines={1}>
                      {m.name}
                    </ThemedText>
                    {m.role !== 'member' && (
                      <ThemedText style={[styles.role, { color: theme.muted }]}>{m.role}</ThemedText>
                    )}
                    {canToggle && (
                      <Pressable
                        onPress={() => toggleAdmin(m, m.role !== 'admin')}
                        hitSlop={8}
                        style={[styles.adminBtn, { borderColor: theme.primary }]}>
                        <ThemedText style={{ color: theme.primary, fontSize: 12 }}>
                          {m.role === 'admin' ? 'Remove admin' : 'Make admin'}
                        </ThemedText>
                      </Pressable>
                    )}
                  </View>
                );
              })
            )}
            {canManage && (
              <View style={styles.addWrap}>
                <PlayerPicker players={availableToAdd} onSelect={addMember} />
              </View>
            )}
          </Card>
        ) : (
          <Card>
            <ThemedText style={styles.centerText}>
              You’re not in a group yet. Create one below to get started.
            </ThemedText>
          </Card>
        )}

        <Card style={styles.newCard}>
          <ThemedText type="subtitle" style={styles.title}>
            New group
          </ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            placeholder="Group name"
            placeholderTextColor={theme.muted}
            value={newName}
            onChangeText={setNewName}
          />
          <Pressable
            onPress={createGroup}
            disabled={!newName.trim() || busy}
            style={[
              styles.createBtn,
              { backgroundColor: theme.primary },
              (!newName.trim() || busy) && styles.disabled,
            ]}>
            {busy ? (
              <ActivityIndicator color={theme.headerText} />
            ) : (
              <ThemedText style={[styles.btnText, { color: theme.headerText }]}>
                Create group
              </ThemedText>
            )}
          </Pressable>
        </Card>

        {message && (
          <ThemedText
            style={[
              styles.message,
              { color: message.type === 'error' ? '#e5484d' : theme.headerText },
            ]}>
            {message.text}
          </ThemedText>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  title: { textAlign: 'center', marginBottom: 8 },
  label: { marginTop: 8, marginBottom: 6, fontWeight: '600' },
  loader: { marginVertical: 16 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
  },
  memberName: { flex: 1, fontSize: 16 },
  role: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  adminBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  addWrap: { marginTop: 10 },
  centerText: { textAlign: 'center' },
  newCard: { marginTop: 16 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 10,
  },
  createBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  btnText: { fontSize: 16, fontWeight: '600' },
  message: { textAlign: 'center', marginTop: 14 },
});
