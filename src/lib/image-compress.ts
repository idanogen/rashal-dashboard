// דחיסת תמונות בצד הלקוח לפני העלאה (עמי / צ'אט שטח).
// חוסך מקום בשרת שלנו וגם מקל על הדחיפה העתידית לנספחי פריוריטי.
// אנשי שטח מצלמים בנייד ברזולוציה ענקית (12MP+, 4-8MB) — לתקלה/מכשיר
// אין שום צורך ביותר מ~1600px ו-JPEG 0.7. יורד טיפוסית ל-200-400KB.

const MAX_DIM = 1600; // הצלע הארוכה
const QUALITY = 0.7;
const COMPRESSIBLE = /^image\/(jpe?g|png|webp)$/i;

/**
 * מקבל קובץ; אם זו תמונה נתמכת — מחזיר גרסה דחוסה (JPEG), אחרת את המקור כמו שהוא.
 * לעולם לא מגדיל, ולא נוגע ב-PDF/מסמכים או ב-HEIC/GIF (מחזיר מקור).
 */
export async function compressImage(file: File): Promise<File> {
  if (!COMPRESSIBLE.test(file.type)) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // דפדפן ישן / פורמט לא נתמך — נעלה מקור
  }

  const { width, height } = bitmap;
  const scale = Math.min(1, MAX_DIM / Math.max(width, height));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY)
  );
  // אם הדחיסה נכשלה או יצאה גדולה מהמקור (תמונה קטנה שכבר דחוסה) — נשאר עם המקור
  if (!blob || blob.size >= file.size) return file;

  const base = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

/** דוחס מערך קבצים במקביל. */
export function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map(compressImage));
}
