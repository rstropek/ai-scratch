// The public page /access, German: how access codes, donated keys and own keys work, who creates what, which
// limits apply and why it is secure. It describes the system as designed in docs/platform-plan.md (Rainer,
// 2026-11-01: the target, no status markers); when a decision there changes, change this text with it. The limits
// are the env vars' defaults from @ai-scratch/db/limits (a static page reads no environment).

import { DEFAULT_LIMITS, OWN_KEY_MAX_REMAINING_USD } from '@ai-scratch/db/limits';
import type { MapEdgeId, MapNodeId, MapNodeText } from '../components/access-map.tsx';
import type { ChipTone } from '../components/ui/chip.tsx';
import { FlowList } from '../components/ui/flow-list.tsx';
import { Prose } from '../components/ui/prose.tsx';
import { TextLink } from '../components/ui/text-link.tsx';
import { LINK_VALID_MINUTES, REGISTRATIONS_PER_EMAIL_HOUR, REGISTRATIONS_PER_IP_HOUR } from '../lib/rules.ts';
import { SOURCE_URL } from '../lib/site.ts';

const { accountUsdMonth, codeBudgetUsd, codeMaxHours, freeCodesPerAccountMonth, totalUsdMonth } = DEFAULT_LIMITS;

const usd = (amount: number) => `${amount} US-Dollar`;
const hours = (count: number) => `${count} Stunden`;

export interface TourStep {
  /** the label on the step's button */
  short: string;
  title: string;
  /** who acts in this step */
  actor: { label: string; tone: ChipTone };
  body: readonly string[];
  /** a list after the body: what the server checks */
  checks?: readonly string[];
  limits: readonly string[];
  safety: readonly string[];
  nodes: readonly MapNodeId[];
  edges: readonly MapEdgeId[];
}

const actors = {
  donor: { label: 'Spender', tone: 'info' },
  operator: { label: 'Administrator:innen', tone: 'primary' },
  adult: { label: 'Lehrkraft oder Eltern', tone: 'success' },
  kid: { label: 'Kind', tone: 'neutral' },
  server: { label: 'AI-Scratch, automatisch', tone: 'neutral' },
} as const satisfies Record<string, TourStep['actor']>;

const nodes: Record<MapNodeId, MapNodeText> = {
  donor: { title: 'Spender', sub: 'Anthropic-Guthaben' },
  pool: { title: 'Schlüssel-Pool', sub: 'im Office' },
  free: { title: 'Gratis-Budget', sub: 'pro Konto freigeschaltet' },
  adult: { title: 'Erwachsene', sub: 'Lehrkräfte und Eltern' },
  openrouter: { title: 'OpenRouter', sub: 'eigener Schlüssel' },
  code: { title: 'Zugangscode', sub: 'TIGER-APFEL-48', mono: true },
  kid: { title: 'Kind', sub: 'ohne Konto' },
  server: { title: 'Prüfung', sub: 'auf dem Server' },
  claude: { title: 'KI-Helfer', sub: 'Claude von Anthropic' },
};

