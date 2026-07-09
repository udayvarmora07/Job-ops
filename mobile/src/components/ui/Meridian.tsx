import { Text, View } from "react-native";
import { colors } from "@/constants/theme";

/* ————————————————————————————————————————————————————————————————
   Meridian "Warm" — shared mobile primitives.
   Streak dots, Ghost Shield, OSS privacy badge and section labels, so the
   4 screens share one visual language with the web dashboard.
———————————————————————————————————————————————————————————————— */

export function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="mb-2.5 text-[11px] font-medium tracking-wide text-subtle">{children}</Text>
  );
}

/** 7 streak pips — amber when a day had activity, dim otherwise. */
export function StreakDots({ days }: { days: { active: boolean }[] }) {
  return (
    <View className="flex-row items-center gap-1.5">
      {days.map((d, i) => (
        <View
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: d.active ? colors.brand : colors.active,
          }}
        />
      ))}
    </View>
  );
}

export type ShieldStatus = "verified" | "suspicious" | "closed";

export function ghostShieldFromLegitimacy(legitimacy: string | null | undefined): {
  status: ShieldStatus;
  label: string;
} {
  const t = (legitimacy ?? "").toLowerCase();
  if (!t) return { status: "suspicious", label: "Not yet evaluated" };
  if (/(closed|expired|dead|ghost)/.test(t)) return { status: "closed", label: legitimacy! };
  if (/(suspicious|caution|unconfirmed|unclear|unknown)/.test(t))
    return { status: "suspicious", label: legitimacy! };
  return { status: "verified", label: legitimacy! };
}

/** Ghost Shield verification badge — green/amber/red. */
export function GhostShield({ status, label }: { status: ShieldStatus; label?: string }) {
  const map = {
    verified: { color: colors.good, bg: colors.greenDim, text: label ?? "Verified active" },
    suspicious: { color: colors.brand, bg: colors.amberDim, text: label ?? "Unverified" },
    closed: { color: colors.bad, bg: colors.redDim, text: label ?? "Closed" },
  } as const;
  const s = map[status];
  return (
    <View
      className="flex-row items-center gap-1 self-start rounded-full px-2 py-0.5"
      style={{ backgroundColor: s.bg }}
    >
      <Text style={{ color: s.color, fontSize: 10 }}>🛡</Text>
      <Text style={{ color: s.color }} className="text-[10px] font-medium">
        {s.text}
      </Text>
    </View>
  );
}

/** Salary vs target — amber slot; renders "Salary not listed" when absent. */
export function SalaryLine({
  salary,
  deltaPct,
}: {
  salary?: string | null;
  deltaPct?: number | null;
}) {
  if (!salary) return <Text className="text-[12px] text-subtle">Salary not listed</Text>;
  const above = (deltaPct ?? 0) >= 0;
  return (
    <View className="flex-row items-center gap-2">
      <Text className="text-[12px] text-muted">{salary}</Text>
      {deltaPct != null && (
        <Text className="text-[12px] font-medium" style={{ color: above ? colors.good : colors.brand }}>
          {above ? "▲ +" : "▼ "}
          {Math.round(Math.abs(deltaPct))}% target
        </Text>
      )}
    </View>
  );
}

/** OSS privacy assurance. */
export function PrivacyBadge() {
  return (
    <View
      className="flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1"
      style={{ backgroundColor: colors.greenDim }}
    >
      <Text style={{ color: colors.good, fontSize: 11 }}>🔒</Text>
      <Text style={{ color: colors.good }} className="text-[11px] font-medium">
        Privacy first · OSS
      </Text>
    </View>
  );
}
