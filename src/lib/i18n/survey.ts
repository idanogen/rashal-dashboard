/**
 * המחרוזות של עמוד הסקר, בחמש שפות.
 *
 * העמוד נפתח מקישור בוואטסאפ אצל מטופלים, וחלקם אינם קוראים עברית. השפה
 * נקבעת לפי הפרמטר `?lang=` בכתובת, ואם אין, לפי מה שנשמר ללקוח במסד
 * (`wa_language_for`), ואם גם זה חסר, עברית.
 *
 * הקובץ בלי שום ייבוא, ולכן נבדק ביחידה ישירות מ-node.
 *
 * 🔴 המשפט הפותח בעברית זהה מילה במילה לתבנית `survey_invite_service`
 * שאושרה במטא. אם משנים אותו כאן, משנים גם שם.
 */

export type SurveyLang = 'he' | 'en' | 'ar' | 'ru' | 'th';

export type SurveyDir = 'rtl' | 'ltr';

export interface SurveyLangMeta {
  code: SurveyLang;
  /** שם השפה בשפה עצמה, כפי שהוא מוצג בבורר. */
  label: string;
  dir: SurveyDir;
}

export const SURVEY_LANGS: SurveyLangMeta[] = [
  { code: 'he', label: 'עברית', dir: 'rtl' },
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'ru', label: 'Русский', dir: 'ltr' },
  { code: 'th', label: 'ไทย', dir: 'ltr' },
];

export function isSurveyLang(x: unknown): x is SurveyLang {
  return typeof x === 'string' && SURVEY_LANGS.some((l) => l.code === x);
}

/** כיוון הכתיבה של שפה. עברית וערבית מימין לשמאל, השאר משמאל לימין. */
export function surveyDir(lang: SurveyLang): SurveyDir {
  return SURVEY_LANGS.find((l) => l.code === lang)?.dir ?? 'rtl';
}

export interface SurveyStrings {
  /** כותרת הלשונית בדפדפן. */
  title: string;
  /** השורה הקטנה מתחת ללוגו. */
  brand: string;
  /** הפנייה האישית. שם ריק מחזיר פנייה כללית. */
  greeting: (name: string) => string;
  intro: string;
  q1: string;
  q1Low: string;
  q1High: string;
  q2: string;
  q2Low: string;
  q2High: string;
  commentLabel: string;
  commentPlaceholder: string;
  send: string;
  sending: string;
  hint: string;
  loading: string;
  thanksTitle: string;
  thanksBody: string;
  answeredTitle: string;
  answeredBody: string;
  invalidTitle: string;
  invalidBody: string;
  errorTitle: string;
  errorBody: string;
  regards: string;
  signerName: string;
  signerRole: string;
}

