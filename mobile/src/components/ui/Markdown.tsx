import { Text, View } from "react-native";

/**
 * Minimal, dependency-free markdown renderer for evaluation reports.
 * Handles headings (#..###), bullets (-, *), bold (**x**), and blank lines.
 * Not a full parser — enough to make reports readable on mobile.
 */
export function Markdown({ content }: { content: string }) {
  const lines = content.replace(/\r/g, "").split("\n");
  return (
    <View className="gap-1.5">
      {lines.map((line, i) => {
        const t = line.trimEnd();
        if (t.trim() === "") return <View key={i} className="h-2" />;
        if (t.startsWith("### ")) return <Heading key={i} level={3} text={t.slice(4)} />;
        if (t.startsWith("## ")) return <Heading key={i} level={2} text={t.slice(3)} />;
        if (t.startsWith("# ")) return <Heading key={i} level={1} text={t.slice(2)} />;
        if (/^\s*[-*]\s+/.test(t)) {
          return (
            <View key={i} className="flex-row gap-2 pl-1">
              <Text className="text-muted">•</Text>
              <Text className="flex-1 text-sm text-white">{renderInline(t.replace(/^\s*[-*]\s+/, ""))}</Text>
            </View>
          );
        }
        return <Text key={i} className="text-sm leading-5 text-white">{renderInline(t)}</Text>;
      })}
    </View>
  );
}

function Heading({ level, text }: { level: 1 | 2 | 3; text: string }) {
  const cls =
    level === 1
      ? "mt-3 text-xl font-bold text-white"
      : level === 2
        ? "mt-3 text-lg font-bold text-white"
        : "mt-2 text-base font-semibold text-white";
  return <Text className={cls}>{renderInline(text)}</Text>;
}

/** Render **bold** segments inline. */
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <Text key={i} className="font-bold">
        {p.slice(2, -2)}
      </Text>
    ) : (
      <Text key={i}>{p}</Text>
    ),
  );
}
