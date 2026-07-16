import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/auth';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase';

type Profile = { username: string | null; display_name: string | null };

export default function HomeScreen() {
  const { user, signOut } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let active = true;
    // Reads this player's own row — exercises the RLS-gated `players` policy.
    supabase
      .from('players')
      .select('username, display_name')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (active) {
          setProfile(data);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [user]);

  const greetingName = profile?.display_name || profile?.username || user?.email;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.content}>
          <ThemedText type="title" style={{ color: theme.primary }}>
            Braggart
          </ThemedText>
          {loading ? (
            <ThemedText style={styles.muted}>Loading your profile…</ThemedText>
          ) : (
            <ThemedText type="subtitle">Welcome, {greetingName}</ThemedText>
          )}
          <ThemedText style={styles.muted}>Signed in as {user?.email}</ThemedText>
        </View>

        <Pressable style={[styles.signOut, { borderColor: theme.icon }]} onPress={signOut}>
          <ThemedText style={{ color: theme.tint }}>Sign out</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 24 },
  content: { flex: 1, justifyContent: 'center', gap: 8 },
  muted: { opacity: 0.6 },
  signOut: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
});
