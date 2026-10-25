// The simulated kid and the judge: two Claude calls outside the app, through the same AI SDK provider the
// server uses. The kid has a game idea (the game's brief), answers the assistant's questions and reports
// what it notices when it tries the game; the judge reads the finished conversation and rates the teaching.
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, type LanguageModelUsage, type ModelMessage, Output } from 'ai';
import { z } from 'zod';

export const DONE = 'FERTIG';

const provider = () =>
  createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    headers: process.env.ANTHROPIC_WORKSPACE_ID ? { 'anthropic-workspace-id': process.env.ANTHROPIC_WORKSPACE_ID } : {},
  });

const kidInstructions = (
  brief: string,
) => `Du spielst ein Kind (11 Jahre) beim Workshop „Digiferien“. Du kennst Scratch ein bisschen und baust heute mit einem KI-Helfer im Chat neben dem Scratch-Editor ein Spiel. Du schreibst die Nachrichten des Kindes an den KI-Helfer.

Deine Spielidee (verrate sie nicht auf einmal, sie entsteht im Gespräch):
${brief}

So schreibst du:
- Kurz und locker, wie ein Kind: meistens 1 bis 2 Sätze, Deutsch, ohne Fachwörter.
- Deine erste Nachricht nennt nur die grobe Idee in einem Satz.
- Beantworte die Fragen des KI-Helfers passend zu deiner Spielidee. Passt sein Vorschlag zu deiner Idee, sag ja. Passt er nicht, sag, was du stattdessen willst.
- Du kannst selbst keine Blöcke ziehen, nichts malen und keine Figuren löschen. Bittet dich der KI-Helfer, selbst etwas im Editor zu machen, sag freundlich, dass du es nicht findest und er es bitte für dich machen soll. Behaupte nie, du hättest etwas im Editor gemacht.
- Ausprobieren kannst du: Nach jeder Änderung steht unter „Beim Ausprobieren“, was du beim Spielen bemerkt hast, und du siehst Bilder der Bühne aus deinem Spiel (zum Beispiel gleich nach der grünen Flagge und am Ende), jedes mit einer kurzen Beschriftung. Sag dem KI-Helfer, was nicht geht, so wie ein Kind es sieht („die Äpfel fallen nicht runter“), nicht wie man es repariert.
- „Beim Ausprobieren“ und die Bilder sind das, was du selbst gesehen hast; der KI-Helfer sieht sie nicht. Erzähl es wie ein Kind, das gespielt hat, und schreib nie „Beim Ausprobieren“, „im Test“, „auf dem Bild“ oder eine Beschriftung.
- Steht unter „Beim Ausprobieren“ zu einem Teil nichts, konntest du ihn noch nicht ausprobieren (die Bilder sind nur einzelne Momente). Behaupte dann nicht, dass er kaputt ist; bau lieber mit dem KI-Helfer weiter.
- Hat der KI-Helfer nichts geändert, gibt es nichts Neues auszuprobieren: Es gilt, was du zuletzt gesehen hast (die Bilder bleiben dieselben).
- Wenn der KI-Helfer etwas Neues baut, was nicht zu deiner Idee gehört, sag es.
- Folge seinen Schritten. Wenn ein Teil deiner Idee noch fehlt und er nicht danach fragt, wünsch ihn dir.
- Wenn alles aus deiner Spielidee funktioniert, schreibe nur: ${DONE}`;

export interface KidTurn {
  kid: string;
  answer: string;
  /** what the kid noticed when trying the game after this answer (German), if the project changed */
  observed?: string;
  /** the game check's stage pictures, if the project changed; the latest ones go with the latest answer */
  stages?: { label: string; png: Buffer }[];
}

export interface CallUsage {
  model: string;
  usage: LanguageModelUsage;
}

export const WELCOME =
  'Hallo! Ich bin dein KI-Helfer. Sag mir, was ich in deinem Scratch-Projekt bauen soll – oder frag mich, wo du etwas findest.';

/** The kid's next message, or DONE. */
export const nextKidMessage = async (
  model: string,
  brief: string,
  turns: KidTurn[],
): Promise<{ text: string; usage: CallUsage }> => {
  const messages: ModelMessage[] = [
    { role: 'user', content: `Der KI-Helfer im Chat sagt: „${WELCOME}“\n\nSchreib deine erste Nachricht.` },
  ];
  turns.forEach((t, i) => {
    messages.push({ role: 'assistant', content: t.kid });
    const text =
      `Der KI-Helfer antwortet: „${t.answer || '(keine Antwort)'}“` +
      (t.observed ? `\n\nBeim Ausprobieren:\n${t.observed}` : '') +
      '\n\nSchreib deine nächste Nachricht.';
    // the latest pictures stay with the latest answer while nothing changes, so the kid doesn't
    // misremember the game (it once saw one row of Memory cards for 15 turns after seeing two)
    const stages = i === turns.length - 1 ? turns.findLast((x) => x.stages?.length)?.stages : undefined;
    messages.push({
      role: 'user',
      content: stages
        ? [
            { type: 'text', text },
            ...stages.flatMap((s, n) => [
              { type: 'text' as const, text: `Bild ${n + 1}: ${s.label}` },
              { type: 'file' as const, mediaType: 'image/png', data: s.png },
            ]),
          ]
        : text,
    });
  });
  const result = await generateText({
    model: provider()(model),
    instructions: kidInstructions(brief),
    messages,
    maxOutputTokens: 4000,
    providerOptions: { anthropic: { effort: 'low' } },
  });
  return { text: result.text.trim(), usage: { model, usage: result.usage } };
};

// --- judge -------------------------------------------------------------------------------------------

const verdictSchema = z.object({
  teaching: z.number().int().min(1).max(5).describe('1 = ignores the teaching rules, 5 = a model tutor'),
  summary: z.string().describe('2-3 sentences: how the session went'),
  findings: z.array(
    z.object({
      severity: z.enum(['high', 'medium', 'low']),
      turn: z.number().int().optional().describe('the kid turn number it refers to'),
      text: z.string(),
    }),
  ),
});
export type Verdict = z.infer<typeof verdictSchema>;

const JUDGE = `You review a session of a German AI assistant that helps a kid (10-16, Scratch beginner) build a Scratch game in a one-day workshop. The kid here is simulated. The assistant changes the kid's project with tools.

Its rules (teaching mode):
- The kid designs the game (idea, rules, points, levels); the assistant leads with questions, step by step.
- Per answer it builds only a small, clearly defined part (usually one script), never the whole game or large parts.
- Answers are short, friendly, kid-level German, and explain what was built so the kid can follow.
- It must not claim something works when the test results show it doesn't, and it should fix reported bugs.

The test results come from an automatic harness that plays the game after each change. The assistant never sees them; it only knows what the kid tells it. Don't blame it for failures the kid didn't report, unless it claimed something works that the results show doesn't.

Find what went wrong or could be better: rule violations, wrong Scratch facts, bugs the assistant caused or missed, misunderstandings, wasted turns, tool errors it handled badly. Only report what the transcript shows. Write in English; quote German where useful.`;

export const judge = async (model: string, transcript: string): Promise<{ verdict: Verdict; usage: CallUsage }> => {
  const result = await generateText({
    model: provider()(model),
    instructions: JUDGE,
    prompt: transcript,
    output: Output.object({ schema: verdictSchema }),
    maxOutputTokens: 16000,
    providerOptions: { anthropic: { effort: 'medium' } },
  });
  return { verdict: result.output, usage: { model, usage: result.usage } };
};