const steps: readonly TourStep[] = [
  {
    short: 'Spenden',
    title: 'Spenden bezahlen die KI',
    actor: actors.donor,
    body: [
      'Der KI-Helfer in AI-Scratch ist Claude von Anthropic. Seine Kosten tragen gespendete Guthaben: von AI-Scratch selbst und von Unterstützerinnen und Unterstützern.',
      'Wer spendet, gibt uns einen API-Schlüssel seines Anthropic-Kontos. Eine Organisation kann unserem Server stattdessen direkt vertrauen, ganz ohne Schlüssel (mehr dazu unten bei der Technik).',
    ],
    limits: [
      'Jeder gespendete Schlüssel hat bei uns ein eigenes Limit pro Monat.',
      'Zusätzlich setzen die Spender in ihrem Anthropic-Konto ein Ausgabelimit.',
    ],
    safety: ['Mehr als ihr Ausgabelimit bei Anthropic kann eine Spende nie kosten.'],
    nodes: ['donor', 'pool'],
    edges: ['donor-pool'],
  },
  {
    short: 'Pool',
    title: 'Der Schlüssel-Pool',
    actor: actors.operator,
    body: [
      'Die Administrator:innen von AI-Scratch verwalten die gespendeten Schlüssel im Office, auf einer Seite, die nur sie öffnen können. Bevor ein neuer Schlüssel gespeichert wird, prüft eine winzige Anfrage an Anthropic, dass er funktioniert und Guthaben hat.',
      'Danach zeigt das Office den Schlüssel nie wieder, nur seine letzten vier Zeichen.',
    ],
    limits: [
      'Der Pool verbraucht die Schlüssel nacheinander, nach Priorität. Hat einer sein Monatslimit erreicht oder lehnt Anthropic ihn ab, kommt der nächste dran.',
    ],
    safety: [
      'Die Schlüssel liegen verschlüsselt in einer Datenbank in der EU. Den Generalschlüssel dazu verwahrt Azure Key Vault.',
    ],
    nodes: ['pool'],
    edges: [],
  },
  {
    short: 'Konto',
    title: 'Konto und Gratis-Budget',
    actor: actors.adult,
    body: [
      'Lehrkräfte und Eltern registrieren sich im Office und bestätigen ihre E-Mail-Adresse über einen Link.',
      'Lehrkräfte können dabei das Gratis-Budget beantragen, das der Pool bezahlt. Sie nennen ihre Schule und wofür sie AI-Scratch nutzen wollen. Eine KI sortiert offensichtlich ungültige Anträge aus, die Entscheidung treffen die Administrator:innen von AI-Scratch. Eltern können das Gratis-Budget nicht beantragen; die Administrator:innen können es aber für jedes Konto freischalten.',
    ],
    limits: [
      `${freeCodesPerAccountMonth} Codes pro Konto und Monat`,
      `${usd(accountUsdMonth)} KI-Kosten pro Konto und Monat`,
      `${usd(totalUsdMonth)} im Monat für alle Konten zusammen`,
    ],
    safety: [
      'Codes erstellen nur registrierte Erwachsene. Das Gratis-Budget gibt es nur mit Freigabe der Administrator:innen, und sie können es jederzeit wieder entziehen.',
    ],
    nodes: ['adult', 'free'],
    edges: ['pool-free'],
  },
  {
    short: 'Eigener Schlüssel',
    title: 'Oder: ein eigener OpenRouter-Schlüssel',
    actor: actors.adult,
    body: [
      'Ohne Gratis-Budget funktioniert AI-Scratch mit einem eigenen API-Schlüssel von OpenRouter (openrouter.ai). Die KI-Kosten zahlen Sie dann direkt an OpenRouter, nicht an uns.',
      'Bei OpenRouter legen Sie fest, wie viel über den Schlüssel höchstens ausgegeben werden kann. Am besten legen Sie dort einen eigenen Schlüssel nur für AI-Scratch an. Den Schlüssel tragen Sie im Office ein, nie im Lernspiel.',
    ],
    limits: [
      'Codes lassen sich nur aus Schlüsseln mit Ausgabelimit erstellen.',
      `Beim Erstellen eines Codes dürfen über den Schlüssel höchstens noch ${usd(OWN_KEY_MAX_REMAINING_USD)} offen sein. Für das Limit danach sind Sie verantwortlich.`,
    ],
    safety: [
      'Wir speichern den Schlüssel verschlüsselt in der EU, und Kinder bekommen ihn nie zu sehen. Löschen Sie ihn bei uns, funktionieren seine Codes nicht mehr.',
    ],
    nodes: ['adult', 'openrouter'],
    edges: ['adult-openrouter'],
  },
  {
    short: 'Code',
    title: 'Der Zugangscode',
    actor: actors.adult,
    body: [
      'Für eine Unterrichtsstunde oder einen Workshop erstellen Sie im Office einen Zugangscode, aus dem Gratis-Budget oder aus Ihrem eigenen Schlüssel. Das Office würfelt ihn aus zwei Wörtern und zwei Ziffern, etwa TIGER-APFEL-48; gefällt er Ihnen nicht, würfeln Sie neu. Eigene Codes gibt es nicht: So lassen sie sich kaum erraten.',
      'Der Code gilt in einem Zeitfenster, das auch später beginnen kann. Ein Kommentar hilft beim Wiederfinden („1A Digitale Grundbildung“); Namen von Kindern gehören nicht hinein. Den „frage KI“-Block, mit dem Kinder die KI aus ihren eigenen Programmen fragen, können Sie pro Code ausschalten.',
    ],
    limits: [`höchstens ${hours(codeMaxHours)} gültig`, `höchstens ${usd(codeBudgetUsd)} KI-Kosten`],
    safety: ['Der Code ist alles, was Kinder bekommen: kein Schlüssel, kein Passwort, kein Konto.'],
    nodes: ['adult', 'code'],
    edges: ['adult-code', 'free-code', 'openrouter-code'],
  },
  {
    short: 'Kind',
    title: 'Das Kind gibt den Code ein',
    actor: actors.kid,
    body: [
      'Die Kinder öffnen ai-scratch.dev und tippen den Code in den Chat neben dem Scratch-Editor. Sie brauchen kein Konto und geben nichts über sich an.',
      'Scratch funktioniert auch ohne Code, ebenso das Speichern und Laden im CoderDojo Locker; der Code schaltet nur den KI-Helfer frei. Bis wann er gilt, sehen die Kinder im Chat.',
    ],
    limits: ['Nachrichten sind gebremst: Ein Kind kann nur wenige schnell hintereinander schicken.'],
    safety: ['Nach seinem Zeitfenster funktioniert der Code nicht mehr, auch wenn ihn jemand weitergegeben hat.'],
    nodes: ['code', 'kid'],
    edges: ['code-kid'],
  },
  {
    short: 'Prüfung',
    title: 'Jede Nachricht wird geprüft',
    actor: actors.server,
    body: ['Bevor eine Nachricht die KI erreicht, prüft der Server von AI-Scratch:'],
    checks: [
      'Der Code gilt gerade, und sein Budget ist nicht verbraucht.',
      'Gratis-Budget: Es ist für das Konto noch freigeschaltet.',
      'Gratis-Budget: Weder das Konto noch alle Konten zusammen haben ihr Monatsbudget verbraucht.',
      'Gratis-Budget: Ein Schlüssel im Pool hat noch Guthaben.',
      'Eigener Schlüssel: Sein Limit ist nicht erreicht; das prüft OpenRouter selbst.',
      'Ein Jugendschutz-Filter liest die Nachricht. Was nicht für Kinder passt, erreicht die KI nie.',
    ],
    limits: ['Fällt eine Prüfung durch, bekommt das Kind statt einer Antwort einen Hinweis auf Deutsch.'],
    safety: [
      'Die Schlüssel kennt nur der Server. Er holt sie aus dem Pool oder vom Konto des Erwachsenen; in den Browser des Kindes kommen sie nie.',
    ],
    nodes: ['kid', 'server', 'pool', 'openrouter'],
    edges: ['kid-server', 'pool-server', 'openrouter-server'],
  },
  {
    short: 'Antwort',
    title: 'Antwort und Abrechnung',
    actor: actors.server,
    body: [
      'Der Server schickt die Nachricht an Claude und die Antwort zurück an das Kind. Alle Sitzungen nutzen denselben Schlüssel aus dem Pool, bis sein Monatslimit erreicht ist; dann nimmt der Server den nächsten.',
      'Nach jeder Antwort bucht er die tatsächlichen Kosten auf den Code, bei Codes aus dem Gratis-Budget auch auf das Konto, den Schlüssel und den Monat. Ist ein Budget aufgebraucht, stoppen alle Codes, die daran hängen, auch mitten in der Stunde. Mit dem neuen Monat beginnen die Monatsbudgets wieder bei null.',
    ],
    limits: [
      'Es zählt nur, was wirklich verbraucht wurde; nichts wird im Voraus reserviert.',
      'Monate sind Kalendermonate nach Wiener Zeit.',
    ],
    safety: [
      'Über ein Budget hinaus gehen höchstens die Anfragen, die gerade laufen.',
      'Sind 80 % des Monatsbudgets oder des Limits eines Schlüssels verbraucht, bekommen die Administrator:innen eine E-Mail.',
    ],
    nodes: ['server', 'claude'],
    edges: ['server-claude'],
  },
];

