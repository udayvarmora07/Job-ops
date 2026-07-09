import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { colors } from "@/constants/theme";
import {
  useComposeFromPost,
  useFindCompanyEmails,
  useParsePost,
  useScanPosts,
  useSendOutreach,
} from "@/hooks/useOutreachActions";
import type {
  CompanyEmailResult,
  FromPostResult,
  ParsedHiringPost,
  ScannedPost,
} from "@/types";

type Mode = "discover" | "paste" | "emails";
const MODES: { value: Mode; label: string }[] = [
  { value: "discover", label: "Discover" },
  { value: "paste", label: "Paste post" },
  { value: "emails", label: "Company emails" },
];

export default function OutreachPosts() {
  const [mode, setMode] = useState<Mode>("discover");
  // Lifts a discovered post's text into the Paste tab (which mounts fresh with it).
  const [pasteSeed, setPasteSeed] = useState("");

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenHeader title="Hiring-post outreach" subtitle="Discover posts, parse & cold-email" back />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerClassName="px-4 pb-10 gap-4" keyboardShouldPersistTaps="handled">
          <View className="flex-row flex-wrap gap-2">
            {MODES.map((m) => {
              const active = m.value === mode;
              return (
                <Pressable
                  key={m.value}
                  onPress={() => setMode(m.value)}
                  className={`rounded-full px-3 py-1.5 ${active ? "bg-brand" : "bg-bg-elevated"}`}
                >
                  <Text className={`text-sm ${active ? "text-paper" : "text-muted"}`}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {mode === "discover" ? <DiscoverTab onUsePost={(t) => { setPasteSeed(t); setMode("paste"); }} /> : null}
          {mode === "paste" ? <PasteTab seed={pasteSeed} /> : null}
          {mode === "emails" ? <EmailsTab /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ErrText({ msg }: { msg: string | null }) {
  return msg ? <Text className="text-sm text-bad">{msg}</Text> : null;
}

/* ── Discover: scan LinkedIn hiring posts that fit the profile ── */
function DiscoverTab({ onUsePost }: { onUsePost: (text: string) => void }) {
  const scan = useScanPosts();
  const [posts, setPosts] = useState<ScannedPost[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    try {
      setPosts(await scan.mutateAsync({ maxPosts: 20, fitOnly: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Discovery failed");
    }
  }

  return (
    <View className="gap-3">
      <Text className="text-sm text-muted">
        Finds recent LinkedIn hiring posts matching your target roles (via Apify).
      </Text>
      <Button
        label={scan.isPending ? "Searching…" : "Find hiring posts"}
        onPress={run}
        loading={scan.isPending}
      />
      <ErrText msg={error} />
      {scan.isPending ? <ActivityIndicator color={colors.brand} /> : null}
      {posts.map((p) => (
        <Card key={p.url}>
          <Text className="text-sm font-semibold text-paper">{p.authorName || "Unknown"}</Text>
          <Text className="text-xs text-muted">{p.authorTitle}</Text>
          {p.fit ? (
            <Text className="mt-1 text-xs text-brand">Fit {Math.round(p.fit.score)}%</Text>
          ) : null}
          <Text className="mt-2 text-sm text-paper" numberOfLines={4}>{p.text}</Text>
          {p.emails?.length ? (
            <Text className="mt-2 text-xs text-good">📧 {p.emails.join(", ")}</Text>
          ) : null}
          <View className="mt-3 flex-row gap-2">
            <View className="flex-1">
              <Button label="Use this post" variant="secondary" onPress={() => onUsePost(`${p.text}\n\n${p.comments}`)} />
            </View>
            {p.url ? (
              <View className="flex-1">
                <Button label="Open" variant="ghost" onPress={() => Linking.openURL(p.url)} />
              </View>
            ) : null}
          </View>
        </Card>
      ))}
    </View>
  );
}

/* ── Paste: parse a hiring post → draft a cold email → send ── */
function PasteTab({ seed }: { seed: string }) {
  const parse = useParsePost();
  const compose = useComposeFromPost();
  const send = useSendOutreach();

  const [post, setPost] = useState(seed || "");
  const [parsed, setParsed] = useState<ParsedHiringPost | null>(null);
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState<FromPostResult | null>(null);
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onParse() {
    setError(null); setNotice(null); setDraft(null);
    if (post.trim().length < 20) return setError("Paste the full hiring post first.");
    try {
      const { parsed, foundEmails } = await parse.mutateAsync({ post: post.trim() });
      setParsed(parsed);
      setEmails(foundEmails);
      setTo(parsed?.email || foundEmails[0] || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parse failed");
    }
  }

  async function onDraft() {
    setError(null); setNotice(null);
    try {
      const d = await compose.mutateAsync({
        company: parsed?.company,
        role: parsed?.role,
        requirements: parsed?.requirements,
        mode: "jd_specific",
      });
      if (d.error) throw new Error(d.error);
      setDraft(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft failed");
    }
  }

  async function onSend() {
    setError(null); setNotice(null);
    if (!to.trim() || !draft) return setError("Need a recipient email and a draft.");
    try {
      const r = await send.mutateAsync({
        to: to.trim(),
        subject: draft.subject,
        body: draft.body,
        company: parsed?.company,
        role: parsed?.role,
      });
      if (r.error) throw new Error(r.error);
      setNotice("Email sent ✓");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    }
  }

  return (
    <View className="gap-3">
      <TextInput
        value={post}
        onChangeText={setPost}
        placeholder="Paste a LinkedIn hiring post (and top comments)…"
        placeholderTextColor={colors.muted}
        multiline
        className="min-h-[120px] rounded-xl border border-border bg-bg-card p-4 text-base text-paper"
        style={{ textAlignVertical: "top" }}
      />
      <Button label={parse.isPending ? "Parsing…" : "Parse post"} onPress={onParse} loading={parse.isPending} />
      <ErrText msg={error} />
      {notice ? <Text className="text-sm text-good">{notice}</Text> : null}

      {parsed ? (
        <Card>
          <Text className="text-sm font-semibold text-paper">{parsed.company || "—"}</Text>
          <Text className="text-xs text-muted">{parsed.role || "role unknown"}</Text>
          {parsed.requirements?.length ? (
            <Text className="mt-2 text-xs text-muted" numberOfLines={4}>
              {parsed.requirements.join(" · ")}
            </Text>
          ) : null}
          {emails.length ? <Text className="mt-2 text-xs text-good">📧 {emails.join(", ")}</Text> : null}
          <View className="mt-3">
            <Button label={compose.isPending ? "Drafting…" : "Draft cold email"} onPress={onDraft} loading={compose.isPending} />
          </View>
        </Card>
      ) : null}

      {draft ? (
        <Card>
          <Text className="text-xs font-medium text-muted">To</Text>
          <TextInput
            value={to}
            onChangeText={setTo}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="recruiter@company.com"
            placeholderTextColor={colors.muted}
            className="mb-3 rounded-md border border-border bg-bg/60 px-3 py-2 text-sm text-paper"
          />
          <Text className="text-xs font-medium text-muted">Subject</Text>
          <TextInput
            value={draft.subject}
            onChangeText={(v) => setDraft({ ...draft, subject: v })}
            className="mb-3 rounded-md border border-border bg-bg/60 px-3 py-2 text-sm text-paper"
          />
          <Text className="text-xs font-medium text-muted">Body</Text>
          <TextInput
            value={draft.body}
            onChangeText={(v) => setDraft({ ...draft, body: v })}
            multiline
            className="min-h-[160px] rounded-md border border-border bg-bg/60 px-3 py-2 text-sm text-paper"
            style={{ textAlignVertical: "top" }}
          />
          <View className="mt-3">
            <Button label={send.isPending ? "Sending…" : "Send email"} onPress={onSend} loading={send.isPending} />
          </View>
        </Card>
      ) : null}
    </View>
  );
}

/* ── Company emails: find indexed emails at a company/domain ── */
function EmailsTab() {
  const find = useFindCompanyEmails();
  const [company, setCompany] = useState("");
  const [domain, setDomain] = useState("");
  const [res, setRes] = useState<CompanyEmailResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null); setRes(null);
    if (!company.trim() && !domain.trim()) return setError("Enter a company name or domain.");
    try {
      setRes(await find.mutateAsync({
        company: company.trim() || undefined,
        domain: domain.trim() || undefined,
        targetType: "hr",
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    }
  }

  return (
    <View className="gap-3">
      <TextInput
        value={company}
        onChangeText={setCompany}
        placeholder="Company name"
        placeholderTextColor={colors.muted}
        className="rounded-md border border-border bg-bg/60 px-3 py-2 text-sm text-paper"
      />
      <TextInput
        value={domain}
        onChangeText={setDomain}
        placeholder="or domain (acme.com)"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        className="rounded-md border border-border bg-bg/60 px-3 py-2 text-sm text-paper"
      />
      <Button label={find.isPending ? "Searching…" : "Find company emails"} onPress={run} loading={find.isPending} />
      <ErrText msg={error} />
      {res?.emails?.length ? (
        res.emails.map((e) => (
          <Card key={e.email}>
            <Text className="text-sm text-paper">{e.email}</Text>
            {(e.name || e.title) ? (
              <Text className="text-xs text-muted">{[e.name, e.title].filter(Boolean).join(" · ")}</Text>
            ) : null}
            {typeof e.confidence === "number" ? (
              <Text className="text-xs text-brand">confidence {e.confidence}%</Text>
            ) : null}
          </Card>
        ))
      ) : res ? (
        <Text className="text-sm text-muted">No emails found.</Text>
      ) : null}
    </View>
  );
}
