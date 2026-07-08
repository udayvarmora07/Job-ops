import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { useAuth } from "@/providers/AuthProvider";
import { SUPABASE_ENABLED } from "@/constants/config";
import { colors } from "@/constants/theme";
import {
  useProfile,
  useUpdateProfile,
  useParseResumeFile,
  useImportLinkedin,
} from "@/hooks/useProfile";
import type { ParsedProfile, UserProfile } from "@/types";

/** Local form shape — arrays are edited as comma-separated strings. */
interface Form {
  fullName: string;
  phone: string;
  city: string;
  country: string;
  timezone: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  employmentStatus: string;
  availability: string;
  visaStatus: string;
  onsiteAvailability: string;
  targetRoles: string;
  superpowers: string;
  compTargetRange: string;
  compCurrency: string;
  compMinimum: string;
  compFlexibility: string;
  pastCompanies: string;
  schools: string;
}

const EMPTY: Form = {
  fullName: "", phone: "", city: "", country: "", timezone: "",
  linkedinUrl: "", githubUrl: "", portfolioUrl: "",
  employmentStatus: "", availability: "", visaStatus: "", onsiteAvailability: "",
  targetRoles: "", superpowers: "",
  compTargetRange: "", compCurrency: "", compMinimum: "", compFlexibility: "",
  pastCompanies: "", schools: "",
};

const join = (a?: string[] | null) => (a ?? []).join(", ");
const split = (s: string) =>
  s.split(",").map((x) => x.trim()).filter(Boolean);

function fromProfile(p: UserProfile): Form {
  return {
    fullName: p.fullName ?? "",
    phone: p.phone ?? "",
    city: p.city ?? "",
    country: p.country ?? "",
    timezone: p.timezone ?? "",
    linkedinUrl: p.linkedinUrl ?? "",
    githubUrl: p.githubUrl ?? "",
    portfolioUrl: p.portfolioUrl ?? "",
    employmentStatus: p.employmentStatus ?? "",
    availability: p.availability ?? "",
    visaStatus: p.visaStatus ?? "",
    onsiteAvailability: p.onsiteAvailability ?? "",
    targetRoles: join(p.targetRoles),
    superpowers: join(p.superpowers),
    compTargetRange: p.compTargetRange ?? "",
    compCurrency: p.compCurrency ?? "",
    compMinimum: p.compMinimum ?? "",
    compFlexibility: p.compFlexibility ?? "",
    pastCompanies: join(p.pastCompanies),
    schools: join(p.schools),
  };
}

