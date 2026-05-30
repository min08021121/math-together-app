import { NextResponse } from "next/server";

type AIRequest =
  | { type: "lesson"; concept: string }
  | {
      type: "hint";
      concept: string;
      attempt: 1 | 2;
      problem: {
        question: string;
        answer: string;
      };
    };

interface LessonAIResponse {
  explanation: string;
  problems: Array<{
    id: string;
    question: string;
    answer: string;
  }>;
}

type GeminiPart = { text?: string };
type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
};

const systemPrompt = [
  "너는 초등학생(8~13세)을 다정하게 가르치는 친절한 수학 선생님이야.",
  "반드시 초등학교 교육과정 내의 개념과 수준(두/세 자리 수 계산 등)만 사용해.",
  "단순 수식보다는 초등학생의 일상생활이 반영된 스토리텔링형 문장제 문제를 출제해.",
  "~요, ~해요 같은 친절한 존댓말과 이모티콘을 사용해.",
  "학생이 틀렸을 때 바로 정답을 주지 말고, 단계별로 비계(Scaffolding)를 설정하여 2번의 힌트만 질문 형태로 제공해.",
].join("\n");

function stripCodeFence(text: string) {
  return text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function isLessonResponse(value: unknown): value is LessonAIResponse {
  if (!value || typeof value !== "object") return false;

  const candidate = value as LessonAIResponse;
  return (
    typeof candidate.explanation === "string" &&
    Array.isArray(candidate.problems) &&
    candidate.problems.length === 5 &&
    candidate.problems.every(
      (problem) =>
        problem &&
        typeof problem.id === "string" &&
        typeof problem.question === "string" &&
        typeof problem.answer === "string",
    )
  );
}

function buildUserPrompt(request: AIRequest) {
  if (request.type === "lesson") {
    return [
      `개념: ${request.concept}`,
      "이 개념을 초등학생에게 3~5줄로 설명하고, 같은 개념을 연습할 수 있는 문장제 문제 5개를 만들어 주세요.",
      "정답은 학생이 입력하기 쉬운 짧은 형태로 써 주세요.",
      "반드시 아래 JSON 형식만 반환하세요.",
      `{
  "explanation": "설명 텍스트",
  "problems": [
    { "id": "problem-1", "question": "문제", "answer": "정답" }
  ]
}`,
    ].join("\n");
  }

  return [
    `개념: ${request.concept}`,
    `문제: ${request.problem.question}`,
    `정답: ${request.problem.answer}`,
    `학생이 ${request.attempt}번째로 틀렸습니다.`,
    request.attempt === 1
      ? "정답을 알려주지 말고 핵심 개념을 떠올리게 하는 질문형 힌트 하나만 주세요."
      : "정답을 알려주지 말고 계산의 첫 단계만 질문형 힌트 하나로 알려주세요.",
    "반드시 아래 JSON 형식만 반환하세요.",
    `{ "hint": "힌트 문장" }`,
  ].join("\n");
}

async function callGemini(request: AIRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured." },
      { status: 503 },
    );
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: "user",
            parts: [{ text: buildUserPrompt(request) }],
          },
        ],
        generationConfig: {
          temperature: request.type === "lesson" ? 0.8 : 0.45,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    return NextResponse.json(
      { error: `Gemini request failed with ${response.status}.` },
      { status: 502 },
    );
  }

  const gemini = (await response.json()) as GeminiResponse;
  const text = gemini.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    return NextResponse.json(
      { error: "Gemini returned an empty response." },
      { status: 502 },
    );
  }

  const parsed = JSON.parse(stripCodeFence(text)) as unknown;

  if (request.type === "lesson") {
    if (!isLessonResponse(parsed)) {
      return NextResponse.json(
        { error: "Gemini returned an invalid lesson payload." },
        { status: 502 },
      );
    }

    return NextResponse.json(parsed);
  }

  const hint = (parsed as { hint?: unknown }).hint;

  if (typeof hint !== "string" || !hint.trim()) {
    return NextResponse.json(
      { error: "Gemini returned an invalid hint payload." },
      { status: 502 },
    );
  }

  return NextResponse.json({ hint });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AIRequest;

    if (body.type !== "lesson" && body.type !== "hint") {
      return NextResponse.json({ error: "Invalid request type." }, { status: 400 });
    }

    return await callGemini(body);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate AI response." },
      { status: 500 },
    );
  }
}
