"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  Code2,
  Terminal,
  Image,
  Music,
  FileText,
  Shield,
  Zap,
  Key,
  Copy,
  Check,
  ChevronRight,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";

// ── Syntax highlighting — Catppuccin Mocha palette ──────────────────
const syntaxColors: Record<string, string> = {
  comment:     "text-[#6c7086] italic",
  keyword:     "text-[#cba6f7]",
  string:      "text-[#a6e3a1]",
  number:      "text-[#fab387]",
  func:        "text-[#89b4fa]",
  type:        "text-[#f9e2af]",
  variable:    "text-[#f38ba8]",
  operator:    "text-[#94e2d5]",
  property:    "text-[#89b4fa]",
  punctuation: "text-[#585b70]",
  plain:       "text-[#cdd6f4]",
  builtin:     "text-[#f9e2af]",
  decorator:   "text-[#fab387]",
  flag:        "text-[#fab387]",
};

type TokenType = keyof typeof syntaxColors;

function getPatterns(lang: string): { type: TokenType; re: RegExp }[] {
  switch (lang) {
    case "python":
      return [
        { type: "comment", re: /^#.*/ },
        { type: "string", re: /^"""[\s\S]*?"""/ },
        { type: "string", re: /^'''[\s\S]*?'''/ },
        { type: "string", re: /^f"(?:[^"\\]|\\.)*"/ },
        { type: "string", re: /^f'(?:[^'\\]|\\.)*'/ },
        { type: "string", re: /^"(?:[^"\\]|\\.)*"/ },
        { type: "string", re: /^'(?:[^'\\]|\\.)*'/ },
        { type: "keyword", re: /^(?:import|from|def|class|return|if|elif|else|for|in|while|with|as|try|except|raise|True|False|None|and|or|not|is|lambda|async|await|yield|pass|break|continue)\b/ },
        { type: "decorator", re: /^@\w+/ },
        { type: "number", re: /^\d+\.?\d*(?:e[+-]?\d+)?/ },
        { type: "builtin", re: /^(?:print|len|range|str|int|float|list|dict|set|tuple|type|isinstance|open|super|map|filter|zip|enumerate|sorted|reversed|any|all|min|max|sum|abs|round|input|format|bytes)\b/ },
        { type: "func", re: /^\w+(?=\s*\()/ },
        { type: "operator", re: /^(?:->|==|!=|<=|>=|\+=|-=|\*=|\/=|\*\*|[+\-*\/%=<>!&|^~])/ },
        { type: "punctuation", re: /^[{}()\[\]:;,.]/ },
        { type: "plain", re: /^\w+/ },
        { type: "plain", re: /^\s+/ },
      ];
    case "typescript":
    case "javascript":
      return [
        { type: "comment", re: /^\/\/.*/ },
        { type: "comment", re: /^\/\*[\s\S]*?\*\// },
        { type: "string", re: /^`(?:[^`\\]|\\.|\$\{[^}]*\})*`/ },
        { type: "string", re: /^"(?:[^"\\]|\\.)*"/ },
        { type: "string", re: /^'(?:[^'\\]|\\.)*'/ },
        { type: "keyword", re: /^(?:import|from|export|default|const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|class|extends|implements|interface|type|typeof|instanceof|async|await|throw|try|catch|finally|true|false|null|undefined|void|this|super|of|in|as)\b/ },
        { type: "type", re: /^(?:string|number|boolean|Promise|Record|Array|Map|Set|any|never|unknown)\b/ },
        { type: "number", re: /^\d+\.?\d*(?:e[+-]?\d+)?/ },
        { type: "builtin", re: /^(?:console|JSON|Math|Object|String|Number|Boolean|Error|RegExp|Date|fetch|require|module|process)\b/ },
        { type: "func", re: /^\w+(?=\s*[(<])/ },
        { type: "operator", re: /^(?:===|!==|==|!=|<=|>=|=>|\?\?|\?\.|&&|\|\||\.\.\.|\+\+|--|[+\-*\/%=<>!&|^~?:])/ },
        { type: "punctuation", re: /^[{}()\[\];,.]/ },
        { type: "plain", re: /^\w+/ },
        { type: "plain", re: /^\s+/ },
      ];
    case "json":
      return [
        { type: "property", re: /^"(?:[^"\\]|\\.)*"(?=\s*:)/ },
        { type: "string", re: /^"(?:[^"\\]|\\.)*"/ },
        { type: "keyword", re: /^(?:true|false|null)\b/ },
        { type: "number", re: /^-?\d+\.?\d*(?:e[+-]?\d+)?/ },
        { type: "punctuation", re: /^[{}()\[\]:,]/ },
        { type: "plain", re: /^\s+/ },
      ];
    case "bash":
    case "shell":
      return [
        { type: "comment", re: /^#.*/ },
        { type: "string", re: /^"(?:[^"\\]|\\.)*"/ },
        { type: "string", re: /^'(?:[^'\\]|\\.)*'/ },
        { type: "variable", re: /^\$\{[^}]*\}/ },
        { type: "variable", re: /^\$[A-Za-z_]\w*/ },
        { type: "keyword", re: /^(?:if|then|else|elif|fi|for|do|done|while|until|case|esac|in|function|export|source|local|readonly|declare|unset)\b/ },
        { type: "func", re: /^(?:curl|git|pip|pip3|python3?|uvicorn|npm|npx|node|echo|cat|head|tail|grep|awk|sed|jq|cd|ls|mkdir|rm|cp|mv|chmod|sudo|docker|brew|apt|wget)\b/ },
        { type: "flag", re: /^--?[a-zA-Z][\w-]*/ },
        { type: "number", re: /^\d+\.?\d*/ },
        { type: "operator", re: /^(?:\|\||&&|;;|[|><&;])/ },
        { type: "punctuation", re: /^[{}()\[\]=,]/ },
        { type: "plain", re: /^\w+/ },
        { type: "plain", re: /^\s+/ },
      ];
    case "go":
      return [
        { type: "comment", re: /^\/\/.*/ },
        { type: "comment", re: /^\/\*[\s\S]*?\*\// },
        { type: "string", re: /^`[^`]*`/ },
        { type: "string", re: /^"(?:[^"\\]|\\.)*"/ },
        { type: "keyword", re: /^(?:package|import|func|return|if|else|for|range|var|const|type|struct|interface|map|defer|go|chan|select|switch|case|default|break|continue|fallthrough)\b/ },
        { type: "type", re: /^(?:string|int|int8|int16|int32|int64|uint|float32|float64|bool|byte|rune|error|any|nil)\b/ },
        { type: "builtin", re: /^(?:make|len|cap|append|copy|delete|new|panic|recover|close|print|println)\b/ },
        { type: "number", re: /^\d+\.?\d*(?:e[+-]?\d+)?/ },
        { type: "func", re: /^\w+(?=\s*\()/ },
        { type: "operator", re: /^(?::=|==|!=|<=|>=|&&|\|\||<-|\.\.\.|\+\+|--|[+\-*\/%=<>!&|^])/ },
        { type: "punctuation", re: /^[{}()\[\]:;,.]/ },
        { type: "plain", re: /^\w+/ },
        { type: "plain", re: /^\s+/ },
      ];
    default:
      return [
        { type: "string", re: /^"(?:[^"\\]|\\.)*"/ },
        { type: "string", re: /^'(?:[^'\\]|\\.)*'/ },
        { type: "number", re: /^\d+\.?\d*/ },
        { type: "plain", re: /^\s+/ },
        { type: "plain", re: /^\w+/ },
      ];
  }
}

