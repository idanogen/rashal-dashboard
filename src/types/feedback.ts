export type FeedbackStatus = 'open' | 'resolved';

/** A note/feedback thread opened by a user. Everyone can see all threads. */
export interface FeedbackThread {
  id: string;
  createdBy: string;
  subject?: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  // resolved client-side from profiles + messages
  authorName: string;
  messageCount: number;
  lastMessagePreview?: string;
  lastMessageAt?: string;
}

/** A single message inside a thread (the first one is the original note). */
export interface FeedbackMessage {
  id: string;
  threadId: string;
  authorId: string;
  body?: string;
  imagePath?: string;
  createdAt: string;
  // resolved client-side
  authorName: string;
  authorIsAdmin: boolean;
}
