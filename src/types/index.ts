import type { Timestamp } from "firebase/firestore";

export type UserRole = "teacher" | "student";
export type AssignmentStatus = "pending" | "completed";

export interface UserProfile {
  id: string;
  displayName: string;
  email: string;
  role: UserRole;
  teacherId?: string;
  inviteCode?: string;
  createdAt?: Timestamp;
}

export interface StudentGroup {
  id: string;
  name: string;
  teacherId: string;
  memberIds: string[];
  createdAt?: Timestamp;
}

export interface Homework {
  id: string;
  title: string;
  description: string;
  dueAt: Timestamp;
  teacherId: string;
  assigneeIds: string[];
  groupIds: string[];
  createdAt?: Timestamp;
}

export interface Assignment {
  id: string;
  homeworkId: string;
  studentId: string;
  teacherId: string;
  title: string;
  description: string;
  dueAt: Timestamp;
  status: AssignmentStatus;
  createdAt?: Timestamp;
  completedAt?: Timestamp | null;
}

export interface ConceptAssignment {
  id: string;
  studentId: string;
  teacherId: string;
  concept: string;
  status: AssignmentStatus;
  assignedAt?: Timestamp;
  completedAt?: Timestamp | null;
}

export interface LearningRecord {
  id: string;
  studentId: string;
  teacherId: string;
  concept: string;
  question: string;
  correctAnswer: string;
  attempts: number;
  wrongAnswers: string[];
  isFailed: boolean;
  isCorrect: boolean;
  updatedAt?: Timestamp;
}
