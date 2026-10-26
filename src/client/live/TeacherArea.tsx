// The teachers' part of the page, below the videos: locked by the teacher code, then what each school needs
// (its KI access code, its Locker cards, the short addresses) plus Rainer's Teams meeting.
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  KeyRound,
  LoaderCircle,
  Lock,
  TriangleAlert,
  Type,
} from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { type LiveData, type LiveSchool, liveFileUrl, PLAYGROUND_PATH } from '../../shared/live.ts';
import { Section } from './Section.tsx';

export const TeacherGate = ({
  checking,
  error,
  onCode,
}: {
  checking: boolean;
  error?: string;
  onCode: (code: string) => void;
}) => {
  const [code, setCode] = useState('');
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!checking && code.trim()) onCode(code.trim());
  };
  return (
    <form onSubmit={onSubmit} className="max-w-xl rounded-xl bg-card p-6 shadow-[0_1px_3px_hsla(225,30%,40%,0.12)]">
      <p className="leading-relaxed">
        Zugangscodes, Locker-Karten und Links für jede Schule. Der Code dafür steht in der E-Mail zu den Digitalferien
        2026.
      </p>
      <label htmlFor="live-code" className="mt-5 flex items-center gap-1.5 font-bold text-primary-ink">
        <KeyRound aria-hidden className="size-[1.1em] text-primary" />
        Code für Lehrkräfte
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="live-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          disabled={checking}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'live-error' : undefined}
          className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-base transition-[border-color,box-shadow] duration-150 outline-none focus:border-primary focus:ring-4 focus:ring-ring disabled:opacity-60 aria-invalid:border-alert-border"
        />
        <Button type="submit" className="h-auto px-5 py-2 text-base font-bold" disabled={checking || !code.trim()}>
          {checking ? (
            <>
              <LoaderCircle aria-hidden className="animate-spin motion-reduce:animate-none" />
              prüfe…
            </>
          ) : (
            'Freischalten'
          )}
        </Button>
      </div>
      {error && (
        <p id="live-error" role="alert" className="mt-3 rounded-lg border border-alert-border bg-alert px-3.5 py-2">
          {error}
        </p>
      )}
    </form>
  );
};

export const TeacherArea = ({
  data,
  code,
  school,
  onSchool,
  onLock,
}: {
  data: LiveData;
  code: string;
  school?: LiveSchool;
  onSchool: (school: LiveSchool) => void;
  onLock: () => void;
}) => (
  <>
    <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
      <p className="max-w-[62ch] text-lg leading-relaxed">Hier stehen alle Daten für jede Schule.</p>
      <Button variant="outline" className="h-10 bg-card px-4 text-[0.9375rem] font-bold" onClick={onLock}>
        <Lock aria-hidden />
        Bereich sperren
      </Button>
    </div>
    {data.teamsUrl && (
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-lg leading-relaxed">Fragen während des Workshops? Rainer ist im Teams-Meeting erreichbar.</p>
        <OpenButton href={data.teamsUrl} label="Teams-Meeting öffnen" />
      </div>
    )}
    <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border border-alert-border bg-alert px-6 py-5">
      <TriangleAlert aria-hidden className="size-7 shrink-0 text-warn-strong" />
      <div className="min-w-[18rem] flex-1">
        <p className="font-bold text-warn-strong">Wichtig vor dem Workshop: Locker-Karten herunterladen</p>
        <p className="mt-1 leading-relaxed text-foreground">
          Mit dem Code auf ihrer Karte speichern die Kinder ihre Spiele im CoderDojo Locker. Ideal: ausdrucken und in
          Kärtchen schneiden. Wer eine Karte möchte und keine hat, bekommt den Code auch einfach angesagt.
        </p>
      </div>
      {school ? (
        <Button asChild className="h-11 bg-warn-strong px-5 text-base font-bold hover:bg-warn-strong-hover">
          <a href={liveFileUrl(school.lockerPdf, code)} download>
            <Download aria-hidden className="size-5" />
            Locker-Karten (PDF)
          </a>
        </Button>
      ) : (
        <a href="#schule" className="font-bold text-warn-strong underline underline-offset-4">
          Dafür zuerst die Schule wählen
        </a>
      )}
    </div>
    <Section title="Schule wählen" id="schule" level={3}>
      <SchoolPicker schools={data.schools} school={school} onSchool={onSchool} />
    </Section>
    <Section title="Wichtige Links" id="links" level={3}>
      {school ? (
        <Links school={school} code={code} />
      ) : (
        <p className="rounded-xl border border-dashed border-[hsla(225,20%,40%,0.35)] px-6 py-8 text-center">
          Oben die Schule wählen, dann stehen hier ihr KI-Zugangscode und ihre Locker-Karten.
        </p>
      )}
    </Section>
  </>
);

const SchoolPicker = ({
  schools,
  school,
  onSchool,
}: {
  schools: LiveSchool[];
  school?: LiveSchool;
  onSchool: (school: LiveSchool) => void;
}) => (
  <fieldset className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
    <legend className="sr-only">Schule</legend>
    {schools.map((s) => (
      <label
        key={s.id}
        className={cn(
          'flex min-h-14 cursor-pointer items-center gap-2.5 rounded-xl border bg-card px-4 py-3 font-bold transition-[background-color,border-color,box-shadow] duration-150',
          'hover:border-primary has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ring',
          s.id === school?.id && 'border-primary bg-primary text-primary-foreground hover:border-primary',
        )}
      >
        <input
          type="radio"
          name="schule"
          value={s.id}
          checked={s.id === school?.id}
          onChange={() => onSchool(s)}
          className="sr-only"
        />
        <span
          aria-hidden
          className={cn(
            'grid size-5 shrink-0 place-items-center rounded-full border-2 border-[hsla(225,15%,40%,0.4)]',
            s.id === school?.id && 'border-white bg-white text-primary',
          )}
        >
          {s.id === school?.id && <Check className="size-3.5" strokeWidth={3.5} />}
        </span>
        <span className="leading-snug">{s.name}</span>
      </label>
    ))}
  </fieldset>
);

