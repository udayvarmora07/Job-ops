import { useState } from "react";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { useAuth, type OAuthProvider } from "@/providers/AuthProvider";

const PROVIDERS: { id: OAuthProvider; label: string }[] = [
  { id: "google", label: "Continue with Google" },
  { id: "github", label: "Continue with GitHub" },
  { id: "linkedin_oidc", label: "Continue with LinkedIn" },
];

/**
 * Social OAuth buttons (Google / GitHub / LinkedIn) plus an "or" divider.
 * Reports failures back to the parent via `onError`.
 */
export function SocialButtons({ onError }: { onError: (msg: string) => void }) {
  const { signInWithProvider } = useAuth();
  const [busy, setBusy] = useState<OAuthProvider | null>(null);

  async function onPress(provider: OAuthProvider) {
    onError("");
    setBusy(provider);
    try {
      await signInWithProvider(provider);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <View className="gap-3">
      {PROVIDERS.map((p) => (
        <Button
          key={p.id}
          label={p.label}
          variant="ghost"
          loading={busy === p.id}
          disabled={busy !== null}
          onPress={() => onPress(p.id)}
        />
      ))}

      <View className="flex-row items-center gap-3 py-1">
        <View className="h-px flex-1 bg-border" />
        <Text className="text-xs uppercase text-muted">or with email</Text>
        <View className="h-px flex-1 bg-border" />
      </View>
    </View>
  );
}
