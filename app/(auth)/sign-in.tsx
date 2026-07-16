import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/auth';
import { useColorScheme } from '@/hooks/useColorScheme';

type Mode = 'sign-in' | 'sign-up';

export default function SignInScreen() {
  const { signIn, signUp } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const theme = Colors[scheme];

  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignUp = mode === 'sign-up';

  async function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    setBusy(true);
    const { error } = isSignUp
      ? await signUp(email.trim(), password, displayName.trim() || undefined)
      : await signIn(email.trim(), password);
    setBusy(false);
    if (error) setError(error);
    // On success, the root navigator redirects into the app automatically.
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <View style={styles.inner}>
          <ThemedText type="title" style={[styles.brand, { color: theme.primary }]}>
            Braggart
          </ThemedText>
          <ThemedText style={styles.tagline}>
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </ThemedText>

          {isSignUp && (
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.icon }]}
              placeholder="Display name (optional)"
              placeholderTextColor={theme.icon}
              autoCapitalize="words"
              value={displayName}
              onChangeText={setDisplayName}
            />
          )}

          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.icon }]}
            placeholder="Email"
            placeholderTextColor={theme.icon}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.icon }]}
            placeholder="Password"
            placeholderTextColor={theme.icon}
            autoCapitalize="none"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error && <ThemedText style={styles.error}>{error}</ThemedText>}

          <Pressable
            style={[styles.button, { backgroundColor: theme.tint }, busy && styles.buttonDisabled]}
            onPress={submit}
            disabled={busy}>
            {busy ? (
              <ActivityIndicator color={scheme === 'dark' ? '#151718' : '#fff'} />
            ) : (
              <ThemedText style={[styles.buttonText, { color: scheme === 'dark' ? '#151718' : '#fff' }]}>
                {isSignUp ? 'Sign up' : 'Sign in'}
              </ThemedText>
            )}
          </Pressable>

          <Pressable
            onPress={() => {
              setError(null);
              setMode(isSignUp ? 'sign-in' : 'sign-up');
            }}
            style={styles.switch}>
            <ThemedText type="link">
              {isSignUp ? 'Have an account? Sign in' : 'New here? Create an account'}
            </ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1, width: '100%' },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    alignItems: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  brand: { textAlign: 'center', fontSize: 48, lineHeight: 58 },
  tagline: { textAlign: 'center', marginBottom: 16, opacity: 0.7 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { fontSize: 16, fontWeight: '600' },
  switch: { alignItems: 'center', marginTop: 8 },
  error: { color: '#e5484d' },
});
