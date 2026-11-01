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

export const texts = {
  appName: 'AI-Scratch Office',
  format: { dateTime: formatDateTime, date: formatDate, time: formatTime },
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
        priority: 'Priorität',
        status: 'Status',
        action: 'Aktion',
      },
      noWorkspace: '–',
      active: 'Aktiv',
      paused: 'Pausiert',
      edit: 'Bearbeiten',
      cap: (eur: number) => `${eur.toLocaleString('de-AT')} €`,
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
        capEurMonth: 'Limit pro Monat (Euro)',
        capEurMonthHint:
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
        cap: (max: number) => `Bitte eine ganze Zahl von 1 bis ${max.toLocaleString('de-AT')}.`,
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
  },
  footer: {
    label: 'Weitere Seiten',
    terms: 'Nutzungsbedingungen',
    access: 'So funktioniert der Zugang',
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
        'AI-Scratch',
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
        '',
        'AI-Scratch',
      ].join('\n'),
    }),
  },
} as const;
