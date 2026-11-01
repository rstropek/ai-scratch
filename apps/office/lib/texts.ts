// Every German text of the office, in one place: English joins later.
import type { RefusalReason } from './jev.ts';
import { LINK_VALID_MINUTES } from './rules.ts';

const kindLabels = {
  teacher: 'Lehrkraft',
  parent: 'Eltern oder andere Erwachsene (z. B. Code Club, Jugendgruppe)',
} as const;

/** the school levels a teacher can tick in the application; the keys are stored */
export const GRADES = {
  volksschule: 'Volksschule',
  unterstufe: 'Mittelschule/AHS-Unterstufe',
  oberstufe: 'Oberstufe',
} as const;
export type Grade = keyof typeof GRADES;

const formatDateTime = (date: Date) =>
  date.toLocaleString('de-AT', { timeZone: 'Europe/Vienna', dateStyle: 'medium', timeStyle: 'short' });
const formatDate = (date: Date) => date.toLocaleDateString('de-AT', { timeZone: 'Europe/Vienna', dateStyle: 'medium' });
const formatTime = (date: Date) => date.toLocaleTimeString('de-AT', { timeZone: 'Europe/Vienna', timeStyle: 'short' });
/** dollars as providers bill them, no conversion: `$ 1,20` */
const formatUsd = (amount: number) => amount.toLocaleString('de-AT', { style: 'currency', currency: 'USD' });
const formatMonth = (date: Date) =>
  date.toLocaleDateString('de-AT', { timeZone: 'Europe/Vienna', month: 'long', year: 'numeric' });
/** a code's window: the start with its date, the end as a time (codes last hours), with its date when it differs */
const formatWindow = (start: Date, end: Date) =>
  `${formatDateTime(start)} – ${formatDate(start) === formatDate(end) ? formatTime(end) : formatDateTime(end)}`;
/** what is left of a limit, never below zero */
const left = (limit: number, spent: number) => Math.max(0, limit - spent);
/** the end of every mail to adults: who sends it and where answers go (Reply-To, MAIL_REPLY_TO) */
const mailSignature = [
  '',
  'Viele Grüße',
  'AI-Scratch',
  '',
  '--',
  'AI-Scratch: Scratch mit KI-Assistent für Kinder von 10 bis 14 Jahren',
  'https://ai-scratch.dev',
  'Fragen? Antworten Sie einfach auf diese E-Mail.',
];

