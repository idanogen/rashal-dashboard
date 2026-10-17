import moh from '@/assets/forms/moh-logo-plain.png';
import maccabi from '@/assets/forms/maccabi-logo.png';
import leumit from '@/assets/forms/leumit-logo.png';
import meuhedet from '@/assets/forms/meuhedet-logo.png';

/** הלוגו של הקופה לפי הטופס, לכותרת מסך החתימה. כללית: אין לנו לוגו, שם בלבד. */
const BY_PREFIX: [string, string][] = [
  ['moh-', moh], ['maccabi-', maccabi], ['leumit-', leumit], ['meuhedet-', meuhedet],
];

export function FormLogo({ formKey, className }: { formKey: string; className?: string }) {
  const src = BY_PREFIX.find(([p]) => formKey.startsWith(p))?.[1];
  if (!src) {
    return <span className="shrink-0 text-lg font-bold text-foreground">כללית</span>;
  }
  return <img src={src} alt="" className={className} />;
}
