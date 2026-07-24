import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { DateField } from '@/components/DateField';
import { PlayerPicker, type PlayerOption } from '@/components/PlayerPicker';
import { SearchSelect } from '@/components/SearchSelect';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { MAX_CONTENT_WIDTH } from '@/constants/layout';
import { useAuth } from '@/context/auth';
import { useGroup } from '@/context/group';
import { useColorScheme } from '@/hooks/useColorScheme';
import {
  createGame,
  createMatch,
  createTeamMatch,
  createTournament,
  getGames,
  getGroupMembers,
  getTournaments,
  type GameRef,
  type Tournament,
} from '@/lib/api';

type Entry = { player: PlayerOption; score: string; handicap: string };
type Team = { key: string; name: string; score: string; players: PlayerOption[] };
type Msg = { type: 'error' | 'success'; text: string };

const numeric = (s: string) => s.trim() !== '' && Number.isFinite(Number(s));
const optionalNumeric = (s: string) => s.trim() === '' || Number.isFinite(Number(s));

export default function RecordScreen() {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const { user } = useAuth();
  const { activeGroupId, groups, loading: groupsLoading } = useGroup();

  const [games, setGames] = useState<GameRef[]>([]);
  const [members, setMembers] = useState<PlayerOption[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  const [gameId, setGameId] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date());
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Msg | null>(null);
  const teamKey = useRef(0);

  // create-tournament card
  const [newName, setNewName] = useState('');
  const [newGroupId, setNewGroupId] = useState<string | null>(activeGroupId);
  const [creating, setCreating] = useState(false);
  const [tourMsg, setTourMsg] = useState<Msg | null>(null);

  // create-game card
  const [gameName, setGameName] = useState('');
  const [gMostPointsWins, setGMostPointsWins] = useState(true);
  const [gTeamBased, setGTeamBased] = useState(false);
  const [gCooperative, setGCooperative] = useState(false);
  const [gPointsToWin, setGPointsToWin] = useState('');
  const [creatingGame, setCreatingGame] = useState(false);
  const [gameMsg, setGameMsg] = useState<Msg | null>(null);

  const activeTournaments = useMemo(
    () => tournaments.filter((t) => t.status === 'active'),
    [tournaments],
  );

  const loadTournaments = async (groupId: string) => {
    setTournaments(await getTournaments(groupId));
  };

  useEffect(() => {
    if (groupsLoading) return;
    setNewGroupId(activeGroupId);
    if (!activeGroupId) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const [g, m, t] = await Promise.all([
        getGames(),
        getGroupMembers(activeGroupId),
        getTournaments(activeGroupId),
      ]);
      if (!active) return;
      setGames(g);
      setMembers(m.map((x) => ({ id: x.id, name: x.name })));
      setTournaments(t);
      resetForm();
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [activeGroupId, groupsLoading]);

  const selectedGame = games.find((g) => g.id === gameId);
  const isTeam = !!selectedGame?.teamBased;

  function resetForm() {
    setGameId(null);
    setEntries([]);
    setTeams([]);
    setDate(new Date());
    setTournamentId(null);
  }

  async function createNewTournament() {
    const name = newName.trim();
    if (!name || !newGroupId || !user) return;
    setCreating(true);
    setTourMsg(null);
    const { error } = await createTournament(name, newGroupId, user.id);
    setCreating(false);
    if (error) {
      setTourMsg({ type: 'error', text: error });
      return;
    }
    setNewName('');
    setTourMsg({ type: 'success', text: 'Tournament created.' });
    // reflect it in the match-form selector if it belongs to the active group
    if (newGroupId === activeGroupId) loadTournaments(activeGroupId);
  }

  function selectGame(id: string) {
    setGameId(id);
    setEntries([]);
    setTeams([]);
    setMessage(null);
  }

  async function createNewGame() {
    const name = gameName.trim();
    if (!name || !user || !optionalNumeric(gPointsToWin)) return;
    setCreatingGame(true);
    setGameMsg(null);
    const { data, error } = await createGame(
      {
        name,
        mostPointsWins: gMostPointsWins,
        teamBased: gTeamBased,
        cooperative: gCooperative,
        pointsToWin: gPointsToWin.trim() === '' ? null : Number(gPointsToWin),
      },
      user.id,
    );
    setCreatingGame(false);
    if (error || !data) {
      setGameMsg({ type: 'error', text: error ?? 'Could not create the game.' });
      return;
    }
    // Add to the picker and select it so the user can record with it right away.
    setGames((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    selectGame(data.id);
    setGameName('');
    setGPointsToWin('');
    setGMostPointsWins(true);
    setGTeamBased(false);
    setGCooperative(false);
    setGameMsg({ type: 'success', text: `“${data.name}” added and selected.` });
  }

  // ── individual mode ──
  const availableForEntries = useMemo(() => {
    const taken = new Set(entries.map((e) => e.player.id));
    return members.filter((p) => !taken.has(p.id));
  }, [members, entries]);

  function addEntry(p: PlayerOption) {
    setEntries((prev) => [...prev, { player: p, score: '', handicap: '' }]);
    setMessage(null);
  }
  function updateEntry(id: string, patch: Partial<Entry>) {
    setEntries((prev) => prev.map((e) => (e.player.id === id ? { ...e, ...patch } : e)));
  }
  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.player.id !== id));
  }

  // ── team mode ──
  const assignedIds = useMemo(
    () => new Set(teams.flatMap((t) => t.players.map((p) => p.id))),
    [teams],
  );
  const availableForTeams = useMemo(
    () => members.filter((p) => !assignedIds.has(p.id)),
    [members, assignedIds],
  );

  function addTeam() {
    teamKey.current += 1;
    setTeams((prev) => [
      ...prev,
      { key: `t${teamKey.current}`, name: `Team ${String.fromCharCode(65 + prev.length)}`, score: '', players: [] },
    ]);
    setMessage(null);
  }
  function updateTeam(key: string, patch: Partial<Team>) {
    setTeams((prev) => prev.map((t) => (t.key === key ? { ...t, ...patch } : t)));
  }
  function removeTeam(key: string) {
    setTeams((prev) => prev.filter((t) => t.key !== key));
  }
  function addPlayerToTeam(key: string, p: PlayerOption) {
    setTeams((prev) => prev.map((t) => (t.key === key ? { ...t, players: [...t.players, p] } : t)));
  }
  function removePlayerFromTeam(key: string, id: string) {
    setTeams((prev) =>
      prev.map((t) => (t.key === key ? { ...t, players: t.players.filter((p) => p.id !== id) } : t)),
    );
  }

  const canSave = isTeam
    ? !!gameId &&
      teams.length >= 2 &&
      teams.every((t) => t.players.length >= 1 && numeric(t.score))
    : !!gameId &&
      entries.length >= 2 &&
      entries.every((e) => numeric(e.score) && optionalNumeric(e.handicap));

  async function save() {
    if (!canSave || !gameId) return;
    setSaving(true);
    setMessage(null);
    const iso = date.toISOString();
    const { error } = isTeam
      ? await createTeamMatch({
          gameId,
          groupId: activeGroupId,
          date: iso,
          tournamentId,
          teams: teams.map((t) => ({
            name: t.name.trim() || 'Team',
            score: Number(t.score),
            player_ids: t.players.map((p) => p.id),
          })),
        })
      : await createMatch({
          gameId,
          groupId: activeGroupId,
          date: iso,
          tournamentId,
          players: entries.map((e) => ({
            player_id: e.player.id,
            score: Number(e.score),
            handicap: e.handicap.trim() === '' ? 0 : Number(e.handicap),
          })),
        });
    setSaving(false);
    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }
    setMessage({ type: 'success', text: 'Match recorded!' });
    resetForm();
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <ThemedText type="subtitle" style={styles.title}>
            Record a match
          </ThemedText>

          {loading ? (
            <ActivityIndicator color={theme.primary} style={styles.loader} />
          ) : !activeGroupId ? (
            <ThemedText style={styles.hint}>
              Join or create a group in the Group tab before recording a match.
            </ThemedText>
          ) : (
            <>
              <ThemedText style={styles.label}>Game</ThemedText>
              <SearchSelect
                options={games}
                selectedId={gameId}
                onSelect={selectGame}
                placeholder="Select a game"
                searchPlaceholder="Search games…"
              />

              <ThemedText style={styles.label}>Date played</ThemedText>
              <DateField value={date} onChange={setDate} />

              {activeTournaments.length > 0 && (
                <>
                  <ThemedText style={styles.label}>Tournament (optional)</ThemedText>
                  <SearchSelect
                    options={activeTournaments.map((t) => ({ id: t.id, name: t.name }))}
                    selectedId={tournamentId}
                    onSelect={setTournamentId}
                    onClear={() => setTournamentId(null)}
                    clearLabel="None"
                    searchPlaceholder="Search tournaments…"
                  />
                </>
              )}

              {isTeam ? (
                <>
                  <ThemedText style={styles.label}>Teams &amp; scores</ThemedText>
                  <ThemedText style={styles.hint}>
                    Add at least two teams. The winning team is set from the scores.
                  </ThemedText>
                  {teams.map((t) => (
                    <View key={t.key} style={[styles.teamCard, { borderColor: theme.border }]}>
                      <View style={styles.teamHeader}>
                        <TextInput
                          style={[styles.teamName, { color: theme.text, borderColor: theme.border }]}
                          value={t.name}
                          onChangeText={(name) => updateTeam(t.key, { name })}
                        />
                        <TextInput
                          style={[styles.scoreInput, { color: theme.text, borderColor: theme.border }]}
                          placeholder="Score"
                          placeholderTextColor={theme.muted}
                          keyboardType="number-pad"
                          value={t.score}
                          onChangeText={(score) => updateTeam(t.key, { score })}
                        />
                        <Pressable onPress={() => removeTeam(t.key)} hitSlop={8} style={styles.remove}>
                          <IconSymbol name="xmark" size={20} color={theme.muted} />
                        </Pressable>
                      </View>
                      {t.players.map((p) => (
                        <View key={p.id} style={styles.chipRow}>
                          <ThemedText numberOfLines={1} style={styles.chipName}>
                            {p.name}
                          </ThemedText>
                          <Pressable onPress={() => removePlayerFromTeam(t.key, p.id)} hitSlop={8}>
                            <IconSymbol name="xmark" size={16} color={theme.muted} />
                          </Pressable>
                        </View>
                      ))}
                      <View style={styles.addWrap}>
                        <PlayerPicker
                          players={availableForTeams}
                          onSelect={(p) => addPlayerToTeam(t.key, p)}
                        />
                      </View>
                    </View>
                  ))}
                  <Pressable
                    onPress={addTeam}
                    style={[styles.addTeam, { borderColor: theme.primary }]}>
                    <IconSymbol name="plus" size={20} color={theme.primary} />
                    <ThemedText style={{ color: theme.primary }}>Add team</ThemedText>
                  </Pressable>
                </>
              ) : (
                <>
                  <ThemedText style={styles.label}>Players, scores &amp; handicaps</ThemedText>
                  <ThemedText style={styles.hint}>
                    Add at least two players. Handicap is optional; the winner is set from the
                    handicap-adjusted scores.
                  </ThemedText>
                  {entries.length > 0 && (
                    <View style={styles.entryHeader}>
                      <ThemedText style={[styles.colName, styles.colLabel]}>Player</ThemedText>
                      <ThemedText style={[styles.colScore, styles.colLabel]}>Score</ThemedText>
                      <ThemedText style={[styles.colHcp, styles.colLabel]}>Hcp</ThemedText>
                      <View style={styles.remove} />
                    </View>
                  )}
                  {entries.map((e) => (
                    <View key={e.player.id} style={styles.playerRow}>
                      <ThemedText style={styles.colName} numberOfLines={1}>
                        {e.player.name}
                      </ThemedText>
                      <TextInput
                        style={[styles.colScore, styles.smallInput, { color: theme.text, borderColor: theme.border }]}
                        placeholder="0"
                        placeholderTextColor={theme.muted}
                        keyboardType="number-pad"
                        value={e.score}
                        onChangeText={(t) => updateEntry(e.player.id, { score: t })}
                      />
                      <TextInput
                        style={[styles.colHcp, styles.smallInput, { color: theme.text, borderColor: theme.border }]}
                        placeholder="0"
                        placeholderTextColor={theme.muted}
                        keyboardType="numbers-and-punctuation"
                        value={e.handicap}
                        onChangeText={(t) => updateEntry(e.player.id, { handicap: t })}
                      />
                      <Pressable onPress={() => removeEntry(e.player.id)} hitSlop={8} style={styles.remove}>
                        <IconSymbol name="xmark" size={20} color={theme.muted} />
                      </Pressable>
                    </View>
                  ))}
                  <View style={styles.addWrap}>
                    <PlayerPicker players={availableForEntries} onSelect={addEntry} />
                  </View>
                </>
              )}

              {message && (
                <ThemedText
                  style={[styles.message, { color: message.type === 'error' ? '#e5484d' : theme.primary }]}>
                  {message.text}
                </ThemedText>
              )}

              <Pressable
                onPress={save}
                disabled={!canSave || saving}
                style={[styles.save, { backgroundColor: theme.primary }, (!canSave || saving) && styles.saveDisabled]}>
                {saving ? (
                  <ActivityIndicator color={theme.headerText} />
                ) : (
                  <ThemedText style={[styles.saveText, { color: theme.headerText }]}>Save match</ThemedText>
                )}
              </Pressable>
            </>
          )}
        </Card>

        <Card style={styles.newCard}>
          <ThemedText type="subtitle" style={styles.title}>
            Create a game
          </ThemedText>
          <ThemedText style={styles.hint}>
            Add a game to your library, then pick it above to record a match.
          </ThemedText>

          <ThemedText style={styles.label}>Name</ThemedText>
          <TextInput
            style={[styles.tourNameInput, { color: theme.text, borderColor: theme.border }]}
            placeholder="e.g. Wingspan"
            placeholderTextColor={theme.muted}
            value={gameName}
            onChangeText={setGameName}
          />

          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <ThemedText style={styles.switchTitle}>Highest score wins</ThemedText>
              <ThemedText style={styles.switchHint}>
                {gMostPointsWins ? 'Most points takes the win.' : 'Lowest score takes the win.'}
              </ThemedText>
            </View>
            <Switch
              value={gMostPointsWins}
              onValueChange={setGMostPointsWins}
              trackColor={{ true: theme.primary }}
            />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <ThemedText style={styles.switchTitle}>Team-based</ThemedText>
              <ThemedText style={styles.switchHint}>
                Played by teams rather than individuals.
              </ThemedText>
            </View>
            <Switch value={gTeamBased} onValueChange={setGTeamBased} trackColor={{ true: theme.primary }} />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <ThemedText style={styles.switchTitle}>Cooperative</ThemedText>
              <ThemedText style={styles.switchHint}>Players work together against the game.</ThemedText>
            </View>
            <Switch
              value={gCooperative}
              onValueChange={setGCooperative}
              trackColor={{ true: theme.primary }}
            />
          </View>

          <ThemedText style={styles.label}>Points to win (optional)</ThemedText>
          <TextInput
            style={[styles.tourNameInput, { color: theme.text, borderColor: theme.border }]}
            placeholder="e.g. 10"
            placeholderTextColor={theme.muted}
            keyboardType="number-pad"
            value={gPointsToWin}
            onChangeText={setGPointsToWin}
          />

          {gameMsg && (
            <ThemedText
              style={[styles.message, { color: gameMsg.type === 'error' ? '#e5484d' : theme.primary }]}>
              {gameMsg.text}
            </ThemedText>
          )}

          <Pressable
            onPress={createNewGame}
            disabled={!gameName.trim() || !optionalNumeric(gPointsToWin) || creatingGame}
            style={[
              styles.save,
              { backgroundColor: theme.primary },
              (!gameName.trim() || !optionalNumeric(gPointsToWin) || creatingGame) && styles.saveDisabled,
            ]}>
            {creatingGame ? (
              <ActivityIndicator color={theme.headerText} />
            ) : (
              <ThemedText style={[styles.saveText, { color: theme.headerText }]}>Create game</ThemedText>
            )}
          </Pressable>
        </Card>

        {activeGroupId && (
          <Card style={styles.newCard}>
            <ThemedText type="subtitle" style={styles.title}>
              Create a tournament
            </ThemedText>
            <ThemedText style={styles.hint}>
              Group matches into a tournament, then attach matches to it when recording.
            </ThemedText>

            <ThemedText style={styles.label}>Name</ThemedText>
            <TextInput
              style={[styles.tourNameInput, { color: theme.text, borderColor: theme.border }]}
              placeholder="e.g. Spring Championship"
              placeholderTextColor={theme.muted}
              value={newName}
              onChangeText={setNewName}
            />

            {groups.length > 1 && (
              <>
                <ThemedText style={styles.label}>Group</ThemedText>
                <SearchSelect
                  options={groups}
                  selectedId={newGroupId}
                  onSelect={setNewGroupId}
                  placeholder="Select a group"
                  searchPlaceholder="Search groups…"
                />
              </>
            )}

            {tourMsg && (
              <ThemedText
                style={[styles.message, { color: tourMsg.type === 'error' ? '#e5484d' : theme.primary }]}>
                {tourMsg.text}
              </ThemedText>
            )}

            <Pressable
              onPress={createNewTournament}
              disabled={!newName.trim() || !newGroupId || creating}
              style={[
                styles.save,
                { backgroundColor: theme.primary },
                (!newName.trim() || !newGroupId || creating) && styles.saveDisabled,
              ]}>
              {creating ? (
                <ActivityIndicator color={theme.headerText} />
              ) : (
                <ThemedText style={[styles.saveText, { color: theme.headerText }]}>
                  Create tournament
                </ThemedText>
              )}
            </Pressable>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  title: { textAlign: 'center', marginBottom: 8 },
  loader: { marginVertical: 24 },
  label: { marginTop: 16, marginBottom: 6, fontWeight: '600' },
  hint: { opacity: 0.6, marginBottom: 10, fontSize: 13 },

  newCard: { marginTop: 16 },
  tourNameInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    gap: 12,
  },
  switchLabel: { flex: 1 },
  switchTitle: { fontSize: 15, fontWeight: '600' },
  switchHint: { fontSize: 12, opacity: 0.6, marginTop: 2 },

  entryHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  colLabel: { fontSize: 12, opacity: 0.6 },
  colName: { flex: 1, fontSize: 16 },
  colScore: { width: 64, textAlign: 'center' },
  colHcp: { width: 56, textAlign: 'center' },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  smallInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 16,
  },
  remove: { width: 24, alignItems: 'center' },
  addWrap: { marginTop: 6 },

  teamCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, marginBottom: 10 },
  teamHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  teamName: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  scoreInput: {
    width: 84,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  chipName: { flex: 1, fontSize: 15 },
  addTeam: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 2,
  },

  message: { textAlign: 'center', marginTop: 14 },
  save: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveDisabled: { opacity: 0.5 },
  saveText: { fontSize: 16, fontWeight: '600' },
});
