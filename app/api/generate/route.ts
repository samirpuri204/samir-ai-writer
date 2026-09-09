import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

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

const MODEL = process.env.OPENROUTER_MODEL || "thinkingmachines/inkling:free";

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

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        "X-Title": "ScholarForge AI by Samir Puri",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt(body.mode) },
          { role: "user", content },
        ],
        ...(content.some((part) => part.type === "file")
          ? { plugins: [{ id: "file-parser", pdf: { engine: "cloudflare-ai" } }] }
          : {}),
        temperature: 0.55,
        max_completion_tokens: 6500,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const message = data?.error?.message || data?.message || "OpenRouter request failed.";
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const output = data?.choices?.[0]?.message?.content;
    if (!output) return NextResponse.json({ error: "The model returned an empty response." }, { status: 502 });

    return NextResponse.json({ output, model: data?.model || MODEL, usage: data?.usage || null });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Unexpected server error. Please try again." }, { status: 500 });
  }
}
