import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { colors } from "@/constants/theme";

/* A dependency-free confetti burst for React Native. Fires whenever `trigger`
   increments — used to celebrate an application reaching Interview. */

const PALETTE = [colors.brand, colors.good, colors.text, colors.bad];

interface Piece {
  id: number;
  x: number;
  y: number;
  color: string;
}

export function Confetti({ trigger }: { trigger: number }) {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!trigger) return;
    const ps: Piece[] = Array.from({ length: 28 }, (_, i) => {
      const angle = (i / 28) * Math.PI * 2;
      const dist = 90 + Math.random() * 180;
      return {
        id: i,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist - 40,
        color: PALETTE[i % PALETTE.length],
      };
    });
    setPieces(ps);
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    }).start(() => setPieces([]));
  }, [trigger, progress]);

  if (pieces.length === 0) return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
      {pieces.map((p) => {
        const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.x] });
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, p.y + 260],
        });
        const opacity = progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
        return (
          <Animated.View
            key={p.id}
            style={{
              position: "absolute",
              width: 8,
              height: 8,
              borderRadius: 2,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateX }, { translateY }],
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", zIndex: 100 },
});