export const access = {
  title: 'So funktioniert der Zugang zur KI',
  description:
    'Wer Schlüssel und Codes erstellt, welche Grenzen gelten und warum Kinder nie einen Schlüssel zu sehen bekommen.',
  tour: {
    title: 'Schritt für Schritt',
    intro: 'Vom gespendeten Guthaben bis zur Antwort an das Kind. Klicken Sie sich durch.',
    stepsLabel: 'Schritte',
    back: 'Zurück',
    next: 'Weiter',
    restart: 'Von vorn',
    position: (step: number, count: number) => `Schritt ${step} von ${count}`,
    actor: 'Wer handelt:',
    keyLegend: 'gestrichelt: Hier holt der Server einen Schlüssel',
    limits: 'Grenzen',
    safety: 'Sicherheit',
    mapLabel:
      'Übersicht: Spender füllen den Schlüssel-Pool, der Pool bezahlt das Gratis-Budget. Erwachsene erstellen Zugangscodes aus dem Gratis-Budget oder aus einem eigenen OpenRouter-Schlüssel. Kinder geben den Code ein; der Server prüft jede Nachricht, holt den passenden Schlüssel und fragt den KI-Helfer.',
    nodes,
    steps,
  },
  who: {
    title: 'Wer erstellt was?',
    columns: { who: 'Wer', creates: 'erstellt', neverSees: 'sieht nie' },
    rows: [
      {
        who: 'Spender',
        creates:
          'einen Anthropic-Schlüssel mit Ausgabelimit, oder für ihre Organisation eine Vertrauensregel ganz ohne Schlüssel',
        neverSees: 'wer ihr Guthaben nutzt',
      },
      {
        who: 'Administrator:innen von AI-Scratch',
        creates: 'den Schlüssel-Pool; sie schalten das Gratis-Budget frei',
        neverSees: 'einen gespeicherten Schlüssel im Ganzen, nur dessen letzte vier Zeichen',
      },
      {
        who: 'Lehrkräfte',
        creates: 'ihr Konto, den Antrag auf das Gratis-Budget, Zugangscodes, auf Wunsch eigene OpenRouter-Schlüssel',
        neverSees: 'die gespendeten Schlüssel',
      },
      {
        who: 'Eltern und andere Erwachsene',
        creates: 'ihr Konto, eigene OpenRouter-Schlüssel, Zugangscodes',
        neverSees: 'die gespendeten Schlüssel',
      },
      { who: 'Kinder', creates: 'nichts: Sie tippen nur einen Code ein', neverSees: 'irgendeinen Schlüssel' },
    ],
  },
  limits: {
    title: 'Welche Grenzen gelten?',
    columns: { limit: 'Grenze', value: 'Wert', appliesTo: 'gilt für' },
    rows: [
      { limit: 'Zeitfenster eines Codes', value: `höchstens ${hours(codeMaxHours)}`, appliesTo: 'alle Codes' },
      { limit: 'KI-Kosten eines Codes', value: `höchstens ${usd(codeBudgetUsd)}`, appliesTo: 'alle Codes' },
      { limit: 'Codes pro Konto', value: `${freeCodesPerAccountMonth} im Monat`, appliesTo: 'Gratis-Budget' },
      { limit: 'KI-Kosten pro Konto', value: `${usd(accountUsdMonth)} im Monat`, appliesTo: 'Gratis-Budget' },
      { limit: 'KI-Kosten aller Konten', value: `${usd(totalUsdMonth)} im Monat`, appliesTo: 'Gratis-Budget' },
      {
        limit: 'Gespendeter Schlüssel',
        value: 'ein eigenes Limit pro Monat, dazu das Ausgabelimit bei Anthropic',
        appliesTo: 'Gratis-Budget',
      },
      {
        limit: 'Eigener OpenRouter-Schlüssel',
        value: `Ausgabelimit nötig; beim Erstellen eines Codes höchstens ${usd(OWN_KEY_MAX_REMAINING_USD)} offen`,
        appliesTo: 'eigene Schlüssel',
      },
    ],
    footer: 'Monate sind Kalendermonate nach Wiener Zeit. Es zählt nur, was wirklich verbraucht wurde.',
  },
  whyTitle: 'Warum ist das sicher?',
  techTitle: 'Für Technik-Interessierte',
} as const;

