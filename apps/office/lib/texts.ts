// Every German text of the office, in one place: English joins later.
export const texts = {
  appName: 'AI-Scratch Office',
  login: {
    title: 'Anmelden',
    email: 'E-Mail',
    password: 'Passwort',
    submit: 'Anmelden',
    submitting: 'Anmelden …',
    failed: 'E-Mail oder Passwort stimmt nicht.',
    tooMany: 'Zu viele Versuche. Bitte warten Sie kurz und versuchen Sie es dann noch einmal.',
    error: 'Die Anmeldung hat nicht geklappt. Bitte versuchen Sie es noch einmal.',
  },
  home: {
    greeting: (name: string) => `Hallo Welt, ${name}!`,
    signedInAs: (email: string) => `Angemeldet als ${email}`,
    admin: 'Administrator',
    signOut: 'Abmelden',
  },
} as const;
