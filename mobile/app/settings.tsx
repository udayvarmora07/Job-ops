import { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { SectionLabel, PrivacyBadge } from "@/components/ui/Meridian";
import { getItem, setItem } from "@/utils/storage";
import { colors } from "@/constants/theme";

const PREFS_KEY = "jobops.prefs";

interface Prefs {
  ghostThreshold: "off" | "suspicious" | "verified";
  scanFrequency: "manual" | "daily" | "3days" | "weekly";
  momentum: boolean;
}
const DEFAULT_PREFS: Prefs = { ghostThreshold: "suspicious", scanFrequency: "3days", momentum: true };

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.key;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            className="rounded-full border px-3 py-1.5"
            style={{
              backgroundColor: active ? colors.amberDim : colors.elevated,
              borderColor: active ? colors.brand : colors.border,
            }}
          >
            <Text className="text-[13px] font-medium" style={{ color: active ? colors.brand : colors.muted }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FieldCard({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View className="rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
      <Text className="mb-1 text-[13px] font-medium text-paper">{label}</Text>
      {hint ? <Text className="mb-3 text-[11px] text-subtle">{hint}</Text> : <View className="mb-3" />}
      {children}
    </View>
  );
}

export default function Settings() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    (async () => {
      try {
        const raw = await getItem(PREFS_KEY);
        if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
      } catch {
        /* ignore */
      }
    })();
  }, []);

  function update(patch: Partial<Prefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenHeader title="Settings" back />
      <ScrollView contentContainerClassName="px-4 pb-10 gap-5 pt-2">
        <View>
          <SectionLabel>Preferences</SectionLabel>
          <View className="gap-3">
            <FieldCard label="Ghost Shield threshold" hint="Flag listings below this verification level on job cards">
              <Segmented
                value={prefs.ghostThreshold}
                onChange={(v) => update({ ghostThreshold: v })}
                options={[
                  { key: "off", label: "Show all" },
                  { key: "suspicious", label: "Warn unverified" },
                  { key: "verified", label: "Verified only" },
                ]}
              />
            </FieldCard>

            <FieldCard label="Scan frequency" hint="How often to sweep the portals for new roles">
              <Segmented
                value={prefs.scanFrequency}
                onChange={(v) => update({ scanFrequency: v })}
                options={[
                  { key: "manual", label: "Manual" },
                  { key: "daily", label: "Daily" },
                  { key: "3days", label: "Every 3 days" },
                  { key: "weekly", label: "Weekly" },
                ]}
              />
            </FieldCard>

            <View
              className="flex-row items-center justify-between rounded-2xl border p-4"
              style={{ borderColor: colors.border, backgroundColor: colors.card }}
            >
              <View className="flex-1 pr-3">
                <Text className="text-[13px] font-medium text-paper">Emotional momentum</Text>
                <Text className="mt-0.5 text-[11px] text-subtle">Streak dots, wins feed and confetti</Text>
              </View>
              <Switch
                value={prefs.momentum}
                onValueChange={(v) => update({ momentum: v })}
                trackColor={{ true: colors.brand, false: colors.active }}
                thumbColor={colors.bg}
              />
            </View>
          </View>
        </View>

        <View>
          <SectionLabel>Account</SectionLabel>
          <Pressable
            onPress={() => router.push("/profile")}
            className="flex-row items-center gap-3 rounded-2xl border p-4 active:opacity-70"
            style={{ borderColor: colors.border, backgroundColor: colors.card }}
          >
            <Text className="text-[18px]">👤</Text>
            <View className="flex-1">
              <Text className="text-[14px] font-medium text-paper">Profile</Text>
              <Text className="text-[11px] text-muted">Name, roles, comp targets & CV</Text>
            </View>
            <Text className="text-subtle">›</Text>
          </Pressable>
        </View>

        <View className="rounded-2xl border p-4" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
          <PrivacyBadge />
          <Text className="mt-3 text-[12px] leading-relaxed text-muted">
            Jobops is open source and runs on your own backend. Your CV, applications and API keys
            stay in local files — nothing is uploaded, tracked or sold.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
