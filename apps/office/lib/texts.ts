// Every German text of the office, in one place: English joins later.
import type { RefusalReason } from './jev.ts';
import { LINK_VALID_MINUTES } from './rules.ts';

const kindLabels = {
  teacher: 'Lehrkraft',
  parent: 'Eltern oder andere Erwachsene (z. B. CoderDojo, Jugendgruppe)',
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

export const texts = {
  appName: 'AI-Scratch Office',
  format: { dateTime: formatDateTime, date: formatDate, time: formatTime },
  login: {
    title: 'Anmelden',
    email: 'E-Mail',
    password: 'Passwort',
    submit: 'Anmelden',
    submitting: 'Anmelden …',
    failed: 'E-Mail oder Passwort stimmt nicht.',
    tooMany: 'Zu viele Versuche. Bitte warten Sie kurz und versuchen Sie es dann noch einmal.',
    error: 'Die Anmeldung hat nicht geklappt. Bitte versuchen Sie es noch einmal.',
    forgot: 'Passwort vergessen?',
    noAccount: 'Noch kein Konto?',
    register: 'Registrieren',
  },
  shell: {
    signOut: 'Abmelden',
    signIn: 'Anmelden',
    register: 'Registrieren',
    admin: 'Konten',
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
    title: 'Registrieren',
    intro:
      'Mit einem Konto erstellen Sie Zugangscodes, mit denen Kinder den KI-Helfer in AI-Scratch nutzen. Kinder selbst brauchen kein Konto.',
    steps: [
      'Sie geben Ihre E-Mail-Adresse an und stimmen den Nutzungsbedingungen zu.',
      'Sie bestätigen Ihre E-Mail-Adresse über den Link, den wir Ihnen schicken, und legen Ihr Passwort fest.',
      'Lehrkräfte beantragen danach den Status als Lehrkraft. Wir prüfen den Antrag und antworten per E-Mail.',
    ],
    privacy: 'Wir speichern Ihre Angaben auf Servern in der EU.',
    about: 'Über Sie',
    email: 'E-Mail-Adresse',
    emailHint: 'Lehrkräfte am besten mit ihrer dienstlichen Adresse. Dorthin schicken wir den Bestätigungslink.',
    kind: 'Ich registriere mich als',
    kindLabels,
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
      ' beschrieben: was Kinder schreiben und ihre Scratch-Projekte, die Prüfung zum Schutz der Kinder und gegen Missbrauch, und die Prüfung von Registrierungen und Bewerbungen.',
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
      'Keine E-Mail da? Manche Schulen halten E-Mails von neuen Absendern ein paar Minuten zurück. Schauen Sie auch im Spam-Ordner nach.',
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
    title: 'Als Lehrkraft bewerben',
    intro:
      'Lehrkräfte nutzen AI-Scratch kostenlos: Ihre Codes laufen über ein Budget, das wir aus gespendeten Mitteln bezahlen. Darum prüfen wir jeden Antrag.',
    steps: [
      'Sie beschreiben kurz Ihre Schule und Ihr Vorhaben.',
      'Eine KI prüft den Antrag auf offensichtlich ungültige Angaben und sagt Ihnen sofort, was fehlt.',
      'Wir prüfen den Antrag und antworten per E-Mail.',
    ],
    meanwhile: 'Bis dahin nutzen Sie AI-Scratch wie Eltern, mit eigenen OpenRouter-Schlüsseln.',
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
    application: {
      none: {
        title: 'Sie sind Lehrkraft?',
        text: 'Lehrkräfte nutzen AI-Scratch kostenlos. Bewerben Sie sich, damit wir Ihren Status bestätigen können.',
      },
      missing: {
        title: 'Ihr Antrag fehlt noch',
        text: 'Sie haben sich als Lehrkraft registriert. Damit wir Ihren Status bestätigen können, beschreiben Sie bitte kurz Ihre Schule und Ihr Vorhaben.',
      },
      pending: {
        title: 'Ihr Antrag wird geprüft',
        text: (date: Date) =>
          `Wir haben Ihren Antrag am ${formatDate(date)} bekommen und antworten per E-Mail. Bis dahin nutzen Sie AI-Scratch wie Eltern.`,
      },
      accepted: {
        title: 'Sie sind als Lehrkraft bestätigt',
        text: 'Sie können Zugangscodes aus dem kostenlosen Budget für Ihre Klassen erstellen.',
      },
      rejected: {
        title: 'Ihr Status als Lehrkraft ist nicht bestätigt',
        text: 'Wir können Ihren Status als Lehrkraft derzeit nicht bestätigen. Sie können AI-Scratch aber mit eigenen OpenRouter-Schlüsseln nutzen. Sie dürfen sich jederzeit noch einmal bewerben.',
      },
      apply: 'Als Lehrkraft bewerben',
      applyAgain: 'Noch einmal bewerben',
    },
    sent: 'Ihr Antrag ist bei uns. Wir antworten per E-Mail.',
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
    status: {
      parent: 'Eltern',
      missing: 'Antrag fehlt',
      pending: 'Antrag offen',
      accepted: 'Lehrkraft bestätigt',
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
        `${name} bekommt eine E-Mail: Der Status als Lehrkraft kann derzeit nicht bestätigt werden, AI-Scratch geht aber mit eigenen OpenRouter-Schlüsseln. Eine neue Bewerbung bleibt möglich.`,
      cancel: 'Abbrechen',
      acceptedBanner: 'Antrag angenommen. Die Lehrkraft hat eine E-Mail bekommen.',
      rejectedBanner: 'Antrag abgelehnt. Die Person hat eine E-Mail bekommen.',
      staleBanner: 'Dieser Antrag ist schon entschieden.',
      mailFailedBanner: 'Entschieden, aber die E-Mail an die Person ging nicht hinaus. Bitte schreiben Sie ihr selbst.',
      decideFailed: 'Speichern hat nicht geklappt. Bitte versuchen Sie es noch einmal.',
    },
  },
  footer: {
    label: 'Weitere Seiten',
    terms: 'Nutzungsbedingungen',
    source: 'Quellcode',
  },
  mail: {
    confirm: (url: string) => ({
      subject: 'Bitte bestätigen Sie Ihre E-Mail-Adresse',
      text: [
        'Guten Tag,',
        '',
        'Sie haben sich bei AI-Scratch registriert. Öffnen Sie diesen Link, um Ihre E-Mail-Adresse zu bestätigen und Ihr Passwort festzulegen:',
        '',
        url,
        '',
        `Der Link gilt ${LINK_VALID_MINUTES} Minuten. Wenn Sie sich nicht registriert haben, ignorieren Sie diese E-Mail einfach; dann legen wir kein Konto an.`,
        '',
        'AI-Scratch',
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
        '',
        'AI-Scratch',
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
        '',
        'AI-Scratch',
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
        `${p.name} (${p.email}) bewirbt sich als Lehrkraft.`,
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
    accepted: (name: string, baseURL: string) => ({
      subject: 'Ihr Antrag bei AI-Scratch ist angenommen',
      text: [
        `Guten Tag ${name},`,
        '',
        'wir haben Ihren Status als Lehrkraft bestätigt. Sie können jetzt Zugangscodes aus dem kostenlosen Budget für Ihre Klassen erstellen.',
        '',
        `Anmelden: ${baseURL}/login`,
        '',
        'Viel Freude mit AI-Scratch im Unterricht!',
        'AI-Scratch',
      ].join('\n'),
    }),
    rejected: (name: string, baseURL: string) => ({
      subject: 'Ihr Antrag bei AI-Scratch',
      text: [
        `Guten Tag ${name},`,
        '',
        'danke für Ihren Antrag. Wir können Ihren Status als Lehrkraft derzeit leider nicht bestätigen.',
        '',
        'Sie können AI-Scratch aber weiter nutzen, mit eigenen OpenRouter-Schlüsseln, wie Eltern und andere Erwachsene. Sie dürfen sich auch jederzeit noch einmal bewerben.',
        '',
        `Anmelden: ${baseURL}/login`,
        '',
        'AI-Scratch',
      ].join('\n'),
    }),
  },
} as const;