/** The reasons, for teachers and parents; place it inside Prose. */
export function WhySecure() {
  return (
    <ul>
      <li>
        <strong>Kinder bekommen nie einen Schlüssel.</strong> Sie bekommen nur einen Code, der nach höchstens{' '}
        {hours(codeMaxHours)} abläuft und höchstens {usd(codeBudgetUsd)} kosten kann. Ein weitergegebener Code ist damit
        wenig wert.
      </li>
      <li>
        <strong>Jede Geldquelle hat mehrere Grenzen.</strong> Der Code, das Konto, der Monat und jeder Schlüssel haben
        ein eigenes Limit, und Anthropic oder OpenRouter setzen noch einmal ein eigenes.
      </li>
      <li>
        <strong>Schlüssel bleiben auf dem Server.</strong> Sie liegen verschlüsselt in einer Datenbank in der EU, werden
        nach dem Speichern nie wieder angezeigt und gehen nur über eine verschlüsselte Verbindung zum KI-Anbieter.
      </li>
      <li>
        <strong>Nur geprüfte Erwachsene erstellen Codes.</strong> Jedes Konto braucht eine bestätigte E-Mail-Adresse;
        das Gratis-Budget gibt es erst nach Freigabe durch die Administrator:innen.
      </li>
      <li>
        <strong>Jede Nachricht wird gefiltert.</strong> Ein Jugendschutz-Filter liest, was Kinder schreiben, bevor die
        KI es sieht.
      </li>
      <li>
        <strong>Was Kinder schreiben, geht an KI-Anbieter, auch außerhalb der EU.</strong> Darum geben Kinder keine
        persönlichen Daten ein (<TextLink href="/terms#datenverarbeitung">Nutzungsbedingungen, Abschnitt 8</TextLink>).
      </li>
      <li>
        <strong>Der Quellcode ist offen.</strong> Jede und jeder kann nachprüfen, ob AI-Scratch tut, was hier steht:{' '}
        <TextLink href={SOURCE_URL}>github.com/rstropek/ai-scratch</TextLink>.
      </li>
    </ul>
  );
}

