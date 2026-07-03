import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/providers/AuthProvider";
import { API_URL, SUPABASE_ENABLED } from "@/constants/config";

export default function Profile() {
  const { user, signOut } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScrollView contentContainerClassName="px-4 pb-8 gap-4">
        <Text className="pt-2 text-2xl font-bold text-white">Profile</Text>

        <Card>
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-brand">
              <Text className="text-lg font-bold text-white">
                {(user?.email?.[0] ?? "U").toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-white">
                {user?.name ?? "Jobops user"}
              </Text>
              <Text className="text-sm text-muted">{user?.email}</Text>
            </View>
          </View>
        </Card>

        <Card>
          <Text className="mb-2 text-sm font-semibold text-white">Backend</Text>
          <Row label="API URL" value={API_URL} />
          <Row label="Auth" value={SUPABASE_ENABLED ? "Supabase" : "Dev bypass"} />
        </Card>

        <Card>
          <Text className="mb-2 text-sm font-semibold text-white">Roadmap</Text>
          <Text className="text-sm text-muted">
            Phase 1 foundation. Push notifications, offline cache, and evaluation
            streaming arrive in Phases 2–3.
          </Text>
        </Card>

        <Button label="Sign out" variant="danger" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="max-w-[60%] text-sm text-white" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
