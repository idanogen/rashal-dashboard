/**
 * Per-order internal chat / timeline.
 * Adapted from parcel-story (`src/types/invoice.ts`): invoice → order.
 */
export type TimelineEventType =
  | 'comment' // user comment (with optional @mentions)
  | 'file_upload' // files attached
  | 'status_change' // order status changed (oldStatus → newStatus in metadata)
  | 'reschedule' // system: stop moved to another day (who + from→to, coordination note)
  | 'created'; // system: order created

export interface TimelineEvent {
  id: string; // "event-{timestamp}" (client-generated, supports optimistic insert)
  orderId?: string; // which order this event belongs to
  serviceCallId?: string; // or which service call this event belongs to
  type: TimelineEventType;
  userId: string; // auth user id (or 'current-user' fallback)
  userName: string; // display name
  content?: string; // comment text / description
  files?: string[]; // original file names (URLs live in metadata.imageUrls)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>; // { mentions: string[], imageUrls: string[], oldStatus, newStatus, ... }
  createdAt: string; // ISO timestamp
}
