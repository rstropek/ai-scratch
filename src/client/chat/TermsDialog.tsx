// The terms of use for a parent's own OpenRouter key, opened from the gate (AccessGate). Built like the
// Locker dialog and Scratch's own modals: purple header, blue overlay. A new text needs a new
// TERMS_VERSION (access.ts), so parents agree again.
import { Check, X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface TermsDialogProps {
  onAgree: () => void;
  onClose: () => void;
}

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section>
    <h4 className="mt-5 mb-1.5 font-bold text-primary-ink">{title}</h4>
    {children}
  </section>
);

const List = ({ children }: { children: ReactNode }) => (
  <ul className="my-1.5 list-disc space-y-1.5 pl-5 marker:text-primary">{children}</ul>
);

const Strong = ({ children }: { children: ReactNode }) => <strong className="text-primary-ink">{children}</strong>;

const Link = ({ href, children }: { href: string; children: ReactNode }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="text-primary-hover underline underline-offset-3 hover:text-primary-ink"
  >
    {children}
  </a>
);

const MAIL = 'rainer@software-architects.at';

export const TermsText = () => (
  <div className="max-w-[68ch] space-y-2 [&_p]:my-1.5">
    <h3 className="text-[1.15em] leading-tight font-bold text-balance text-primary-ink">
      Nutzungsbedingungen für den <span className="whitespace-nowrap">KI-Helfer</span> mit eigenem{' '}
      <span className="whitespace-nowrap">OpenRouter-Schlüssel</span>
    </h3>
    <p className="!mt-1 text-[0.9em] text-muted-foreground">Stand: 28. Oktober 2026</p>

    <Section title="1. Worum es geht">
      <p>
        KI-Scratch ist ein kostenloses Lernangebot: der Scratch-Editor mit einem KI-Helfer, der Kindern beim
        Programmieren eigener Spiele hilft. Es ist eine private Initiative von Rainer Stropek (
        <Link href={`mailto:${MAIL}`}>{MAIL}</Link>), der den Dienst betreibt („wir“). Es handelt sich nicht um ein
        kommerzielles Angebot eines Unternehmens.
      </p>
      <p>
        Der Quellcode ist Open Source und öffentlich einsehbar:{' '}
        <Link href="https://github.com/rstropek/ai-scratch">github.com/rstropek/ai-scratch</Link>. Dort können Sie
        nachvollziehen, wie der Dienst mit Ihrem Schlüssel und den Daten umgeht.
      </p>
      <p>
        Diese Bedingungen gelten, wenn der KI-Helfer nicht mit dem Zugangscode einer Schule, sondern mit einem eigenen
        API-Schlüssel von OpenRouter (openrouter.ai) genutzt wird. Sie richten sich an die volljährige Person, die den
        Schlüssel einträgt („Sie“), in der Regel einen Elternteil oder eine andere erziehungsberechtigte Person. Mit dem
        Häkchen bestätigen Sie, dass Sie volljährig sind und diesen Bedingungen zustimmen.
      </p>
    </Section>

    <Section title="2. Ihr Schlüssel und Ihre Kosten">
      <List>
        <li>
          Jede Anfrage des KI-Helfers wird über Ihren Schlüssel von Ihrem OpenRouter-Guthaben abgebucht.{' '}
          <Strong>Alle Kosten tragen Sie.</Strong> Wir erstatten keine Kosten.
        </li>
        <li>
          <Strong>Sie sind dafür verantwortlich, nur einen Schlüssel mit festem Ausgabelimit einzutragen</Strong>: einen
          Schlüssel, den Sie eigens für diesen Dienst anlegen und bei OpenRouter auf einen kleinen Betrag begrenzen,
          dessen Verbrauch für Sie in Ordnung ist (zum Beispiel einige Dollar). Mehr als dieses Limit kann über den
          Schlüssel nicht ausgegeben werden. Schlüssel ohne Limit nehmen wir nicht an.
        </li>
        <li>
          Wie weit Ihr Guthaben reicht, können wir nicht zusagen. Die Preise legen OpenRouter und die KI-Anbieter fest.
          Welches KI-Modell der Dienst verwendet und wie er es einstellt, bestimmen wir und können es jederzeit ändern.
        </li>
        <li>
          Ist das Limit erreicht, hört der KI-Helfer auf zu antworten, bis Sie das Limit bei OpenRouter erhöhen. Scratch
          selbst funktioniert weiter.
        </li>
        <li>
          Für Ihr Konto bei OpenRouter gelten ausschließlich die Bedingungen von OpenRouter. Wir sind nicht Partei
          dieses Vertrags.
        </li>
        <li>Wenn Sie vermuten, dass jemand anderer Ihren Schlüssel kennt, löschen Sie ihn sofort bei OpenRouter.</li>
      </List>
    </Section>

    <Section title="3. Was mit dem Schlüssel geschieht">
      <List>
        <li>
          Der Schlüssel wird in diesem Browser auf diesem Gerät gespeichert, damit Sie ihn nicht jedes Mal neu eintragen
          müssen. Auf einem Gerät, das auch andere benutzen, löschen Sie ihn nach der Nutzung („Schlüssel vergessen“
          oben im Chat).
        </li>
        <li>
          Bei jeder Anfrage schickt der Browser den Schlüssel verschlüsselt an unseren Server, der damit die Anfrage an
          OpenRouter stellt. Wir speichern den Schlüssel nicht und verwenden ihn für nichts anderes.
        </li>
      </List>
    </Section>

    <Section title="4. Wo die Daten verarbeitet werden">
      <List>
        <li>
          Damit der KI-Helfer antworten kann, werden die Nachrichten Ihres Kindes und sein Scratch-Projekt (Figuren,
          Bilder, Texte, Skripte) an OpenRouter übermittelt und von dort an einen KI-Anbieter weitergeleitet, derzeit
          Anthropic, auch über Cloud-Plattformen wie Amazon Web Services. Jede neue Nachricht prüft zusätzlich ein
          Jugendschutzfilter eines weiteren Anbieters.
        </li>
        <li>
          <Strong>Wir sichern keinen Ort der Verarbeitung zu.</Strong> Die Daten können in Ländern außerhalb der
          Europäischen Union verarbeitet werden, insbesondere in den USA, in denen ein geringeres Datenschutzniveau
          bestehen kann als in der EU. Für die Verarbeitung bei OpenRouter und bei den KI-Anbietern gelten deren
          Datenschutzbestimmungen. Welcher Anbieter und welches Rechenzentrum eine Anfrage bearbeitet, kann sich von
          Anfrage zu Anfrage ändern.
        </li>
        <li>
          Wir speichern keine Unterhaltungen. Technische Fehlerprotokolle können einzelne Nachrichten oder Teile davon
          enthalten; wir verwenden sie nur, um Fehler zu beheben.
        </li>
      </List>
    </Section>

    <Section title="5. Keine persönlichen oder sensiblen Daten">
      <p>
        <Strong>
          In den KI-Helfer und in das Scratch-Projekt dürfen keine personenbezogenen oder sensiblen Daten eingegeben
          werden.
        </Strong>{' '}
        Dazu gehören insbesondere:
      </p>
      <List>
        <li>
          Namen, Adressen, Telefonnummern, E-Mail-Adressen, Geburtsdaten, Schule oder Wohnort des Kindes oder anderer
          Personen;
        </li>
        <li>Fotos, Passwörter und Zugangsdaten;</li>
        <li>
          Gesundheitsdaten und andere besonders schutzwürdige Angaben, etwa zu Herkunft, Religion, politischer Meinung
          oder sexueller Orientierung.
        </li>
      </List>
      <p>Der KI-Helfer ist nur für Fragen zum eigenen Scratch-Spiel gedacht.</p>
    </Section>

    <Section title="6. Ihre Verantwortung als Eltern">
      <List>
        <li>
          <Strong>Sie erklären Ihrem Kind vor der ersten Nutzung diese Regeln</Strong>, besonders, dass es keine
          persönlichen Daten eingibt, und Sie begleiten die Nutzung so, wie es dem Alter Ihres Kindes entspricht.
        </li>
        <li>
          Antworten einer KI können falsch, unvollständig oder unpassend sein. Der Jugendschutzfilter prüft nur die
          Nachrichten Ihres Kindes, nicht die Antworten, und erkennt nicht alles. Er ersetzt Ihre Aufsicht nicht.
        </li>
        <li>
          Soweit für die Nutzung durch Ihr Kind die Zustimmung einer erziehungsberechtigten Person nötig ist, erteilen
          Sie diese mit dem Häkchen.
        </li>
      </List>
    </Section>

    <Section title="7. Keine Gewähr, Haftung">
      <List>
        <li>
          Der Dienst ist kostenlos. Wir sagen nicht zu, dass er immer verfügbar ist oder fehlerfrei arbeitet, und können
          ihn jederzeit einschränken oder einstellen. Speichern Sie Spiele deshalb regelmäßig.
        </li>
        <li>
          Soweit gesetzlich zulässig, haften wir nicht für Schäden aus der Nutzung, insbesondere nicht für Kosten auf
          Ihrem OpenRouter-Konto. Das gilt nicht bei Vorsatz oder grober Fahrlässigkeit und nicht für Personenschäden.
        </li>
      </List>
    </Section>

    <Section title="8. Änderungen, anwendbares Recht">
      <List>
        <li>
          Wir können diese Bedingungen ändern. Ändern sie sich, fragt der KI-Helfer beim nächsten Start erneut nach
          Ihrer Zustimmung.
        </li>
        <li>
          Es gilt österreichisches Recht. Zwingende Verbraucherschutzbestimmungen Ihres Wohnsitzstaates bleiben
          unberührt.
        </li>
      </List>
      <p>
        Kontakt: Rainer Stropek, <Link href={`mailto:${MAIL}`}>{MAIL}</Link>
      </p>
    </Section>
  </div>
);

