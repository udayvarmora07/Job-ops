import "../global.css";
import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import { View, ActivityIndicator } from "react-native";
import { QueryProvider } from "@/providers/QueryProvider";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { colors } from "@/constants/theme";
import { getItem, STORAGE_KEYS } from "@/utils/storage";
import { API_URL } from "@/constants/config";

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const { user, loading, supabaseEnabled } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [profileChecked, setProfileChecked] = useState(false);

  useEffect(() => {
    if (loading) return;
    SplashScreen.hideAsync().catch(() => {});

    const inAuthGroup = String(segments[0]) === "(auth)";
    const inOnboarding = String(segments[0]) === "(onboarding)";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
      return;
    }
    if (user && inAuthGroup) {
      // Check onboarding status before going to tabs
      (async () => {
        if (supabaseEnabled) {
          try {
            const token = await getItem(STORAGE_KEYS.authToken);
            if (token) {
              const resp = await fetch(`${API_URL}/api/profile/status`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (resp.ok) {
                const status = await resp.json();
                if (!status.essentialsComplete && !inOnboarding) {
                  router.replace("/(onboarding)" as any);
                  setProfileChecked(true);
                  return;
                }
              }
            }
          } catch {
            /* transient - let user through */
          }
        }
        router.replace("/(tabs)");
        setProfileChecked(true);
      })();
    }
  }, [user, loading, segments, router, supabaseEnabled]);

  if (loading || (user && !profileChecked && supabaseEnabled && segments[0] === "(auth)")) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="job/[url]" options={{ presentation: "card" }} />
      <Stack.Screen name="report/[id]" options={{ presentation: "card" }} />
      <Stack.Screen name="application/[num]" options={{ presentation: "card" }} />
      <Stack.Screen name="evaluate" options={{ presentation: "card" }} />
      <Stack.Screen name="scan" options={{ presentation: "card" }} />
      <Stack.Screen name="ai-studio" options={{ presentation: "card" }} />
      <Stack.Screen name="referral-finder" options={{ presentation: "card" }} />
      <Stack.Screen name="outreach-compose" options={{ presentation: "card" }} />
      <Stack.Screen name="pipeline" options={{ presentation: "card" }} />
      <Stack.Screen name="resumes" options={{ presentation: "card" }} />
      <Stack.Screen name="referrals" options={{ presentation: "card" }} />
      <Stack.Screen name="outreach" options={{ presentation: "card" }} />
      <Stack.Screen name="outreach-posts" options={{ presentation: "card" }} />
      <Stack.Screen name="profile" options={{ presentation: "card" }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryProvider>
          <AuthProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </AuthProvider>
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
