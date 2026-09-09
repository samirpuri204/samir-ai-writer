"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BookOpenCheck,
  Check,
  Clipboard,
  Download,
  FileImage,
  FileText,
  FlaskConical,
  Images,
  LoaderCircle,
  Paperclip,
  RotateCcw,
  ScanSearch,
  Sparkles,
  UploadCloud,
  WandSparkles,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import MarkdownResult from "./MarkdownResult";

type Mode = "assignment" | "lab";
type Purpose = "brief" | "format";
type UploadFile = {
  id: string;
  name: string;
  type: string;
  dataUrl?: string;
  text?: string;
  purpose: Purpose;
};

type ExtractedFields = {
  title?: string;
  subject?: string;
  level?: string;
  wordCount?: string;
  citationStyle?: string;
  instructions?: string;
};

const levels = ["School", "High School", "Undergraduate", "Postgraduate", "Professional"];
const citations = ["None", "APA 7th", "MLA 9th", "Harvard", "Chicago", "IEEE"];
const MAX_QUESTION_FILES = 8;
const MAX_SERIALIZED_BYTES = 2.8 * 1024 * 1024;

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function dataUrlBytes(dataUrl = "") {
  const base64 = dataUrl.split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
}

function attachmentBytes(file: UploadFile) {
  if (file.text) return new Blob([file.text]).size;
  return dataUrlBytes(file.dataUrl);
}

async function readApiPayload(res: Response): Promise<Record<string, any>> {
  const raw = await res.text();
  if (!raw.trim()) {
    if (!res.ok) throw new Error(`Server request failed (${res.status}).`);
    return {};
  }

  try {
    return JSON.parse(raw) as Record<string, any>;
  } catch {
    const compact = raw.replace(/\s+/g, " ").trim().slice(0, 500);
    if (res.status === 413) {
      throw new Error("The uploaded files are too large for the server request. Remove one file or upload smaller images/PDFs.");
    }
    if (!res.ok) {
      throw new Error(compact || `Server request failed (${res.status}).`);
    }
    throw new Error(`The server returned a non-JSON response: ${compact || "empty response"}`);
  }
}

async function compressImage(file: File): Promise<string> {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = source;
  });

  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  let quality = 0.86;
  let result = canvas.toDataURL("image/webp", quality);
  while (dataUrlBytes(result) > 620 * 1024 && quality > 0.48) {
    quality -= 0.08;
    result = canvas.toDataURL("image/webp", quality);
  }
  return result;
}

