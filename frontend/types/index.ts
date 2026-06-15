export type Role = 'STUDENT' | 'CURATOR' | 'TEACHER' | 'SUPER_ADMIN';
export type TestType = 'DTM_VARIANT' | 'DTM_RANDOM' | 'ATTESTATION' | 'NATIONAL_CERT' | 'TOPIC';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type QuestionType = 'TEXT' | 'IMAGE' | 'GRAPH' | 'THEORY' | 'OPEN' | 'MULTI' | 'REACTIONS';
export type AiStatus = 'PENDING' | 'CONFIRMED' | 'RECHECK' | 'MANUAL';
export type AttemptStatus = 'IN_PROGRESS' | 'COMPLETED' | 'TIMED_OUT';

export interface User {
  id: number;
  phone: string;
  name: string | null;
  role: Role;
  groupId: number | null;
  group?: { id: number; name: string } | null;
  createdAt: string;
}

export interface Test {
  id: number;
  type: TestType;
  title: string;
  year?: number;
  variantNo?: number;
  price: number;
  duration: number;
  totalQ: number;
  authorName?: string;
  collectionName?: string;
  topics?: string;
  coverImage?: string;
  pdfUrl?: string;
  telegramId?: string;
  isPaid?: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Option {
  id: number;
  label: string;
  text: string;
  isCorrect?: boolean;
}

export interface Question {
  id: number;
  text: string;
  imageUrl?: string;
  difficulty?: Difficulty;
  qType: QuestionType;
  orderNo: number;
  options: Option[];
}

export interface Answer {
  questionId: number;
  orderNo: number;
  text: string;
  qType: QuestionType;
  selectedOpts: string[];
  openText?: string;
  imageUrl?: string;
  isCorrect: boolean | null;
  aiStatus?: AiStatus;
  aiScore?: number;
  aiComment?: string;
  correctOptions: string[];
  videoFileId?: string;
}

export interface Attempt {
  id: number;
  testId: number;
  status: AttemptStatus;
  score: number | null;
  totalScore: number | null;
  startedAt: string;
  finishedAt?: string;
}

export interface AttemptResult extends Attempt {
  test: { id: number; title: string; type: TestType; totalQ: number };
  answers: Answer[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  name: string;
  phone: string;
  avgScore: number;
  attempts: number;
  groupName?: string | null;
  totalTimeSec?: number;
}

export interface Group {
  id: number;
  name: string;
  curatorId?: number | null;
  curator?: { id: number; name: string | null; phone: string } | null;
  telegramChatId?: string | null;
  _count?: { users: number };
}
