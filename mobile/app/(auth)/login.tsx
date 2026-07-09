import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SocialButtons } from "@/components/auth/SocialButtons";
import { useAuth } from "@/providers/AuthProvider";

export default function Login() {
  const { signIn, supabaseEnabled } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    if (!email.trim()) {
      setError("Enter your email");
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerClassName="flex-grow justify-center px-6 gap-6">
          <View className="gap-2">
            <Text className="text-3xl font-bold text-paper">Welcome back</Text>
            <Text className="text-base text-muted">
              Sign in to manage your job search.
            </Text>
          </View>

          <SocialButtons onError={(m) => setError(m || null)} />

          <View className="gap-4">
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="password"
            />
            {error ? <Text className="text-sm text-bad">{error}</Text> : null}
            <Button label="Sign in" onPress={onSubmit} loading={busy} />
          </View>

          <View className="flex-row items-center justify-between">
            <Link href="/(auth)/forgot-password" className="text-sm text-brand">
              Forgot password?
            </Link>
            <Link href="/(auth)/signup" className="text-sm text-brand">
              Create account
            </Link>
          </View>

          {!supabaseEnabled ? (
            <Text className="text-center text-xs text-muted">
              Dev mode: Supabase not configured — any credentials sign you in.
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