function toPatch(f: Form): Partial<UserProfile> {
  return {
    fullName: f.fullName,
    phone: f.phone,
    city: f.city,
    country: f.country,
    timezone: f.timezone,
    linkedinUrl: f.linkedinUrl,
    githubUrl: f.githubUrl,
    portfolioUrl: f.portfolioUrl,
    employmentStatus: f.employmentStatus,
    availability: f.availability,
    visaStatus: f.visaStatus,
    onsiteAvailability: f.onsiteAvailability,
    targetRoles: split(f.targetRoles),
    superpowers: split(f.superpowers),
    compTargetRange: f.compTargetRange,
    compCurrency: f.compCurrency,
    compMinimum: f.compMinimum,
    compFlexibility: f.compFlexibility,
    pastCompanies: split(f.pastCompanies),
    schools: split(f.schools),
  };
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const update = useUpdateProfile();
  const parseFile = useParseResumeFile();
  const importLi = useImportLinkedin();

  const [form, setForm] = useState<Form>(EMPTY);
  const [linkedinInput, setLinkedinInput] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync local form when the profile loads.
  useEffect(() => {
    if (profile) setForm(fromProfile(profile));
  }, [profile]);

  const set = (k: keyof Form) => (v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  /** Merge best-effort parsed fields into the form (only fill blanks/updates). */
  function applyParsed(p: ParsedProfile) {
    setForm((prev) => ({
      ...prev,
      fullName: p.fullName || prev.fullName,
      city: p.city || prev.city,
      country: p.country || prev.country,
      linkedinUrl: p.linkedinUrl || prev.linkedinUrl,
      githubUrl: p.githubUrl || prev.githubUrl,
      phone: p.phone || prev.phone,
      targetRoles: p.targetRoles?.length ? p.targetRoles.join(", ") : prev.targetRoles,
      superpowers: p.skills?.length ? p.skills.join(", ") : prev.superpowers,
    }));
  }

  async function onUploadResume() {
    setError(null);
    setNotice(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/msword", "text/plain",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      const parsed = await parseFile.mutateAsync({
        uri: a.uri,
        name: a.name,
        mimeType: a.mimeType,
      });
      applyParsed(parsed);
      setNotice("Résumé parsed — review the fields below, then Save.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't parse that résumé.");
    }
  }

  async function onImportLinkedin() {
    setError(null);
    setNotice(null);
    if (!linkedinInput.trim()) return setError("Paste your public LinkedIn URL first.");
    try {
      const { parsed, warning } = await importLi.mutateAsync(linkedinInput.trim());
      applyParsed(parsed);
      setForm((prev) => ({ ...prev, linkedinUrl: linkedinInput.trim() }));
      setNotice(warning || "Imported — review the fields below, then Save.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "LinkedIn import failed.");
    }
  }

  async function onSave() {
    setError(null);
    setNotice(null);
    try {
      await update.mutateAsync(toPatch(form));
      setNotice("Profile saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    }
  }

  const busy = parseFile.isPending || importLi.isPending || update.isPending;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={["top"]}>
      <ScreenHeader title="Profile" back />
      <ScrollView contentContainerClassName="px-4 pb-10 gap-4" keyboardShouldPersistTaps="handled">
        {/* Identity header */}
        <Card>
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-brand">
              <Text className="text-lg font-bold text-white">
                {(user?.email?.[0] ?? "U").toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-white">
                {form.fullName || user?.name || "Jobops user"}
              </Text>
              <Text className="text-sm text-muted">{user?.email}</Text>
            </View>
          </View>
        </Card>

        {isLoading ? (
          <View className="items-center py-8">
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : (
          <>
            {/* Quick fill / enrichment */}
            <Card>
              <Text className="mb-1 text-sm font-semibold text-white">Quick fill</Text>
              <Text className="mb-3 text-xs text-muted">
                Import from a résumé or LinkedIn to pre-fill the fields below.
              </Text>
              <Button
                label={parseFile.isPending ? "Parsing…" : "📄 Upload résumé"}
                variant="ghost"
                loading={parseFile.isPending}
                disabled={busy}
                onPress={onUploadResume}
              />
              <View className="mt-3 gap-2">
                <TextInput
                  className="rounded-md border border-border bg-bg/60 px-3 py-2 text-sm text-white"
                  placeholder="https://linkedin.com/in/your-profile"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="none"
                  value={linkedinInput}
                  onChangeText={setLinkedinInput}
                />
                <Button
                  label={importLi.isPending ? "Importing…" : "Import from LinkedIn"}
                  variant="ghost"
                  loading={importLi.isPending}
                  disabled={busy}
                  onPress={onImportLinkedin}
                />
              </View>
            </Card>

            {notice ? <Text className="text-sm text-good">{notice}</Text> : null}
            {error ? <Text className="text-sm text-bad">{error}</Text> : null}

            <Section title="Identity">
              <Field label="Full name"><Input value={form.fullName} onChangeText={set("fullName")} placeholder="Jane Doe" /></Field>
              <Field label="Phone"><Input value={form.phone} onChangeText={set("phone")} placeholder="+1 555 0123" keyboardType="phone-pad" /></Field>
              <Row>
                <Field label="City" flex><Input value={form.city} onChangeText={set("city")} placeholder="Berlin" /></Field>
                <Field label="Country" flex><Input value={form.country} onChangeText={set("country")} placeholder="Germany" /></Field>
              </Row>
              <Field label="Timezone"><Input value={form.timezone} onChangeText={set("timezone")} placeholder="CET" /></Field>
              <Field label="LinkedIn URL"><Input value={form.linkedinUrl} onChangeText={set("linkedinUrl")} placeholder="linkedin.com/in/…" autoCapitalize="none" /></Field>
              <Field label="GitHub URL"><Input value={form.githubUrl} onChangeText={set("githubUrl")} placeholder="github.com/…" autoCapitalize="none" /></Field>
              <Field label="Portfolio URL"><Input value={form.portfolioUrl} onChangeText={set("portfolioUrl")} placeholder="https://…" autoCapitalize="none" /></Field>
            </Section>

            <Section title="Targeting">
              <Field label="Target roles (comma-separated)"><Input value={form.targetRoles} onChangeText={set("targetRoles")} placeholder="DevOps Engineer, SRE" multiline /></Field>
              <Field label="Superpowers (comma-separated)"><Input value={form.superpowers} onChangeText={set("superpowers")} placeholder="CI/CD, Kubernetes, Terraform" multiline /></Field>
            </Section>

            <Section title="Status & availability">
              <Field label="Employment status"><Input value={form.employmentStatus} onChangeText={set("employmentStatus")} placeholder="actively-looking" /></Field>
              <Field label="Availability"><Input value={form.availability} onChangeText={set("availability")} placeholder="Immediate joiner" /></Field>
              <Field label="Visa status"><Input value={form.visaStatus} onChangeText={set("visaStatus")} placeholder="No sponsorship needed" /></Field>
              <Field label="Onsite availability"><Input value={form.onsiteAvailability} onChangeText={set("onsiteAvailability")} placeholder="hybrid / remote-only" /></Field>
            </Section>

            <Section title="Compensation">
              <Row>
                <Field label="Target range" flex><Input value={form.compTargetRange} onChangeText={set("compTargetRange")} placeholder="$120k-$140k" /></Field>
                <Field label="Currency" flex><Input value={form.compCurrency} onChangeText={set("compCurrency")} placeholder="USD" /></Field>
              </Row>
              <Row>
                <Field label="Minimum" flex><Input value={form.compMinimum} onChangeText={set("compMinimum")} placeholder="$110k" /></Field>
                <Field label="Flexibility" flex><Input value={form.compFlexibility} onChangeText={set("compFlexibility")} placeholder="slight-flex" /></Field>
              </Row>
            </Section>

            <Section title="Referral network">
              <Field label="Past companies (comma-separated)"><Input value={form.pastCompanies} onChangeText={set("pastCompanies")} placeholder="Acme, Globex" multiline /></Field>
              <Field label="Schools (comma-separated)"><Input value={form.schools} onChangeText={set("schools")} placeholder="MIT, Stanford" multiline /></Field>
            </Section>

            <Button
              label={update.isPending ? "Saving…" : "Save profile"}
              onPress={onSave}
              loading={update.isPending}
              disabled={busy}
            />
          </>
        )}

        <Card>
          <Text className="mb-2 text-sm font-semibold text-white">Account</Text>
          <InfoRow label="Email" value={user?.email || "N/A"} />
          <InfoRow label="Auth" value={SUPABASE_ENABLED ? "Supabase" : "Dev bypass"} />
        </Card>

        <Button label="Sign out" variant="danger" onPress={signOut} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <Text className="mb-3 text-sm font-semibold text-white">{title}</Text>
      <View className="gap-3">{children}</View>
    </Card>
  );
}

function Field({
  label,
  children,
  flex,
}: {
  label: string;
  children: React.ReactNode;
  flex?: boolean;
}) {
  return (
    <View className={flex ? "flex-1 gap-1" : "gap-1"}>
      <Text className="text-xs font-medium text-muted">{label}</Text>
      {children}
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View className="flex-row gap-3">{children}</View>;
}

function Input(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      className="rounded-md border border-border bg-bg/60 px-3 py-2 text-sm text-white"
      placeholderTextColor={colors.muted}
      {...props}
    />
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className="text-sm text-muted">{label}</Text>
      <Text className="max-w-[60%] text-sm text-white" numberOfLines={1}>{value}</Text>
    </View>
  );
}
