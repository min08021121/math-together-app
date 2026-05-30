"use client";

import { signInAnonymously } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type SVGProps } from "react";

import { auth, db } from "@/lib/firebase";

type Screen = "login" | "student-home" | "study-picker" | "lesson" | "teacher";
type StudyMode = "self" | "homework";
type TeacherTab = "progress" | "assignment" | "students";
type AIRequest =
  | { type: "lesson"; concept: string }
  | { type: "hint"; concept: string; problem: LessonProblem; attempt: 1 | 2 };

type IconName =
  | "arrowLeft"
  | "book"
  | "brain"
  | "check"
  | "chevronRight"
  | "clipboard"
  | "home"
  | "lightbulb"
  | "lock"
  | "logout"
  | "person"
  | "plus"
  | "send"
  | "sparkles"
  | "teacher"
  | "x";

interface Assignment {
  id: string;
  concept: string;
  assignedAt: string;
  completed: boolean;
}

interface LearningRecord {
  id: string;
  concept: string;
  question: string;
  correctAnswer: string;
  attempts: number;
  wrongAnswers: string[];
  isFailed: boolean;
  isCorrect: boolean;
}

interface Student {
  id: string;
  name: string;
  grade: string;
  password: string;
  assignments: Assignment[];
  records: LearningRecord[];
}

interface TeacherAccount {
  name: string;
  password: string;
}

interface LessonProblem {
  id: string;
  question: string;
  answer: string;
  input: string;
  attempts: number;
  wrongAnswers: string[];
  isFailed: boolean;
  isCorrect: boolean;
  feedback: string;
  hint: string;
  hintLoading: boolean;
}

interface LessonData {
  concept: string;
  explanation: string;
  problems: LessonProblem[];
}

interface LessonAIResponse {
  explanation: string;
  problems: Array<Pick<LessonProblem, "id" | "question" | "answer">>;
}

const initialStudents: Student[] = [
  {
    id: "student-1",
    name: "민준",
    grade: "4학년",
    password: "1234",
    assignments: [
      { id: "assignment-1", concept: "분수의 덧셈", assignedAt: "5월 29일", completed: false },
      { id: "assignment-2", concept: "두 자리 수 곱셈", assignedAt: "5월 27일", completed: true },
    ],
    records: [
      {
        id: "seed-1",
        concept: "두 자리 수 곱셈",
        question: "문구점에서 24개씩 든 연필 상자 3개를 샀어요. 연필은 모두 몇 개인가요?",
        correctAnswer: "72",
        attempts: 2,
        wrongAnswers: ["62"],
        isFailed: false,
        isCorrect: true,
      },
      {
        id: "seed-2",
        concept: "나눗셈",
        question: "사탕 84개를 7명에게 똑같이 나누면 한 명당 몇 개를 받나요?",
        correctAnswer: "12",
        attempts: 3,
        wrongAnswers: ["14", "11", "10"],
        isFailed: true,
        isCorrect: false,
      },
    ],
  },
  {
    id: "student-2",
    name: "서연",
    grade: "3학년",
    password: "1234",
    assignments: [
      { id: "assignment-3", concept: "세 자리 수 뺄셈", assignedAt: "5월 28일", completed: false },
    ],
    records: [
      {
        id: "seed-3",
        concept: "세 자리 수 덧셈",
        question: "도서관에 동화책이 238권, 과학책이 145권 있어요. 책은 모두 몇 권인가요?",
        correctAnswer: "383",
        attempts: 1,
        wrongAnswers: [],
        isFailed: false,
        isCorrect: true,
      },
    ],
  },
  {
    id: "student-3",
    name: "지우",
    grade: "5학년",
    password: "1234",
    assignments: [
      { id: "assignment-4", concept: "소수의 크기 비교", assignedAt: "5월 29일", completed: false },
      { id: "assignment-5", concept: "분수의 덧셈", assignedAt: "5월 26일", completed: false },
    ],
    records: [],
  },
  {
    id: "student-4",
    name: "하준",
    grade: "4학년",
    password: "1234",
    assignments: [],
    records: [],
  },
];

const DEMO_STORAGE_KEY = "math-together-demo-students";
const DEMO_TEACHER_STORAGE_KEY = "math-together-demo-teacher";
const DEMO_FIRESTORE_DOC = "mathTogetherPrototype";

const normalizeStudents = (students: Student[]) =>
  students.map((student) => ({
    ...student,
    password: student.password || "1234",
    assignments: Array.isArray(student.assignments) ? student.assignments : [],
    records: Array.isArray(student.records) ? student.records : [],
  }));

const isTeacherAccount = (value: unknown): value is TeacherAccount => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as TeacherAccount;
  return typeof candidate.name === "string" && typeof candidate.password === "string";
};

