# 수학같이할래?

초등학생과 담당 교사를 위한 수학 학습 앱입니다.  
현재 화면 흐름은 확정했고, Vercel 배포 + Firebase Firestore 저장까지 연결되어 있습니다.

## 주요 기능

- 이름과 비밀번호만 사용하는 학생/교사 진입 화면
- 학생: 혼자 공부하기, 선생님이 내준 숙제하기
- AI 개념 설명, 5개 맞춤형 문제, 단계별 힌트
- 오답 1회/2회 힌트, 3회 실패 시 정답 공개
- 교사: 학생별 attempts, wrongAnswers, isFailed 확인
- 교사: 학생 개개인에게 개념 숙제 전송
- Firestore `demoApps/mathTogetherPrototype` 문서에 데모 상태 저장

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 환경 변수

`.env.local.example`을 복사해 `.env.local`을 만들고 값을 채웁니다.

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

`NEXT_PUBLIC_FIREBASE_*` 값은 브라우저에서 Firebase SDK가 쓰는 공개 설정입니다.  
`GEMINI_API_KEY`는 서버 API Route에서만 사용하며 브라우저에 노출하지 않습니다.

## Firebase

필요한 Firebase 설정:

- Firestore Database
- Authentication의 Anonymous 로그인
- Firestore rules 배포

배포 명령:

```bash
npx firebase-tools deploy --only firestore
```

PowerShell 실행 정책 때문에 `npx`가 막히면:

```powershell
npx.cmd firebase-tools deploy --only firestore
```

## Gemini

프론트엔드는 `/api/ai` 서버 라우트를 호출합니다.  
서버 라우트는 `GEMINI_API_KEY`가 있으면 Gemini REST API를 호출하고, 키가 없거나 호출 실패 시 기존 Mock 응답으로 fallback합니다.

현재 서버 라우트:

```text
src/app/api/ai/route.ts
```

Vercel에 추가해야 하는 환경 변수:

```env
GEMINI_API_KEY=발급받은_키
GEMINI_MODEL=gemini-2.5-flash
```

## 배포

현재는 Vercel 배포를 사용합니다.

1. GitHub 저장소를 Vercel 프로젝트에 연결
2. Firebase 공개 환경 변수 등록
3. Gemini 연결 시 `GEMINI_API_KEY`, `GEMINI_MODEL` 추가
4. `main` 브랜치에 push하면 자동 재배포

## 확인 명령

```bash
npm run lint
npm run build
```
