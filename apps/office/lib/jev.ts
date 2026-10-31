// Teacher applications are screened by TypeSafe's Jev (like the kids' messages in apps/app/src/server/guard.ts):
// it refuses obviously invalid ones, so a real teacher learns at once what to fix. Rainer still decides every
// application that gets through. If Jev fails, the application goes through (fail open).

export const JEV_URL = 'https://api.typesafe.ai/v1/systemone';
const TIMEOUT_MS = 8000;

const CONTEXT =
  'The state holds an application (`school_name`, `school_url`, `grades`, `summary`) that an adult sent to ' +
  'AI-Scratch, a free Scratch learning tool with an AI helper for kids aged 10 to 14, to be confirmed as a ' +
  'teacher. Applications come mostly from Austria and Germany and are mostly written in German. Short and ' +
  'informal answers are fine; only obviously invalid applications should be caught.';

interface Question {
  question: string;
  yes: string;
  no: string;
}
const q = (question: string, yes: string, no: string): Question => ({ question, yes, no });

const QUESTIONS = {
  not_genuine: q(
    'Is the summary obviously not a real reason to use a learning tool with students: gibberish, a test ' +
      'entry, spam, advertising, or text unrelated to teaching?',
    'It is random characters, "test", "asdf", copied unrelated text, an advert, or has nothing to do with ' +
      'teaching or kids learning.',
    'It says, however briefly, that the person wants to use the tool with students, a class, a course or ' +
      'kids ("Digitale Grundbildung in der 2. Klasse", "Informatik-Wahlfach", "Programmieren lernen").',
  ),
  not_school: q(
    'Are the school name and the web address obviously not those of a school or other educational institution?',
    'A fantasy or joke name, a placeholder such as example.com or "keine", a shop, a social network, a ' +
      'private homepage that is clearly no school, or a name and address that clearly belong to different things.',
    'A plausible school or educational institution, even if unknown, abbreviated (BRG, MS, NMS, VS, HTL, ' +
      'Gymnasium) or with a shortened address.',
  ),
  abusive: q(
    'Does any field contain insults, hate, sexual content or other abusive language?',
    'It contains insults, slurs, hate against groups, sexual content or threats.',
    'It is neutral or polite.',
  ),
};

export type RefusalReason = keyof typeof QUESTIONS;

/** Jev must be sure: a wrongly refused teacher is worse than one more application for Rainer to read */
const THRESHOLD = 0.8;

export interface ApplicationText {
  schoolName: string;
  schoolUrl: string;
  grades: string[];
  summary: string;
}

export interface JevVerdict {
  /** the questions that fired; empty means the application gets through */
  reasons: RefusalReason[];
  nouls?: Partial<Record<RefusalReason, number>>;
  model?: string;
  /** set when Jev could not be asked; the application then goes through */
  error?: string;
}

export type ApplicationScreener = (application: ApplicationText) => Promise<JevVerdict>;

interface JevResponse {
  model?: string;
  answers?: Record<string, { noul?: unknown }>;
}

const questions = Object.fromEntries(
  Object.entries(QUESTIONS).map(([id, { question, yes, no }]) => [
    id,
    { type: 'noul', instructions: `${CONTEXT}\n\n${question}`, criteria: { true: yes, false: no } },
  ]),
);

export const createJevScreener =
  ({ apiKey, model, fetch: baseFetch = fetch }: { apiKey: string; model: string; fetch?: typeof fetch }) =>
  async (application: ApplicationText): Promise<JevVerdict> => {
    const state = {
      school_name: application.schoolName,
      school_url: application.schoolUrl,
      grades: application.grades.join(', '),
      summary: application.summary,
    };
    try {
      const res = await baseFetch(JEV_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, state, questions }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Jev answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const body = (await res.json()) as JevResponse;
      const nouls: Partial<Record<RefusalReason, number>> = {};
      for (const id of Object.keys(QUESTIONS) as RefusalReason[]) {
        const value = body.answers?.[id]?.noul;
        if (typeof value !== 'number') throw new Error(`Jev answer without noul for ${id}`);
        nouls[id] = value;
      }
      const reasons = (Object.keys(nouls) as RefusalReason[]).filter((id) => (nouls[id] ?? 0) >= THRESHOLD);
      return { reasons, nouls, model: body.model };
    } catch (e) {
      const error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
      console.warn('jev: application screening failed, letting it through', error);
      return { reasons: [], error };
    }
  };