export const SURVEY_TEXT: Record<SurveyLang, SurveyStrings> = {
  he: {
    title: 'סקר שביעות רצון · ר.שעל',
    brand: 'שירותי עזר לנכים',
    greeting: (name) => (name ? `${name} שלום,` : 'שלום,'),
    intro:
      'קיבלת לאחרונה שירות מחברת ר.שעל בע״מ. חשוב לי לדעת איך הרגשת עם השירות שקיבלת, ולכן אשמח אם תקדיש לנו פחות מדקה ותענה על שתי שאלות קצרות.',
    q1: 'באיזו מידה היית שבע רצון מהשירות שקיבלת?',
    q1Low: 'לא מרוצה כלל',
    q1High: 'מרוצה מאוד',
    q2: 'באיזו מידה היית ממליץ עלינו לחבר או קולגה?',
    q2Low: 'בכלל לא',
    q2High: 'בהחלט',
    commentLabel: 'משהו נוסף שתרצו לומר לנו? (לא חובה)',
    commentPlaceholder: 'כתבו כאן',
    send: 'שליחה',
    sending: 'שולח',
    hint: 'סמנו לפחות שאלה אחת כדי לשלוח',
    loading: 'רגע אחד',
    thanksTitle: 'תודה על שיתוף הפעולה',
    thanksBody: 'התשובה שלך התקבלה ותגיע אליי אישית. אנחנו קוראים כל מילה.',
    answeredTitle: 'כבר קיבלנו את התשובה שלך',
    answeredBody: 'תודה רבה, זה עוזר לנו להשתפר.',
    invalidTitle: 'הקישור אינו בתוקף',
    invalidBody: 'ייתכן שהקישור הועתק חלקית. אפשר לפתוח אותו שוב מתוך ההודעה שקיבלת בוואטסאפ.',
    errorTitle: 'משהו השתבש',
    errorBody: 'אפשר לנסות שוב בעוד רגע. אם זה חוזר, נשמח שתעדכנו אותנו.',
    regards: 'בברכה,',
    signerName: 'שלומי קורן',
    signerRole: 'סמנכ"ל · ר.שעל שירותי עזר לנכים',
  },
  en: {
    title: 'Satisfaction survey · R. Shaal',
    brand: 'Assistive services for people with disabilities',
    greeting: (name) => (name ? `Hello ${name},` : 'Hello,'),
    intro:
      'You recently received service from R. Shaal Ltd. It matters to me to know how you felt about the service, so I would appreciate a minute of your time to answer two short questions.',
    q1: 'How satisfied were you with the service you received?',
    q1Low: 'Not satisfied at all',
    q1High: 'Very satisfied',
    q2: 'How likely are you to recommend us to a friend or colleague?',
    q2Low: 'Not at all',
    q2High: 'Definitely',
    commentLabel: 'Anything else you would like to tell us? (optional)',
    commentPlaceholder: 'Write here',
    send: 'Send',
    sending: 'Sending',
    hint: 'Answer at least one question to send',
    loading: 'One moment',
    thanksTitle: 'Thank you for your cooperation',
    thanksBody: 'Your answer has been received and will reach me personally. We read every word.',
    answeredTitle: 'We already have your answer',
    answeredBody: 'Thank you, it helps us improve.',
    invalidTitle: 'This link is not valid',
    invalidBody: 'The link may have been copied partially. Open it again from the WhatsApp message you received.',
    errorTitle: 'Something went wrong',
    errorBody: 'Please try again in a moment. If it happens again, let us know.',
    regards: 'Best regards,',
    signerName: 'Shlomi Koren',
    signerRole: 'Deputy CEO · R. Shaal',
  },
  ar: {
    title: 'استبيان الرضا · ر. شعل',
    brand: 'خدمات مساعدة لذوي الإعاقة',
    greeting: (name) => (name ? `مرحباً ${name}،` : 'مرحباً،'),
    intro:
      'لقد تلقّيتم مؤخراً خدمة من شركة ر. شعل م.ض. يهمّني أن أعرف كيف شعرتم بالخدمة التي تلقّيتموها، ولذلك أكون ممتناً لو خصّصتم أقل من دقيقة للإجابة عن سؤالين قصيرين.',
    q1: 'إلى أي مدى كنتم راضين عن الخدمة التي تلقّيتموها؟',
    q1Low: 'غير راضٍ إطلاقاً',
    q1High: 'راضٍ جداً',
    q2: 'إلى أي مدى توصون بنا لصديق أو زميل؟',
    q2Low: 'إطلاقاً',
    q2High: 'بالتأكيد',
    commentLabel: 'هل هناك شيء آخر تودّون إخبارنا به؟ (اختياري)',
    commentPlaceholder: 'اكتبوا هنا',
    send: 'إرسال',
    sending: 'جارٍ الإرسال',
    hint: 'أجيبوا عن سؤال واحد على الأقل للإرسال',
    loading: 'لحظة من فضلكم',
    thanksTitle: 'شكراً لتعاونكم',
    thanksBody: 'وصلت إجابتكم وستصلني شخصياً. نحن نقرأ كل كلمة.',
    answeredTitle: 'لقد تلقّينا إجابتكم من قبل',
    answeredBody: 'شكراً جزيلاً، هذا يساعدنا على التحسّن.',
    invalidTitle: 'الرابط غير صالح',
    invalidBody: 'ربما تم نسخ الرابط جزئياً. افتحوه مرة أخرى من رسالة واتساب التي وصلتكم.',
    errorTitle: 'حدث خطأ ما',
    errorBody: 'يمكنكم المحاولة مرة أخرى بعد قليل. إذا تكرّر الأمر، يسعدنا إبلاغنا.',
    regards: 'مع التحية،',
    signerName: 'شلومي كورن',
    signerRole: 'نائب المدير العام · ر. شعل',
  },
  ru: {
    title: 'Опрос удовлетворённости · Р. Шааль',
    brand: 'Вспомогательные услуги для людей с инвалидностью',
    greeting: (name) => (name ? `Здравствуйте, ${name},` : 'Здравствуйте,'),
    intro:
      'Недавно вы получили услугу от компании Р. Шааль. Мне важно знать, как вы оцениваете полученную услугу, поэтому буду благодарен, если вы уделите меньше минуты и ответите на два коротких вопроса.',
    q1: 'Насколько вы довольны полученной услугой?',
    q1Low: 'Совсем не доволен',
    q1High: 'Очень доволен',
    q2: 'Насколько вероятно, что вы порекомендуете нас другу или коллеге?',
    q2Low: 'Совсем нет',
    q2High: 'Определённо да',
    commentLabel: 'Хотите добавить что-то ещё? (необязательно)',
    commentPlaceholder: 'Напишите здесь',
    send: 'Отправить',
    sending: 'Отправляем',
    hint: 'Ответьте хотя бы на один вопрос, чтобы отправить',
    loading: 'Одну минуту',
    thanksTitle: 'Спасибо за сотрудничество',
    thanksBody: 'Ваш ответ получен и попадёт ко мне лично. Мы читаем каждое слово.',
    answeredTitle: 'Мы уже получили ваш ответ',
    answeredBody: 'Большое спасибо, это помогает нам становиться лучше.',
    invalidTitle: 'Ссылка недействительна',
    invalidBody: 'Возможно, ссылка скопирована не полностью. Откройте её снова из сообщения в WhatsApp.',
    errorTitle: 'Что-то пошло не так',
    errorBody: 'Попробуйте ещё раз через минуту. Если повторится, сообщите нам.',
    regards: 'С уважением,',
    signerName: 'Шломи Корен',
    signerRole: 'Заместитель генерального директора · Р. Шааль',
  },
  th: {
    title: 'แบบสำรวจความพึงพอใจ · R. Shaal',
    brand: 'บริการช่วยเหลือสำหรับผู้พิการ',
    greeting: (name) => (name ? `สวัสดีคุณ ${name}` : 'สวัสดีค่ะ/ครับ'),
    intro:
      'เมื่อเร็วๆ นี้คุณได้รับบริการจากบริษัท R. Shaal จำกัด ผมอยากทราบว่าคุณรู้สึกอย่างไรกับบริการที่ได้รับ จึงขอรบกวนเวลาไม่ถึงหนึ่งนาทีเพื่อตอบคำถามสั้นๆ 2 ข้อ',
    q1: 'คุณพึงพอใจกับบริการที่ได้รับมากน้อยเพียงใด',
    q1Low: 'ไม่พอใจเลย',
    q1High: 'พอใจมาก',
    q2: 'คุณจะแนะนำเราให้เพื่อนหรือเพื่อนร่วมงานมากน้อยเพียงใด',
    q2Low: 'ไม่แนะนำเลย',
    q2High: 'แนะนำแน่นอน',
    commentLabel: 'มีอะไรอยากบอกเราเพิ่มเติมไหม (ไม่บังคับ)',
    commentPlaceholder: 'เขียนที่นี่',
    send: 'ส่ง',
    sending: 'กำลังส่ง',
    hint: 'กรุณาตอบอย่างน้อยหนึ่งข้อเพื่อส่ง',
    loading: 'รอสักครู่',
    thanksTitle: 'ขอบคุณสำหรับความร่วมมือ',
    thanksBody: 'คำตอบของคุณถูกส่งแล้วและจะถึงผมโดยตรง เราอ่านทุกคำ',
    answeredTitle: 'เราได้รับคำตอบของคุณแล้ว',
    answeredBody: 'ขอบคุณมาก สิ่งนี้ช่วยให้เราพัฒนาได้',
    invalidTitle: 'ลิงก์ไม่ถูกต้อง',
    invalidBody: 'ลิงก์อาจถูกคัดลอกไม่ครบ กรุณาเปิดอีกครั้งจากข้อความ WhatsApp ที่ได้รับ',
    errorTitle: 'เกิดข้อผิดพลาด',
    errorBody: 'กรุณาลองใหม่อีกครั้งในอีกสักครู่ หากยังเกิดขึ้นอีก กรุณาแจ้งให้เราทราบ',
    regards: 'ด้วยความเคารพ',
    signerName: 'Shlomi Koren',
    signerRole: 'รองกรรมการผู้จัดการ · R. Shaal',
  },
};
