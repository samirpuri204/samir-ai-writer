import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

type Attachment = {
  name: string;
  type: string;
  dataUrl?: string;
  text?: string;
  purpose?: "brief" | "format";
};

type RequestBody = {
  mode: "assignment" | "lab";
  title: string;
  subject: string;
  level: string;
  instructions: string;
  wordCount: string;
  citationStyle: string;
  attachments?: Attachment[];
};

const MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";
const OPENROUTER_TIMEOUT_MS = 270_000;

async function openRouterFetch(payload: Record<string, unknown>, apiKey: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);
  try {
    return await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        "X-Title": "ScholarForge AI by Samir Puri",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readProviderPayload(response: Response): Promise<Record<string, any>> {
  const raw = await response.text();
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, any>;
  } catch {
    return { message: raw.replace(/\s+/g, " ").trim().slice(0, 1200) };
  }
}

function messageText(message: any) {
  const content = message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => typeof part === "string" ? part : typeof part?.text === "string" ? part.text : "")
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function systemPrompt(mode: "assignment" | "lab") {
  if (mode === "lab") {
    return `You are ScholarForge, an expert academic lab-task writing assistant. Produce complete, professional, submission-ready lab work while keeping it educational and accurate. If a user supplies a format/template, follow its headings, ordering, table style, tone, and structure closely. If no format is supplied, use a polished default lab structure appropriate to the task (title, objective, theory/concept, requirements where relevant, procedure/algorithm, implementation/code where relevant, result/output, discussion, conclusion, and viva-style notes only when useful). Never invent observed experimental values; clearly label assumed/example values. Keep code correct, readable, and consistent with the requested language. Use Markdown with strong hierarchy.`;
  }
  return `You are ScholarForge, an expert academic assignment-writing assistant. Create a polished, logically structured, academically styled response matched to the user's level and subject. Explain concepts accurately, use clear headings, coherent arguments, examples where useful, and a strong conclusion. Do not fabricate sources or citations. When a citation style is requested, only cite sources that are actually supplied in the prompt; otherwise provide a clearly labeled "Suggested references to verify" section instead of inventing bibliographic details. Use Markdown.`;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENROUTER_API_KEY is not configured on the server." }, { status: 500 });
    }

    const body = (await req.json()) as RequestBody;
    if (!body.mode || (!body.title?.trim() && !body.instructions?.trim())) {
      return NextResponse.json({ error: "Please provide a topic/title or instructions." }, { status: 400 });
    }

    const prompt = [
      `MODE: ${body.mode.toUpperCase()}`,
      `TITLE / TASK: ${body.title || "Not specified"}`,
      `SUBJECT / COURSE: ${body.subject || "Not specified"}`,
      `ACADEMIC LEVEL: ${body.level || "Undergraduate"}`,
      `TARGET LENGTH: ${body.wordCount || "Use an appropriate professional length"}`,
      `CITATION STYLE: ${body.citationStyle || "None specified"}`,
      `USER INSTRUCTIONS:\n${body.instructions || "Complete the task professionally."}`,
      body.mode === "lab" ? "If a FORMAT attachment is present, prioritize matching it." : "",
    ].filter(Boolean).join("\n\n");

    const content: any[] = [{ type: "text", text: prompt }];

    for (const file of body.attachments || []) {
      const attachmentLabel = file.purpose === "format" ? "FORMAT/TEMPLATE" : "QUESTION/BRIEF";
      content.push({ type: "text", text: `\n--- ${attachmentLabel}: ${file.name} ---` });
      if (file.text) {
        content.push({ type: "text", text: file.text });
      } else if (file.dataUrl && file.type === "application/pdf") {
        content.push({ type: "file", file: { filename: file.name, file_data: file.dataUrl } });
      } else if (file.dataUrl && file.type.startsWith("image/")) {
        content.push({ type: "image_url", image_url: { url: file.dataUrl } });
      }
    }

    const response = await openRouterFetch({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt(body.mode) },
        { role: "user", content },
      ],
      ...(content.some((part) => part.type === "file")
        ? { plugins: [{ id: "file-parser", pdf: { engine: "cloudflare-ai" } }] }
        : {}),
      provider: {
        sort: "throughput",
        allow_fallbacks: true,
      },
      temperature: 0.5,
      max_completion_tokens: 5000,
    }, apiKey);

    const data = await readProviderPayload(response);
    if (!response.ok) {
      const message = data?.error?.message || data?.message || `OpenRouter request failed (${response.status}).`;
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const output = messageText(data?.choices?.[0]?.message);
    if (!output.trim()) {
      const providerMessage = data?.message ? ` Provider response: ${data.message}` : "";
      return NextResponse.json({ error: `The model returned an empty response.${providerMessage}` }, { status: 502 });
    }

    return NextResponse.json({ output, model: data?.model || MODEL, usage: data?.usage || null });
  } catch (error) {
    console.error("Generation route error:", error);
    if (error instanceof Error && (error.name === "AbortError" || /aborted|timeout/i.test(error.message))) {
      return NextResponse.json(
        { error: "The free OpenRouter model took too long to respond. Please try Generate again; the free router may select a different available model on the next request." },
        { status: 504 }
      );
    }
    const message = error instanceof Error ? error.message : "Unexpected server error. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
