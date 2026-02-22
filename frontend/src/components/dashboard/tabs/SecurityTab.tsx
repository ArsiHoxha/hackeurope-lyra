"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  RefreshCw,
  Monitor,
  Lock,
  Eye,
  EyeOff,
  Server,
  Bell,
  ArrowRight,
  Copy,
  Check,
  Trash2,
  Plus,
  Loader2,
  FileKey,
  Fingerprint,
  AlertTriangle,
  Zap,
  Settings2,
  Search,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Hash,
  Clock,
  Activity,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type SecurityConfig,
  type SecurityAuditResult,
  type SecurityAuditCheck,
  type ApiKeyInfo,
  type GeneratedApiKey,
  type ProvenanceCertificate,
  type ProvenanceVerifyResult,
  getSecurityConfig,
  updateSecurityConfig,
  runSecurityAudit,
  rotateKey,
  generateApiKey,
  listApiKeys,
  revokeApiKey,
  generateProvenance,
  verifyProvenance,
} from "@/lib/api";

// ── Tiny clipboard helper ────────────────────────────────────────────────────
function useCopyToClipboard() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }, []);
  return { copied, copy };
}

// ── Section wrapper ──────────────────────────────────────────────────────────
function Section({
  title,
  icon: Icon,
  description,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border-border/40 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 p-5 text-left transition-colors hover:bg-secondary/30"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="size-4.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold">{title}</p>
          <p className="text-[11px] text-muted-foreground truncate">{description}</p>
        </div>
        {open ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <Separator />
            <div className="p-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export function SecurityTab() {
  // ── State ──────────────────────────────────────────────────────────────
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [audit, setAudit] = useState<SecurityAuditResult | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [newKey, setNewKey] = useState<GeneratedApiKey | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);

  const [loading, setLoading] = useState(true);
  const [auditing, setAuditing] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [keyScope, setKeyScope] = useState<"read" | "write" | "admin">("read");
  const [keyExpiry, setKeyExpiry] = useState(30);

  // Provenance
  const [provContent, setProvContent] = useState("");
  const [provModel, setProvModel] = useState("");
  const [provCert, setProvCert] = useState<ProvenanceCertificate | null>(null);
  const [provVerify, setProvVerify] = useState<ProvenanceVerifyResult | null>(null);
  const [generatingProv, setGeneratingProv] = useState(false);
  const [verifyingProv, setVerifyingProv] = useState(false);

  // Config updates
  const [savingConfig, setSavingConfig] = useState(false);

  const { copied, copy } = useCopyToClipboard();

  // ── Initial load ───────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [cfg, keys] = await Promise.all([
          getSecurityConfig(),
          listApiKeys(),
        ]);
        setConfig(cfg);
        setApiKeys(keys);
      } catch {
        // Backend might not be running
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleAudit = async () => {
    setAuditing(true);
    try {
      const result = await runSecurityAudit();
      setAudit(result);
      const cfg = await getSecurityConfig();
      setConfig(cfg);
    } catch {
      /* noop */
    } finally {
      setAuditing(false);
    }
  };

  const handleRotateKey = async () => {
    setRotating(true);
    try {
      await rotateKey();
      const cfg = await getSecurityConfig();
      setConfig(cfg);
      const a = await runSecurityAudit();
      setAudit(a);
    } catch {
      /* noop */
    } finally {
      setRotating(false);
    }
  };

  const handleGenerateKey = async () => {
    setGeneratingKey(true);
    try {
      const key = await generateApiKey(keyScope, keyExpiry);
      setNewKey(key);
      setShowNewKey(true);
      const keys = await listApiKeys();
      setApiKeys(keys);
    } catch {
      /* noop */
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    try {
      await revokeApiKey(id);
      const keys = await listApiKeys();
      setApiKeys(keys);
    } catch {
      /* noop */
    }
  };

  const handleUpdateConfig = async (updates: Partial<SecurityConfig>) => {
    setSavingConfig(true);
    try {
      const cfg = await updateSecurityConfig(updates);
      setConfig(cfg);
    } catch {
      /* noop */
    } finally {
      setSavingConfig(false);
    }
  };

  const handleGenerateProvenance = async () => {
    if (!provContent.trim()) return;
    setGeneratingProv(true);
    setProvVerify(null);
    try {
      const cert = await generateProvenance(provContent, "text", provModel || undefined);
      setProvCert(cert);
    } catch {
      /* noop */
    } finally {
      setGeneratingProv(false);
    }
  };

  const handleVerifyProvenance = async () => {
    if (!provContent.trim() || !provCert) return;
    setVerifyingProv(true);
    try {
      const result = await verifyProvenance(provContent, "text", provCert);
      setProvVerify(result);
    } catch {
      /* noop */
    } finally {
      setVerifyingProv(false);
    }
  };

  const handleFixAction = async (action: string) => {
    switch (action) {
      case "rotate_key":
        await handleRotateKey();
        break;
      case "enable_2fa":
        await handleUpdateConfig({ two_factor_enabled: true } as Partial<SecurityConfig>);
        break;
      case "configure_webhook":
        await handleUpdateConfig({ webhook_url: "https://hooks.example.com/lyra" } as Partial<SecurityConfig>);
        break;
      case "run_audit":
        await handleAudit();
        break;
      case "set_entropy":
        await handleUpdateConfig({ entropy_level: "high" } as Partial<SecurityConfig>);
        break;
      case "enable_anti_scraping":
        await handleUpdateConfig({ anti_scraping_enabled: true } as Partial<SecurityConfig>);
        break;
      case "change_key":
        break;
      default:
        break;
    }
    const a = await runSecurityAudit();
    setAudit(a);
    const cfg = await getSecurityConfig();
    setConfig(cfg);
  };

  const score = audit?.score ?? 0;

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Security</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Cryptographic protection against IP theft, output scraping, and synthetic data
          contamination.
        </p>
      </div>

      {/* ── Top row: Score + Audit Checklist ───────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Score ring */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
        >
          <Card className="flex h-full flex-col items-center justify-center border-border/40 p-6 text-center">
            <div className="relative">
              <svg className="size-32" viewBox="0 0 128 128">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="var(--secondary)"
                  strokeWidth="8"
                />
                <motion.circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke={
                    score >= 80
                      ? "var(--chart-2)"
                      : score >= 50
                        ? "var(--chart-3)"
                        : "var(--destructive)"
                  }
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 56 }}
                  animate={{
                    strokeDashoffset: 2 * Math.PI * 56 * (1 - score / 100),
                  }}
                  transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
                  transform="rotate(-90 64 64)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold tracking-tight">{score}</span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  out of 100
                </span>
              </div>
            </div>
            <p className="mt-4 text-[14px] font-semibold">Security Score</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {!audit
                ? "Run an audit to calculate your score."
                : score >= 80
                  ? "Strong — your deployment is well protected."
                  : score >= 50
                    ? `Fair — complete ${audit.failed} more items to improve.`
                    : `Weak — ${audit.failed} critical items need attention.`}
            </p>
            <Button
              className="mt-4 gap-2"
              size="sm"
              onClick={handleAudit}
              disabled={auditing}
            >
              {auditing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Search className="size-3.5" />
              )}
              {auditing ? "Scanning…" : "Run Security Audit"}
            </Button>
          </Card>
        </motion.div>

        {/* Audit checklist */}
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
        >
          <Card className="h-full border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-[14px]">
                <ShieldCheck className="size-4 text-primary" />
                Security Checklist
                {audit && (
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    Last audit: {new Date(audit.audited_at).toLocaleString()}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {audit ? (
                <>
                  {audit.checks.map((check, i) => (
                    <motion.div
                      key={check.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.04 }}
                      className="flex items-center gap-3 rounded-xl bg-secondary/30 px-4 py-3 transition-colors hover:bg-secondary/50"
                    >
                      <div
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
                          check.passed ? "bg-emerald-500/15" : "bg-muted"
                        }`}
                      >
                        {check.passed ? (
                          <Check className="size-3.5 text-emerald-500" />
                        ) : (
                          <div className="size-2 rounded-full bg-muted-foreground/30" />
                        )}
                      </div>
                      <span
                        className={`flex-1 text-[12.5px] ${
                          check.passed
                            ? "text-muted-foreground line-through"
                            : "font-medium"
                        }`}
                      >
                        {check.label}
                      </span>
                      <Badge
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] ${
                          check.severity === "critical"
                            ? "bg-red-500/10 text-red-500"
                            : check.severity === "high"
                              ? "bg-orange-500/10 text-orange-500"
                              : check.severity === "medium"
                                ? "bg-yellow-500/10 text-yellow-500"
                                : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {check.severity}
                      </Badge>
                      {!check.passed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 rounded-lg px-2.5 text-[11px] text-primary"
                          onClick={() => handleFixAction(check.fix_action)}
                        >
                          Fix <ArrowRight className="size-3" />
                        </Button>
                      )}
                    </motion.div>
                  ))}
                  <div className="mt-2 pt-2">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[12px] text-muted-foreground">
                        Overall progress
                      </span>
                      <span className="text-[12px] font-semibold">
                        {audit.passed}/{audit.total}
                      </span>
                    </div>
                    <Progress
                      value={(audit.passed / audit.total) * 100}
                      className="h-1.5"
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <ShieldAlert className="size-10 text-muted-foreground/40" />
                  <p className="mt-3 text-[13px] text-muted-foreground">
                    No audit data yet. Click <strong>Run Security Audit</strong> to
                    assess your security posture.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── API Key Management ─────────────────────────────────────────────── */}
      <Section
        title="API Key Management"
        icon={KeyRound}
        description="Generate, rotate, and revoke scoped API keys with HMAC-SHA256 derivation"
      >
        <div className="space-y-5">
          {/* Generate new key */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Scope</Label>
              <Select
                value={keyScope}
                onValueChange={(v) => setKeyScope(v as "read" | "write" | "admin")}
              >
                <SelectTrigger className="h-9 w-32 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">Read</SelectItem>
                  <SelectItem value="write">Write</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">
                Expires (days)
              </Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={keyExpiry}
                onChange={(e) => setKeyExpiry(Number(e.target.value))}
                className="h-9 w-24 text-[12px]"
              />
            </div>
            <Button
              size="sm"
              className="h-9 gap-1.5"
              onClick={handleGenerateKey}
              disabled={generatingKey}
            >
              {generatingKey ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Plus className="size-3.5" />
              )}
              Generate Key
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-1.5"
              onClick={handleRotateKey}
              disabled={rotating}
            >
              {rotating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Rotate Master Key
            </Button>
          </div>

          {/* Newly generated key (shown once) */}
          <AnimatePresence>
            {newKey && showNewKey && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[12px] font-semibold text-emerald-600 dark:text-emerald-400">
                        New API Key Generated — copy it now, it won&apos;t be shown
                        again
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <code className="rounded bg-secondary px-2 py-1 font-mono text-[11px] break-all">
                          {newKey.api_key}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 shrink-0 p-0"
                          onClick={() => copy(newKey.api_key, "newkey")}
                        >
                          {copied === "newkey" ? (
                            <Check className="size-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </Button>
                      </div>
                      <p className="mt-1.5 text-[10px] text-muted-foreground">
                        Scope: <strong>{newKey.scope}</strong> &middot; Expires:{" "}
                        {new Date(newKey.expires).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 shrink-0 p-0"
                      onClick={() => setShowNewKey(false)}
                    >
                      <span className="text-[11px]">✕</span>
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Key list */}
          {apiKeys.length > 0 && (
            <div className="space-y-2">
              <p className="text-[12px] font-medium text-muted-foreground">
                Active Keys ({apiKeys.filter((k) => !k.revoked).length})
              </p>
              {apiKeys.map((k) => (
                <div
                  key={k.id}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-[12px] transition-colors ${
                    k.revoked
                      ? "bg-muted/30 opacity-50"
                      : "bg-secondary/30 hover:bg-secondary/50"
                  }`}
                >
                  <KeyRound className="size-3.5 shrink-0 text-muted-foreground" />
                  <code className="font-mono text-[11px]">{k.prefix}</code>
                  <Badge
                    variant="outline"
                    className="rounded-full px-2 py-0 text-[9px]"
                  >
                    {k.scope}
                  </Badge>
                  <span className="flex-1 text-[10px] text-muted-foreground">
                    expires {new Date(k.expires).toLocaleDateString()}
                  </span>
                  {k.revoked ? (
                    <Badge className="bg-destructive/10 text-destructive text-[9px]">
                      revoked
                    </Badge>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1 rounded-lg px-2 text-[10px] text-destructive hover:bg-destructive/10"
                      onClick={() => handleRevokeKey(k.id)}
                    >
                      <Trash2 className="size-3" /> Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {config && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Clock className="size-3" />
              Key epoch: <strong>{config.key_rotation_epoch}</strong>
              {config.key_last_rotated && (
                <>
                  {" "}
                  &middot; Last rotated:{" "}
                  {new Date(config.key_last_rotated).toLocaleString()}
                </>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* ── Cryptographic Provenance ───────────────────────────────────────── */}
      <Section
        title="Content Provenance Certificates"
        icon={FileKey}
        description="Generate cryptographic proof of origin — binds content to model, timestamp, and deployment key"
        defaultOpen={true}
      >
        <div className="space-y-4">
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            Provenance certificates create an unforgeable chain:{" "}
            <strong>Content → SHA-256 hash → HMAC-SHA256 provenance ID → Origin proof → Chain hash</strong>.
            Any modification to the content or certificate fields invalidates the chain.
            This protects against IP theft by binding every output to its origin model and your deployment key.
          </p>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-[11px]">Content to certify</Label>
              <textarea
                className="flex min-h-24 w-full rounded-xl border border-input bg-secondary/30 px-3 py-2 text-[12px] ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Paste any AI-generated content here…"
                value={provContent}
                onChange={(e) => setProvContent(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[11px]">Model name (optional)</Label>
              <Input
                className="h-9 text-[12px]"
                placeholder="e.g. gpt-4o, claude-3.5"
                value={provModel}
                onChange={(e) => setProvModel(e.target.value)}
              />
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  className="h-9 gap-1.5 flex-1"
                  onClick={handleGenerateProvenance}
                  disabled={generatingProv || !provContent.trim()}
                >
                  {generatingProv ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <FileKey className="size-3.5" />
                  )}
                  Generate Certificate
                </Button>
                {provCert && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 gap-1.5"
                    onClick={handleVerifyProvenance}
                    disabled={verifyingProv}
                  >
                    {verifyingProv ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="size-3.5" />
                    )}
                    Verify
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Certificate display */}
          <AnimatePresence>
            {provCert && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <Separator />
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-semibold">
                    Provenance Certificate v{provCert.version}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-[10px]"
                    onClick={() =>
                      copy(JSON.stringify(provCert, null, 2), "cert")
                    }
                  >
                    {copied === "cert" ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    Copy JSON
                  </Button>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <CertField
                    label="Content Hash (SHA-256)"
                    value={provCert.content_hash}
                    icon={Hash}
                    copyId="cert-hash"
                    copy={copy}
                    copied={copied}
                  />
                  <CertField
                    label="Provenance ID (HMAC)"
                    value={provCert.provenance_id}
                    icon={Fingerprint}
                    copyId="cert-prov"
                    copy={copy}
                    copied={copied}
                  />
                  <CertField
                    label="Origin Proof"
                    value={provCert.origin_proof}
                    icon={Lock}
                    copyId="cert-origin"
                    copy={copy}
                    copied={copied}
                  />
                  <CertField
                    label="Anti-Scrape Fingerprint"
                    value={provCert.anti_scrape_fingerprint}
                    icon={Fingerprint}
                    copyId="cert-fp"
                    copy={copy}
                    copied={copied}
                  />
                  <CertField
                    label="Chain Hash"
                    value={provCert.chain_hash}
                    icon={Activity}
                    copyId="cert-chain"
                    copy={copy}
                    copied={copied}
                  />
                  <div className="rounded-xl bg-secondary/30 p-3">
                    <p className="text-[10px] text-muted-foreground">Claims</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {Object.entries(provCert.claims).map(([k, v]) => (
                        <Badge
                          key={k}
                          className={`rounded-full px-2 py-0 text-[9px] ${
                            v
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {v ? "✓" : "✗"}{" "}
                          {k.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Model: <strong>{provCert.model_name}</strong> &middot;{" "}
                      Size: {provCert.content_size_bytes} bytes &middot;{" "}
                      Epoch: {provCert.key_epoch} &middot;{" "}
                      Entropy: {provCert.entropy_level}
                    </p>
                  </div>
                </div>

                {/* Verification result */}
                {provVerify && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-xl border p-4 ${
                      provVerify.valid
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-destructive/30 bg-destructive/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {provVerify.valid ? (
                        <ShieldCheck className="size-5 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="size-5 text-destructive" />
                      )}
                      <p className="text-[13px] font-semibold">
                        {provVerify.valid
                          ? "Certificate Valid — Provenance Verified"
                          : "Certificate Invalid — Content Tampered or Wrong Key"}
                      </p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(provVerify.checks).map(([k, v]) => (
                        <Badge
                          key={k}
                          className={`rounded-full px-2.5 py-0.5 text-[10px] ${
                            v
                              ? "bg-emerald-500/10 text-emerald-500"
                              : "bg-destructive/10 text-destructive"
                          }`}
                        >
                          {v ? "✓" : "✗"} {k.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Section>

      {/* ── Security Configuration ─────────────────────────────────────────── */}
      <Section
        title="Security Configuration"
        icon={Settings2}
        description="Entropy level, anti-scraping, rate limiting, and webhook alerts"
        defaultOpen={false}
      >
        {config ? (
          <div className="space-y-5">
            {/* Entropy Level */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12.5px] font-semibold">Watermark Entropy</p>
                <p className="text-[11px] text-muted-foreground">
                  Higher entropy produces more resilient watermarks that survive
                  transformations, paraphrasing, and compression.
                </p>
              </div>
              <Select
                value={config.entropy_level}
                onValueChange={(v) =>
                  handleUpdateConfig({
                    entropy_level: v as "standard" | "high" | "maximum",
                  } as Partial<SecurityConfig>)
                }
              >
                <SelectTrigger className="h-9 w-36 text-[12px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="maximum">Maximum</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Anti-Scraping */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12.5px] font-semibold flex items-center gap-2">
                  <Fingerprint className="size-3.5 text-primary" />
                  Anti-Scraping Protection
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Adds per-request fingerprints to detect bulk content extraction.
                  Each API response includes a unique tracking nonce.
                </p>
              </div>
              <Switch
                checked={config.anti_scraping_enabled}
                onCheckedChange={(v) =>
                  handleUpdateConfig({ anti_scraping_enabled: v } as Partial<SecurityConfig>)
                }
              />
            </div>

            <Separator />

            {/* Rate Limiting */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12.5px] font-semibold flex items-center gap-2">
                  <Activity className="size-3.5 text-primary" />
                  Rate Limiting
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Throttle API requests to prevent automated scraping.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={config.rate_limit_rpm}
                  onChange={(e) =>
                    handleUpdateConfig({
                      rate_limit_rpm: Number(e.target.value),
                    } as Partial<SecurityConfig>)
                  }
                  className="h-9 w-20 text-[12px]"
                />
                <span className="text-[11px] text-muted-foreground">req/min</span>
                <Switch
                  checked={config.rate_limit_enabled}
                  onCheckedChange={(v) =>
                    handleUpdateConfig({ rate_limit_enabled: v } as Partial<SecurityConfig>)
                  }
                />
              </div>
            </div>

            <Separator />

            {/* Two-Factor */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12.5px] font-semibold flex items-center gap-2">
                  <Lock className="size-3.5 text-primary" />
                  Two-Factor Authentication
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Require a second factor (TOTP) for dashboard access and key
                  management operations.
                </p>
              </div>
              <Switch
                checked={config.two_factor_enabled}
                onCheckedChange={(v) =>
                  handleUpdateConfig({ two_factor_enabled: v } as Partial<SecurityConfig>)
                }
              />
            </div>

            <Separator />

            {/* Provenance Chain */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12.5px] font-semibold flex items-center gap-2">
                  <FileKey className="size-3.5 text-primary" />
                  Provenance Chain
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Automatically generate provenance certificates for every
                  watermarked output.  Certificates form a cryptographic chain.
                </p>
              </div>
              <Switch
                checked={config.provenance_chain_enabled}
                onCheckedChange={(v) =>
                  handleUpdateConfig({
                    provenance_chain_enabled: v,
                  } as Partial<SecurityConfig>)
                }
              />
            </div>

            <Separator />

            {/* Webhook */}
            <div className="space-y-2">
              <div>
                <p className="text-[12.5px] font-semibold flex items-center gap-2">
                  <Bell className="size-3.5 text-primary" />
                  Webhook Alerts
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Send real-time notifications when watermark violations, scraping
                  patterns, or anomalies are detected.
                </p>
              </div>
              <div className="flex gap-2">
                <Input
                  className="h-9 text-[12px] flex-1"
                  placeholder="https://hooks.example.com/lyra-alerts"
                  value={config.webhook_url ?? ""}
                  onChange={(e) =>
                    handleUpdateConfig({
                      webhook_url: e.target.value || null,
                    } as unknown as Partial<SecurityConfig>)
                  }
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1 text-[11px]"
                  onClick={() =>
                    handleUpdateConfig({
                      webhook_url: config.webhook_url,
                    } as Partial<SecurityConfig>)
                  }
                  disabled={savingConfig}
                >
                  {savingConfig ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Check className="size-3" />
                  )}
                  Save
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground">
            Could not load security configuration. Is the backend running?
          </p>
        )}
      </Section>

      {/* ── Threat Protection Summary ──────────────────────────────────────── */}
      <div>
        <h3 className="mb-4 text-[14px] font-semibold">
          Threat Protection Matrix
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: ShieldAlert,
              title: "IP Theft Protection",
              description:
                "Every watermarked output carries a self-authenticating HMAC-SHA256 payload (model + timestamp + 32-bit auth tag). Provenance certificates bind content to its origin deployment key — forging requires breaking 2^128 security.",
              severity: "active" as const,
              color: "var(--chart-2)",
            },
            {
              icon: Monitor,
              title: "Anti-Scraping Defense",
              description:
                "Per-request nonce fingerprints track every API call. Rate-aware monitoring detects bulk extraction patterns. Each scraped item carries an invisible forensic trail back to the request session.",
              severity: config?.anti_scraping_enabled
                ? ("active" as const)
                : ("inactive" as const),
              color: "var(--chart-3)",
            },
            {
              icon: Zap,
              title: "Synthetic Data Contamination Guard",
              description:
                "Embedded payloads survive model fine-tuning poisoning attempts. Even if watermarked text is used as training data, the statistical signal (KGW Z-score) persists in generated outputs, proving data lineage.",
              severity: "active" as const,
              color: "var(--chart-1)",
            },
            {
              icon: Lock,
              title: "Tamper Detection",
              description:
                "Dual-layer verification: statistical signal (DCT / FFT / Z-score) detects watermark presence, while HMAC tag validates payload integrity. Any content modification triggers a tamper alert.",
              severity: "active" as const,
              color: "var(--chart-4)",
            },
            {
              icon: RefreshCw,
              title: "Key Rotation & Epoch Tracking",
              description:
                "Rotate deployment keys without invalidating existing watermarks. Each rotation increments the epoch counter, and provenance certificates record which epoch they were issued under.",
              severity:
                config && config.key_rotation_epoch > 0
                  ? ("active" as const)
                  : ("inactive" as const),
              color: "var(--chart-5)",
            },
            {
              icon: FileKey,
              title: "Cryptographic Provenance Chain",
              description:
                "Content hash → Provenance ID (HMAC) → Origin proof (SHA-256) → Chain hash creates an immutable record. Verification is fully stateless — no database, registry, or external service required.",
              severity: config?.provenance_chain_enabled
                ? ("active" as const)
                : ("inactive" as const),
              color: "var(--chart-1)",
            },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 + i * 0.06 }}
              >
                <Card className="group h-full border-border/40 transition-all duration-300 hover:shadow-md hover:shadow-primary/5">
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <div
                        className="flex size-10 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
                        style={{
                          background: `color-mix(in srgb, ${item.color} 12%, transparent)`,
                        }}
                      >
                        <Icon className="size-5" style={{ color: item.color }} />
                      </div>
                      <Badge
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          item.severity === "active"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.severity}
                      </Badge>
                    </div>
                    <p className="text-[13px] font-semibold">{item.title}</p>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ── Certificate field sub-component ──────────────────────────────────────────
function CertField({
  label,
  value,
  icon: Icon,
  copyId,
  copy,
  copied,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  copyId: string;
  copy: (text: string, id: string) => void;
  copied: string | null;
}) {
  return (
    <div className="rounded-xl bg-secondary/30 p-3">
      <div className="flex items-center gap-1.5">
        <Icon className="size-3 text-muted-foreground" />
        <p className="text-[10px] text-muted-foreground">{label}</p>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5">
        <code className="flex-1 truncate font-mono text-[10px]">{value}</code>
        <button
          className="shrink-0 rounded p-0.5 hover:bg-secondary"
          onClick={() => copy(value, copyId)}
        >
          {copied === copyId ? (
            <Check className="size-3 text-emerald-500" />
          ) : (
            <Copy className="size-3 text-muted-foreground" />
          )}
        </button>
      </div>
    </div>
  );
}
