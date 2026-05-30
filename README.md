# 수학같이할래?

초등학생과 담당 교사를 위한 수학 학습 앱 초안입니다.  
`Next.js + React + Tailwind CSS + Firebase` 구성을 기준으로 만들었습니다.

## 현재 구현 상태

메인 앱은 [src/app/page.tsx](src/app/page.tsx)에 단일 파일 프로토타입으로 구현되어 있습니다.

- 이름과 비밀번호만 사용하는 로그인 UI
- 학생용 혼자 공부하기, 개별 숙제하기
- AI 개념 설명과 5개 맞춤형 문제 생성 시뮬레이션
- 오답 1회, 2회 힌트와 3회 실패 처리
- 교사용 학생별 attempts, wrongAnswers, isFailed 확인
- 학생 개개인에게 개념 숙제 전송
- 새로고침 후에도 시연 상태가 남도록 localStorage 저장

기존 `/auth/login`, `/auth/signup`, `/student`, `/teacher` 경로는 이전 이메일 로그인 MVP와 충돌하지 않도록 `/`로 연결됩니다.

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## Firebase 연결

현재 UI는 API 키 없이 바로 확인할 수 있는 프론트엔드 초안입니다. Firebase 연결을 진행할 때는 다음 순서로 옮기면 됩니다.

1. `.env.local.example`을 참고해 `.env.local`에 Firebase 웹 앱 설정값을 넣습니다.
2. Firebase 콘솔에서 Firestore Database를 생성합니다.
3. 아래 명령으로 보안 규칙과 인덱스를 배포합니다.

```bash
firebase deploy --only firestore
```

새 학습 기능을 위해 아래 컬렉션이 추가되어 있습니다.

### `conceptAssignments/{assignmentId}`

학생 개개인에게 전송하는 수학 개념 숙제입니다.

```ts
{
  studentId: string;
  teacherId: string;
  concept: string;
  status: "pending" | "completed";
  assignedAt: Timestamp;
  completedAt: Timestamp | null;
}
```

### `learningRecords/{recordId}`

문제별 풀이 기록입니다. 교사 화면의 시도 횟수, 입력했던 오답, 최종 실패 목록에 사용합니다.

```ts
{
  studentId: string;
  teacherId: string;
  concept: string;
  question: string;
  correctAnswer: string;
  attempts: number;
  wrongAnswers: string[];
  isFailed: boolean;
  isCorrect: boolean;
  updatedAt: Timestamp;
}
```

기존 `users`, `teacherInvites`, `groups`, `homeworks`, `assignments` 컬렉션은 마이그레이션 중 데이터 손실을 막기 위해 유지합니다.

현재 규칙은 학생이 자신의 풀이 기록만 만들고, 제출마다 `attempts`가 1씩 증가하도록 제한합니다. 운영 단계에서는 정답 판정과 기록 저장을 Gemini 서버 API 쪽으로 옮겨 클라이언트 조작 가능성도 제거하세요.

## 이름 로그인 주의점

Firebase Authentication의 기본 비밀번호 로그인은 이메일과 비밀번호를 사용합니다. 이 앱은 학생 UI에서 이메일을 받지 않아야 하므로, 운영 버전에서는 클라이언트에서 가짜 이메일을 만들지 마세요.

권장 흐름:

1. 서버 API 또는 Cloud Function에서 `이름 + 비밀번호`를 검증합니다.
2. 서버에서 Firebase Admin SDK로 Custom Token을 발급합니다.
3. 클라이언트는 Custom Token으로 Firebase에 로그인합니다.
4. 동일한 이름을 가진 학생을 구분할 수 있도록 교사 코드 또는 내부 사용자 ID를 함께 관리합니다.

관련 문서:

- [Firebase 비밀번호 인증](https://firebase.google.com/docs/auth/web/password-auth)
- [Firebase Custom Auth](https://firebase.google.com/docs/auth/web/custom-auth)

## Gemini 연결

[src/app/page.tsx](src/app/page.tsx)의 `fetchAIResponse()`는 현재 `setTimeout()`과 Mock Data를 사용합니다. 실제 연결 시 Gemini 호출은 서버 API Route 또는 Cloud Function으로 옮기세요.

- `GEMINI_API_KEY`는 브라우저 코드에 넣지 않습니다.
- `NEXT_PUBLIC_GEMINI_API_KEY`처럼 공개 환경 변수로 만들지 않습니다.
- App Hosting에서는 Secret Manager에 저장하고 `apphosting.yaml`에서 참조합니다.

## GitHub 배포

Next.js 전체 앱은 Firebase App Hosting 사용을 권장합니다. GitHub 저장소를 연결하면 지정한 브랜치에 push할 때 자동으로 새 버전이 배포됩니다.

1. 코드를 GitHub 저장소에 push합니다.
2. Firebase 콘솔에서 **App Hosting** 백엔드를 만듭니다.
3. GitHub 저장소와 배포 브랜치(일반적으로 `main`)를 연결합니다.
4. `.env.local`의 공개 Firebase 설정값은 App Hosting 환경 변수로 등록합니다.
5. Gemini 키는 Secret Manager로 등록합니다.

이 저장소의 [apphosting.yaml](apphosting.yaml)은 초기 비용 제어를 위해 최대 인스턴스를 2개로 제한합니다.

관련 문서:

- [Firebase App Hosting 시작하기](https://firebase.google.com/docs/app-hosting/get-started)
- [App Hosting 설정](https://firebase.google.com/docs/app-hosting/configure)

## 확인 명령

```bash
npm run lint
npm run build
```