const lessonBank: Record<string, LessonAIResponse> = {
  "분수의 덧셈": {
    explanation:
      "분수의 덧셈은 조각의 크기를 먼저 똑같이 맞추는 것이 중요해요.\n분모가 같으면 분자는 서로 더하고, 분모는 그대로 두어요.\n예를 들어 1/5 + 2/5는 같은 크기의 조각을 모두 3개 모은 것이니 3/5이에요.\n피자 조각을 떠올리면 더 쉽게 이해할 수 있어요! 🍕",
    problems: [
      { id: "fraction-1", question: "유나는 피자의 1/5을, 동생은 2/5를 먹었어요. 둘이 먹은 피자는 모두 얼마인가요?", answer: "3/5" },
      { id: "fraction-2", question: "리본 2/7m와 3/7m를 이어 붙였어요. 리본은 모두 몇 m인가요?", answer: "5/7" },
      { id: "fraction-3", question: "물병의 물을 오전에 1/6, 오후에 4/6만큼 마셨어요. 모두 얼마만큼 마셨나요?", answer: "5/6" },
      { id: "fraction-4", question: "책을 어제 3/8, 오늘 2/8만큼 읽었어요. 읽은 양은 모두 얼마인가요?", answer: "5/8" },
      { id: "fraction-5", question: "찰흙의 2/9로 별을, 4/9로 하트를 만들었어요. 사용한 찰흙은 모두 얼마인가요?", answer: "6/9" },
    ],
  },
  "두 자리 수 곱셈": {
    explanation:
      "곱셈은 같은 수를 여러 번 더할 때 빠르게 계산하는 방법이에요.\n두 자리 수를 곱할 때는 일의 자리와 십의 자리를 차근차근 나누어 생각해요.\n예를 들어 24 x 3은 20 x 3과 4 x 3을 더하면 72가 돼요.\n작은 단계부터 시작하면 어렵지 않아요! ✨",
    problems: [
      { id: "multiply-1", question: "한 상자에 귤이 23개씩 있어요. 4상자에는 귤이 모두 몇 개인가요?", answer: "92" },
      { id: "multiply-2", question: "학급마다 색연필을 32자루씩 나누어 주려고 해요. 3학급에는 몇 자루가 필요한가요?", answer: "96" },
      { id: "multiply-3", question: "줄넘기를 하루에 14번씩 6일 동안 연습했어요. 모두 몇 번 했나요?", answer: "84" },
      { id: "multiply-4", question: "책장 한 칸에 책을 21권씩 꽂았어요. 4칸에 꽂은 책은 모두 몇 권인가요?", answer: "84" },
      { id: "multiply-5", question: "스티커가 12장씩 든 봉투를 7개 샀어요. 스티커는 모두 몇 장인가요?", answer: "84" },
    ],
  },
  "세 자리 수 뺄셈": {
    explanation:
      "세 자리 수 뺄셈은 일의 자리부터 차례대로 계산해요.\n위의 수가 더 작아서 뺄 수 없다면 바로 왼쪽 자리에서 10을 빌려오면 돼요.\n빌려온 자리의 수가 1만큼 작아지는 것도 꼭 기억해요.\n천천히 자리끼리 맞춰 쓰면 잘할 수 있어요! 😊",
    problems: [
      { id: "subtract-1", question: "도서관에 책이 425권 있었는데 132권을 빌려주었어요. 남은 책은 몇 권인가요?", answer: "293" },
      { id: "subtract-2", question: "운동회에 물병 580개를 준비했고 245개를 나누어 주었어요. 남은 물병은 몇 개인가요?", answer: "335" },
      { id: "subtract-3", question: "저금통에 763원이 있었는데 318원을 사용했어요. 남은 돈은 얼마인가요?", answer: "445" },
      { id: "subtract-4", question: "농장에 사과가 904개 있었는데 276개를 팔았어요. 남은 사과는 몇 개인가요?", answer: "628" },
      { id: "subtract-5", question: "퍼즐 조각 651개 중 187개를 맞췄어요. 남은 조각은 몇 개인가요?", answer: "464" },
    ],
  },
  "소수의 크기 비교": {
    explanation:
      "소수의 크기를 비교할 때는 자연수 부분부터 살펴봐요.\n자연수 부분이 같다면 소수 첫째 자리, 둘째 자리 순서로 비교해요.\n빈 자리에는 0이 있다고 생각하면 더 쉬워요. 예를 들어 0.5는 0.50과 같아요.\n숫자를 줄 맞춰 쓰면 금방 찾을 수 있어요! 🔎",
    problems: [
      { id: "decimal-1", question: "주스가 0.7L와 0.5L 있어요. 더 많은 양을 숫자로 써 보세요.", answer: "0.7" },
      { id: "decimal-2", question: "리본 길이가 1.25m와 1.3m예요. 더 긴 리본의 길이는 얼마인가요?", answer: "1.3" },
      { id: "decimal-3", question: "수영 기록이 2.08초와 2.8초예요. 더 큰 수를 써 보세요.", answer: "2.8" },
      { id: "decimal-4", question: "화분의 높이가 0.42m와 0.39m예요. 더 높은 화분의 높이는 얼마인가요?", answer: "0.42" },
      { id: "decimal-5", question: "연필 길이가 1.05dm와 1.15dm예요. 더 긴 연필의 길이는 얼마인가요?", answer: "1.15" },
    ],
  },
};

const fallbackLesson = (concept: string): LessonAIResponse => ({
  explanation: `${concept}은(는) 수학에서 꼭 알아두면 좋은 개념이에요.\n문장을 천천히 읽고, 무엇을 구해야 하는지 먼저 찾아봐요.\n그다음 알고 있는 숫자를 식으로 차근차근 정리하면 돼요.\n우리 일상 속 장면을 떠올리며 함께 연습해 봐요! 😊`,
  problems: [
    { id: "fallback-1", question: "바구니에 사과가 12개 있었는데 7개를 더 담았어요. 사과는 모두 몇 개인가요?", answer: "19" },
    { id: "fallback-2", question: "친구 4명에게 연필을 3자루씩 나누어 주려 해요. 연필은 모두 몇 자루가 필요한가요?", answer: "12" },
    { id: "fallback-3", question: "쿠키 25개 중 8개를 먹었어요. 남은 쿠키는 몇 개인가요?", answer: "17" },
    { id: "fallback-4", question: "책을 어제 15쪽, 오늘 18쪽 읽었어요. 모두 몇 쪽을 읽었나요?", answer: "33" },
    { id: "fallback-5", question: "사탕 20개를 5명에게 똑같이 나누면 한 명당 몇 개를 받나요?", answer: "4" },
  ],
});

async function fetchAIResponse(request: AIRequest): Promise<LessonAIResponse | string> {
  // Gemini API 연결 시 아래 messages 배열의 system 규칙을 서버 API Route에 전달합니다.
  const messages = [
    {
      role: "system",
      content: [
        "너는 초등학생(8~13세)을 다정하게 가르치는 친절한 수학 선생님이야.",
        "반드시 초등학교 교육과정 내의 개념과 수준(두/세 자리 수 계산 등)만 사용해.",
        "단순 수식보다는 초등학생의 일상생활이 반영된 스토리텔링형 문장제 문제를 출제해.",
        "~요, ~해요 같은 친절한 존댓말과 이모티콘을 사용해.",
        "학생이 틀렸을 때 바로 정답을 주지 말고, 단계별로 비계(Scaffolding)를 설정하여 2번의 힌트만 질문 형태로 제공해.",
      ].join("\n"),
    },
    { role: "user", content: request },
  ];

  void messages;

  try {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (response.ok) {
      const payload = await response.json();

      if (request.type === "lesson") {
        return payload as LessonAIResponse;
      }

      if (typeof payload.hint === "string") {
        return payload.hint;
      }
    }
  } catch {
    // Gemini가 아직 설정되지 않았거나 일시 실패하면 아래 Mock 응답으로 시연 흐름을 유지합니다.
  }

  await new Promise((resolve) => setTimeout(resolve, request.type === "lesson" ? 850 : 650));

  if (request.type === "lesson") {
    return lessonBank[request.concept] ?? fallbackLesson(request.concept);
  }

  if (request.attempt === 1) {
    return `힌트 1 💡 문제에서 구하려는 것은 무엇이고, 먼저 어떤 숫자들을 사용해야 할까요?`;
  }

  return `힌트 2 ✨ 첫 계산부터 함께 해볼까요? 문제의 숫자를 식에 넣고 가장 오른쪽 자리부터 계산해 보세요.`;
}