async function serializeFile(file: File, purpose: Purpose): Promise<UploadFile> {
  const lower = file.name.toLowerCase();
  if (file.type.startsWith("text/") || lower.endsWith(".md")) {
    if (file.size > 1024 * 1024) throw new Error(`${file.name} is larger than 1 MB.`);
    return { id: makeId(), name: file.name, type: file.type || "text/plain", text: await file.text(), purpose };
  }

  if (file.type.startsWith("image/")) {
    if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} is larger than 10 MB.`);
    const dataUrl = await compressImage(file);
    return { id: makeId(), name: file.name, type: "image/webp", dataUrl, purpose };
  }

  if (file.type === "application/pdf") {
    if (file.size > 2.5 * 1024 * 1024) throw new Error(`${file.name} is larger than 2.5 MB.`);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    return { id: makeId(), name: file.name, type: file.type, dataUrl, purpose };
  }

  throw new Error("Use PDF, PNG, JPG, WEBP, GIF, TXT or MD files.");
}

export default function WriterStudio() {
  const [mode, setMode] = useState<Mode>("assignment");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [level, setLevel] = useState("Undergraduate");
  const [wordCount, setWordCount] = useState("1200–1800 words");
  const [citationStyle, setCitationStyle] = useState("None");
  const [instructions, setInstructions] = useState("");
  const [briefs, setBriefs] = useState<UploadFile[]>([]);
  const [format, setFormat] = useState<UploadFile | null>(null);
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractNotice, setExtractNotice] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const completion = useMemo(() => {
    let n = 0;
    if (title.trim()) n++;
    if (subject.trim()) n++;
    if (instructions.trim()) n++;
    if (briefs.length) n++;
    return Math.min(100, 26 + n * 18);
  }, [title, subject, instructions, briefs]);

  function validateTotal(files: UploadFile[], labFormat: UploadFile | null = format) {
    const total = [...files, ...(labFormat ? [labFormat] : [])].reduce((sum, file) => sum + attachmentBytes(file), 0);
    if (total > MAX_SERIALIZED_BYTES) {
      throw new Error("The selected uploads are too large together. Remove one file or use smaller images/PDFs.");
    }
  }

  async function extractDetails(attachments: UploadFile[]) {
    if (!attachments.length) return;
    setExtracting(true);
    setExtractNotice("Scanning uploaded questions for subject, title and requirements…");
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, attachments }),
      });
      const data = await readApiPayload(res);
      if (!res.ok) throw new Error(data.error || data.message || `Could not auto-detect document details (${res.status}).`);
      const fields = (data.fields || {}) as ExtractedFields;
      let filled = 0;

      if (!title.trim() && fields.title?.trim()) { setTitle(fields.title.trim()); filled++; }
      if (!subject.trim() && fields.subject?.trim()) { setSubject(fields.subject.trim()); filled++; }
      if (fields.level && levels.includes(fields.level) && level === "Undergraduate") { setLevel(fields.level); filled++; }
      if (fields.wordCount?.trim() && wordCount === "1200–1800 words") { setWordCount(fields.wordCount.trim()); filled++; }
      if (fields.citationStyle && citations.includes(fields.citationStyle) && citationStyle === "None") { setCitationStyle(fields.citationStyle); filled++; }
      if (!instructions.trim() && fields.instructions?.trim()) { setInstructions(fields.instructions.trim()); filled++; }

      setExtractNotice(
        filled
          ? `${filled} detail${filled === 1 ? "" : "s"} detected and filled automatically. You can edit anything before generating.`
          : "Upload analyzed. No additional empty fields could be filled automatically."
      );
    } catch (e) {
      setExtractNotice(e instanceof Error ? `Files uploaded, but auto-detection failed: ${e.message}` : "Files uploaded, but auto-detection failed.");
    } finally {
      setExtracting(false);
    }
  }

  async function onQuestionFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    setError("");
    setExtractNotice("");
    try {
      const incoming = Array.from(fileList);
      if (briefs.length + incoming.length > MAX_QUESTION_FILES) {
        throw new Error(`You can attach up to ${MAX_QUESTION_FILES} question files/images at once.`);
      }
      const serialized = await Promise.all(incoming.map((file) => serializeFile(file, "brief")));
      const next = [...briefs, ...serialized];
      validateTotal(next);
      setBriefs(next);
      await extractDetails(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read those files.");
    }
  }

  async function onFormatFile(file: File | undefined) {
    if (!file) return;
    setError("");
    try {
      const serialized = await serializeFile(file, "format");
      validateTotal(briefs, serialized);
      setFormat(serialized);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that file.");
    }
  }

  function removeBrief(id: string) {
    setBriefs((current) => current.filter((file) => file.id !== id));
  }

  async function generate() {
    setError("");
    setLoading(true);
    setOutput("");
    try {
      const attachments = [...briefs, ...(mode === "lab" && format ? [format] : [])];
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, title, subject, level, wordCount, citationStyle, instructions, attachments }),
      });
      const data = await readApiPayload(res);
      if (!res.ok) throw new Error(data.error || data.message || `Generation failed (${res.status}).`);
      if (typeof data.output !== "string" || !data.output.trim()) throw new Error("The AI returned an empty response.");
      setOutput(data.output);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 160);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setTitle("");
    setSubject("");
    setLevel("Undergraduate");
    setWordCount("1200–1800 words");
    setCitationStyle("None");
    setInstructions("");
    setBriefs([]);
    setFormat(null);
    setOutput("");
    setError("");
    setExtractNotice("");
  }

  async function copy() {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  function download() {
    const blob = new Blob([output], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || mode).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section id="studio" className="studio-section">
      <motion.div
        className="studio-shell"
        initial={{ opacity: 0, y: 60, rotateX: 5 }}
        whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
        viewport={{ once: true, amount: 0.12 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="studio-topbar">
          <div>
            <span className="eyebrow"><Sparkles size={14} /> AI WORKSPACE</span>
            <h2>Create work that looks <em>professionally authored.</em></h2>
          </div>
          <div className="completion-ring" style={{ "--p": `${completion * 3.6}deg` } as React.CSSProperties}>
            <span>{completion}%</span>
          </div>
        </div>

        <div className="mode-switch" role="tablist" aria-label="Writer mode">
          <button className={mode === "assignment" ? "active" : ""} onClick={() => setMode("assignment")}>
            <BookOpenCheck size={18} /> Assignment Writer
          </button>
          <button className={mode === "lab" ? "active" : ""} onClick={() => setMode("lab")}>
            <FlaskConical size={18} /> Lab Task Writer
          </button>
          <motion.span className="mode-glow" animate={{ x: mode === "assignment" ? "0%" : "100%" }} />
        </div>

        <div className="studio-grid">
          <div className="form-panel">
            <label className="field-label">{mode === "assignment" ? "Assignment topic / title" : "Lab title / experiment"}</label>
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={mode === "assignment" ? "e.g. Impact of cloud computing on modern business" : "e.g. Implement set operations in C"} />

            <div className="field-row">
              <div>
                <label className="field-label">Subject / course</label>
                <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Computer Science" />
              </div>
              <div>
                <label className="field-label">Academic level</label>
                <select className="field" value={level} onChange={(e) => setLevel(e.target.value)}>{levels.map((x) => <option key={x}>{x}</option>)}</select>
              </div>
            </div>

            <div className="field-row">
              <div>
                <label className="field-label">Target length</label>
                <input className="field" value={wordCount} onChange={(e) => setWordCount(e.target.value)} placeholder="e.g. 1500 words" />
              </div>
              <div>
                <label className="field-label">Citation style</label>
                <select className="field" value={citationStyle} onChange={(e) => setCitationStyle(e.target.value)}>{citations.map((x) => <option key={x}>{x}</option>)}</select>
              </div>
            </div>

            <label className="field-label">Instructions / questions</label>
            <textarea className="field textarea" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Paste the full questions, marking scheme, special requirements, code constraints, structure, or teacher instructions…" />

            <div className="upload-grid">
              <MultiUploadCard
                label="Questions / brief"
                hint={`Optional · up to ${MAX_QUESTION_FILES} files · multiple images supported`}
                files={briefs}
                onFiles={onQuestionFiles}
                onRemove={removeBrief}
                extracting={extracting}
              />
              <AnimatePresence mode="popLayout">
                {mode === "lab" && (
                  <motion.div key="format" initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.96 }}>
                    <UploadCard label="Lab format / sample" hint="Optional · AI will match its structure" file={format} onFile={onFormatFile} onRemove={() => setFormat(null)} accent />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {(extracting || extractNotice) && (
                <motion.div className={`extract-box ${extracting ? "working" : ""}`} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                  {extracting ? <LoaderCircle className="spin" size={16} /> : <ScanSearch size={16} />}
                  <span>{extracting ? "Reading uploaded questions and filling detected details…" : extractNotice}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {error && <motion.div className="error-box" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>{error}</motion.div>}

            <div className="action-row">
              <button className="reset-btn" onClick={reset}><RotateCcw size={17} /> Reset</button>
              <button className="generate-btn" onClick={generate} disabled={loading || extracting}>
                <span className="button-shine" />
                {loading ? <><LoaderCircle className="spin" size={19} /> Building your document…</> : extracting ? <><LoaderCircle className="spin" size={19} /> Reading uploads…</> : <><WandSparkles size={19} /> Generate professional work <ArrowRight size={18} /></>}
              </button>
            </div>
          </div>

          <aside className="preview-panel">
            <div className="preview-orbit"><span /><span /><span /></div>
            <div className="preview-icon">{mode === "assignment" ? <BookOpenCheck /> : <FlaskConical />}</div>
            <span className="eyebrow">LIVE BLUEPRINT</span>
            <h3>{mode === "assignment" ? "Academic narrative engine" : "Structured lab engine"}</h3>
            <p>{mode === "assignment" ? "Upload one document or several question screenshots. ScholarForge scans them and fills recognizable subject, title, length, citation and instruction fields before writing." : "Upload multiple question images plus an optional lab format. ScholarForge extracts visible task details and matches your supplied structure when available."}</p>
            <div className="preview-list">
              {(mode === "assignment"
                ? ["Automatic question metadata extraction", "Multi-image question reading", "Level-aware explanation", "Citation hallucination guard"]
                : ["Automatic task detail extraction", "Multiple question images", "Optional format matching", "Theory + code + result structure"]
              ).map((item, i) => (
                <motion.div key={item} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
                  <span><Check size={12} /></span>{item}
                </motion.div>
              ))}
            </div>
            <div className="privacy-note"><Sparkles size={15} /> Avoid confidential or personal documents when using free research endpoints.</div>
          </aside>
        </div>
      </motion.div>

      <AnimatePresence>
        {(loading || output) && (
          <motion.div ref={resultRef} className="result-shell" initial={{ opacity: 0, y: 70, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}>
            <div className="result-head">
              <div><span className="eyebrow">GENERATED DOCUMENT</span><h3>{title || (mode === "assignment" ? "Assignment" : "Lab Task")}</h3></div>
              {output && <div className="result-actions"><button onClick={copy}>{copied ? <Check size={17} /> : <Clipboard size={17} />} {copied ? "Copied" : "Copy"}</button><button onClick={download}><Download size={17} /> .MD</button></div>}
            </div>
            {loading ? <GenerationLoader /> : <MarkdownResult value={output} />}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function MultiUploadCard({ label, hint, files, onFiles, onRemove, extracting }: {
  label: string;
  hint: string;
  files: UploadFile[];
  onFiles: (files: FileList | null) => void;
  onRemove: (id: string) => void;
  extracting: boolean;
}) {
  return (
    <div className={`multi-upload ${files.length ? "has-files" : ""}`}>
      <label className="multi-upload-trigger">
        <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,text/plain,application/pdf,image/*" onChange={(e) => { onFiles(e.target.files); e.currentTarget.value = ""; }} />
        <div className="multi-upload-icon">{extracting ? <LoaderCircle className="spin" size={23} /> : <Images size={23} />}</div>
        <div className="multi-upload-copy">
          <strong>{files.length ? `${files.length} question file${files.length === 1 ? "" : "s"} attached` : label}</strong>
          <small>{files.length ? "Click to add more images or files" : hint}</small>
        </div>
        <UploadCloud size={18} />
      </label>

      <AnimatePresence initial={false}>
        {files.length > 0 && (
          <motion.div className="file-chip-list" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            {files.map((file) => (
              <motion.div className="file-chip" key={file.id} layout initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                {file.type.startsWith("image/") ? <FileImage size={14} /> : <FileText size={14} />}
                <span title={file.name}>{file.name}</span>
                <button type="button" onClick={() => onRemove(file.id)} aria-label={`Remove ${file.name}`}><X size={13} /></button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UploadCard({ label, hint, file, onFile, onRemove, accent = false }: { label: string; hint: string; file: UploadFile | null; onFile: (file?: File) => void; onRemove: () => void; accent?: boolean }) {
  return (
    <label className={`upload-card ${accent ? "accent" : ""} ${file ? "has-file" : ""}`}>
      <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,text/plain,application/pdf,image/*" onChange={(e) => { onFile(e.target.files?.[0]); e.currentTarget.value = ""; }} />
      {file ? (
        <><FileText size={22} /><div><strong>{file.name}</strong><small>Ready to include</small></div><button type="button" onClick={(e) => { e.preventDefault(); onRemove(); }} aria-label="Remove file"><X size={16} /></button></>
      ) : (
        <><UploadCloud size={23} /><div><strong>{label}</strong><small>{hint}</small></div><Paperclip size={15} /></>
      )}
    </label>
  );
}

function GenerationLoader() {
  return (
    <div className="generation-loader">
      <div className="ai-core"><span /><span /><span /><Sparkles size={27} /></div>
      <h4>Composing your document</h4>
      <p>Analyzing requirements · structuring sections · refining academic tone</p>
      <div className="skeleton"><i /><i /><i /><i /><i /></div>
    </div>
  );
}
