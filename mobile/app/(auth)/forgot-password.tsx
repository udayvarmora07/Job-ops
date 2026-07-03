import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/providers/AuthProvider";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setError(null);
    if (!email.trim()) return setError("Enter your email");
    setBusy(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerClassName="flex-grow justify-center px-6 gap-6">
        <View className="gap-2">
          <Text className="text-3xl font-bold text-white">Reset password</Text>
          <Text className="text-base text-muted">
            We&apos;ll email you a link to reset it.
          </Text>
        </View>

        {sent ? (
          <View className="gap-4">
            <Text className="text-base text-good">
              If an account exists for {email}, a reset link is on its way.
            </Text>
            <Link href="/(auth)/login" className="text-sm text-brand">
              Back to sign in
            </Link>
          </View>
        ) : (
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
            {error ? <Text className="text-sm text-bad">{error}</Text> : null}
            <Button label="Send reset link" onPress={onSubmit} loading={busy} />
            <Link href="/(auth)/login" className="text-center text-sm text-brand">
              Back to sign in
            </Link>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