const federation = [
  {
    title: 'Azure',
    text: 'Die Web-App holt für ihre verwaltete Identität ein Token von Microsoft Entra ID, ausgestellt für eine eigene Zielgruppe (Audience).',
  },
  {
    title: 'Anthropic prüft',
    text: 'Aussteller, Zielgruppe und die Objekt-ID unserer Identität müssen genau zu einer Regel passen, die die Organisation der Spender angelegt hat.',
  },
  {
    title: 'Kurzes Token',
    text: 'Anthropic gibt ein Zugriffstoken für ein Dienstkonto in einem Workspace der Spender aus. Es gilt nur Minuten.',
  },
  {
    title: 'Claude',
    text: 'Damit ruft der Server Claude auf. Die Kosten erscheinen im Workspace der Spender, unter deren Ausgabelimit.',
  },
] as const;

/** The technical part: Prose blocks with the federation flow between them. */
export function TechDocument() {
  return (
    <>
      <Prose>
        <h3>Schlüssel im Ruhezustand</h3>
        <p>
          Gespeicherte API-Schlüssel sind mit AES-256-GCM versiegelt; GCM erkennt auch jede Veränderung. Die ID der
          Datenbankzeile ist als zusätzliche authentifizierte Daten eingebunden: Ein versiegelter Schlüssel, der in eine
          andere Zeile kopiert wird, lässt sich nicht öffnen. Der 32 Byte lange Generalschlüssel ist ein Secret in Azure
          Key Vault, das die Web-Apps von AI-Scratch beim Start lesen. Ein HMAC-Fingerabdruck unter demselben
          Generalschlüssel verhindert, dass derselbe Schlüssel zweimal in den Pool kommt.
        </p>
        <p>
          Die Datenbank (Azure Database for PostgreSQL, Region Nordeuropa) nimmt Anmeldungen der Web-Apps nur über deren
          verwaltete Identität an. Ein Datenbank-Passwort, das verloren gehen könnte, gibt es nicht.
        </p>
        <h3>Die Prüfung beim Speichern</h3>
        <p>
          Ein neuer Schlüssel wird mit einer einzigen Anfrage an das kleinste Claude-Modell geprüft (
          <code className="font-mono text-sm">max_tokens: 1</code>, ein Bruchteil eines Cents). Sie zeigt, dass der
          Schlüssel gilt, der Workspace stimmt und Guthaben da ist. Ein Restguthaben meldet Anthropic nicht; darum zählt
          AI-Scratch die Ausgaben jedes Schlüssels selbst gegen dessen Monatslimit.
        </p>
        <h3>Spenden ohne Schlüssel: Workload Identity Federation</h3>
        <p>
          Für Organisationen gibt es einen Weg ganz ohne Schlüssel. Die Web-Apps laufen in Azure App Service mit einer
          verwalteten Identität. Statt mit einem API-Schlüssel tauschen sie bei Anthropic ein Token von Microsoft Entra
          ID gegen ein Zugriffstoken, das nur Minuten gilt (OAuth 2.0, JWT Bearer):
        </p>
      </Prose>
      <FlowList items={federation} />
      <Prose>
        <p>
          Es gibt kein Geheimnis, das verloren gehen oder gestohlen werden könnte. Die Regel passt nur auf genau diese
          eine Identität, nie auf alle Anwendungen unseres Azure-Mandanten. Archivieren die Spender die Regel in der
          Anthropic Console, endet der Zugriff, sobald das laufende Token abläuft, nach wenigen Minuten.
        </p>
        <h3>Zwei getrennte Apps</h3>
        <p>
          Das Lernspiel (ai-scratch.dev) und das Office (office.ai-scratch.dev) sind getrennte Web-Apps. Das Lernspiel
          liest Codes und bucht Kosten direkt in der Datenbank und ruft das Office nie auf. Das Anmelde-Cookie der
          Erwachsenen gilt nur für das Office; es erreicht nie die Seite, auf der Scratch und die Projekte der Kinder
          laufen.
        </p>
        <h3>Registrierung</h3>
        <p>
          Das Registrierungsformular schützen Cloudflare Turnstile und Ratenlimits ({REGISTRATIONS_PER_IP_HOUR} pro
          Stunde je IP-Adresse, {REGISTRATIONS_PER_EMAIL_HOUR} je E-Mail-Adresse). Der Bestätigungslink ist mit
          AES-256-GCM verschlüsselt und {LINK_VALID_MINUTES} Minuten gültig; ein Konto entsteht erst, wenn jemand ihn
          benutzt und ein Passwort setzt.
        </p>
      </Prose>
    </>
  );
}
