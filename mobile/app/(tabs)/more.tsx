import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { Card } from "@/components/ui/Card";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useSummary } from "@/hooks/useSummary";
import { useAuth } from "@/providers/AuthProvider";

interface Item {
  icon: string;
  label: string;
  sub: string;
  href: Href;
  count?: number;
}

export default function More() {
  const router = useRouter();
  const { signOut } = useAuth();
  const summary = useSummary();
  const c = summary.data?.counts;

  const items: Item[] = [
    { icon: "🤖", label: "Evaluate", sub: "AI job-fit evaluation", href: "/evaluate" },
    { icon: "✨", label: "AI Studio", sub: "Cover letters, interview prep", href: "/ai-studio" },
    { icon: "⚡", label: "Scan portals", sub: "Find new job postings", href: "/scan" },
    { icon: "📥", label: "Pipeline", sub: "Pending job URLs to evaluate", href: "/pipeline", count: c?.inPipeline },
    { icon: "📑", label: "Resumes", sub: "Tailored CV versions", href: "/resumes" },
    { icon: "🤝", label: "Referrals", sub: "Warm intros & asks", href: "/referrals", count: c?.referrals },
    { icon: "🔎", label: "Referral finder", sub: "Find people to ask (AI)", href: "/referral-finder" },
    { icon: "📧", label: "Outreach", sub: "Cold emails & follow-ups", href: "/outreach" },
    { icon: "✍️", label: "Compose outreach", sub: "Draft & send cold emails", href: "/outreach-compose" },
    { icon: "🎯", label: "Hiring-post outreach", sub: "Discover posts, parse & cold-email", href: "/outreach-posts" as Href },
    { icon: "👤", label: "Profile", sub: "Complete & edit your profile", href: "/profile" },
  ];

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenHeader title="More" />
      <ScrollView contentContainerClassName="px-4 pb-8 gap-3">
        {items.map((it) => (
          <Card key={it.label} onPress={() => router.push(it.href)}>
            <View className="flex-row items-center gap-3">
              <Text className="text-2xl">{it.icon}</Text>
              <View className="flex-1">
                <Text className="text-base font-semibold text-white">{it.label}</Text>
                <Text className="text-xs text-muted">{it.sub}</Text>
              </View>
              {typeof it.count === "number" ? (
                <View className="rounded-full bg-bg-elevated px-2 py-0.5">
                  <Text className="text-xs text-muted">{it.count}</Text>
                </View>
              ) : null}
              <Text className="text-muted">›</Text>
            </View>
          </Card>
        ))}

        <Text
          className="mt-2 self-center text-sm text-bad"
          onPress={signOut}
          accessibilityRole="button"
        >
          Sign out
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
