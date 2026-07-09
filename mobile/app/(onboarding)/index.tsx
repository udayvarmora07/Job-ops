import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useAuth } from "@/providers/AuthProvider";
import { api } from "@/api/client";
import { useParseResumeFile, useImportLinkedin } from "@/hooks/useProfile";
import type { ParsedProfile } from "@/types";
import { colors } from "@/constants/theme";

/**
 * Mobile onboarding — Essentials step (name, target roles, city/country).
 * The web wizard has the full multi-step flow; mobile does essentials inline
 * and the user can fill the rest from the Profile screen later.
 *
 * Quick fill (resume upload / LinkedIn import) mirrors the same pattern
 * already proven on the Profile screen — without it, new users had to
 * hand-type everything on a phone keyboard even though the backend already
 * supports importing it in one tap.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const parseFile = useParseResumeFile();
  const importLi = useImportLinkedin();

  const [fullName, setFullName] = useState(user?.name || "");
  const [roles, setRoles] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [linkedinInput, setLinkedinInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Fields the last import touched — shown with a small "auto-filled" hint
  // so the user knows to double-check them rather than trust them blindly.
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());

  const busy = parseFile.isPending || importLi.isPending || saving;

  /** Merge parsed fields into the form — only fills blanks, like the web wizard. */
  function applyParsed(p: ParsedProfile) {
    const touched: string[] = [];
    if (p.fullName && !fullName.trim()) {
      setFullName(p.fullName);
      touched.push("fullName");
    }
    if (p.city && !city.trim()) {
      setCity(p.city);
      touched.push("city");
    }
    if (p.country && !country.trim()) {
      setCountry(p.country);
      touched.push("country");
    }
    if (p.targetRoles?.length && !roles.trim()) {
      setRoles(p.targetRoles.join(", "));
      touched.push("roles");
    }
    if (touched.length) setAutoFilled((prev) => new Set(Array.from(prev).concat(touched)));
  }

  const untouch = (field: string) =>
    setAutoFilled((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });

  async function onUploadResume() {
    setError(null);
    setNotice(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/msword",
          "text/plain",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      const parsed = await parseFile.mutateAsync({
        uri: a.uri,
        name: a.name,
        mimeType: a.mimeType,
      });
      applyParsed(parsed);
      setNotice("Résumé parsed — review the fields below, then continue.");
    } catch (e) {
      // Never surface raw parser/library errors — point at a working fallback instead.
      setError(
        "We couldn't read that résumé automatically. Double-check the file, or fill in the fields below by hand.",
      );
    }
  }

  async function onImportLinkedin() {
    setError(null);
    setNotice(null);
    if (!linkedinInput.trim()) return setError("Paste your public LinkedIn URL first.");
    try {
      const { parsed, warning } = await importLi.mutateAsync(linkedinInput.trim());
      applyParsed(parsed);
      setNotice(warning || "Imported — review the fields below, then continue.");
    } catch (e) {
      setError("We couldn't import that LinkedIn profile. Try the fields below instead.");
    }
  }

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const profile = await api.put<{ profile: Record<string, unknown> }>(
        "/api/profile",
        {
          fullName,
          targetRoles: roles
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          city,
          country,
        },
      );
      if (profile.profile?.essentialsComplete) {
        router.replace("/(tabs)");
      } else {
        setError("Please fill in all required fields.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenHeader title="Welcome to Jobops" />
      <ScrollView contentContainerClassName="px-4 pb-8 gap-4" keyboardShouldPersistTaps="handled">
        <Text className="text-sm text-muted">
          Fill in the essentials to get started. You can complete the rest from
          your Profile later.
        </Text>

        <Card>
          <Text className="mb-1 text-sm font-semibold text-paper">Quick start</Text>
          <Text className="mb-3 text-xs text-muted">
            Upload a résumé or import from LinkedIn to pre-fill the fields below.
          </Text>
          <Button
            label={parseFile.isPending ? "Parsing…" : "📄 Upload résumé"}
            variant="ghost"
            loading={parseFile.isPending}
            disabled={busy}
            onPress={onUploadResume}
          />
          <View className="mt-3 gap-2">
            <TextInput
              className="rounded-md border border-border bg-bg/60 px-3 py-2 text-sm text-paper"
              placeholder="https://linkedin.com/in/your-profile"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              value={linkedinInput}
              onChangeText={setLinkedinInput}
              editable={!busy}
            />
            <Button
              label={importLi.isPending ? "Importing…" : "Import from LinkedIn"}
              variant="ghost"
              loading={importLi.isPending}
              disabled={busy}
              onPress={onImportLinkedin}
            />
          </View>
        </Card>

        {notice ? <Text className="text-sm text-good">{notice}</Text> : null}
        {error ? <Text className="text-sm text-bad">{error}</Text> : null}

        <Card>
          <View className="gap-3">
            <Field label="Full name *" autoFilled={autoFilled.has("fullName")}>
              <TextInput
                className="rounded-md border border-border bg-bg/60 px-3 py-2 text-sm text-paper"
                placeholder="Jane Doe"
                placeholderTextColor={colors.muted}
                value={fullName}
                onChangeText={(v) => {
                  untouch("fullName");
                  setFullName(v);
                }}
              />
            </Field>

            <Field label="Target roles * (comma-separated)" autoFilled={autoFilled.has("roles")}>
              <TextInput
                className="rounded-md border border-border bg-bg/60 px-3 py-2 text-sm text-paper"
                placeholder="DevOps Engineer, SRE"
                placeholderTextColor={colors.muted}
                value={roles}
                onChangeText={(v) => {
                  untouch("roles");
                  setRoles(v);
                }}
                multiline
              />
            </Field>

            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field label="City *" autoFilled={autoFilled.has("city")}>
                  <TextInput
                    className="rounded-md border border-border bg-bg/60 px-3 py-2 text-sm text-paper"
                    placeholder="Berlin"
                    placeholderTextColor={colors.muted}
                    value={city}
                    onChangeText={(v) => {
                      untouch("city");
                      setCity(v);
                    }}
                  />
                </Field>
              </View>
              <View className="flex-1">
                <Field label="Country *" autoFilled={autoFilled.has("country")}>
                  <TextInput
                    className="rounded-md border border-border bg-bg/60 px-3 py-2 text-sm text-paper"
                    placeholder="Germany"
                    placeholderTextColor={colors.muted}
                    value={country}
                    onChangeText={(v) => {
                      untouch("country");
                      setCountry(v);
                    }}
                  />
                </Field>
              </View>
            </View>
          </View>
        </Card>

        <Button
          label={saving ? "Saving…" : "Save & continue"}
          onPress={save}
          disabled={
            saving ||
            !fullName.trim() ||
            !roles.trim() ||
            (!city.trim() && !country.trim())
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({
  label,
  children,
  autoFilled,
}: {
  label: string;
  children: React.ReactNode;
  autoFilled?: boolean;
}) {
  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-1.5">
        <Text className="text-sm font-medium text-paper">{label}</Text>
        {autoFilled && (
          <Text className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] text-brand">
            auto-filled — check this
          </Text>
        )}
      </View>
      {children}
    </View>
  );
}
