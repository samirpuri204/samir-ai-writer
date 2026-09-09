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

type ExtractBody = {
  mode: "assignment" | "lab";
  attachments?: Attachment[];
};

const MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";
const OPENROUTER_TIMEOUT_MS = 90_000;

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
const allowedLevels = ["School", "High School", "Undergraduate", "Postgraduate", "Professional"];
const allowedCitations = ["None", "APA 7th", "MLA 9th", "Harvard", "Chicago", "IEEE"];

async function readProviderPayload(response: Response): Promise<Record<string, any>> {
  const raw = await response.text();
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw) as Record<string, any>;
  } catch {
    return { message: raw.replace(/\s+/g, " ").trim().slice(0, 1200) };
  }
}

function parseJson(value: unknown) {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string") throw new Error("Model returned no structured extraction data.");

  const cleaned = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Model did not return valid JSON.");
  }
}

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENROUTER_API_KEY is not configured on the server." }, { status: 500 });
    }

    const body = (await req.json()) as ExtractBody;
    const attachments = body.attachments || [];
    if (!attachments.length) return NextResponse.json({ fields: {} });

    const content: any[] = [{
      type: "text",
      text: `You are reading uploaded ${body.mode === "lab" ? "lab-task" : "assignment"} questions. Extract only details that are explicitly visible or strongly unambiguous in the uploads. Transcribe the complete actionable questions/instructions into the instructions field while preserving numbering when possible. Do not invent missing metadata. Return ONLY one JSON object with exactly these keys:\n{\n  "title": "",\n  "subject": "",\n  "level": "",\n  "wordCount": "",\n  "citationStyle": "",\n  "instructions": ""\n}\n\nRules:\n- title: assignment title, task heading, experiment name, or concise task title if explicitly identifiable.\n- subject: course/subject name or code exactly as shown when possible.\n- level: only one of ${allowedLevels.join(", ")} if clearly inferable from explicit text; otherwise empty.\n- wordCount: preserve a visible word/page limit such as "1500 words" or "3–5 pages"; otherwise empty.\n- citationStyle: only one of ${allowedCitations.join(", ")} if explicitly stated; otherwise empty.\n- instructions: include all actual questions/tasks, constraints, marking requirements, required sections, programming-language requirements, and submission instructions visible in the files. Do not include headers like student name/date unless they are part of the task itself.\n- If a field is not present, return an empty string.`
    }];

    for (const file of attachments) {
      content.push({ type: "text", text: `\n--- QUESTION FILE: ${file.name} ---` });
      if (file.text) {
        content.push({ type: "text", text: file.text });
      } else if (file.dataUrl && file.type === "application/pdf") {
        content.push({ type: "file", file: { filename: file.name, file_data: file.dataUrl } });
      } else if (file.dataUrl && file.type.startsWith("image/")) {
        content.push({ type: "image_url", image_url: { url: file.dataUrl } });
      }
    }

    const hasPdf = attachments.some((file) => file.dataUrl && file.type === "application/pdf");
    const response = await openRouterFetch({
      model: MODEL,
      messages: [
        { role: "system", content: "You are a precise academic document parser. Return a single valid JSON object only, without markdown fences or commentary." },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
      ...(hasPdf ? { plugins: [{ id: "file-parser", pdf: { engine: "cloudflare-ai" } }] } : {}),
      provider: {
        sort: "latency",
        allow_fallbacks: true,
      },
      temperature: 0.1,
      max_completion_tokens: 1400,
    }, apiKey);

    const data = await readProviderPayload(response);
    if (!response.ok) {
      const providerMessage = data?.error?.message || data?.message || `OpenRouter extraction request failed (${response.status}).`;
      return NextResponse.json({ error: providerMessage }, { status: response.status });
    }

    const rawText = messageText(data?.choices?.[0]?.message);
    const raw = parseJson(rawText || data?.choices?.[0]?.message?.content);
    const record = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const level = safeString(record.level);
    const citationStyle = safeString(record.citationStyle);

    const fields = {
      title: safeString(record.title).slice(0, 220),
      subject: safeString(record.subject).slice(0, 180),
      level: allowedLevels.includes(level) ? level : "",
      wordCount: safeString(record.wordCount).slice(0, 100),
      citationStyle: allowedCitations.includes(citationStyle) ? citationStyle : "",
      instructions: safeString(record.instructions).slice(0, 16000),
    };

    return NextResponse.json({ fields, model: data?.model || MODEL });
  } catch (error) {
    console.error("Extraction route error:", error);
    if (error instanceof Error && (error.name === "AbortError" || /aborted|timeout/i.test(error.message))) {
      return NextResponse.json(
        { error: "Automatic question extraction took too long on the free router. Your files are still attached; you can fill the fields manually or try the upload again." },
        { status: 504 }
      );
    }
    const message = error instanceof Error ? error.message : "Could not extract details from the uploaded questions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
