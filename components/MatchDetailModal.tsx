import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { DateField } from '@/components/DateField';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { deleteMatch, updateMatch, type MatchSummary } from '@/lib/api';

type Props = {
  match: MatchSummary | null;
  currentUserId: string | undefined;
  isGroupAdmin?: boolean;
  onClose: () => void;
  onChanged: () => void; // refetch + close after edit/delete
};

type Edits = Record<string, { score: string; handicap: string }>;

export function MatchDetailModal({
  match,
  currentUserId,
  isGroupAdmin = false,
  onClose,
  onChanged,
}: Props) {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];

  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date());
  const [edits, setEdits] = useState<Edits>({});

  useEffect(() => {
    if (!match) return;
    setMode('view');
    setConfirmDelete(false);
    setError(null);
    setDate(match.datePlayed ? new Date(match.datePlayed) : new Date());
    const e: Edits = {};
    for (const p of match.participants) {
      e[p.playerId] = { score: p.score == null ? '' : String(p.score), handicap: p.handicap ? String(p.handicap) : '' };
    }
    setEdits(e);
  }, [match]);

  if (!match) return null;

  const isOwner = !!match.ownerId && match.ownerId === currentUserId;
  const canManage = isOwner || isGroupAdmin;
  const canEdit = canManage && !match.teamBased;
  const dateLabel = match.datePlayed ? new Date(match.datePlayed).toLocaleDateString() : 'No date';

  async function save() {
    if (!match) return;
    setBusy(true);
    setError(null);
    const { error } = await updateMatch({
      matchId: match.id,
      date: date.toISOString(),
      players: match.participants.map((p) => ({
        player_id: p.playerId,
        score: Number(edits[p.playerId]?.score || 0),
        handicap: edits[p.playerId]?.handicap?.trim() ? Number(edits[p.playerId].handicap) : 0,
      })),
    });
    setBusy(false);
    if (error) setError(error);
    else onChanged();
  }

  async function remove() {
    if (!match) return;
    setBusy(true);
    setError(null);
    const { error } = await deleteMatch(match.id);
    setBusy(false);
    if (error) setError(error);
    else onChanged();
  }

  const sortedParticipants = [...match.participants].sort(
    (a, b) => (a.place ?? 99) - (b.place ?? 99) || a.name.localeCompare(b.name),
  );
  const sortedTeams = [...match.teams].sort((a, b) => Number(b.isWinner) - Number(a.isWinner));

  return (
    <Modal visible={!!match} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => {}}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <ThemedText type="subtitle" style={styles.title}>
              {match.gameName}
            </ThemedText>

            {mode === 'view' ? (
              <>
                <ThemedText style={styles.muted}>{dateLabel}</ThemedText>

                {match.teamBased ? (
                  <View style={styles.section}>
                    {sortedTeams.map((t) => (
                      <View key={t.teamId} style={[styles.teamBlock, { borderColor: theme.border }]}>
                        <View style={styles.rowBetween}>
                          <ThemedText style={styles.teamName}>
                            {t.name} {t.isWinner ? '· winner' : ''}
                          </ThemedText>
                          <ThemedText style={styles.score}>{t.score ?? ''}</ThemedText>
                        </View>
                        {match.participants
                          .filter((p) => p.teamId === t.teamId)
                          .map((p) => (
                            <ThemedText key={p.playerId} style={styles.teamPlayer}>
                              {p.name}
                            </ThemedText>
                          ))}
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.section}>
                    {sortedParticipants.map((p) => (
                      <View key={p.playerId} style={styles.resultRow}>
                        <ThemedText style={styles.place}>{p.place ?? '-'}</ThemedText>
                        <ThemedText style={[styles.pname, p.isWinner && { color: theme.primary, fontWeight: '700' }]} numberOfLines={1}>
                          {p.name}
                          {p.handicap ? ` (hcp ${p.handicap > 0 ? '+' : ''}${p.handicap})` : ''}
                        </ThemedText>
                        <ThemedText style={styles.score}>{p.score ?? ''}</ThemedText>
                      </View>
                    ))}
                  </View>
                )}

                {error && <ThemedText style={styles.error}>{error}</ThemedText>}

                {canManage && (
                  <View style={styles.actions}>
                    {canEdit && (
                      <Pressable
                        onPress={() => setMode('edit')}
                        style={[styles.action, { borderColor: theme.border }]}>
                        <IconSymbol name="pencil" size={18} color={theme.text} />
                        <ThemedText>Edit</ThemedText>
                      </Pressable>
                    )}
                    {!confirmDelete ? (
                      <Pressable
                        onPress={() => setConfirmDelete(true)}
                        style={[styles.action, { borderColor: theme.border }]}>
                        <IconSymbol name="trash" size={18} color="#e5484d" />
                        <ThemedText style={{ color: '#e5484d' }}>Delete</ThemedText>
                      </Pressable>
                    ) : (
                      <View style={styles.confirmRow}>
                        <ThemedText style={styles.confirmText}>Delete this match?</ThemedText>
                        <Pressable onPress={remove} disabled={busy} style={[styles.confirmBtn, { backgroundColor: '#e5484d' }]}>
                          {busy ? <ActivityIndicator color="#fff" /> : <ThemedText style={{ color: '#fff' }}>Delete</ThemedText>}
                        </Pressable>
                        <Pressable onPress={() => setConfirmDelete(false)} style={styles.confirmCancel}>
                          <ThemedText>Cancel</ThemedText>
                        </Pressable>
                      </View>
                    )}
                  </View>
                )}
              </>
            ) : (
              <>
                <ThemedText style={styles.label}>Date played</ThemedText>
                <DateField value={date} onChange={setDate} />

                <ThemedText style={styles.label}>Scores</ThemedText>
                {match.participants.map((p) => (
                  <View key={p.playerId} style={styles.editRow}>
                    <ThemedText style={styles.pname} numberOfLines={1}>{p.name}</ThemedText>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                      keyboardType="number-pad"
                      placeholder="Score"
                      placeholderTextColor={theme.muted}
                      value={edits[p.playerId]?.score ?? ''}
                      onChangeText={(t) => setEdits((e) => ({ ...e, [p.playerId]: { ...e[p.playerId], score: t } }))}
                    />
                    <TextInput
                      style={[styles.inputSmall, { color: theme.text, borderColor: theme.border }]}
                      keyboardType="numbers-and-punctuation"
                      placeholder="hcp"
                      placeholderTextColor={theme.muted}
                      value={edits[p.playerId]?.handicap ?? ''}
                      onChangeText={(t) => setEdits((e) => ({ ...e, [p.playerId]: { ...e[p.playerId], handicap: t } }))}
                    />
                  </View>
                ))}

                {error && <ThemedText style={styles.error}>{error}</ThemedText>}

                <Pressable
                  onPress={save}
                  disabled={busy}
                  style={[styles.saveBtn, { backgroundColor: theme.primary }, busy && styles.disabled]}>
                  {busy ? <ActivityIndicator color={theme.headerText} /> : <ThemedText style={{ color: theme.headerText, fontWeight: '600' }}>Save changes</ThemedText>}
                </Pressable>
                <Pressable onPress={() => setMode('view')} style={styles.close}>
                  <ThemedText type="link">Cancel</ThemedText>
                </Pressable>
              </>
            )}

            {mode === 'view' && (
              <Pressable onPress={onClose} style={styles.close}>
                <ThemedText type="link">Close</ThemedText>
              </Pressable>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 460, maxHeight: '85%', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  title: { marginBottom: 4 },
  muted: { opacity: 0.6 },
  section: { marginTop: 12, gap: 4 },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  place: { width: 24, textAlign: 'center', opacity: 0.6 },
  pname: { flex: 1, fontSize: 16 },
  score: { width: 60, textAlign: 'right', fontSize: 16 },
  teamBlock: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, marginBottom: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  teamName: { fontSize: 16, fontWeight: '600' },
  teamPlayer: { opacity: 0.8, marginTop: 4 },
  label: { marginTop: 14, marginBottom: 6, fontWeight: '600' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  input: { width: 76, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, textAlign: 'center' },
  inputSmall: { width: 56, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, fontSize: 16, textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  confirmText: { flex: 1 },
  confirmBtn: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' },
  confirmCancel: { paddingHorizontal: 10, paddingVertical: 8 },
  saveBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  disabled: { opacity: 0.5 },
  error: { color: '#e5484d', textAlign: 'center', marginTop: 12 },
  close: { alignItems: 'center', marginTop: 14 },
});
