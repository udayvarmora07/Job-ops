import { Pressable, View } from "react-native";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  onPress?: () => void;
  className?: string;
}

export function Card({ children, onPress, className = "" }: Props) {
  const base = `rounded-2xl bg-bg-card border border-border p-4 ${className}`;
  if (onPress) {
    return (
      <Pressable onPress={onPress} className={`${base} active:opacity-80`}>
        {children}
      </Pressable>
    );
  }
  return <View className={base}>{children}</View>;
}
