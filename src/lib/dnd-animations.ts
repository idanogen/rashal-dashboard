import {
  defaultDropAnimationSideEffects,
  type DropAnimation,
  type Announcements,
} from '@dnd-kit/core';

/**
 * אנימציית drop — fade קצר תוך 150ms. שומר על תחושה רספונסיבית
 * גם כשמשחררים מחוץ ל-dropZone (הדיאלוג הבא לא מחכה לאנימציה ארוכה).
 */
export const dropAnimationDown: DropAnimation = {
  duration: 150,
  easing: 'cubic-bezier(0.25, 0, 0.4, 1)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0' } },
  }),
};

/** משתיק announcements של @dnd-kit שגורמים ל-div זוהר ב-RTL. */
export const silentAnnouncements: Announcements = {
  onDragStart: () => '',
  onDragOver: () => '',
  onDragEnd: () => '',
  onDragCancel: () => '',
};

export const silentScreenReaderInstructions = { draggable: '' };