const FOOT_BUTTON =
  'inline-flex items-center gap-2 rounded px-4 py-3 text-sm leading-none font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&_svg]:size-4';

export const TermsDialog = ({ onAgree, onClose }: TermsDialogProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const ids = useId();
  useEffect(() => {
    const d = dialog.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby={`${ids}-title`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="mx-auto mt-[6vh] max-h-[calc(100vh-6vh-2rem)] w-[600px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border-4 border-white/25 bg-transparent bg-clip-padding p-0 text-base text-foreground backdrop:bg-modal-overlay open:flex"
    >
      <div className="relative grid h-[50px] flex-none place-items-center bg-primary text-primary-foreground">
        <h2 id={`${ids}-title`} className="text-base font-normal">
          Nutzungsbedingungen
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="absolute top-[11px] right-2.5 grid size-7 place-items-center rounded-full bg-black/15 shadow-[0_0_0_2px_rgba(0,0,0,0.15)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white [&_svg]:size-3.5"
        >
          <X strokeWidth={3.2} aria-hidden />
        </button>
      </div>
      {/* Chrome makes a scrolling box keyboard-focusable by itself */}
      <div className="scrollbar-soft min-h-0 flex-1 overflow-y-auto bg-background px-8 pt-5.5 pb-2 text-[15px] leading-[1.55]">
        <TermsText />
      </div>
      <div className="flex flex-none justify-end gap-2 border-t bg-background px-8 pt-3.5 pb-4.5">
        <button
          type="button"
          onClick={onClose}
          className={cn(FOOT_BUTTON, 'border bg-background text-foreground hover:bg-secondary')}
        >
          Schließen
        </button>
        <button
          type="button"
          onClick={onAgree}
          className={cn(FOOT_BUTTON, 'bg-primary text-primary-foreground hover:bg-primary-hover')}
        >
          <Check aria-hidden />
          Gelesen, ich stimme zu
        </button>
      </div>
    </dialog>
  );
};