function Icon({ name, className = "h-5 w-5", ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  const paths: Record<IconName, ReactNode> = {
    arrowLeft: <path d="m15 18-6-6 6-6" />,
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></>,
    brain: <><path d="M9.5 4A2.5 2.5 0 0 0 7 6.5a2.5 2.5 0 0 0-2.1 3.85A3 3 0 0 0 6 16a3 3 0 0 0 5.5 1.7V6.5A2.5 2.5 0 0 0 9.5 4Z" /><path d="M14.5 4A2.5 2.5 0 0 1 17 6.5a2.5 2.5 0 0 1 2.1 3.85A3 3 0 0 1 18 16a3 3 0 0 1-5.5 1.7V6.5A2.5 2.5 0 0 1 14.5 4Z" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevronRight: <path d="m9 18 6-6-6-6" />,
    clipboard: <><rect width="14" height="16" x="5" y="4" rx="2" /><path d="M9 4V2h6v2M9 10h6m-6 4h6" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
    lightbulb: <><path d="M9 18h6m-5 4h4" /><path d="M8.4 14.5a6 6 0 1 1 7.2 0c-.96.72-1.6 1.4-1.6 2.5h-4c0-1.1-.64-1.78-1.6-2.5Z" /></>,
    lock: <><rect width="14" height="11" x="5" y="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5m5 5H9" /></>,
    person: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    plus: <path d="M12 5v14m-7-7h14" />,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    sparkles: <><path d="m12 3-1.9 5.1L5 10l5.1 1.9L12 17l1.9-5.1L19 10l-5.1-1.9Z" /><path d="m5 18-.7 1.8L2.5 20.5l1.8.7L5 23l.7-1.8 1.8-.7-1.8-.7Z" /></>,
    teacher: <><path d="M14 2v6h6" /><path d="M4 5a3 3 0 1 0 6 0 3 3 0 0 0-6 0Zm-2 15a5 5 0 0 1 10 0" /><path d="M14 4h6v13h-5" /></>,
    x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      {...props}
    >
      {paths[name]}
    </svg>
  );
}

function GlassCard({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <section className={`rounded-3xl border border-white/20 bg-white/50 shadow-xl shadow-black/5 backdrop-blur-xl ${className}`}>
      {children}
    </section>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`${compact ? "h-10 w-10" : "h-12 w-12"} flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-500 text-white shadow-lg shadow-blue-500/20`}>
        <Icon name="sparkles" className="h-6 w-6" />
      </div>
      <div>
        <p className={`${compact ? "text-base" : "text-lg"} font-black tracking-tight text-slate-900`}>수학같이할래?</p>
        {!compact && <p className="mt-0.5 text-xs font-medium text-slate-500">오늘도 한 걸음씩, 같이 해요</p>}
      </div>
    </div>
  );
}