const Links = ({ school, code }: { school: LiveSchool; code: string }) => {
  // the short address the kids type from the projector; the server redirects to the real playground link
  const playground = `${location.origin}${PLAYGROUND_PATH}`;
  return (
    <dl className="divide-y overflow-hidden rounded-xl bg-card shadow-[0_1px_3px_hsla(225,30%,40%,0.12)]">
      <LinkRow
        term="KI-Scratch"
        note="Scratch mit dem KI-Helfer. Für alle Schulen gleich. Die Kinder tippen diese Adresse ab."
      >
        <span className="block text-[1.75rem] leading-tight font-bold break-words text-primary-ink">
          {location.host}
        </span>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <OpenButton href={`${location.origin}/`} label="App öffnen" primary />
          <CopyButton text={`${location.origin}/`} label="Link kopieren" />
          <LargeTypeButton text={location.host} />
        </div>
      </LinkRow>
      <LinkRow term="KI-Zugangscode" note="Für den KI-Helfer in der App. Groß- und Kleinschreibung egal.">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <span className="text-[2.25rem] leading-none font-bold tracking-[0.02em] text-primary-ink tabular-nums">
            {school.accessCode}
          </span>
          <div className="flex flex-wrap gap-2.5">
            <CopyButton text={school.accessCode} label="Code kopieren" />
            <LargeTypeButton text={school.accessCode} />
          </div>
        </div>
      </LinkRow>
      <LinkRow
        term="Locker-Karten"
        note="Ein Code pro Karte: zum Ausdrucken und Schneiden. Die Liste (CSV) hat dieselben Codes."
      >
        <div className="flex flex-wrap gap-2.5">
          <Button asChild className="h-10 px-4 text-[0.9375rem] font-bold">
            <a href={liveFileUrl(school.lockerPdf, code)} download>
              <Download aria-hidden />
              Karten als PDF
            </a>
          </Button>
          <Button asChild variant="outline" className="h-10 px-4 text-[0.9375rem] font-bold">
            <a href={liveFileUrl(school.lockerCsv, code)} download>
              <FileSpreadsheet aria-hidden />
              Liste als CSV
            </a>
          </Button>
        </div>
      </LinkRow>
      <LinkRow
        term="TypeScript-Entwicklungsumgebung"
        note="Für das Video „TypeScript“. Für alle Schulen gleich. Die Kinder tippen diese Adresse ab."
      >
        <span className="block text-[1.75rem] leading-tight font-bold break-words text-primary-ink">
          {location.host}
          {PLAYGROUND_PATH}
        </span>
        <div className="mt-4 flex flex-wrap gap-2.5">
          <OpenButton href={playground} label="Entwicklungsumgebung öffnen" primary />
          <CopyButton text={playground} label="Link kopieren" />
          <LargeTypeButton text={`${location.host}${PLAYGROUND_PATH}`} />
        </div>
      </LinkRow>
    </dl>
  );
};

const LinkRow = ({ term, note, children }: { term: string; note: string; children: ReactNode }) => (
  <div className="grid gap-x-10 gap-y-3 px-6 py-6 md:grid-cols-[16rem_1fr]">
    <dt>
      <span className="block text-[1.0625rem] font-bold text-primary-ink">{term}</span>
      <span className="mt-1 block text-[0.9375rem] leading-snug text-muted-foreground">{note}</span>
    </dt>
    <dd className="min-w-0">{children}</dd>
  </div>
);

const CopyButton = ({ text, label }: { text: string; label: string }) => {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <Button
      variant="outline"
      className="h-10 min-w-36 px-4 text-[0.9375rem] font-bold"
      onClick={() => {
        // the clipboard can be refused (browser settings): the text is on the page to copy by hand
        navigator.clipboard.writeText(text).then(
          () => setCopied(true),
          () => {},
        );
      }}
    >
      {copied ? <Check aria-hidden className="text-success" strokeWidth={3} /> : <Copy aria-hidden />}
      <span aria-live="polite">{copied ? 'Kopiert' : label}</span>
    </Button>
  );
};

/** large-type.com shows the text across the whole screen, for the projector */
const LargeTypeButton = ({ text }: { text: string }) => (
  <Button asChild variant="outline" className="h-10 px-4 text-[0.9375rem] font-bold">
    <a href={`https://large-type.com/#${encodeURI(text)}`} target="_blank" rel="noreferrer">
      <Type aria-hidden />
      Groß anzeigen
    </a>
  </Button>
);

const OpenButton = ({ href, label, primary }: { href: string; label: string; primary?: boolean }) => (
  <Button asChild variant={primary ? 'default' : 'outline'} className="h-10 px-4 text-[0.9375rem] font-bold">
    <a href={href} target="_blank" rel="noreferrer">
      <ExternalLink aria-hidden />
      {label}
    </a>
  </Button>
);
