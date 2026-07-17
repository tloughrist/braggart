import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/Card';
import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { MAX_CONTENT_WIDTH } from '@/constants/layout';
import { useAuth } from '@/context/auth';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';

type Profile = {
  display_name: string | null;
  username: string | null;
  color_1: string | null;
  color_2: string | null;
};
type Msg = { type: 'error' | 'success'; text: string };

// Identity color palette — tap to set a primary/secondary color.
const SWATCHES = [
  '#9B2D2D', '#D2604F', '#E0A458', '#6C8E68', '#3E7C8E',
  '#4C5B9E', '#7A5EA6', '#A6497E', '#5A5A5A', '#2E2A26',
];

function initialsOf(source: string) {
  return source
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function ProfileScreen() {
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];
  const { user, signOut } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [color1, setColor1] = useState(SWATCHES[0]);
  const [color2, setColor2] = useState(SWATCHES[1]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<Msg | null>(null);

  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<Msg | null>(null);

  const [totals, setTotals] = useState<{ matches: number; wins: number } | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase
          .from('players')
          .select('display_name, username, color_1, color_2')
          .eq('id', user.id)
          .single(),
        supabase.from('game_player_stats').select('matches, wins').eq('player_id', user.id),
      ]);
      if (!active) return;
      if (p) {
        setProfile(p);
        setName(p.display_name ?? '');
        setColor1(p.color_1 ?? SWATCHES[0]);
        setColor2(p.color_2 ?? SWATCHES[1]);
      }
      const matches = (s ?? []).reduce((n, r: any) => n + (r.matches ?? 0), 0);
      const wins = (s ?? []).reduce((n, r: any) => n + (r.wins ?? 0), 0);
      setTotals({ matches, wins });
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const displayName = name || profile?.username || user?.email || 'Player';
  const initials = initialsOf(profile?.display_name || profile?.username || user?.email || '?');
  const winRate =
    totals && totals.matches > 0 ? Math.round((totals.wins / totals.matches) * 100) : 0;

  async function saveProfile() {
    if (!user) return;
    setSavingProfile(true);
    setProfileMsg(null);
    const { error } = await supabase
      .from('players')
      .update({ display_name: name.trim() || null, color_1: color1, color_2: color2 })
      .eq('id', user.id);
    setSavingProfile(false);
    if (error) {
      setProfileMsg({ type: 'error', text: error.message });
      return;
    }
    setProfile((prev) => (prev ? { ...prev, display_name: name.trim() || null } : prev));
    setProfileMsg({ type: 'success', text: 'Profile saved.' });
  }

  async function updatePassword() {
    setPwMsg(null);
    if (newPw.length < 6) {
      setPwMsg({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    setSavingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSavingPw(false);
    if (error) {
      setPwMsg({ type: 'error', text: error.message });
      return;
    }
    setNewPw('');
    setConfirmPw('');
    setPwMsg({ type: 'success', text: 'Password updated.' });
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.primary }]}>
      <AppHeader showGroup={false} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {loading ? (
          <ActivityIndicator color={theme.headerText} style={styles.loader} />
        ) : (
          <>
            {/* Identity */}
            <Card>
              <View style={styles.identity}>
                <View style={[styles.avatar, { backgroundColor: color1 }]}>
                  <ThemedText style={styles.avatarText}>{initials}</ThemedText>
                </View>
                <View style={styles.identityText}>
                  <ThemedText type="subtitle" numberOfLines={1}>
                    {displayName}
                  </ThemedText>
                  {profile?.username && (
                    <ThemedText style={styles.muted}>@{profile.username}</ThemedText>
                  )}
                  <ThemedText style={styles.muted} numberOfLines={1}>
                    {user?.email}
                  </ThemedText>
                </View>
              </View>
            </Card>

            {/* Stats summary */}
            <Card style={styles.card}>
              <ThemedText style={styles.sectionLabel}>Your record</ThemedText>
              <View style={styles.statsRow}>
                <Stat label="Matches" value={totals?.matches ?? 0} theme={theme} />
                <Stat label="Wins" value={totals?.wins ?? 0} theme={theme} />
                <Stat label="Win rate" value={`${winRate}%`} theme={theme} />
              </View>
            </Card>

            {/* Edit profile */}
            <Card style={styles.card}>
              <ThemedText type="subtitle" style={styles.cardTitle}>
                Edit profile
              </ThemedText>

              <ThemedText style={styles.label}>Display name</ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                value={name}
                onChangeText={setName}
                placeholder="Display name"
                placeholderTextColor={theme.muted}
              />

              <ThemedText style={styles.label}>Primary color</ThemedText>
              <Swatches value={color1} onChange={setColor1} borderColor={theme.text} />

              <ThemedText style={styles.label}>Secondary color</ThemedText>
              <Swatches value={color2} onChange={setColor2} borderColor={theme.text} />

              {profileMsg && (
                <ThemedText
                  style={[styles.msg, { color: profileMsg.type === 'error' ? '#e5484d' : theme.primary }]}>
                  {profileMsg.text}
                </ThemedText>
              )}
              <Pressable
                onPress={saveProfile}
                disabled={savingProfile}
                style={[styles.button, { backgroundColor: theme.primary }, savingProfile && styles.disabled]}>
                {savingProfile ? (
                  <ActivityIndicator color={theme.headerText} />
                ) : (
                  <ThemedText style={[styles.buttonText, { color: theme.headerText }]}>
                    Save profile
                  </ThemedText>
                )}
              </Pressable>
            </Card>

            {/* Password */}
            <Card style={styles.card}>
              <ThemedText type="subtitle" style={styles.cardTitle}>
                Change password
              </ThemedText>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                value={newPw}
                onChangeText={setNewPw}
                placeholder="New password"
                placeholderTextColor={theme.muted}
                secureTextEntry
                autoCapitalize="none"
              />
              <TextInput
                style={[styles.input, styles.inputSpaced, { color: theme.text, borderColor: theme.border }]}
                value={confirmPw}
                onChangeText={setConfirmPw}
                placeholder="Confirm new password"
                placeholderTextColor={theme.muted}
                secureTextEntry
                autoCapitalize="none"
              />
              {pwMsg && (
                <ThemedText
                  style={[styles.msg, { color: pwMsg.type === 'error' ? '#e5484d' : theme.primary }]}>
                  {pwMsg.text}
                </ThemedText>
              )}
              <Pressable
                onPress={updatePassword}
                disabled={savingPw}
                style={[styles.button, { backgroundColor: theme.primary }, savingPw && styles.disabled]}>
                {savingPw ? (
                  <ActivityIndicator color={theme.headerText} />
                ) : (
                  <ThemedText style={[styles.buttonText, { color: theme.headerText }]}>
                    Update password
                  </ThemedText>
                )}
              </Pressable>
            </Card>

            <Pressable style={[styles.signOut, { borderColor: theme.headerText }]} onPress={signOut}>
              <ThemedText style={{ color: theme.headerText }}>Sign out</ThemedText>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, theme }: { label: string; value: string | number; theme: any }) {
  return (
    <View style={styles.stat}>
      <ThemedText style={[styles.statValue, { color: theme.primary }]}>{value}</ThemedText>
      <ThemedText style={styles.muted}>{label}</ThemedText>
    </View>
  );
}

function Swatches({
  value,
  onChange,
  borderColor,
}: {
  value: string;
  onChange: (c: string) => void;
  borderColor: string;
}) {
  return (
    <View style={styles.swatches}>
      {SWATCHES.map((c) => (
        <Pressable
          key={c}
          onPress={() => onChange(c)}
          style={[
            styles.swatch,
            { backgroundColor: c },
            value === c && { borderColor, borderWidth: 3 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Color ${c}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  loader: { marginTop: 48 },
  card: { marginTop: 16 },

  identity: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FAF1E1', fontSize: 24, fontWeight: '700' },
  identityText: { flex: 1 },
  muted: { opacity: 0.6 },

  sectionLabel: { fontWeight: '600', marginBottom: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700' },

  cardTitle: { marginBottom: 8 },
  label: { marginTop: 14, marginBottom: 6, fontWeight: '600' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputSpaced: { marginTop: 10 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 36, height: 36, borderRadius: 18 },

  msg: { textAlign: 'center', marginTop: 12 },
  button: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 14 },
  disabled: { opacity: 0.5 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  signOut: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 20,
  },
});
