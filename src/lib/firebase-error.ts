export function getFirebaseErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "잠시 후 다시 시도해 주세요.";

  if (error.message.includes("auth/email-already-in-use")) {
    return "이미 가입된 계정입니다.";
  }
  if (error.message.includes("auth/invalid-credential")) {
    return "로그인 정보를 다시 확인해 주세요.";
  }
  if (error.message.includes("auth/weak-password")) {
    return "비밀번호를 6자 이상 입력해 주세요.";
  }

  return "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
}
