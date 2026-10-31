// What a server action returns to its form (React's useActionState). No imports: client components load it.

export interface FormBanner {
  title: string;
  text?: string;
}

export interface FormState<F extends string> {
  fieldErrors?: Partial<Record<F, string>>;
  /** a problem with the whole form (rate limit, server error, a refusal) */
  banner?: FormBanner;
  /** React resets a form after its action: the answers come back so the fields can show them again */
  values?: Record<string, string | string[]>;
  /** counts submits, so the Turnstile widget can get a fresh token after each */
  attempt?: number;
}

/** the text fields of a form, to send back with an error */
export const echo = (form: FormData, ...names: string[]): Record<string, string | string[]> =>
  Object.fromEntries(
    names.map((name) => {
      const all = form.getAll(name).map(String);
      return [name, all.length > 1 ? all : (all[0] ?? '')];
    }),
  );

export const answerOf = (state: FormState<string>, name: string): string => {
  const value = state.values?.[name];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
};

export const answersOf = (state: FormState<string>, name: string): string[] => {
  const value = state.values?.[name];
  return value === undefined || value === '' ? [] : Array.isArray(value) ? value : [value];
};
