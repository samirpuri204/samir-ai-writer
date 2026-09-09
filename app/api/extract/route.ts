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

type ExtractBody = {
  mode: "assignment" | "lab";
  attachments?: Attachment[];
};

const MODEL = process.env.OPENROUTER_MODEL || "thinkingmachines/inkling:free";
const allowedLevels = ["School", "High School", "Undergraduate", "Postgraduate", "Professional"];
const allowedCitations = ["None", "APA 7th", "MLA 9th", "Harvard", "Chicago", "IEEE"];

function parseJson(value: unknown) {
  if (typeof value !== "string") return value;
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
          { role: "system", content: "You are a precise academic document parser. Your entire response must be valid JSON and contain no markdown fences or commentary." },
          { role: "user", content },
        ],
        ...(hasPdf ? { plugins: [{ id: "file-parser", pdf: { engine: "cloudflare-ai" } }] } : {}),
        temperature: 0.1,
        max_completion_tokens: 2200,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: data?.error?.message || data?.message || "OpenRouter extraction request failed." }, { status: response.status });
    }

    const raw = parseJson(data?.choices?.[0]?.message?.content);
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

    return NextResponse.json({ fields });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Could not extract details from the uploaded questions." }, { status: 500 });
  }
}
