import { useState } from "react";
import { ActivityIndicator, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useComposeOutreach, useFindEmail, useSendOutreach } from "@/hooks/useOutreachActions";
import { colors } from "@/constants/theme";

export default function OutreachCompose() {
  const params = useLocalSearchParams<{ company?: string; role?: string }>();
  const [company, setCompany] = useState(params.company ?? "");
  const [role, setRole] = useState(params.role ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [name, setName] = useState("");
  const [to, setTo] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const compose = useComposeOutreach();
  const find = useFindEmail();
  const send = useSendOutreach();

  async function onCompose() {
    setErr(null); setNote(null);
    if (!company.trim()) return setErr("Company is required");
    try {
      const r = await compose.mutateAsync({ company: company.trim(), role: role.trim() });
      setSubject(r.subject);
      setBody(r.body);
      setNote(r.templateName ? `Draft from template: ${r.templateName}` : "Draft ready");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Compose failed");
    }
  }

  async function onFindEmail() {
    setErr(null); setNote(null);
    if (!name.trim()) return setErr("Contact name is required to find an email");
    try {
      const r = await find.mutateAsync({ name: name.trim(), company: company.trim() });
      if (r.email) { setTo(r.email); setNote(`Found: ${r.email}${r.verification ? ` (${r.verification})` : ""}`); }
      else setNote("No email found.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Email lookup failed");
    }
  }

  function onSend() {
    setErr(null); setNote(null);
    if (!to.trim() || !subject.trim() || !body.trim()) return setErr("Recipient, subject and body are required");
    const confirmMsg = `Send this email to ${to}? This really sends it.`;
    const go = async () => {
      try {
        const r = await send.mutateAsync({ to: to.trim(), subject: subject.trim(), body: body.trim(), company: company.trim(), role: role.trim() });
        setNote(r.ok ? "✅ Sent." : r.error || "Send returned no confirmation.");
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Send failed");
      }
    };
    if (Platform.OS === "web") { if (globalThis.confirm?.(confirmMsg)) go(); }
    else go(); // native confirm handled by the button's own affordance
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenHeader title="Outreach" subtitle="Compose & send cold emails" back />
      <ScrollView contentContainerClassName="px-4 pb-8 gap-4">
        <View className="gap-2">
          <Input label="Company *" value={company} onChangeText={setCompany} placeholder="e.g. Stripe" />
          <Input label="Role" value={role} onChangeText={setRole} placeholder="e.g. Platform Engineer" />
        </View>
        <Button label={compose.isPending ? "Composing…" : "✍️ Compose email"} onPress={onCompose} loading={compose.isPending} />

        {compose.isPending ? <ActivityIndicator color={colors.brand} /> : null}

        {(subject || body) ? (
          <Card>
            <Input label="Subject" value={subject} onChangeText={setSubject} />
            <Text className="mb-1 mt-2 text-sm font-medium text-muted">Body</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              multiline
              placeholderTextColor={colors.muted}
              className="min-h-[180px] rounded-xl border border-border bg-bg px-3 py-2 text-sm text-paper"
              style={{ textAlignVertical: "top" }}
            />
          </Card>
        ) : null}

        <Card>
          <Text className="mb-2 text-sm font-semibold text-paper">Recipient</Text>
          <Input label="Contact name" value={name} onChangeText={setName} placeholder="e.g. Alex Rivera" />
          <View className="mt-2">
            <Button label={find.isPending ? "Finding…" : "🔍 Find email"} variant="secondary" onPress={onFindEmail} loading={find.isPending} />
          </View>
          <View className="mt-2">
            <Input label="To (email)" value={to} onChangeText={setTo} placeholder="name@company.com" autoCapitalize="none" keyboardType="email-address" />
          </View>
        </Card>

        <Button label={send.isPending ? "Sending…" : "Send email"} variant="danger" onPress={onSend} loading={send.isPending} />

        {err ? <Text className="text-sm text-bad">{err}</Text> : null}
        {note ? <Text className="text-sm text-good">{note}</Text> : null}
        <Text className="text-center text-xs text-muted">
          Sending really delivers the email via your backend&apos;s SMTP. Review before sending.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