function AppButton({
  children,
  className = "",
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const variants = {
    primary: "bg-slate-900 text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800",
    secondary: "border border-white/70 bg-white/70 text-slate-700 shadow-sm hover:bg-white",
    ghost: "text-slate-500 hover:bg-white/60 hover:text-slate-800",
    danger: "bg-rose-50 text-rose-600 hover:bg-rose-100",
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function AppHeader({
  title,
  onBack,
  onHome,
  onLogout,
}: {
  title?: string;
  onBack?: () => void;
  onHome?: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <div className="flex min-w-0 items-center gap-3">
        {onBack ? (
          <button aria-label="뒤로 가기" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/50 text-slate-600 transition hover:bg-white/80" onClick={onBack}>
            <Icon name="arrowLeft" />
          </button>
        ) : (
          <Logo compact />
        )}
        {title && <h1 className="truncate text-base font-extrabold text-slate-800 sm:text-lg">{title}</h1>}
      </div>
      <div className="flex items-center gap-1">
        {onHome && (
          <button aria-label="홈으로 가기" className="flex h-10 w-10 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-white/60 hover:text-slate-800" onClick={onHome}>
            <Icon name="home" />
          </button>
        )}
        <button aria-label="로그아웃" className="flex h-10 w-10 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-white/60 hover:text-slate-800" onClick={onLogout}>
          <Icon name="logout" />
        </button>
      </div>
    </header>
  );
}

function LoginScreen({
  hasTeacherAccount,
  onLogin,
}: {
  hasTeacherAccount: boolean;
  onLogin: (role: "student" | "teacher", name: string, password: string) => string | null;
}) {
  const [selectedRole, setSelectedRole] = useState<"student" | "teacher" | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const chooseRole = (role: "student" | "teacher") => {
    setSelectedRole(role);
    setName("");
    setPassword("");
    setError("");
  };

  const login = () => {
    if (!selectedRole) {
      setError("학생 또는 선생님을 먼저 선택해 주세요.");
      return;
    }

    if (!name.trim() || !password.trim()) {
      setError("이름과 비밀번호를 모두 입력해 주세요.");
      return;
    }
    const loginError = onLogin(selectedRole, name.trim(), password.trim());
    setError(loginError ?? "");
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <GlassCard className="p-6 sm:p-8">
          <div className="mb-7">
            <span className="mb-3 inline-flex rounded-full bg-blue-50/80 px-3 py-1 text-xs font-bold text-blue-600">반가워요!</span>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">오늘도 같이 공부해요</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">역할을 선택한 뒤 받은 이름과 비밀번호로 들어가 주세요.</p>
          </div>
          {selectedRole === "teacher" && !hasTeacherAccount && (
            <div className="mb-5 rounded-2xl bg-violet-50/80 p-4 text-sm font-bold leading-6 text-violet-700">
              아직 교사 계정이 없어요. 지금 입력하는 이름과 비밀번호가 첫 교사 계정으로 설정됩니다.
            </div>
          )}
          <div className="mb-5 grid grid-cols-2 gap-3">
            <button
              className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${selectedRole === "student" ? "border-blue-300 bg-blue-50 text-blue-700 ring-4 ring-blue-100/70" : "border-white/60 bg-white/60 text-slate-500 hover:bg-white"}`}
              onClick={() => chooseRole("student")}
              type="button"
            >
              학생
            </button>
            <button
              className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${selectedRole === "teacher" ? "border-violet-300 bg-violet-50 text-violet-700 ring-4 ring-violet-100/70" : "border-white/60 bg-white/60 text-slate-500 hover:bg-white"}`}
              onClick={() => chooseRole("teacher")}
              type="button"
            >
              선생님
            </button>
          </div>
          <label className="mb-5 block">
            <span className="mb-2 block text-xs font-bold text-slate-600">이름</span>
            <div className="relative">
              <Icon name="person" className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="w-full rounded-2xl border border-white/60 bg-white/65 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/70" onChange={(event) => setName(event.target.value)} placeholder={selectedRole === "teacher" ? "선생님 이름" : "학생 이름"} value={name} />
            </div>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-bold text-slate-600">비밀번호</span>
            <div className="relative">
              <Icon name="lock" className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="w-full rounded-2xl border border-white/60 bg-white/65 py-3.5 pl-11 pr-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/70" onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호를 입력해 주세요" type="password" value={password} />
            </div>
          </label>
          {error && <p className="mt-3 text-xs font-bold text-rose-500">{error}</p>}
          <div className="mt-7 space-y-3">
            <AppButton className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700" disabled={!selectedRole} onClick={login}>
              <Icon name={selectedRole === "teacher" ? "teacher" : "person"} className="h-4 w-4" />
              {selectedRole === "teacher" ? "선생님으로 로그인" : selectedRole === "student" ? "학생으로 로그인" : "역할을 선택해 주세요"}
            </AppButton>
          </div>
          <p className="mt-6 text-center text-[11px] font-medium text-slate-400">계정 정보는 담당 교사에게 받은 내용을 사용해 주세요.</p>
        </GlassCard>
      </div>
    </main>
  );
}

function StudentHome({
  student,
  onChooseMode,
  onLogout,
}: {
  student: Student;
  onChooseMode: (mode: StudyMode) => void;
  onLogout: () => void;
}) {
  const pendingCount = student.assignments.filter((assignment) => !assignment.completed).length;

  return (
    <>
      <AppHeader onLogout={onLogout} />
      <main className="mx-auto w-full max-w-5xl px-5 pb-12 pt-8 sm:px-8 sm:pt-14">
        <div className="mb-9">
          <p className="mb-3 text-sm font-bold text-blue-600">오늘도 반가워요 👋</p>
          <h1 className="max-w-xl text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-4xl">
            안녕, {student.name}아!<br />
            <span className="text-slate-600">오늘 어떤 공부를 해볼까?</span>
          </h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <button className="group text-left" onClick={() => onChooseMode("self")}>
            <GlassCard className="h-full overflow-hidden p-6 transition duration-300 hover:-translate-y-1 hover:bg-white/70 sm:p-7">
              <div className="mb-10 flex items-start justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100/80 text-blue-600">
                  <Icon name="brain" className="h-7 w-7" />
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/60 text-slate-400 transition group-hover:bg-blue-600 group-hover:text-white">
                  <Icon name="chevronRight" className="h-5 w-5" />
                </span>
              </div>
              <p className="text-xs font-extrabold text-blue-600">내가 골라요</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">혼자 공부하기</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">헷갈렸던 개념을 골라서<br />나만의 문제를 풀어봐요.</p>
            </GlassCard>
          </button>
          <button className="group text-left" onClick={() => onChooseMode("homework")}>
            <GlassCard className="h-full overflow-hidden p-6 transition duration-300 hover:-translate-y-1 hover:bg-white/70 sm:p-7">
              <div className="mb-10 flex items-start justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100/80 text-violet-600">
                  <Icon name="clipboard" className="h-7 w-7" />
                </div>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/60 text-slate-400 transition group-hover:bg-violet-600 group-hover:text-white">
                  <Icon name="chevronRight" className="h-5 w-5" />
                </span>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-extrabold text-violet-600">선생님과 같이 해요</p>
                {pendingCount > 0 && <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-black text-white">{pendingCount}</span>}
              </div>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-900">선생님이 내준 숙제하기</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">선생님이 골라준 개념을<br />차근차근 연습해 봐요.</p>
            </GlassCard>
          </button>
        </div>
      </main>
    </>
  );
}

function StudyPicker({
  mode,
  student,
  loading,
  onBack,
  onLogout,
  onStart,
}: {
  mode: StudyMode;
  student: Student;
  loading: boolean;
  onBack: () => void;
  onLogout: () => void;
  onStart: (concept: string, assignmentId?: string) => void;
}) {
  const [concept, setConcept] = useState("");
  const availableAssignments = student.assignments.filter((assignment) => !assignment.completed);

  return (
    <>
      <AppHeader onBack={onBack} onLogout={onLogout} title={mode === "self" ? "혼자 공부하기" : "내 숙제"} />
      <main className="mx-auto w-full max-w-3xl px-5 pb-12 pt-5 sm:px-8 sm:pt-10">
        <GlassCard className="p-6 sm:p-8">
          {mode === "self" ? (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100/80 text-blue-600">
                <Icon name="brain" className="h-6 w-6" />
              </div>
              <h1 className="mt-6 text-2xl font-black tracking-tight text-slate-900">헷갈리는 수학 개념을 입력해봐!</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">AI 선생님이 쉬운 설명과 연습 문제를 준비해 줄게요.</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <input
                  className="min-w-0 flex-1 rounded-2xl border border-white/70 bg-white/70 px-4 py-3.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/70"
                  onChange={(event) => setConcept(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && concept.trim()) onStart(concept.trim());
                  }}
                  placeholder="예: 분수의 덧셈, 두 자리 수 곱셈"
                  value={concept}
                />
                <AppButton disabled={!concept.trim() || loading} onClick={() => onStart(concept.trim())}>
                  {loading ? "문제 만드는 중..." : "공부 시작하기"} <Icon name="chevronRight" className="h-4 w-4" />
                </AppButton>
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {["분수의 덧셈", "두 자리 수 곱셈", "세 자리 수 뺄셈", "소수의 크기 비교"].map((example) => (
                  <button className="rounded-full bg-white/55 px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-white hover:text-blue-600" key={example} onClick={() => setConcept(example)}>
                    {example}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-extrabold text-violet-600">선생님이 보내준 개념</p>
                  <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900">오늘의 숙제를 골라볼까요?</h1>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-100/80 text-violet-600">
                  <Icon name="clipboard" className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-7 space-y-3">
                {availableAssignments.length ? (
                  availableAssignments.map((assignment) => (
                    <button
                      className="group flex w-full items-center justify-between rounded-2xl border border-white/70 bg-white/60 p-4 text-left transition hover:bg-white/90"
                      disabled={loading}
                      key={assignment.id}
                      onClick={() => onStart(assignment.concept, assignment.id)}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-slate-800">{assignment.concept}</p>
                        <p className="mt-1 text-xs font-medium text-slate-400">{assignment.assignedAt} 선생님이 보냄</p>
                      </div>
                      <span className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-500 transition group-hover:bg-violet-600 group-hover:text-white">
                        <Icon name="chevronRight" className="h-4 w-4" />
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-white bg-white/35 px-5 py-10 text-center">
                    <p className="text-sm font-bold text-slate-600">아직 새로운 숙제가 없어요.</p>
                    <p className="mt-2 text-xs text-slate-400">혼자 공부하기에서 궁금한 개념을 연습해 봐요.</p>
                  </div>
                )}
              </div>
              {loading && <p className="mt-5 text-center text-sm font-bold text-violet-600">AI 선생님이 문제를 만들고 있어요...</p>}
            </>
          )}
        </GlassCard>
      </main>
    </>
  );
}

function LessonScreen({
  lesson,
  onBack,
  onHome,
  onLogout,
  onInput,
  onSubmit,
}: {
  lesson: LessonData;
  onBack: () => void;
  onHome: () => void;
  onLogout: () => void;
  onInput: (problemId: string, value: string) => void;
  onSubmit: (problemId: string) => void;
}) {
  const solvedCount = lesson.problems.filter((problem) => problem.isCorrect).length;
  const finishedCount = lesson.problems.filter((problem) => problem.isCorrect || problem.isFailed).length;
  const progress = (finishedCount / lesson.problems.length) * 100;

  return (
    <>
      <AppHeader onBack={onBack} onHome={onHome} onLogout={onLogout} title={lesson.concept} />
      <main className="mx-auto w-full max-w-3xl px-5 pb-14 pt-4 sm:px-8 sm:pt-8">
        <div className="mb-7">
          <div className="mb-2 flex items-center justify-between text-xs font-extrabold">
            <span className="text-slate-500">오늘의 문제</span>
            <span className="text-blue-600">{finishedCount} / {lesson.problems.length} 완료</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/50">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <GlassCard className="mb-5 overflow-hidden p-6 sm:p-7">
          <div className="flex items-center gap-2 text-blue-600">
            <Icon name="sparkles" className="h-4 w-4" />
            <p className="text-xs font-black">AI 선생님의 개념 설명</p>
          </div>
          <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-900">{lesson.concept}</h1>
          <p className="mt-4 whitespace-pre-line text-sm font-medium leading-7 text-slate-600">{lesson.explanation}</p>
        </GlassCard>
        <div className="space-y-4">
          {lesson.problems.map((problem, index) => {
            const isDone = problem.isCorrect || problem.isFailed;
            return (
              <GlassCard className={`p-5 transition sm:p-6 ${problem.isCorrect ? "ring-2 ring-emerald-200/80" : problem.isFailed ? "ring-2 ring-rose-200/80" : ""}`} key={problem.id}>
                <div className="flex items-start gap-4">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${problem.isCorrect ? "bg-emerald-100 text-emerald-600" : problem.isFailed ? "bg-rose-100 text-rose-600" : "bg-white/80 text-slate-600"}`}>
                    {problem.isCorrect ? <Icon name="check" className="h-4 w-4" /> : problem.isFailed ? <Icon name="x" className="h-4 w-4" /> : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-6 text-slate-700">{problem.question}</p>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <input
                        aria-label={`${index + 1}번 문제 정답`}
                        className="min-w-0 flex-1 rounded-2xl border border-white/70 bg-white/65 px-4 py-3 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/60 disabled:bg-white/30 disabled:text-slate-400"
                        disabled={isDone || problem.hintLoading}
                        onChange={(event) => onInput(problem.id, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && problem.input.trim() && !isDone) onSubmit(problem.id);
                        }}
                        placeholder="정답을 입력해 주세요"
                        value={problem.input}
                      />
                      <AppButton className="sm:px-5" disabled={!problem.input.trim() || isDone || problem.hintLoading} onClick={() => onSubmit(problem.id)}>
                        {problem.hintLoading ? "힌트 준비 중..." : "확인"}
                      </AppButton>
                    </div>
                    {problem.feedback && (
                      <div className={`mt-4 rounded-2xl p-4 text-sm font-bold leading-6 ${problem.isCorrect ? "bg-emerald-50/80 text-emerald-700" : problem.isFailed ? "bg-rose-50/80 text-rose-700" : "bg-amber-50/80 text-amber-700"}`}>
                        {problem.feedback}
                      </div>
                    )}
                    {problem.hint && !problem.isFailed && (
                      <div className="mt-2 flex gap-2 rounded-2xl bg-blue-50/80 p-4 text-sm font-medium leading-6 text-blue-700">
                        <Icon name="lightbulb" className="mt-0.5 h-4 w-4 shrink-0" />
                        <p>{problem.hint}</p>
                      </div>
                    )}
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
        {finishedCount === lesson.problems.length && (
          <GlassCard className="mt-5 p-6 text-center sm:p-7">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <Icon name="sparkles" className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-xl font-black text-slate-900">오늘 공부도 정말 잘했어요!</h2>
            <p className="mt-2 text-sm font-medium text-slate-500">5문제 중 {solvedCount}문제를 스스로 해결했어요.</p>
            <AppButton className="mt-5" onClick={onHome}>학습 홈으로 돌아가기</AppButton>
          </GlassCard>
        )}
      </main>
    </>
  );
}

function TeacherDashboard({
  students,
  teacherAccount,
  onLogout,
  onAddStudent,
  onSendAssignment,
  onUpdateTeacherAccount,
}: {
  students: Student[];
  teacherAccount: TeacherAccount;
  onLogout: () => void;
  onAddStudent: (name: string, grade: string, password: string) => string | null;
  onSendAssignment: (studentId: string, concept: string) => void;
  onUpdateTeacherAccount: (currentPassword: string, name: string, password: string) => string | null;
}) {
  const [selectedId, setSelectedId] = useState(students[0].id);
  const [activeTab, setActiveTab] = useState<TeacherTab>("progress");
  const [concept, setConcept] = useState("");
  const [sentMessage, setSentMessage] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentGrade, setNewStudentGrade] = useState("");
  const [newStudentPassword, setNewStudentPassword] = useState("");
  const [studentMessage, setStudentMessage] = useState("");
  const [teacherName, setTeacherName] = useState(teacherAccount.name);
  const [teacherCurrentPassword, setTeacherCurrentPassword] = useState("");
  const [teacherNewPassword, setTeacherNewPassword] = useState("");
  const [teacherMessage, setTeacherMessage] = useState("");
  const selected = students.find((student) => student.id === selectedId) ?? students[0];
  const failedRecords = selected.records.filter((record) => record.isFailed);

  const send = () => {
    if (!concept.trim()) return;
    onSendAssignment(selected.id, concept.trim());
    setSentMessage(`${selected.name} 학생에게 숙제를 보냈어요.`);
    setConcept("");
  };

  const addStudent = () => {
    const result = onAddStudent(newStudentName.trim(), newStudentGrade.trim(), newStudentPassword.trim());

    if (result) {
      setStudentMessage(result);
      return;
    }

    setStudentMessage(`${newStudentName.trim()} 학생을 추가했어요.`);
    setNewStudentName("");
    setNewStudentGrade("");
    setNewStudentPassword("");
  };

  const updateTeacherAccount = () => {
    const result = onUpdateTeacherAccount(
      teacherCurrentPassword.trim(),
      teacherName.trim(),
      teacherNewPassword.trim(),
    );

    if (result) {
      setTeacherMessage(result);
      return;
    }

    setTeacherMessage("교사 계정 정보를 변경했어요.");
    setTeacherCurrentPassword("");
    setTeacherNewPassword("");
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/30 bg-white/25 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Logo compact />
          <div className="flex items-center gap-3">
            <span className="hidden text-xs font-bold text-slate-500 sm:inline">{teacherAccount.name} 선생님</span>
            <button aria-label="로그아웃" className="flex h-10 w-10 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-white/60 hover:text-slate-800" onClick={onLogout}>
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-6 sm:px-8 lg:grid-cols-[240px_1fr] lg:py-8">
        <GlassCard className="h-fit p-3 lg:sticky lg:top-6">
          <p className="px-3 pb-2 pt-2 text-xs font-black text-slate-400">내 반 학생</p>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
            {students.map((student) => (
              <button
                className={`flex shrink-0 items-center gap-3 rounded-2xl px-3 py-3 text-left transition lg:w-full ${selected.id === student.id ? "bg-slate-900 text-white shadow-lg shadow-slate-900/10" : "text-slate-600 hover:bg-white/60"}`}
                key={student.id}
                onClick={() => {
                  setSelectedId(student.id);
                  setSentMessage("");
                }}
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${selected.id === student.id ? "bg-white/15 text-white" : "bg-white/70 text-slate-500"}`}>{student.name[0]}</span>
                <span>
                  <span className="block text-sm font-extrabold">{student.name}</span>
                  <span className={`block text-[10px] font-bold ${selected.id === student.id ? "text-slate-300" : "text-slate-400"}`}>{student.grade}</span>
                </span>
              </button>
            ))}
          </div>
        </GlassCard>
        <section className="min-w-0">
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-black text-blue-600">학습 관리</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{selected.name} 학생</h1>
            </div>
            <div className="flex w-fit gap-1 rounded-2xl bg-white/45 p-1 backdrop-blur-xl">
              <button className={`rounded-xl px-4 py-2.5 text-xs font-black transition ${activeTab === "progress" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`} onClick={() => setActiveTab("progress")}>학생별 학습 현황</button>
              <button className={`rounded-xl px-4 py-2.5 text-xs font-black transition ${activeTab === "assignment" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`} onClick={() => setActiveTab("assignment")}>숙제 내주기</button>
              <button className={`rounded-xl px-4 py-2.5 text-xs font-black transition ${activeTab === "students" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`} onClick={() => setActiveTab("students")}>학생 추가</button>
            </div>
          </div>
          {activeTab === "progress" ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="풀이한 문제" tone="blue" value={`${selected.records.length}개`} />
                <StatCard label="전체 시도 횟수" tone="violet" value={`${selected.records.reduce((total, record) => total + record.attempts, 0)}회`} />
                <StatCard label="해결 못한 문제" tone="rose" value={`${failedRecords.length}개`} />
              </div>
              <GlassCard className="overflow-hidden">
                <div className="border-b border-white/45 px-5 py-5 sm:px-6">
                  <h2 className="text-base font-black text-slate-900">문제별 풀이 기록</h2>
                  <p className="mt-1 text-xs font-medium text-slate-400">학생이 답을 확인할 때마다 바로 업데이트돼요.</p>
                </div>
                {selected.records.length ? (
                  <div className="divide-y divide-white/45">
                    {selected.records.map((record, index) => (
                      <div className="p-5 sm:p-6" key={record.id}>
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                          <div className="flex min-w-0 gap-3">
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-black ${record.isFailed ? "bg-rose-100 text-rose-600" : record.isCorrect ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"}`}>{index + 1}</span>
                            <div>
                              <p className="text-xs font-black text-blue-600">{record.concept}</p>
                              <p className="mt-1 text-sm font-bold leading-6 text-slate-700">{record.question}</p>
                            </div>
                          </div>
                          <span className={`w-fit shrink-0 rounded-full px-3 py-1 text-[11px] font-black ${record.isFailed ? "bg-rose-100 text-rose-600" : record.isCorrect ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
                            {record.isFailed ? "해결 못함" : record.isCorrect ? "정답" : "풀이 중"}
                          </span>
                        </div>
                        <div className="mt-4 grid gap-3 rounded-2xl bg-white/40 p-4 text-xs sm:grid-cols-[120px_1fr]">
                          <p className="font-black text-slate-500">시도 횟수 <span className="ml-1 text-slate-800">{record.attempts}회</span></p>
                          <div>
                            <p className="font-black text-slate-500">입력했던 오답</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {record.wrongAnswers.length ? record.wrongAnswers.map((answer, answerIndex) => (
                                <span className="rounded-lg bg-rose-50 px-2 py-1 font-bold text-rose-500" key={`${record.id}-${answer}-${answerIndex}`}>{answer}</span>
                              )) : <span className="font-medium text-slate-400">오답 없이 풀었어요.</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="px-5 py-14 text-center">
                    <p className="text-sm font-bold text-slate-600">아직 풀이 기록이 없어요.</p>
                    <p className="mt-2 text-xs text-slate-400">학생이 문제를 풀면 이곳에 바로 표시돼요.</p>
                  </div>
                )}
              </GlassCard>
              {failedRecords.length > 0 && (
                <GlassCard className="border-rose-100/60 bg-rose-50/45 p-5 sm:p-6">
                  <div className="flex items-center gap-2 text-rose-600">
                    <Icon name="lightbulb" className="h-4 w-4" />
                    <h2 className="text-sm font-black">힌트를 다 받고도 풀지 못한 문제</h2>
                  </div>
                  <div className="mt-4 space-y-2">
                    {failedRecords.map((record) => (
                      <div className="rounded-2xl bg-white/55 p-4" key={`failed-${record.id}`}>
                        <p className="text-xs font-black text-rose-500">{record.concept}</p>
                        <p className="mt-1 text-sm font-bold leading-6 text-slate-700">{record.question}</p>
                        <p className="mt-2 text-xs font-bold text-slate-400">정답: {record.correctAnswer}</p>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              )}
            </div>
          ) : activeTab === "assignment" ? (
            <GlassCard className="p-6 sm:p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                <Icon name="send" className="h-5 w-5" />
              </div>
              <h2 className="mt-5 text-2xl font-black tracking-tight text-slate-900">{selected.name} 학생에게 숙제 내주기</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">학생에게 필요한 수학 개념 하나를 골라 보내 주세요.</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <input
                  className="min-w-0 flex-1 rounded-2xl border border-white/70 bg-white/70 px-4 py-3.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100/70"
                  onChange={(event) => setConcept(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") send();
                  }}
                  placeholder="예: 분수의 덧셈"
                  value={concept}
                />
                <AppButton disabled={!concept.trim()} onClick={send}>
                  <Icon name="send" className="h-4 w-4" /> 숙제 전송
                </AppButton>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {["분수의 덧셈", "두 자리 수 곱셈", "세 자리 수 뺄셈", "소수의 크기 비교"].map((example) => (
                  <button className="rounded-full bg-white/55 px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-white hover:text-violet-600" key={example} onClick={() => setConcept(example)}>{example}</button>
                ))}
              </div>
              {sentMessage && <p className="mt-5 rounded-2xl bg-emerald-50/80 p-4 text-sm font-bold text-emerald-700">{sentMessage}</p>}
              <div className="mt-8 border-t border-white/50 pt-6">
                <h3 className="text-sm font-black text-slate-800">보낸 숙제</h3>
                <div className="mt-3 space-y-2">
                  {selected.assignments.length ? selected.assignments.map((assignment) => (
                    <div className="flex items-center justify-between rounded-2xl bg-white/45 px-4 py-3" key={assignment.id}>
                      <div>
                        <p className="text-sm font-bold text-slate-700">{assignment.concept}</p>
                        <p className="mt-1 text-[11px] font-medium text-slate-400">{assignment.assignedAt}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${assignment.completed ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>{assignment.completed ? "완료" : "진행 전"}</span>
                    </div>
                  )) : <p className="rounded-2xl bg-white/35 p-4 text-xs font-medium text-slate-400">아직 보낸 숙제가 없어요.</p>}
                </div>
              </div>
            </GlassCard>
          ) : (
            <div className="space-y-5">
              <GlassCard className="p-6 sm:p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-600">
                  <Icon name="lock" className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-2xl font-black tracking-tight text-slate-900">교사 계정 관리</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">교사 이름과 비밀번호는 Firestore에 저장되고, 다음 로그인부터 바로 적용돼요.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <input
                    className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100/70"
                    onChange={(event) => setTeacherName(event.target.value)}
                    placeholder="교사 이름"
                    value={teacherName}
                  />
                  <input
                    className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100/70"
                    onChange={(event) => setTeacherCurrentPassword(event.target.value)}
                    placeholder="현재 비밀번호"
                    type="password"
                    value={teacherCurrentPassword}
                  />
                  <input
                    className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:bg-white focus:ring-4 focus:ring-violet-100/70"
                    onChange={(event) => setTeacherNewPassword(event.target.value)}
                    placeholder="새 비밀번호"
                    type="password"
                    value={teacherNewPassword}
                  />
                </div>
                <AppButton className="mt-4" disabled={!teacherName.trim() || !teacherCurrentPassword.trim() || !teacherNewPassword.trim()} onClick={updateTeacherAccount}>
                  <Icon name="check" className="h-4 w-4" /> 교사 계정 변경
                </AppButton>
                {teacherMessage && <p className="mt-5 rounded-2xl bg-violet-50/80 p-4 text-sm font-bold text-violet-700">{teacherMessage}</p>}
              </GlassCard>

              <GlassCard className="p-6 sm:p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                  <Icon name="plus" className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-2xl font-black tracking-tight text-slate-900">새 학생 추가</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">학생 이름, 학년, 임시 비밀번호를 등록하면 바로 로그인할 수 있어요.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <input
                    className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/70"
                    onChange={(event) => setNewStudentName(event.target.value)}
                    placeholder="학생 이름"
                    value={newStudentName}
                  />
                  <input
                    className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/70"
                    onChange={(event) => setNewStudentGrade(event.target.value)}
                    placeholder="학년"
                    value={newStudentGrade}
                  />
                  <input
                    className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3.5 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100/70"
                    onChange={(event) => setNewStudentPassword(event.target.value)}
                    placeholder="임시 비밀번호"
                    type="password"
                    value={newStudentPassword}
                  />
                </div>
                <AppButton className="mt-4" disabled={!newStudentName.trim() || !newStudentGrade.trim() || !newStudentPassword.trim()} onClick={addStudent}>
                  <Icon name="plus" className="h-4 w-4" /> 학생 추가
                </AppButton>
                {studentMessage && <p className="mt-5 rounded-2xl bg-emerald-50/80 p-4 text-sm font-bold text-emerald-700">{studentMessage}</p>}
                <div className="mt-8 border-t border-white/50 pt-6">
                  <h3 className="text-sm font-black text-slate-800">등록된 학생</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {students.map((student) => (
                      <div className="rounded-2xl bg-white/45 px-4 py-3" key={`student-card-${student.id}`}>
                        <p className="text-sm font-bold text-slate-700">{student.name}</p>
                        <p className="mt-1 text-[11px] font-medium text-slate-400">{student.grade} · 비밀번호 {student.password}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </GlassCard>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, tone, value }: { label: string; tone: "blue" | "violet" | "rose"; value: string }) {
  const tones = {
    blue: "bg-blue-100/80 text-blue-600",
    violet: "bg-violet-100/80 text-violet-600",
    rose: "bg-rose-100/80 text-rose-600",
  };

  return (
    <GlassCard className="p-5">
      <p className="text-xs font-black text-slate-400">{label}</p>
      <p className={`mt-3 w-fit rounded-xl px-3 py-1.5 text-xl font-black ${tones[tone]}`}>{value}</p>
    </GlassCard>
  );
}

const createLesson = (response: LessonAIResponse, concept: string): LessonData => ({
  concept,
  explanation: response.explanation,
  problems: response.problems.map((problem) => ({
    ...problem,
    id: `${problem.id}-${Date.now()}`,
    input: "",
    attempts: 0,
    wrongAnswers: [],
    isFailed: false,
    isCorrect: false,
    feedback: "",
    hint: "",
    hintLoading: false,
  })),
});

const normalizeAnswer = (answer: string) => answer.replace(/\s|,/g, "").toLowerCase();

export default function HomePage() {
  const [screen, setScreen] = useState<Screen>("login");
  const [students, setStudents] = useState<Student[]>(() => {
    if (typeof window === "undefined") return normalizeStudents(initialStudents);

    try {
      const savedStudents = window.localStorage.getItem(DEMO_STORAGE_KEY);
      if (!savedStudents) return normalizeStudents(initialStudents);

      const parsedStudents = JSON.parse(savedStudents) as Student[];
      return Array.isArray(parsedStudents) && parsedStudents.length > 0
        ? normalizeStudents(parsedStudents)
        : normalizeStudents(initialStudents);
    } catch {
      window.localStorage.removeItem(DEMO_STORAGE_KEY);
      return normalizeStudents(initialStudents);
    }
  });
  const [teacherAccount, setTeacherAccount] = useState<TeacherAccount | null>(() => {
    if (typeof window === "undefined") return null;

    try {
      const savedTeacher = window.localStorage.getItem(DEMO_TEACHER_STORAGE_KEY);
      if (!savedTeacher) return null;

      const parsedTeacher = JSON.parse(savedTeacher) as unknown;
      return isTeacherAccount(parsedTeacher) && parsedTeacher.name && parsedTeacher.password
        ? parsedTeacher
        : null;
    } catch {
      window.localStorage.removeItem(DEMO_TEACHER_STORAGE_KEY);
      return null;
    }
  });
  const [currentStudentId, setCurrentStudentId] = useState(initialStudents[0].id);
  const [studyMode, setStudyMode] = useState<StudyMode>("self");
  const [lesson, setLesson] = useState<LessonData | null>(null);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [firestoreReady, setFirestoreReady] = useState(false);
  const [syncMessage, setSyncMessage] = useState("브라우저에 저장 중");
  const applyingRemoteStudents = useRef(false);
  const applyingRemoteTeacher = useRef(false);
  const initialStudentsForFirestore = useRef(students);
  const initialTeacherForFirestore = useRef(teacherAccount);
  const currentStudent = useMemo(
    () => students.find((student) => student.id === currentStudentId) ?? students[0] ?? initialStudents[0],
    [currentStudentId, students],
  );

  useEffect(() => {
    let unsubscribe: undefined | (() => void);
    let canceled = false;

    async function connectFirestore() {
      try {
        await signInAnonymously(auth);
        if (canceled) return;

        const demoRef = doc(db, "demoApps", DEMO_FIRESTORE_DOC);
        unsubscribe = onSnapshot(
          demoRef,
          async (snapshot) => {
            if (!snapshot.exists()) {
              await setDoc(demoRef, {
                students: initialStudentsForFirestore.current,
                teacherAccount: initialTeacherForFirestore.current,
                updatedAt: serverTimestamp(),
              });
              return;
            }

            const remoteData = snapshot.data();
            const remoteStudents = remoteData.students;
            if (Array.isArray(remoteStudents) && remoteStudents.length > 0) {
              applyingRemoteStudents.current = true;
              setStudents(normalizeStudents(remoteStudents as Student[]));
            }
            if (isTeacherAccount(remoteData.teacherAccount) && remoteData.teacherAccount.name && remoteData.teacherAccount.password) {
              applyingRemoteTeacher.current = true;
              setTeacherAccount(remoteData.teacherAccount);
            }
            setFirestoreReady(true);
            setSyncMessage("Firestore 연결됨");
          },
          (error) => {
            setFirestoreReady(false);
            setSyncMessage(
              error.code === "permission-denied"
                ? "Firestore 규칙 배포 필요"
                : "브라우저에 저장 중",
            );
          },
        );
      } catch (error) {
        setFirestoreReady(false);
        setSyncMessage(
          error instanceof Error && error.message.includes("auth/operation-not-allowed")
            ? "익명 인증 켜기 필요"
            : "브라우저에 저장 중",
        );
      }
    }

    void connectFirestore();

    return () => {
      canceled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(students));
      if (teacherAccount) {
        window.localStorage.setItem(DEMO_TEACHER_STORAGE_KEY, JSON.stringify(teacherAccount));
      } else {
        window.localStorage.removeItem(DEMO_TEACHER_STORAGE_KEY);
      }
    } catch {
      // The demo remains usable in browsers that block local storage.
    }

    if (applyingRemoteStudents.current || applyingRemoteTeacher.current) {
      applyingRemoteStudents.current = false;
      applyingRemoteTeacher.current = false;
      return;
    }

    if (!firestoreReady) return;

    void setDoc(
      doc(db, "demoApps", DEMO_FIRESTORE_DOC),
      {
        students,
        teacherAccount,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }, [firestoreReady, students, teacherAccount]);

  const logout = () => {
    setScreen("login");
    setLesson(null);
  };

  const login = (role: "student" | "teacher", name: string, password: string) => {
    if (role === "teacher") {
      if (!teacherAccount) {
        setTeacherAccount({ name, password });
        setScreen("teacher");
        return null;
      }

      if (teacherAccount.name !== name || teacherAccount.password !== password) {
        return "선생님 이름 또는 비밀번호가 맞지 않아요.";
      }

      setScreen("teacher");
      return null;
    }
    const matchingStudent = students.find((student) => student.name === name);

    if (!matchingStudent) {
      return "등록된 학생 이름이 아니에요.";
    }

    if (matchingStudent.password !== password) {
      return "학생 비밀번호가 맞지 않아요.";
    }

    setCurrentStudentId(matchingStudent.id);
    setScreen("student-home");
    return null;
  };

  const startLesson = async (concept: string, assignmentId?: string) => {
    if (!concept) return;
    setLessonLoading(true);
    const response = await fetchAIResponse({ type: "lesson", concept });
    if (typeof response !== "string") {
      setLesson(createLesson(response, concept));
      if (assignmentId) {
        setStudents((previous) =>
          previous.map((student) =>
            student.id === currentStudentId
              ? {
                  ...student,
                  assignments: student.assignments.map((assignment) =>
                    assignment.id === assignmentId ? { ...assignment, completed: true } : assignment,
                  ),
                }
              : student,
          ),
        );
      }
      setScreen("lesson");
    }
    setLessonLoading(false);
  };

  const updateLessonProblem = (problemId: string, updater: (problem: LessonProblem) => LessonProblem) => {
    setLesson((previous) =>
      previous
        ? { ...previous, problems: previous.problems.map((problem) => (problem.id === problemId ? updater(problem) : problem)) }
        : previous,
    );
  };

  const recordAttempt = (problem: LessonProblem, input: string, nextAttempts: number, isCorrect: boolean, isFailed: boolean) => {
    setStudents((previous) =>
      previous.map((student) => {
        if (student.id !== currentStudentId) return student;
        const existing = student.records.find((record) => record.id === problem.id);
        const wrongAnswers = isCorrect ? existing?.wrongAnswers ?? [] : [...(existing?.wrongAnswers ?? []), input];
        const updatedRecord: LearningRecord = {
          id: problem.id,
          concept: lesson?.concept ?? "",
          question: problem.question,
          correctAnswer: problem.answer,
          attempts: nextAttempts,
          wrongAnswers,
          isFailed,
          isCorrect,
        };
        return {
          ...student,
          records: existing
            ? student.records.map((record) => (record.id === problem.id ? updatedRecord : record))
            : [...student.records, updatedRecord],
        };
      }),
    );
  };

  const submitAnswer = async (problemId: string) => {
    const problem = lesson?.problems.find((item) => item.id === problemId);
    if (!problem || !problem.input.trim() || problem.isCorrect || problem.isFailed || problem.hintLoading) return;

    const input = problem.input.trim();
    const nextAttempts = problem.attempts + 1;
    const isCorrect = normalizeAnswer(input) === normalizeAnswer(problem.answer);
    const isFailed = !isCorrect && nextAttempts >= 3;
    recordAttempt(problem, input, nextAttempts, isCorrect, isFailed);

    if (isCorrect) {
      updateLessonProblem(problemId, (current) => ({
        ...current,
        attempts: nextAttempts,
        isCorrect: true,
        feedback: "정답이에요! 정말 잘했어요 😊",
      }));
      return;
    }

    if (isFailed) {
      updateLessonProblem(problemId, (current) => ({
        ...current,
        attempts: nextAttempts,
        wrongAnswers: [...current.wrongAnswers, input],
        isFailed: true,
        feedback: `아쉽네요, 정답은 ${current.answer}입니다. 다음 문제에서 다시 힘내봐요!`,
      }));
      return;
    }

    updateLessonProblem(problemId, (current) => ({
      ...current,
      attempts: nextAttempts,
      wrongAnswers: [...current.wrongAnswers, input],
      feedback: "다시 해볼까요?",
      hintLoading: true,
    }));
    const hint = await fetchAIResponse({
      type: "hint",
      concept: lesson?.concept ?? "",
      problem,
      attempt: nextAttempts as 1 | 2,
    });
    if (typeof hint === "string") {
      updateLessonProblem(problemId, (current) => ({ ...current, hint, hintLoading: false, input: "" }));
    }
  };

  const sendAssignment = (studentId: string, concept: string) => {
    setStudents((previous) =>
      previous.map((student) =>
        student.id === studentId
          ? {
              ...student,
              assignments: [
                {
                  id: `assignment-${Date.now()}`,
                  concept,
                  assignedAt: "방금 전",
                  completed: false,
                },
                ...student.assignments,
              ],
            }
          : student,
      ),
    );
  };

  const addStudent = (name: string, grade: string, password: string) => {
    if (!name || !grade || !password) {
      return "이름, 학년, 비밀번호를 모두 입력해 주세요.";
    }

    if (students.some((student) => student.name === name)) {
      return "이미 등록된 학생 이름이에요.";
    }

    const newStudent: Student = {
      id: `student-${Date.now()}`,
      name,
      grade,
      password,
      assignments: [],
      records: [],
    };

    setStudents((previous) => [...previous, newStudent]);
    setCurrentStudentId(newStudent.id);
    return null;
  };

  const updateTeacherAccount = (currentPassword: string, name: string, password: string) => {
    if (!teacherAccount) {
      return "먼저 교사 계정을 설정해 주세요.";
    }

    if (!currentPassword || !name || !password) {
      return "교사 이름, 현재 비밀번호, 새 비밀번호를 모두 입력해 주세요.";
    }

    if (teacherAccount.password !== currentPassword) {
      return "현재 비밀번호가 맞지 않아요.";
    }

    setTeacherAccount({ name, password });
    return null;
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f9fafb] font-sans text-slate-800 antialiased">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(191,219,254,0.78),transparent_32%),radial-gradient(circle_at_85%_20%,rgba(221,214,254,0.75),transparent_34%),radial-gradient(circle_at_55%_90%,rgba(224,231,255,0.78),transparent_38%)]" />
      <div className={`fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border px-3 py-1.5 text-[11px] font-black shadow-lg backdrop-blur-xl ${firestoreReady ? "border-emerald-200 bg-emerald-50/80 text-emerald-700" : "border-white/50 bg-white/70 text-slate-500"}`}>
        {syncMessage}
      </div>
      <div className="relative">
        {screen === "login" && <LoginScreen hasTeacherAccount={Boolean(teacherAccount)} onLogin={login} />}
        {screen === "student-home" && <StudentHome onChooseMode={(mode) => { setStudyMode(mode); setScreen("study-picker"); }} onLogout={logout} student={currentStudent} />}
        {screen === "study-picker" && <StudyPicker loading={lessonLoading} mode={studyMode} onBack={() => setScreen("student-home")} onLogout={logout} onStart={startLesson} student={currentStudent} />}
        {screen === "lesson" && lesson && (
          <LessonScreen
            lesson={lesson}
            onBack={() => setScreen("study-picker")}
            onHome={() => setScreen("student-home")}
            onInput={(problemId, value) => updateLessonProblem(problemId, (problem) => ({ ...problem, input: value }))}
            onLogout={logout}
            onSubmit={submitAnswer}
          />
        )}
        {screen === "teacher" && teacherAccount && (
          <TeacherDashboard
            onAddStudent={addStudent}
            onLogout={logout}
            onSendAssignment={sendAssignment}
            onUpdateTeacherAccount={updateTeacherAccount}
            students={students}
            teacherAccount={teacherAccount}
          />
        )}
      </div>
    </div>
  );
}