function tokenize(code: string, lang: string) {
  const patterns = getPatterns(lang);
  const tokens: { type: TokenType; text: string }[] = [];
  let pos = 0;
  while (pos < code.length) {
    const rest = code.slice(pos);
    let matched = false;
    for (const p of patterns) {
      const m = rest.match(p.re);
      if (m) {
        tokens.push({ type: p.type, text: m[0] });
        pos += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const last = tokens.at(-1);
      if (last?.type === "plain") last.text += code[pos];
      else tokens.push({ type: "plain", text: code[pos] });
      pos++;
    }
  }
  return tokens;
}

function highlight(code: string, lang: string) {
  return tokenize(code, lang).map((t, i) => (
    <span key={i} className={syntaxColors[t.type]}>{t.text}</span>
  ));
}

// ── Code block with copy ────────────────────────────────────────────
function CodeBlock({
  code,
  lang = "bash",
  title,
}: {
  code: string;
  lang?: string;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split("\n");

  return (
    <div className="group relative overflow-hidden rounded-xl border border-[#313244] bg-[#1e1e2e] shadow-lg">
      {title && (
        <div className="flex items-center justify-between border-b border-[#313244] bg-[#181825] px-4 py-2.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="size-3 rounded-full bg-[#f38ba8]/80" />
              <span className="size-3 rounded-full bg-[#f9e2af]/80" />
              <span className="size-3 rounded-full bg-[#a6e3a1]/80" />
            </div>
            <span className="text-[11px] font-medium text-[#6c7086]">
              {title}
            </span>
          </div>
          <Badge variant="secondary" className="border-0 bg-[#313244] text-[9px] font-mono text-[#6c7086]">
            {lang}
          </Badge>
        </div>
      )}
      <div className="relative flex">
        {/* Line numbers */}
        <div className="hidden select-none border-r border-[#313244] py-4 pl-4 pr-3 text-right font-mono text-[13px] leading-relaxed text-[#45475a] sm:block">
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        {/* Code */}
        <pre className="flex-1 overflow-x-auto p-4 text-[13px] leading-relaxed">
          <code className="font-mono">{highlight(code, lang)}</code>
        </pre>
        <button
          onClick={copy}
          className="absolute right-3 top-3 rounded-lg border border-[#313244] bg-[#1e1e2e]/90 p-1.5 opacity-0 backdrop-blur-sm transition-all hover:bg-[#313244] group-hover:opacity-100"
        >
          {copied ? (
            <Check className="size-3.5 text-[#a6e3a1]" />
          ) : (
            <Copy className="size-3.5 text-[#6c7086]" />
          )}
        </button>
      </div>
    </div>
  );
}

// ── Section nav items ───────────────────────────────────────────────
const sections = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "quickstart", label: "Quick Start", icon: Zap },
  { id: "auth", label: "Authentication", icon: Key },
  { id: "watermark", label: "POST /api/watermark", icon: Shield },
  { id: "verify", label: "POST /api/verify", icon: Terminal },
  { id: "health", label: "GET /health", icon: Zap },
  { id: "text", label: "Text Integration", icon: FileText },
  { id: "image", label: "Image Integration", icon: Image },
  { id: "audio", label: "Audio Integration", icon: Music },
  { id: "sdks", label: "SDK Examples", icon: Code2 },
];

// ── Main page ───────────────────────────────────────────────────────
export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview");

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <Badge variant="secondary" className="mb-4 text-[11px] font-normal">
            API v2.0.0 · Stateless
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight">
            Integration Docs
          </h1>
          <p className="mt-3 max-w-2xl text-lg font-light text-muted-foreground">
            Add invisible, cryptographic watermarking to every piece of
            AI-generated content your platform produces. Three endpoints, zero
            storage, full provenance.
          </p>
        </motion.div>

        <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
          {/* Sidebar nav */}
          <nav className="hidden lg:block">
            <div className="sticky top-20 space-y-1">
              {sections.map((s) => {
                const Icon = s.icon;
                const active = activeSection === s.id;
                return (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    onClick={() => setActiveSection(s.id)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-light transition-colors ${
                      active
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-3.5" />
                    {s.label}
                  </a>
                );
              })}
            </div>
          </nav>

          {/* Content */}
          <div className="min-w-0 space-y-20">
            {/* ── Overview ───────────────────────────── */}
            <section id="overview" className="scroll-mt-24 space-y-6">
              <h2 className="text-2xl font-semibold tracking-tight">
                Overview
              </h2>
              <p className="text-[15px] font-light leading-relaxed text-muted-foreground">
                Lyra embeds self-authenticating watermarks into AI-generated
                content — text, images, and audio. The watermark is invisible to
                humans but machine-verifiable. All metadata (model origin,
                timestamp, HMAC authentication tag) lives{" "}
                <strong className="text-foreground">inside the content itself</strong>,
                so verification requires zero server-side state.
              </p>

              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    icon: FileText,
                    title: "Text & Code",
                    desc: "KGW Z-score statistical bias + invisible Unicode steganography. Works with any language.",
                    method: "kgw_statistical_payload_steganography",
                  },
                  {
                    icon: Image,
                    title: "Images (PNG)",
                    desc: "DCT frequency-domain perturbation + R-channel LSB payload. Imperceptible to humans.",
                    method: "dct_lsb_dual_layer",
                  },
                  {
                    icon: Music,
                    title: "Audio (WAV)",
                    desc: "FFT mid-frequency band embedding + sample LSB payload. Inaudible modification.",
                    method: "fft_lsb_dual_layer",
                  },
                ].map((m) => (
                  <div
                    key={m.title}
                    className="rounded-xl border border-border/40 p-5"
                  >
                    <m.icon className="mb-3 size-5 text-muted-foreground" />
                    <p className="text-[14px] font-medium">{m.title}</p>
                    <p className="mt-1 text-[12px] font-light leading-relaxed text-muted-foreground">
                      {m.desc}
                    </p>
                    <Badge
                      variant="secondary"
                      className="mt-3 text-[9px] font-mono font-normal"
                    >
                      {m.method}
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-border/40 bg-card p-6">
                <h3 className="text-[14px] font-medium">
                  Cryptographic Payload (30 bytes embedded per request)
                </h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-[13px] font-light">
                    <thead>
                      <tr className="border-b border-border/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground/60">
                        <th className="pb-2 pr-4">Bytes</th>
                        <th className="pb-2 pr-4">Field</th>
                        <th className="pb-2">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      <tr>
                        <td className="py-2 pr-4 font-mono text-[12px]">[0:2]</td>
                        <td className="py-2 pr-4">Magic</td>
                        <td className="py-2 text-muted-foreground">
                          <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">0x574D</code> (&quot;WM&quot;) — identifies Lyra payloads
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 font-mono text-[12px]">[2:6]</td>
                        <td className="py-2 pr-4">Timestamp</td>
                        <td className="py-2 text-muted-foreground">
                          Unix uint32 big-endian — when the watermark was created
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 font-mono text-[12px]">[6:26]</td>
                        <td className="py-2 pr-4">Model Name</td>
                        <td className="py-2 text-muted-foreground">
                          UTF-8, zero-padded to 20 bytes — AI model identifier
                        </td>
                      </tr>
                      <tr>
                        <td className="py-2 pr-4 font-mono text-[12px]">[26:30]</td>
                        <td className="py-2 pr-4">Auth Tag</td>
                        <td className="py-2 text-muted-foreground">
                          <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">HMAC-SHA256(bytes[0:26], K)[:4]</code> — 32-bit integrity tag
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-[12px] font-light text-muted-foreground">
                  <strong className="text-foreground">WM_ID</strong> = SHA256(K ‖ ts_bytes ‖ model_bytes) — deterministic, same on embed and verify.
                </p>
              </div>
            </section>

            {/* ── Quick Start ────────────────────────── */}
            <section id="quickstart" className="scroll-mt-24 space-y-6">
              <h2 className="text-2xl font-semibold tracking-tight">
                Quick Start
              </h2>
              <p className="text-[15px] font-light text-muted-foreground">
                Get watermarking working in under 2 minutes.
              </p>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-7 items-center justify-center rounded-full bg-foreground text-[12px] font-semibold text-background">
                    1
                  </div>
                  <span className="text-[14px] font-medium">
                    Start the API server
                  </span>
                </div>
                <CodeBlock
                  title="Terminal"
                  lang="bash"
                  code={`# Clone and install
git clone https://github.com/your-org/lyra.git
cd lyra/backend
pip install -r requirements.txt

# Set your secret key (CRITICAL — keep this private)
export WATERMARK_SECRET_KEY="your-secret-key-here"

# Start the server
uvicorn main:app --host 0.0.0.0 --port 8000`}
                />

                <div className="flex items-center gap-3">
                  <div className="flex size-7 items-center justify-center rounded-full bg-foreground text-[12px] font-semibold text-background">
                    2
                  </div>
                  <span className="text-[14px] font-medium">
                    Watermark your first text
                  </span>
                </div>
                <CodeBlock
                  title="cURL — Embed watermark"
                  lang="bash"
                  code={`curl -X POST http://localhost:8000/api/watermark \\
  -H "Content-Type: application/json" \\
  -d '{
    "data_type": "text",
    "data": "The transformer architecture revolutionized NLP...",
    "watermark_strength": 0.8,
    "model_name": "GPT-4o"
  }'`}
                />

                <div className="flex items-center gap-3">
                  <div className="flex size-7 items-center justify-center rounded-full bg-foreground text-[12px] font-semibold text-background">
                    3
                  </div>
                  <span className="text-[14px] font-medium">
                    Verify it later
                  </span>
                </div>
                <CodeBlock
                  title="cURL — Verify watermark"
                  lang="bash"
                  code={`curl -X POST http://localhost:8000/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{
    "data_type": "text",
    "data": "<paste the watermarked_data from step 2>"
  }'`}
                />
              </div>
            </section>

            {/* ── Authentication ─────────────────────── */}
            <section id="auth" className="scroll-mt-24 space-y-6">
              <h2 className="text-2xl font-semibold tracking-tight">
                Authentication
              </h2>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
                <p className="text-[14px] font-medium text-amber-400">
                  ⚠ Security Critical
                </p>
                <p className="mt-2 text-[13px] font-light leading-relaxed text-muted-foreground">
                  The <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">WATERMARK_SECRET_KEY</code> is the root of trust.
                  Anyone with this key can forge or verify watermarks. In production:
                </p>
                <ul className="mt-3 space-y-1.5 text-[13px] font-light text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                    Store the key in a secrets manager (AWS Secrets Manager, Vault, etc.)
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                    Rotate keys periodically — old watermarks remain verifiable with the old key
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                    Use a different key per tenant / organization for isolation
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                    Add API key authentication (Bearer token) in front of the endpoints
                  </li>
                </ul>
              </div>
              <CodeBlock
                title="Environment variable"
                lang="bash"
                code={`export WATERMARK_SECRET_KEY="your-256-bit-hex-key-here"

# Generate a strong key:
python3 -c "import secrets; print(secrets.token_hex(32))"`}
              />
            </section>

            {/* ── POST /api/watermark ───────────────── */}
            <section id="watermark" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <Badge className="font-mono text-[11px]">POST</Badge>
                <h2 className="text-2xl font-semibold tracking-tight">
                  /api/watermark
                </h2>
              </div>
              <p className="text-[15px] font-light text-muted-foreground">
                Embed a self-authenticating watermark into content. Returns the
                watermarked content with cryptographic metadata.
              </p>

              <h3 className="text-[15px] font-medium">Request Body</h3>
              <div className="overflow-x-auto rounded-xl border border-border/40">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border/30 bg-secondary/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground/60">
                      <th className="px-4 py-2.5">Field</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5">Required</th>
                      <th className="px-4 py-2.5">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20 font-light">
                    <tr>
                      <td className="px-4 py-2.5 font-mono text-[12px]">data_type</td>
                      <td className="px-4 py-2.5 text-muted-foreground">string</td>
                      <td className="px-4 py-2.5">✓</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">&quot;text&quot;</code>{" "}
                        <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">&quot;image&quot;</code>{" "}
                        <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">&quot;audio&quot;</code>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-mono text-[12px]">data</td>
                      <td className="px-4 py-2.5 text-muted-foreground">string</td>
                      <td className="px-4 py-2.5">✓</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        UTF-8 text or base64-encoded binary (image/audio)
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-mono text-[12px]">watermark_strength</td>
                      <td className="px-4 py-2.5 text-muted-foreground">float</td>
                      <td className="px-4 py-2.5 text-muted-foreground/50">—</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        0.0 – 1.0 (default 0.8). Higher = more detectable but less invisible.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-mono text-[12px]">model_name</td>
                      <td className="px-4 py-2.5 text-muted-foreground">string | null</td>
                      <td className="px-4 py-2.5 text-muted-foreground/50">—</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        AI model identifier (e.g. &quot;GPT-4o&quot;, &quot;Claude 3.5&quot;). Embedded in the payload.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-[15px] font-medium">Response</h3>
              <CodeBlock
                title="200 OK"
                lang="json"
                code={`{
  "watermarked_data": "The transformer architecture...",
  "watermark_metadata": {
    "watermark_id": "e06e3676784...",
    "embedding_method": "kgw_statistical_payload_steganography",
    "cryptographic_signature": "c0def6e455a...",
    "fingerprint_hash": "bf29ff33711...",
    "model_name": "GPT-4o"
  },
  "integrity_proof": {
    "algorithm": "HMAC-SHA256",
    "timestamp": "2026-02-21T14:30:58.555Z"
  }
}`}
              />
            </section>

            {/* ── POST /api/verify ──────────────────── */}
            <section id="verify" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <Badge className="font-mono text-[11px]">POST</Badge>
                <h2 className="text-2xl font-semibold tracking-tight">
                  /api/verify
                </h2>
              </div>
              <p className="text-[15px] font-light text-muted-foreground">
                Verify whether content contains a watermark. Completely stateless
                — all proof is extracted from the content itself.
              </p>

              <h3 className="text-[15px] font-medium">Request Body</h3>
              <div className="overflow-x-auto rounded-xl border border-border/40">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border/30 bg-secondary/30 text-left text-[11px] uppercase tracking-wider text-muted-foreground/60">
                      <th className="px-4 py-2.5">Field</th>
                      <th className="px-4 py-2.5">Type</th>
                      <th className="px-4 py-2.5">Required</th>
                      <th className="px-4 py-2.5">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20 font-light">
                    <tr>
                      <td className="px-4 py-2.5 font-mono text-[12px]">data_type</td>
                      <td className="px-4 py-2.5 text-muted-foreground">string</td>
                      <td className="px-4 py-2.5">✓</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">&quot;text&quot;</code>{" "}
                        <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">&quot;image&quot;</code>{" "}
                        <code className="rounded bg-secondary px-1.5 py-0.5 text-[11px]">&quot;audio&quot;</code>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-mono text-[12px]">data</td>
                      <td className="px-4 py-2.5 text-muted-foreground">string</td>
                      <td className="px-4 py-2.5">✓</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        The content to verify (same format as watermark request)
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2.5 font-mono text-[12px]">model_name</td>
                      <td className="px-4 py-2.5 text-muted-foreground">string | null</td>
                      <td className="px-4 py-2.5 text-muted-foreground/50">—</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        Optional hint (the payload already contains the real model name)
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <h3 className="text-[15px] font-medium">Response</h3>
              <CodeBlock
                title="200 OK"
                lang="json"
                code={`{
  "verification_result": {
    "watermark_detected": true,
    "confidence_score": 0.9412,
    "matched_watermark_id": "e06e3676784...",
    "model_name": "GPT-4o"
  },
  "forensic_details": {
    "signature_valid": true,
    "tamper_detected": false,
    "statistical_score": 4.827351
  },
  "analysis_timestamp": "2026-02-21T15:12:03.221Z"
}`}
              />

              <div className="rounded-xl border border-border/40 bg-card p-5">
                <h4 className="text-[13px] font-medium">Understanding the Response</h4>
                <div className="mt-3 space-y-2 text-[12px] font-light text-muted-foreground">
                  <p><strong className="text-foreground">watermark_detected</strong> — true if either statistical test or payload HMAC passes</p>
                  <p><strong className="text-foreground">confidence_score</strong> — 0.0–1.0, combines statistical and cryptographic signals</p>
                  <p><strong className="text-foreground">signature_valid</strong> — true if embedded HMAC tag verified with your key</p>
                  <p><strong className="text-foreground">tamper_detected</strong> — true if statistical signal exists but HMAC is broken (content was modified)</p>
                  <p><strong className="text-foreground">statistical_score</strong> — Z-score (text) or correlation coefficient ρ (image/audio)</p>
                </div>
              </div>
            </section>

            {/* ── GET /health ────────────────────────── */}
            <section id="health" className="scroll-mt-24 space-y-6">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="font-mono text-[11px]">GET</Badge>
                <h2 className="text-2xl font-semibold tracking-tight">
                  /health
                </h2>
              </div>
              <p className="text-[15px] font-light text-muted-foreground">
                Health check endpoint for load balancers and monitoring.
              </p>
              <CodeBlock
                title="Response"
                lang="json"
                code={`{ "status": "ok", "mode": "stateless", "registry": "none" }`}
              />
            </section>

            {/* ── Text Integration ───────────────────── */}
            <section id="text" className="scroll-mt-24 space-y-6">
              <h2 className="text-2xl font-semibold tracking-tight">
                Text Integration — OpenAI / LLM Pipeline
              </h2>
              <p className="text-[15px] font-light text-muted-foreground">
                Watermark every LLM response before it reaches the end user.
                Drop this middleware into your API gateway or backend.
              </p>

              <CodeBlock
                title="Python — OpenAI Chat Completion + Lyra watermark"
                lang="python"
                code={`import openai
import httpx

LYRA_URL = "https://lyra.yourcompany.com"

client = openai.OpenAI()

def generate_watermarked(prompt: str, model: str = "gpt-4o") -> dict:
    """Generate text with OpenAI, then watermark it before returning."""
    
    # 1. Generate with OpenAI
    completion = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
    )
    raw_text = completion.choices[0].message.content

    # 2. Watermark the output before it leaves your server
    resp = httpx.post(f"{LYRA_URL}/api/watermark", json={
        "data_type": "text",
        "data": raw_text,
        "model_name": model,
        "watermark_strength": 0.8,
    })
    result = resp.json()

    # 3. Return watermarked text to the end user
    return {
        "text": result["watermarked_data"],
        "watermark_id": result["watermark_metadata"]["watermark_id"],
    }


# Usage
response = generate_watermarked("Explain quantum computing")
print(response["text"])        # ← user sees this (invisibly watermarked)
print(response["watermark_id"])  # ← you store this for audit`}
              />

              <CodeBlock
                title="Node.js / TypeScript — Express middleware"
                lang="typescript"
                code={`import OpenAI from "openai";

const LYRA_URL = "https://lyra.yourcompany.com";
const openai = new OpenAI();

// Middleware: watermark every AI response before sending
async function watermarkMiddleware(
  rawText: string,
  modelName: string
): Promise<{ text: string; watermarkId: string }> {
  const res = await fetch(\`\${LYRA_URL}/api/watermark\`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data_type: "text",
      data: rawText,
      model_name: modelName,
      watermark_strength: 0.8,
    }),
  });

  const result = await res.json();
  return {
    text: result.watermarked_data,
    watermarkId: result.watermark_metadata.watermark_id,
  };
}

// Express route example
app.post("/api/chat", async (req, res) => {
  const { prompt } = req.body;

  // Generate
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
  });
  const rawText = completion.choices[0].message.content!;

  // Watermark before responding
  const { text, watermarkId } = await watermarkMiddleware(rawText, "gpt-4o");

  res.json({ text, watermarkId });
});`}
              />

              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                <p className="text-[14px] font-medium text-emerald-400">
                  💡 Key Principle
                </p>
                <p className="mt-2 text-[13px] font-light leading-relaxed text-muted-foreground">
                  Always watermark <strong className="text-foreground">server-side, before the response leaves your backend</strong>.
                  If you watermark on the client, the user already has the un-watermarked text.
                  The watermarking step should sit between your AI model call and the HTTP response.
                </p>
              </div>
            </section>

            {/* ── Image Integration ──────────────────── */}
            <section id="image" className="scroll-mt-24 space-y-6">
              <h2 className="text-2xl font-semibold tracking-tight">
                Image Integration — DALL·E / Stable Diffusion
              </h2>
              <p className="text-[15px] font-light text-muted-foreground">
                Watermark AI-generated images before serving them. Send the
                image as base64-encoded PNG.
              </p>

              <CodeBlock
                title="Python — DALL·E image → Lyra watermark"
                lang="python"
                code={`import openai
import httpx
import base64

client = openai.OpenAI()
LYRA_URL = "https://lyra.yourcompany.com"

def generate_watermarked_image(prompt: str) -> bytes:
    """Generate image with DALL·E, watermark it, return PNG bytes."""
    
    # 1. Generate image (base64 response)
    response = client.images.generate(
        model="dall-e-3",
        prompt=prompt,
        response_format="b64_json",
        size="1024x1024",
    )
    image_b64 = response.data[0].b64_json

    # 2. Watermark the image
    resp = httpx.post(f"{LYRA_URL}/api/watermark", json={
        "data_type": "image",
        "data": image_b64,
        "model_name": "dall-e-3",
        "watermark_strength": 0.8,
    })
    result = resp.json()

    # 3. Return watermarked PNG bytes
    watermarked_b64 = result["watermarked_data"]
    return base64.b64decode(watermarked_b64)


# Usage
png_bytes = generate_watermarked_image("A sunset over mountains")
with open("output.png", "wb") as f:
    f.write(png_bytes)

# Later: verify the image
with open("output.png", "rb") as f:
    verify_resp = httpx.post(f"{LYRA_URL}/api/verify", json={
        "data_type": "image",
        "data": base64.b64encode(f.read()).decode(),
    })
    print(verify_resp.json())  # watermark_detected: true`}
              />

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
                <p className="text-[14px] font-medium text-amber-400">
                  ⚠ Image Format
                </p>
                <p className="mt-2 text-[13px] font-light text-muted-foreground">
                  Images must be <strong className="text-foreground">PNG</strong> (lossless).
                  JPEG compression destroys the LSB payload layer.
                  If your pipeline outputs JPEG, convert to PNG before watermarking.
                </p>
              </div>
            </section>

            {/* ── Audio Integration ──────────────────── */}
            <section id="audio" className="scroll-mt-24 space-y-6">
              <h2 className="text-2xl font-semibold tracking-tight">
                Audio Integration — TTS / Music Generation
              </h2>
              <p className="text-[15px] font-light text-muted-foreground">
                Watermark text-to-speech or AI-generated audio. Send WAV files
                as base64.
              </p>

              <CodeBlock
                title="Python — OpenAI TTS → Lyra watermark"
                lang="python"
                code={`import openai
import httpx
import base64

client = openai.OpenAI()
LYRA_URL = "https://lyra.yourcompany.com"

def generate_watermarked_audio(text: str) -> bytes:
    """Generate TTS audio, watermark it, return WAV bytes."""
    
    # 1. Generate speech
    response = client.audio.speech.create(
        model="tts-1-hd",
        voice="alloy",
        input=text,
        response_format="wav",
    )
    audio_bytes = response.content
    audio_b64 = base64.b64encode(audio_bytes).decode()

    # 2. Watermark the audio
    resp = httpx.post(f"{LYRA_URL}/api/watermark", json={
        "data_type": "audio",
        "data": audio_b64,
        "model_name": "tts-1-hd",
        "watermark_strength": 0.8,
    })
    result = resp.json()

    # 3. Return watermarked WAV bytes
    return base64.b64decode(result["watermarked_data"])


# Usage
wav_bytes = generate_watermarked_audio("Hello, this is AI-generated speech.")
with open("speech.wav", "wb") as f:
    f.write(wav_bytes)`}
              />

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
                <p className="text-[14px] font-medium text-amber-400">
                  ⚠ Audio Format
                </p>
                <p className="mt-2 text-[13px] font-light text-muted-foreground">
                  Audio must be <strong className="text-foreground">WAV</strong> (uncompressed PCM).
                  MP3/AAC/OGG lossy compression will destroy the LSB payload.
                  Convert to WAV before watermarking.
                </p>
              </div>
            </section>

            {/* ── SDK Examples ───────────────────────── */}
            <section id="sdks" className="scroll-mt-24 space-y-6">
              <h2 className="text-2xl font-semibold tracking-tight">
                SDK & Language Examples
              </h2>
              <p className="text-[15px] font-light text-muted-foreground">
                The API is a simple REST interface — no SDK required. Here are
                ready-to-use examples for common languages.
              </p>

              <CodeBlock
                title="Python (requests)"
                lang="python"
                code={`import requests

LYRA = "https://lyra.yourcompany.com"

# Embed
resp = requests.post(f"{LYRA}/api/watermark", json={
    "data_type": "text",
    "data": "AI-generated content here...",
    "model_name": "gpt-4o",
})
watermarked = resp.json()["watermarked_data"]

# Verify
resp = requests.post(f"{LYRA}/api/verify", json={
    "data_type": "text",
    "data": watermarked,
})
print(resp.json()["verification_result"]["watermark_detected"])  # True`}
              />

              <CodeBlock
                title="JavaScript / TypeScript (fetch)"
                lang="typescript"
                code={`const LYRA = "https://lyra.yourcompany.com";

// Embed
const embedRes = await fetch(\`\${LYRA}/api/watermark\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    data_type: "text",
    data: "AI-generated content here...",
    model_name: "gpt-4o",
  }),
});
const { watermarked_data } = await embedRes.json();

// Verify
const verifyRes = await fetch(\`\${LYRA}/api/verify\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    data_type: "text",
    data: watermarked_data,
  }),
});
const result = await verifyRes.json();
console.log(result.verification_result.watermark_detected); // true`}
              />

              <CodeBlock
                title="Go"
                lang="go"
                code={`package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

const lyraURL = "https://lyra.yourcompany.com"

func watermark(text, model string) (string, error) {
    body, _ := json.Marshal(map[string]interface{}{
        "data_type":          "text",
        "data":               text,
        "model_name":         model,
        "watermark_strength": 0.8,
    })

    resp, err := http.Post(lyraURL+"/api/watermark", "application/json", bytes.NewReader(body))
    if err != nil {
        return "", err
    }
    defer resp.Body.Close()

    var result map[string]interface{}
    json.NewDecoder(resp.Body).Decode(&result)
    return result["watermarked_data"].(string), nil
}

func main() {
    wm, _ := watermark("Hello from Go!", "gpt-4o")
    fmt.Println(wm)
}`}
              />

              <CodeBlock
                title="cURL — Full round-trip"
                lang="bash"
                code={`# 1. Embed watermark
WATERMARKED=$(curl -s -X POST http://localhost:8000/api/watermark \\
  -H "Content-Type: application/json" \\
  -d '{"data_type":"text","data":"Hello world","model_name":"GPT-4o"}' \\
  | jq -r '.watermarked_data')

# 2. Verify watermark
curl -s -X POST http://localhost:8000/api/verify \\
  -H "Content-Type: application/json" \\
  -d "{\\"data_type\\":\\"text\\",\\"data\\":\\"$WATERMARKED\\"}" \\
  | jq .`}
              />
            </section>

            {/* ── Architecture diagram ───────────────── */}
            <section className="scroll-mt-24 space-y-6">
              <h2 className="text-2xl font-semibold tracking-tight">
                Architecture
              </h2>
              <div className="rounded-xl border border-border/40 bg-card p-6">
                <pre className="overflow-x-auto font-mono text-[12px] leading-relaxed text-muted-foreground">
{`┌─────────────────────────────────────────────────────────────┐
│                     Your Application                         │
│                                                              │
│  ┌──────────┐     ┌───────────────┐     ┌───────────────┐   │
│  │  AI Model │────▸│  Lyra API     │────▸│  End User     │   │
│  │  (GPT-4o, │     │  /api/watermark│     │  (sees normal │   │
│  │  DALL·E,  │     │               │     │   content)    │   │
│  │  TTS)     │     │  Embeds:      │     │               │   │
│  └──────────┘     │  • Payload    │     └───────┬───────┘   │
│                    │  • HMAC tag   │             │           │
│                    │  • Model ID   │             │           │
│                    └───────────────┘             │           │
│                                                  ▼           │
│                    ┌───────────────┐     ┌───────────────┐   │
│                    │  Lyra API     │◂────│  Content      │   │
│                    │  /api/verify  │     │  republished  │   │
│                    │               │     │  anywhere     │   │
│                    │  Extracts:    │     └───────────────┘   │
│                    │  • Model name │                         │
│                    │  • Timestamp  │     No database needed. │
│                    │  • Tamper flag│     Data carries proof. │
│                    └───────────────┘                         │
└─────────────────────────────────────────────────────────────┘`}
                </pre>
              </div>
            </section>

            {/* ── Footer CTA ─────────────────────────── */}
            <section className="scroll-mt-24 rounded-2xl border border-border/40 bg-card p-8 text-center">
              <h2 className="text-xl font-semibold tracking-tight">
                Ready to integrate?
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-[14px] font-light text-muted-foreground">
                Deploy the Lyra API behind your AI pipeline. Three endpoints,
                zero storage, full content provenance for every piece of
                AI-generated content your platform produces.
              </p>
              <div className="mt-6 flex items-center justify-center gap-3">
                <a href="/dashboard">
                  <button className="inline-flex h-10 items-center gap-2 rounded-xl bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-foreground/90">
                    Try the Dashboard
                    <ArrowRight className="size-3.5" />
                  </button>
                </a>
                <a
                  href="http://localhost:8000/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <button className="inline-flex h-10 items-center gap-2 rounded-xl border border-border/50 bg-card px-5 text-sm font-medium transition-colors hover:bg-secondary">
                    OpenAPI Spec
                    <ExternalLink className="size-3.5" />
                  </button>
                </a>
              </div>
            </section>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
