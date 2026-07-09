import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "@/constants/theme";

/** Emoji tab icon (kept dependency-free; swap for vector icons later). */
function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{icon}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.subtle,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "500" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ focused }) => <TabIcon icon="⚡" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: "Discover",
          tabBarIcon: ({ focused }) => <TabIcon icon="🔍" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="applications"
        options={{
          title: "Track",
          tabBarIcon: ({ focused }) => <TabIcon icon="◧" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "Me",
          tabBarIcon: ({ focused }) => <TabIcon icon="👤" focused={focused} />,
        }}
      />
      {/* Reports stays reachable by route but is not a bottom-nav tab. */}
      <Tabs.Screen name="reports" options={{ href: null }} />
    </Tabs>
  );
}