export const texts = {
  appName: 'AI-Scratch Office',
  format: {
    dateTime: formatDateTime,
    date: formatDate,
    time: formatTime,
    usd: formatUsd,
    month: formatMonth,
    window: formatWindow,
  },
  login: {
    title: 'Anmelden',
    subtitle: 'Für Lehrkräfte und Eltern mit Konto.',
    email: 'E-Mail',
    password: 'Passwort',
    submit: 'Anmelden',
    submitting: 'Anmelden …',
    failed: 'E-Mail oder Passwort stimmt nicht.',
    tooMany: 'Zu viele Versuche. Bitte warten Sie kurz und versuchen Sie es dann noch einmal.',
    error: 'Die Anmeldung hat nicht geklappt. Bitte versuchen Sie es noch einmal.',
    forgot: 'Passwort vergessen?',
    newTitle: 'Neu hier?',
    newText:
      'Kinder nutzen den KI-Helfer in AI-Scratch mit einem Zugangscode. Diese Codes erstellen Erwachsene in ihrem Konto: Lehrkräfte für ihre Klassen, Eltern für ihre Kinder.',
    register: 'Als Lehrkraft oder Elternteil registrieren',
  },
  /** on the login and the registration page; the last line speaks to kids who landed here, so it says "du" */
  whoMayRegister: {
    label: 'Wer sich registrieren darf',
    yes: [
      'Lehrkräfte',
      'Eltern und Erziehungsberechtigte',
      'Andere Erwachsene, die mit Kindern arbeiten, z. B. im Code Club oder in einer Jugendgruppe',
    ],
    no: 'Keine Kinder und Jugendlichen unter 18',
    kids: 'Deinen Zugangscode für den KI-Helfer bekommst du von deiner Lehrerin, deinem Lehrer oder deinen Eltern.',
  },
  /** at the foot of the login and the registration page; the terms say the same in section 11 */
  scratchNote: {
    title: 'Kein offizielles Angebot von Scratch',
    text: 'AI-Scratch ist eine unabhängige App, mit der Kinder Grundlagen der künstlichen Intelligenz lernen. Sie verwendet den Scratch-Editor als Baustein, ist aber kein Angebot der Scratch Foundation oder des MIT.',
    link: 'Mehr in den Nutzungsbedingungen',
  },
  shell: {
    signOut: 'Abmelden',
    signIn: 'Anmelden',
    admin: 'Konten',
    keys: 'API-Schlüssel',
    codes: 'Alle Codes',
    prices: 'Preise',
    openrouterKeys: 'OpenRouter-Schlüssel',
    home: 'Start',
    nav: 'Bereiche',
  },
  validation: {
    email: 'Diese E-Mail-Adresse ist unvollständig. Beispiel: name@schule.at',
    kind: 'Bitte wählen Sie, ob Sie sich als Lehrkraft oder als Erwachsene*r registrieren.',
    adult: 'Nur Erwachsene können sich registrieren.',
    terms: 'Ohne Zustimmung zu den Nutzungsbedingungen können wir kein Konto anlegen.',
    aiConsent: 'Ohne diese Zustimmung können wir kein Konto anlegen.',
    turnstile:
      'Die Sicherheitsprüfung hat nicht geklappt. Bitte warten Sie, bis sie fertig ist, und senden Sie dann noch einmal.',
    firstName: 'Bitte geben Sie Ihren Vornamen an.',
    lastName: 'Bitte geben Sie Ihren Nachnamen an.',
    passwordShort: (min: number) => `Das Passwort braucht mindestens ${min} Zeichen.`,
    passwordLong: (max: number) => `Das Passwort darf höchstens ${max} Zeichen haben.`,
    passwordRepeat: 'Die beiden Passwörter sind nicht gleich.',
    schoolName: 'Bitte geben Sie den Namen Ihrer Schule an.',
    schoolUrl: 'Diese Adresse ist unvollständig. Beispiel: www.ms-lindenweg.at',
    grades: 'Bitte wählen Sie mindestens eine Schulstufe.',
    summaryShort: (min: number) => `Bitte schreiben Sie mindestens ${min} Zeichen: ein, zwei Sätze reichen.`,
    summaryLong: (max: number) => `Bitte schreiben Sie höchstens ${max} Zeichen.`,
    summary: (count: number) => (count === 1 ? 'Bitte prüfen Sie 1 Angabe.' : `Bitte prüfen Sie ${count} Angaben.`),
  },
  register: {
    title: 'Konto für Lehrkräfte und Eltern',
    intro: 'Mit einem Konto erstellen Sie Zugangscodes, mit denen Kinder den KI-Helfer in AI-Scratch nutzen.',
    steps: [
      'Sie geben Ihre E-Mail-Adresse an und stimmen den Nutzungsbedingungen zu.',
      'Sie bestätigen Ihre E-Mail-Adresse über den Link, den wir Ihnen schicken, und legen Ihr Passwort fest.',
      'Lehrkräfte, die das Gratis-Budget beantragen, beschreiben danach kurz ihre Schule. Wir prüfen den Antrag und antworten per E-Mail.',
    ],
    privacy: 'Wir speichern Ihre Angaben auf Servern in der EU.',
    about: 'Über Sie',
    email: 'E-Mail-Adresse',
    emailHint: 'Lehrkräfte am besten mit ihrer dienstlichen Adresse. Dorthin schicken wir den Bestätigungslink.',
    kind: 'Ich registriere mich als',
    kindLabels,
    freeBudget: 'Ich beantrage das Gratis-Budget.',
    freeBudgetHint:
      'Dann tragen gespendete Mittel die KI-Kosten Ihrer Codes. Nach der Bestätigung beschreiben Sie kurz Ihre Schule, und wir prüfen den Antrag. Beantragen geht nur hier bei der Registrierung.',
    consent: 'Zustimmung',
    adult: 'Ich bin mindestens 18 Jahre alt.',
    termsBefore: 'Ich habe die ',
    termsLink: 'Nutzungsbedingungen',
    termsAfter: ' gelesen und stimme ihnen zu.',
    /** the separate, explicit consent of section 8 of the terms */
    aiConsentBefore:
      'Ich stimme ausdrücklich zu, dass KI-Dienste außerhalb der EU, insbesondere in den USA, Daten verarbeiten, wie in ',
    aiConsentLink: 'Abschnitt 8 der Nutzungsbedingungen',
    aiConsentAfter:
      ' beschrieben: was Kinder schreiben und ihre Scratch-Projekte, die Prüfung zum Schutz der Kinder und gegen Missbrauch, und die Prüfung von Registrierungen und Anträgen.',
    newTab: '(öffnet in einem neuen Tab)',
    turnstileHint: 'Sicherheitsprüfung von Cloudflare Turnstile, ohne Tracking-Cookies.',
    submit: 'Bestätigungslink senden',
    submitting: 'Wird gesendet …',
    tooManyIp: {
      title: 'Zu viele Registrierungen aus Ihrem Netzwerk.',
      text: 'In der letzten Stunde kamen schon mehrere Registrierungen von dieser Adresse. Versuchen Sie es in einer Stunde noch einmal.',
    },
    tooManyEmail: {
      title: 'Für diese E-Mail-Adresse kamen schon mehrere Anfragen.',
      text: 'Bitte schauen Sie in Ihrem Postfach und im Spam-Ordner nach, oder versuchen Sie es in einer Stunde noch einmal.',
    },
    error: {
      title: 'Senden hat nicht geklappt.',
      text: 'Bitte versuchen Sie es noch einmal. Ihre Eingaben sind noch da.',
    },
    sentTitle: 'Bitte bestätigen Sie Ihre E-Mail-Adresse',
    sent: (email: string) =>
      `Wir haben eine E-Mail an ${email} geschickt. Der Link darin gilt ${LINK_VALID_MINUTES} Minuten.`,
    sentHint:
      'Keine E-Mail da? Manche Schulen halten E-Mails von neuen Absendern zurück. Schauen Sie im Spam-Ordner nach und, wenn Ihre Schule Microsoft 365 nutzt, in der Quarantäne (security.microsoft.com/quarantine). Finden Sie sie dort nicht, kann Ihre Schul-IT sie freigeben.',
  },
  confirm: {
    title: 'Konto anlegen',
    intro: (email: string) => `Ihre E-Mail-Adresse ${email} ist bestätigt. Legen Sie jetzt Ihr Passwort fest.`,
    firstName: 'Vorname',
    lastName: 'Nachname',
    password: 'Passwort',
    passwordHint: (min: number) => `Mindestens ${min} Zeichen. Ein Satz, den Sie sich merken, ist ein gutes Passwort.`,
    passwordRepeat: 'Passwort wiederholen',
    submit: 'Konto anlegen',
    submitting: 'Konto wird angelegt …',
    invalidTitle: 'Dieser Link funktioniert nicht',
    invalid: 'Vielleicht wurde er beim Kopieren abgeschnitten. Bitte registrieren Sie sich noch einmal.',
    expiredTitle: 'Dieser Link ist abgelaufen',
    expired: `Bestätigungslinks gelten ${LINK_VALID_MINUTES} Minuten. Bitte registrieren Sie sich noch einmal; Sie bekommen einen neuen Link.`,
    again: 'Noch einmal registrieren',
    existsTitle: 'Ihr Konto besteht schon',
    exists: 'Melden Sie sich mit Ihrer E-Mail-Adresse und Ihrem Passwort an.',
    toLogin: 'Zur Anmeldung',
    error: {
      title: 'Das Konto konnte nicht angelegt werden.',
      text: 'Bitte versuchen Sie es noch einmal.',
    },
  },
  consent: {
    title: 'Neue Nutzungsbedingungen',
    intro: (date: string) =>
      `Wir haben die Nutzungsbedingungen geändert (${date}). Bitte lesen Sie sie und stimmen Sie ihnen zu, damit Sie AI-Scratch weiter nutzen können.`,
    decline: (email: string) =>
      `Wenn Sie nicht zustimmen, können Sie Ihr Konto löschen lassen: Schreiben Sie dazu an ${email}.`,
    submit: 'Zustimmen',
    submitting: 'Wird gespeichert …',
    error: 'Speichern hat nicht geklappt. Bitte versuchen Sie es noch einmal.',
  },
  apply: {
    title: 'Gratis-Budget beantragen',
    intro:
      'Mit dem Gratis-Budget nutzen Sie AI-Scratch kostenlos: Die KI-Kosten Ihrer Codes tragen gespendete Mittel. Darum prüfen wir jeden Antrag.',
    steps: [
      'Sie beschreiben kurz Ihre Schule und Ihr Vorhaben.',
      'Eine KI prüft den Antrag auf offensichtlich ungültige Angaben und sagt Ihnen sofort, was fehlt.',
      'Wir prüfen den Antrag und antworten per E-Mail.',
    ],
    meanwhile: 'Bis dahin nutzen Sie AI-Scratch mit eigenen OpenRouter-Schlüsseln.',
    school: 'Ihre Schule',
    schoolName: 'Name der Schule',
    schoolUrl: 'Website der Schule',
    schoolUrlHint: 'Hilft uns bei der Prüfung.',
    grades: 'Schulstufen, in denen Sie AI-Scratch nutzen möchten',
    gradeLabels: GRADES,
    plan: 'Ihr Vorhaben',
    summary: 'Warum möchten Sie AI-Scratch nutzen?',
    summaryHint: 'Zwei, drei Sätze reichen: welche Klassen, wie oft, wofür.',
    submit: 'Antrag senden',
    submitting: 'Antrag wird geprüft …',
    refusedTitle: 'Wir können den Antrag so noch nicht annehmen.',
    refusals: {
      not_genuine:
        'Ihre Beschreibung klingt nicht nach einem Vorhaben mit Kindern. Beschreiben Sie bitte kurz, mit welchen Klassen Sie AI-Scratch wofür nutzen möchten.',
      not_school:
        'Wir konnten Name und Website nicht als Schule erkennen. Bitte geben Sie den vollständigen Namen Ihrer Schule und die Adresse ihrer Website an.',
      abusive: 'Ihr Antrag enthält Formulierungen, die wir nicht annehmen können. Bitte formulieren Sie ihn sachlich.',
    } satisfies Record<RefusalReason, string>,
    error: {
      title: 'Senden hat nicht geklappt.',
      text: 'Bitte versuchen Sie es noch einmal. Ihre Eingaben sind noch da.',
    },
  },
  home: {
    greeting: (name: string) => `Hallo ${name}`,
    signedInAs: (email: string) => `Angemeldet als ${email}`,
    admin: 'Administrator',
    adminLink: 'Zu den Konten',
    kind: { parent: 'Erwachsene*r', teacher: 'Lehrkraft' },
    freeBudget: {
      missing: {
        title: 'Ihr Antrag fehlt noch',
        text: 'Sie haben bei der Registrierung das Gratis-Budget beantragt. Damit wir den Antrag prüfen können, beschreiben Sie bitte noch kurz Ihre Schule und Ihr Vorhaben.',
      },
      pending: {
        title: 'Ihr Antrag wird geprüft',
        text: (date: Date) =>
          `Wir haben Ihren Antrag auf das Gratis-Budget am ${formatDate(date)} bekommen und antworten per E-Mail. Bis dahin nutzen Sie AI-Scratch mit eigenen OpenRouter-Schlüsseln.`,
      },
      granted: {
        title: 'Gratis-Budget freigeschaltet',
        text: 'Sie können Zugangscodes erstellen, deren KI-Kosten gespendete Mittel tragen.',
      },
      rejected: {
        title: 'Gratis-Budget nicht freigeschaltet',
        text: 'Wir können Ihnen das Gratis-Budget derzeit nicht freischalten. Sie können AI-Scratch aber mit eigenen OpenRouter-Schlüsseln nutzen.',
      },
      apply: 'Antrag ausfüllen',
    },
    sent: 'Ihr Antrag ist bei uns. Wir antworten per E-Mail.',
    newCode: 'Neuer Code',
    created: (code: string) => `Code ${code} erstellt. Geben Sie ihn den Kindern, wenn die Stunde beginnt.`,
    codeDeleted: 'Code gelöscht.',
    budget: {
      title: (month: string) => `Budget im ${month}`,
      free: 'Gratis-Budget: KI-Kosten',
      freeValue: (spent: number, limit: number) =>
        `${formatUsd(spent)} von ${formatUsd(limit)} verbraucht, ${formatUsd(left(limit, spent))} übrig`,
      freeCodes: 'Codes aus dem Gratis-Budget',
      freeCodesValue: (created: number, limit: number) =>
        `${created} von ${limit} erstellt, ${left(limit, created)} übrig`,
      ownKey: (label: string, hint: string) => `OpenRouter: ${label} ${hint}`,
      ownKeyValue: (remaining: string, spent: number) =>
        `${remaining}; diesen Monat ${formatUsd(spent)} über AI-Scratch`,
      noOwnKeys: 'Noch keine eigenen OpenRouter-Schlüssel.',
      manageKeys: 'OpenRouter-Schlüssel verwalten',
      none: 'Sie haben weder das Gratis-Budget noch einen eigenen OpenRouter-Schlüssel. Fügen Sie einen Schlüssel hinzu, um Codes zu erstellen.',
      adminTitle: (month: string) => `Alle Konten im ${month}`,
      total: 'Gratis-Budget aller Konten',
      totalValue: (spent: number, limit: number) =>
        `${formatUsd(spent)} von ${formatUsd(limit)} verbraucht, ${formatUsd(left(limit, spent))} übrig`,
      ownKeysTotal: 'Über eigene OpenRouter-Schlüssel',
      ownKeysTotalValue: (spent: number) => formatUsd(spent),
      running: 'Laufende Codes',
      pool: (donor: string, hint: string) => `Pool: ${donor} ${hint}`,
      poolValue: (spent: number, cap: number) => `${formatUsd(spent)} von ${formatUsd(cap)} verbraucht`,
      poolPaused: 'pausiert',
      poolRefused: (reason: string | null) => `von Anthropic abgelehnt${reason ? `: ${reason}` : ''}`,
      noPool: 'Noch keine Zugänge im Pool: Codes aus dem Gratis-Budget funktionieren nicht.',
    },
    codesTitle: 'Ihre Codes',
    noCodes: 'Noch keine Codes.',
  },
  /** a key's remaining budget at OpenRouter, read while a page loads */
  remaining: {
    usd: (amount: number) => `bei OpenRouter noch ${formatUsd(amount)} übrig`,
    noLimit: 'ohne Limit bei OpenRouter: kein Code möglich',
    unreachable: 'OpenRouter nicht erreichbar',
    invalid: 'OpenRouter kennt den Schlüssel nicht mehr',
  },
  codes: {
    newTitle: 'Neuer Code',
    newIntro:
      'Kinder tippen den Code in AI-Scratch ein und nutzen damit den KI-Helfer, solange der Code gilt und sein Budget reicht.',
    back: 'Zur Startseite',
    noSourceTitle: 'Noch keine Quelle für Codes',
    noSource:
      'Codes brauchen das Gratis-Budget oder einen eigenen OpenRouter-Schlüssel. Fügen Sie einen Schlüssel hinzu; das Gratis-Budget schalten die Administrator:innen von AI-Scratch frei.',
    addKey: 'OpenRouter-Schlüssel hinzufügen',
    code: 'Code',
    codeHint: 'So tippen ihn die Kinder ein; Groß- und Kleinschreibung ist egal.',
    propose: 'Neuer Vorschlag',
    copy: (code: string) => `Code ${code} kopieren`,
    source: 'Wer die KI bezahlt',
    sourceFree: 'Gratis-Budget',
    sourceKey: (label: string, hint: string) => `Eigener OpenRouter-Schlüssel: ${label} ${hint}`,
    startsAt: 'Beginn (optional)',
    startsAtHint: (days: number) =>
      `Leer lassen, damit der Code sofort gilt. Höchstens ${days} Tage im Voraus, Wiener Zeit.`,
    hours: 'Dauer',
    hoursLabel: (hours: number) => (hours === 1 ? '1 Stunde' : `${hours} Stunden`),
    comment: 'Kommentar (optional)',
    commentHint: 'Zum Wiederfinden, z. B. „4b, Digitale Grundbildung“. Bitte keine Namen von Kindern.',
    askEnabled: 'Der Block „frage KI“ funktioniert mit diesem Code',
    submit: 'Code erstellen',
    budgetNote: (usd: number) =>
      `Jeder Code kann höchstens ${formatUsd(usd)} KI-Kosten verursachen. Danach antwortet der KI-Helfer nicht mehr.`,
    columns: {
      code: 'Code',
      window: 'Gilt',
      state: 'Status',
      source: 'Quelle',
      owner: 'Erstellt von',
      spent: 'Verbraucht',
      action: 'Aktion',
    },
    state: { planned: 'Geplant', running: 'Läuft', expired: 'Abgelaufen' },
    sourceShort: { free: 'Gratis-Budget', openrouter: (label: string) => `OpenRouter: ${label}` },
    askOff: '„frage KI“ aus',
    spent: (spent: number, budget: number) => `${formatUsd(spent)} von ${formatUsd(budget)}`,
    spentLeft: (spent: number, budget: number) => `${formatUsd(left(budget, spent))} übrig`,
    delete: 'Löschen',
    deleteTitle: 'Code löschen?',
    deleteText: (code: string) =>
      `${code} funktioniert danach nicht mehr, auch wenn Kinder gerade damit arbeiten (spätestens nach einer Minute). Das lässt sich nicht rückgängig machen.`,
    cancel: 'Abbrechen',
    deleteFailed: { title: 'Löschen hat nicht geklappt.', text: 'Bitte versuchen Sie es noch einmal.' },
    footer: (count: number) => `${count} ${count === 1 ? 'Code' : 'Codes'}, späterer Beginn zuerst`,
    refusals: {
      'no-free-budget': {
        title: 'Das Gratis-Budget ist für Ihr Konto nicht freigeschaltet.',
        text: 'Wählen Sie einen eigenen OpenRouter-Schlüssel.',
      },
      'free-codes-used': {
        title: 'Diesen Monat sind alle Codes aus dem Gratis-Budget erstellt.',
        text: (limit: number) =>
          `Pro Monat gibt es ${limit} Codes aus dem Gratis-Budget. Löschen Sie einen Code, den Sie nicht mehr brauchen, oder nehmen Sie einen eigenen OpenRouter-Schlüssel.`,
      },
      'key-invalid': {
        title: 'OpenRouter kennt diesen Schlüssel nicht mehr.',
        text: 'Vielleicht wurde er bei OpenRouter gelöscht. Fügen Sie einen neuen hinzu.',
      },
      'key-unreachable': {
        title: 'OpenRouter war nicht erreichbar.',
        text: 'Wir konnten das Limit des Schlüssels nicht prüfen. Bitte versuchen Sie es gleich noch einmal.',
      },
      'key-no-limit': {
        title: 'Dieser Schlüssel hat bei OpenRouter kein Limit.',
        text: (max: number) =>
          `Setzen Sie bei OpenRouter ein Ausgabelimit für den Schlüssel, so dass höchstens ${formatUsd(max)} übrig sind, und versuchen Sie es dann noch einmal.`,
      },
      'key-too-much': {
        title: 'Über diesen Schlüssel ist noch zu viel offen.',
        text: (remaining: number, max: number) =>
          `Bei OpenRouter sind noch ${formatUsd(remaining)} übrig; für einen Code dürfen es höchstens ${formatUsd(max)} sein. Senken Sie das Limit des Schlüssels bei OpenRouter und versuchen Sie es dann noch einmal.`,
      },
      taken: {
        title: 'Diesen Code gibt es gerade schon.',
        text: 'Wir haben einen neuen vorgeschlagen. Prüfen Sie ihn und erstellen Sie den Code noch einmal.',
      },
    },
    validation: {
      source: 'Bitte wählen Sie, wer die KI bezahlt.',
      startsAt: 'Bitte geben Sie Datum und Uhrzeit an, z. B. 03.11.2026, 10:00.',
      startsAtPast: 'Der Beginn liegt in der Vergangenheit. Lassen Sie das Feld leer, damit der Code sofort gilt.',
      startsAtFar: (days: number) => `Ein Code darf höchstens ${days} Tage im Voraus beginnen.`,
      hours: (max: number) => `Bitte wählen Sie eine Dauer von höchstens ${max} Stunden.`,
      comment: (max: number) => `Bitte schreiben Sie höchstens ${max} Zeichen.`,
    },
    error: { title: 'Erstellen hat nicht geklappt.', text: 'Bitte versuchen Sie es noch einmal.' },
  },
  openrouterKeys: {
    title: 'Eigene OpenRouter-Schlüssel',
    description: (max: number) =>
      `Mit einem eigenen Schlüssel von OpenRouter (openrouter.ai) erstellen Sie Codes ohne Gratis-Budget; die KI-Kosten zahlen Sie direkt an OpenRouter. Ein Code lässt sich nur aus einem Schlüssel mit Ausgabelimit erstellen, über den höchstens noch ${formatUsd(max)} offen sind.`,
    addTitle: 'Schlüssel hinzufügen',
    label: 'Name',
    labelHint: 'Damit Sie Ihre Schlüssel unterscheiden, z. B. „Schule“ oder „Zuhause“.',
    key: 'OpenRouter-Schlüssel',
    keyHint: 'Beginnt mit sk-or-. Er wird verschlüsselt gespeichert und nie wieder angezeigt; Kinder sehen ihn nie.',
    add: 'Prüfen und hinzufügen',
    checkNote: 'Beim Hinzufügen fragen wir OpenRouter nur, ob es den Schlüssel kennt; das kostet nichts.',
    listTitle: 'Ihre Schlüssel',
    empty: 'Noch keine Schlüssel.',
    columns: { label: 'Name', remaining: 'Bei OpenRouter', codes: 'Codes', added: 'Hinzugefügt', action: 'Aktion' },
    codeCount: (count: number) => (count === 1 ? '1 Code' : `${count} Codes`),
    added: 'Geprüft und hinzugefügt.',
    deleted: 'Schlüssel gelöscht.',
    delete: 'Löschen',
    deleteTitle: 'Schlüssel löschen?',
    deleteText: (label: string, hint: string) =>
      `${label} ${hint} wird bei uns gelöscht. Bei OpenRouter bleibt er gültig: Löschen Sie ihn dort, wenn Sie ihn nicht mehr brauchen.`,
    deleteCodes: (codes: string[]) =>
      codes.length === 1
        ? `Mit ihm wird auch der Code ${codes[0]} gelöscht.`
        : `Mit ihm werden auch diese ${codes.length} Codes gelöscht: ${codes.join(', ')}.`,
    cancel: 'Abbrechen',
    check: {
      invalid: {
        title: 'OpenRouter kennt diesen Schlüssel nicht.',
        text: 'Er ist falsch, abgelaufen oder gelöscht. Nichts wurde gespeichert.',
      },
      unreachable: {
        title: 'OpenRouter war nicht erreichbar.',
        text: 'Der Schlüssel konnte nicht geprüft werden, nichts wurde gespeichert. Bitte versuchen Sie es gleich noch einmal.',
      },
    },
    validation: {
      label: (max: number) => `Bitte geben Sie dem Schlüssel einen Namen (höchstens ${max} Zeichen).`,
      key: 'Das ist kein OpenRouter-Schlüssel. Er beginnt mit sk-or- und hat keine Leerzeichen.',
      duplicate: 'Diesen Schlüssel haben Sie schon hinzugefügt.',
    },
    error: {
      title: 'Speichern hat nicht geklappt.',
      text: 'Bitte versuchen Sie es noch einmal. Den Schlüssel geben Sie bitte noch einmal ein.',
    },
    deleteFailed: { title: 'Löschen hat nicht geklappt.', text: 'Bitte versuchen Sie es noch einmal.' },
  },
  forgot: {
    title: 'Passwort vergessen',
    intro:
      'Geben Sie Ihre E-Mail-Adresse an. Wenn es dazu ein Konto gibt, schicken wir Ihnen einen Link, mit dem Sie ein neues Passwort festlegen.',
    email: 'E-Mail-Adresse',
    submit: 'Link senden',
    submitting: 'Wird gesendet …',
    sentTitle: 'Bitte schauen Sie in Ihr Postfach',
    sent: 'Wenn es zu dieser Adresse ein Konto gibt, ist der Link unterwegs. Er gilt eine Stunde.',
    tooMany: 'Zu viele Anfragen. Bitte warten Sie eine Minute und versuchen Sie es dann noch einmal.',
    error: 'Senden hat nicht geklappt. Bitte versuchen Sie es noch einmal.',
  },
  reset: {
    title: 'Neues Passwort festlegen',
    password: 'Neues Passwort',
    passwordRepeat: 'Neues Passwort wiederholen',
    submit: 'Passwort speichern',
    submitting: 'Wird gespeichert …',
    doneTitle: 'Ihr Passwort ist geändert',
    done: 'Melden Sie sich jetzt mit dem neuen Passwort an. Alle anderen Anmeldungen sind beendet.',
    invalidTitle: 'Dieser Link funktioniert nicht mehr',
    invalid: 'Links zum Zurücksetzen gelten eine Stunde und nur einmal. Fordern Sie bitte einen neuen an.',
    requestNew: 'Neuen Link anfordern',
    error: 'Speichern hat nicht geklappt. Bitte versuchen Sie es noch einmal.',
  },
  admin: {
    title: 'Konten',
    description: 'Alle registrierten Erwachsenen. Nur Konten mit bestätigter E-Mail-Adresse erscheinen hier.',
    filters: {
      pending: 'Offene Anträge',
      freeBudget: 'Gratis-Budget',
      teachers: 'Lehrkräfte',
      parents: 'Eltern',
      all: 'Alle',
    },
    filterLabel: 'Filter',
    search: 'Name, E-Mail oder Schule',
    searchLabel: 'Konten durchsuchen',
    searchSubmit: 'Suchen',
    columns: {
      registered: 'Registriert',
      applied: 'Antrag vom',
      person: 'Person',
      kind: 'Rolle',
      freeBudget: 'Gratis-Budget',
      status: 'Status',
      school: 'Schule',
      action: 'Aktion',
    },
    review: 'Prüfen',
    open: 'Öffnen',
    empty: {
      pending: 'Keine offenen Anträge.',
      other: 'Keine Konten in dieser Ansicht.',
      search: (q: string) => `Kein Konto passt zu „${q}“.`,
    },
    footer: (count: number, filter: 'pending' | 'other') =>
      filter === 'pending'
        ? `${count} ${count === 1 ? 'offener Antrag' : 'offene Anträge'}, älteste zuerst`
        : `${count} ${count === 1 ? 'Konto' : 'Konten'}, neueste zuerst`,
    kind: { parent: 'Eltern', teacher: 'Lehrkraft' },
    /** where the free budget stands; none shows as a dash */
    budgetStatus: {
      missing: 'Antrag fehlt',
      pending: 'Antrag offen',
      rejected: 'Abgelehnt',
      granted: 'Freigeschaltet',
    },
    applicationStatus: {
      pending: 'Offen',
      accepted: 'Angenommen',
      rejected: 'Abgelehnt',
    },
    forbiddenTitle: 'Diese Seite ist nur für Administratoren',
    forbidden: (name: string) => `Sie sind als ${name} angemeldet.`,
    toHome: 'Zur Startseite',
    notFound: 'Dieses Konto gibt es nicht.',
    back: 'Alle Konten',
    account: {
      registeredAs: 'Registriert als',
      registeredAt: 'Registriert am',
      email: 'E-Mail',
      terms: 'Nutzungsbedingungen',
      termsValue: (version: string, at: Date) => `Version ${version}, zugestimmt am ${formatDateTime(at)}`,
      aiConsent: 'KI-Verarbeitung außerhalb der EU',
      aiConsentValue: (at: Date) => `zugestimmt am ${formatDateTime(at)}`,
      jevChecks: 'KI-Prüfungen von Anträgen',
      freeBudget: 'Gratis-Budget',
      freeBudgetValue: (at: Date | null, by: string | null, requested: boolean) =>
        at
          ? `Freigeschaltet am ${formatDateTime(at)}${by ? ` von ${by}` : ''}.`
          : requested
            ? 'Bei der Registrierung beantragt, nicht freigeschaltet.'
            : 'Nicht freigeschaltet.',
      switchOn: 'Gratis-Budget freischalten',
      switchOnHint: (name: string) =>
        `${name} bekommt eine E-Mail und kann danach Codes aus dem Gratis-Budget erstellen. Das geht auch für Eltern.`,
      switchOff: 'Gratis-Budget entziehen',
      switchOffTitle: 'Gratis-Budget entziehen?',
      switchOffText: (name: string) =>
        `${name} kann danach keine Codes aus dem Gratis-Budget mehr erstellen und bekommt keine E-Mail. Laufende Codes aus dem Gratis-Budget hören auf zu funktionieren.`,
      switchPending: 'Über das Gratis-Budget entscheiden Sie mit dem offenen Antrag unten.',
      applications: 'Anträge',
      noApplications: 'Noch kein Antrag.',
      application: (date: Date) => `Antrag vom ${formatDateTime(date)}`,
      schoolName: 'Schule',
      schoolUrl: 'Website',
      grades: 'Schulstufen',
      summary: 'Vorhaben',
      jev: 'KI-Prüfung',
      jevPassed: (model: string) => `Bestanden (${model})`,
      jevFailed: (error: string) => `Nicht geprüft: Jev war nicht erreichbar (${error})`,
      jevCapped: 'Nicht geprüft: das Limit an Prüfungen für dieses Konto ist erreicht',
      jevDisabled: 'Nicht geprüft: Jev ist abgeschaltet',
      domainMismatch: (emailDomain: string, host: string) =>
        `Die E-Mail-Domain ${emailDomain} passt nicht zur Website ${host}. Das ist ein Hinweis, kein Ausschlussgrund.`,
      decided: (status: 'accepted' | 'rejected', at: Date, by: string | null) =>
        `${status === 'accepted' ? 'Angenommen' : 'Abgelehnt'} am ${formatDateTime(at)}${by ? ` von ${by}` : ''}`,
      note: 'Interne Notiz',
      noteHint: 'Nur für Administratoren sichtbar, nicht in der E-Mail.',
      accept: 'Annehmen',
      reject: 'Ablehnen',
      rejectTitle: 'Antrag ablehnen?',
      rejectText: (name: string) =>
        `${name} bekommt eine E-Mail: Das Gratis-Budget kann derzeit nicht freigeschaltet werden, AI-Scratch geht aber mit eigenen OpenRouter-Schlüsseln. Einen neuen Antrag kann ${name} nicht stellen; Sie können das Gratis-Budget aber später selbst freischalten.`,
      cancel: 'Abbrechen',
      acceptedBanner: 'Antrag angenommen, Gratis-Budget freigeschaltet. Die Person hat eine E-Mail bekommen.',
      rejectedBanner: 'Antrag abgelehnt. Die Person hat eine E-Mail bekommen.',
      onBanner: 'Gratis-Budget freigeschaltet. Die Person hat eine E-Mail bekommen.',
      offBanner: 'Gratis-Budget entzogen.',
      staleBanner: 'Das ist schon entschieden: Die Seite zeigt den aktuellen Stand.',
      mailFailedBanner: 'Entschieden, aber die E-Mail an die Person ging nicht hinaus. Bitte schreiben Sie ihr selbst.',
      decideFailed: 'Speichern hat nicht geklappt. Bitte versuchen Sie es noch einmal.',
    },
    keys: {
      title: 'API-Schlüssel',
      description:
        'Die gespendeten Anthropic-Zugänge für das Gratis-Budget: Schlüssel, oder eine Föderation, bei der Anthropic der Azure-Identität von AI-Scratch vertraut. Der Pool nutzt sie nacheinander: aktive zuerst, höchste Priorität zuerst.',
      add: 'Schlüssel hinzufügen',
      addFederation: 'Föderation hinzufügen',
      addTitle: 'Anthropic-Schlüssel hinzufügen',
      addFederationTitle: 'Föderation hinzufügen',
      back: 'Alle Zugänge',
      notFound: 'Diesen Zugang gibt es nicht.',
      empty: 'Noch keine Zugänge. Ohne sie funktionieren keine Codes aus dem Gratis-Budget.',
      footer: (count: number) => `${count} Zugänge, in der Reihenfolge, in der der Pool sie nutzt`,
      federation: 'Föderation',
      columns: {
        donor: 'Spender*in',
        key: 'Zugang',
        workspace: 'Workspace',
        cap: 'Limit pro Monat',
        spent: 'Diesen Monat',
        priority: 'Priorität',
        status: 'Status',
        action: 'Aktion',
      },
      noWorkspace: '–',
      active: 'Aktiv',
      paused: 'Pausiert',
      edit: 'Bearbeiten',
      monthSpend: (spent: number, cap: number) => `${formatUsd(spent)} von ${formatUsd(cap)}`,
      refused: 'Abgelehnt',
      refusedAt: (at: Date, reason: string | null) =>
        `Anthropic hat ihn am ${formatDateTime(at)} abgelehnt${reason ? `: ${reason}` : ''}. Speichern Sie ihn nach der Klärung, damit der Pool ihn wieder nutzt.`,
      changed: (at: Date) => `Geändert am ${formatDateTime(at)}`,
      form: {
        donor: 'Spender*in',
        donorHint: 'Von wem das Guthaben kommt, z. B. „AI-Scratch“ oder „CoderDojo Linz“.',
        key: 'API-Schlüssel',
        keyHint: 'Beginnt mit sk-ant-. Er wird verschlüsselt gespeichert und nie wieder angezeigt.',
        keyReplace: 'Neuer API-Schlüssel (optional)',
        keyReplaceHint: (hint: string) =>
          `Gespeichert ist ${hint}. Leer lassen, um ihn zu behalten; ein neuer Schlüssel ersetzt ihn.`,
        workspaceId: 'Workspace-ID (optional)',
        workspaceIdHint:
          'Nur für persönliche Schlüssel und Service-Account-Schlüssel (nicht an einen Workspace gebunden): die ID des Workspace, über den abgerechnet wird, z. B. wrkspc_01…. Workspace-Schlüssel brauchen keine.',
        federationIntro:
          'Kein Schlüssel: Die Organisation der Spenderin oder des Spenders vertraut in der Anthropic Console der Azure-Identität von AI-Scratch (Workload Identity Federation). Die IDs stehen im Testcode der Regel in der Console; keine davon ist geheim.',
        organizationId: 'Organisations-ID',
        organizationIdHint: 'Die ID der Anthropic-Organisation, eine UUID wie 16c29832-2434-4718-a036-07dd4846877c.',
        federationRuleId: 'Regel-ID',
        federationRuleIdHint: 'Die Regel, die unserer Azure-Identität vertraut. Beginnt mit fdrl_.',
        serviceAccountId: 'Service-Account-ID (optional)',
        serviceAccountIdHint:
          'Als wer die Aufrufe laufen. Beginnt mit svac_. Leer lassen, wenn die Regel den Service Account selbst festlegt.',
        federationWorkspaceIdHint:
          'Der Workspace, über den abgerechnet wird, z. B. wrkspc_01…. Leer: der einzige Workspace der Regel.',
        capMonth: 'Limit pro Monat (US-Dollar)',
        capMonthHint:
          'So viel gibt der Pool über diesen Zugang pro Kalendermonat höchstens aus. Setzen Sie zusätzlich ein Spend Limit in der Anthropic Console.',
        priority: 'Priorität',
        priorityHint: 'Höhere Zahlen kommen zuerst dran. Bei gleicher Priorität der ältere Zugang.',
        active: 'Aktiv: der Pool darf diesen Zugang nutzen',
        save: 'Speichern',
        add: 'Prüfen und hinzufügen',
        checkNote:
          'Beim Speichern prüfen wir einen neuen Schlüssel mit einem kleinen Aufruf bei Anthropic (Bruchteile eines Cents).',
        federationCheckNote:
          'Beim Speichern holen wir über die Föderation ein Token und prüfen es mit einem kleinen Aufruf bei Anthropic (Bruchteile eines Cents).',
      },
      check: {
        invalid: {
          title: 'Anthropic kennt diesen Schlüssel nicht.',
          text: 'Er ist falsch, abgelaufen oder gelöscht. Nichts wurde gespeichert.',
        },
        forbidden: {
          title: 'Anthropic lässt diesen Zugang nicht zu.',
          text: (message?: string) => `Nichts wurde gespeichert.${message ? ` Antwort von Anthropic: ${message}` : ''}`,
        },
        rejected: {
          title: 'Anthropic hat den Testaufruf abgelehnt.',
          text: (message?: string) =>
            `Oft fehlt die Workspace-ID oder sie passt nicht, oder es ist kein Guthaben mehr da. Nichts wurde gespeichert.${message ? ` Antwort von Anthropic: ${message}` : ''}`,
        },
        unreachable: {
          title: 'Anthropic war nicht erreichbar.',
          text: 'Der Zugang konnte nicht geprüft werden, nichts wurde gespeichert. Bitte versuchen Sie es gleich noch einmal.',
        },
        exchange: {
          title: 'Anthropic hat die Föderation abgelehnt.',
          text: (message?: string) =>
            `Stimmen Organisation, Regel und Workspace? Passt die Regel zu unserer Azure-Identität? Den Grund zeigt die Console unter „Workload identity“ → „Authentication events“. Nichts wurde gespeichert.${message ? ` Antwort von Anthropic: ${message}` : ''}`,
        },
        identity: {
          title: 'Das Office bekommt kein Token seiner Azure-Identität.',
          text: 'Die Föderation ist auf diesem Server nicht (richtig) eingerichtet, nichts wurde gespeichert. Lokal braucht sie ein az login, auf Azure die Identität aus provision.sh (docs/anthropic-federation.md).',
        },
      },
      validation: {
        donor: (max: number) => `Bitte geben Sie an, von wem der Zugang kommt (höchstens ${max} Zeichen).`,
        key: 'Das ist kein Anthropic-API-Schlüssel. Er beginnt mit sk-ant- und hat keine Leerzeichen.',
        adminKey: 'Das ist ein Admin-Schlüssel. Der Pool braucht einen normalen API-Schlüssel.',
        duplicate: 'Diesen Schlüssel gibt es schon im Pool.',
        federationDuplicate: 'Diese Regel gibt es für diesen Workspace schon im Pool.',
        organizationId: 'Eine Organisations-ID ist eine UUID, zum Beispiel 16c29832-2434-4718-a036-07dd4846877c.',
        federationRuleId: 'Eine Regel-ID beginnt mit fdrl_, zum Beispiel fdrl_01XiXjNwgFMpW5PXMZ6W6ogq.',
        serviceAccountId: 'Eine Service-Account-ID beginnt mit svac_, zum Beispiel svac_01Gi6Kw95sBeRDFT5iVLcc4X.',
        workspaceId: 'Eine Workspace-ID beginnt mit wrkspc_, zum Beispiel wrkspc_01JwQvzr7rXLA5AGx3HKfFUJ.',
        cap: (max: number) => `Bitte eine ganze Zahl von 1 bis ${max.toLocaleString('de-AT')} (Dollar).`,
        priority: (max: number) => `Bitte eine ganze Zahl von 0 bis ${max}.`,
      },
      delete: 'Zugang löschen',
      deleteTitle: 'Zugang löschen?',
      deleteText: (donor: string, hint: string) =>
        `Der Schlüssel ${hint} von ${donor} wird gelöscht und vom Pool nicht mehr genutzt. Bei Anthropic bleibt er gültig: Widerrufen Sie ihn dort, wenn er nicht mehr gebraucht wird.`,
      deleteFederationText: (donor: string, hint: string) =>
        `Die Föderation ${hint} von ${donor} wird gelöscht und vom Pool nicht mehr genutzt. Bei Anthropic bleibt die Regel aktiv: Archivieren Sie sie dort, wenn sie nicht mehr gebraucht wird.`,
      deleteHint: 'Wollen Sie den Zugang nur vorübergehend nicht nutzen, pausieren Sie ihn stattdessen.',
      cancel: 'Abbrechen',
      saved: {
        added: 'Geprüft und hinzugefügt.',
        updated: 'Änderungen gespeichert.',
        deleted: 'Zugang gelöscht.',
      },
      error: {
        title: 'Speichern hat nicht geklappt.',
        text: 'Bitte versuchen Sie es noch einmal. Einen neuen Schlüssel geben Sie bitte noch einmal ein.',
      },
      deleteFailed: { title: 'Löschen hat nicht geklappt.', text: 'Bitte versuchen Sie es noch einmal.' },
    },
    codes: {
      title: 'Alle Codes',
      description: 'Die Codes aller Konten, mit dem, was jeder schon verbraucht hat. Löschen geht für jeden Code.',
      filterLabel: 'Filter',
      filters: { running: 'Laufend', planned: 'Geplant', expired: 'Abgelaufen' },
      empty: 'Keine Codes in dieser Ansicht.',
    },
    prices: {
      title: 'Preise',
      description:
        'Was das Modell (Claude Haiku) kostet, in US-Dollar pro Million Tokens. Alle Budgets rechnen Tokens mal diesen Preis, auch rückwirkend für den ganzen Monat. AI-Scratch nutzt einen gespeicherten Preis spätestens nach einer Minute.',
      input: 'Eingabe',
      output: 'Ausgabe',
      cacheWrite: 'Cache schreiben (5 Minuten)',
      cacheRead: 'Cache lesen',
      hint: 'US-Dollar pro Million Tokens',
      updated: (at: Date, by: string | null) =>
        `Zuletzt gespeichert am ${formatDateTime(at)}${by ? ` von ${by}` : ''}.`,
      fetch: 'Von OpenRouter holen',
      save: 'Speichern',
      fetched: {
        title: 'Die aktuellen Preise von OpenRouter stehen im Formular.',
        text: 'Prüfen Sie sie und speichern Sie dann.',
      },
      saved: 'Preise gespeichert.',
      fetchFailed: {
        unreachable: { title: 'OpenRouter war nicht erreichbar.', text: 'Bitte versuchen Sie es gleich noch einmal.' },
        missing: {
          title: 'OpenRouter nennt keine vollständigen Preise für das Modell.',
          text: 'Bitte tragen Sie die Preise von Anthropic selbst ein.',
        },
      },
      validation: (max: number) => `Bitte eine Zahl größer als 0 und höchstens ${max}, z. B. 0,125.`,
      error: { title: 'Speichern hat nicht geklappt.', text: 'Bitte versuchen Sie es noch einmal.' },
    },
  },
  footer: {
    label: 'Weitere Seiten',
    terms: 'Nutzungsbedingungen',
    access: 'So funktioniert der Zugang',
    source: 'Quellcode',
  },
  /** the copy button's outcome, shown for a moment */
  copy: { copied: 'Kopiert', failed: 'Kopieren hat nicht geklappt' },
  mail: {
    confirm: (url: string) => ({
      subject: 'Ihre Registrierung bei AI-Scratch',
      text: [
        'Guten Tag,',
        '',
        'Sie haben sich gerade bei AI-Scratch registriert. AI-Scratch ist der Scratch-Editor mit einem KI-Assistenten für Kinder von 10 bis 14 Jahren. Lehrkräfte und Eltern erstellen im Office die Zugangscodes dafür.',
        '',
        'Mit diesem Link schließen Sie Ihre Registrierung ab:',
        '',
        url,
        '',
        `Der Link gilt ${LINK_VALID_MINUTES} Minuten. Wenn Sie sich nicht registriert haben, ignorieren Sie diese E-Mail einfach; dann legen wir kein Konto an.`,
        ...mailSignature,
      ].join('\n'),
    }),
    exists: (baseURL: string) => ({
      subject: 'Sie haben schon ein Konto bei AI-Scratch',
      text: [
        'Guten Tag,',
        '',
        'jemand wollte sich mit dieser E-Mail-Adresse bei AI-Scratch registrieren. Sie haben schon ein Konto.',
        '',
        `Anmelden: ${baseURL}/login`,
        `Passwort vergessen: ${baseURL}/forgot-password`,
        '',
        'Wenn Sie das nicht waren, ignorieren Sie diese E-Mail einfach. An Ihrem Konto ändert sich nichts.',
        ...mailSignature,
      ].join('\n'),
    }),
    resetPassword: (url: string) => ({
      subject: 'Neues Passwort für AI-Scratch',
      text: [
        'Guten Tag,',
        '',
        'mit diesem Link legen Sie ein neues Passwort für Ihr Konto bei AI-Scratch fest:',
        '',
        url,
        '',
        'Der Link gilt eine Stunde und nur einmal. Wenn Sie kein neues Passwort angefordert haben, ignorieren Sie diese E-Mail einfach.',
        ...mailSignature,
      ].join('\n'),
    }),
    newApplication: (p: {
      name: string;
      email: string;
      schoolName: string;
      schoolUrl: string;
      grades: string;
      summary: string;
      jev: string;
      domainHint?: string;
      url: string;
    }) => ({
      subject: `Neuer Antrag: ${p.name}, ${p.schoolName}`,
      text: [
        `${p.name} (${p.email}) beantragt das Gratis-Budget.`,
        '',
        `Schule: ${p.schoolName}`,
        `Website: ${p.schoolUrl}`,
        `Schulstufen: ${p.grades}`,
        `KI-Prüfung: ${p.jev}`,
        ...(p.domainHint ? ['', `Hinweis: ${p.domainHint}`] : []),
        '',
        'Vorhaben:',
        p.summary,
        '',
        `Prüfen: ${p.url}`,
      ].join('\n'),
    }),
    freeBudgetOn: (name: string, baseURL: string) => ({
      subject: 'Ihr Gratis-Budget bei AI-Scratch ist freigeschaltet',
      text: [
        `Guten Tag ${name},`,
        '',
        'wir haben für Ihr Konto das Gratis-Budget freigeschaltet. Sie können jetzt Zugangscodes erstellen, deren KI-Kosten gespendete Mittel tragen.',
        '',
        `Anmelden: ${baseURL}/login`,
        '',
        'Viel Freude mit AI-Scratch!',
        ...mailSignature,
      ].join('\n'),
    }),
    rejected: (name: string, baseURL: string) => ({
      subject: 'Ihr Antrag auf das Gratis-Budget bei AI-Scratch',
      text: [
        `Guten Tag ${name},`,
        '',
        'danke für Ihren Antrag. Wir können Ihnen das Gratis-Budget derzeit leider nicht freischalten.',
        '',
        'Sie können AI-Scratch aber weiter nutzen, mit eigenen OpenRouter-Schlüsseln.',
        '',
        `Anmelden: ${baseURL}/login`,
        ...mailSignature,
      ].join('\n'),
    }),
  },
} as const;
