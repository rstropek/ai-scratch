# Legal texts

The public legal pages of the office (`apps/office/app/(info)/`, no login, static). So far: the terms of use at
`/terms`. They are drafts by Claude as a starting point; Rainer has them checked by a lawyer. Read before
changing a legal text, or a behaviour a legal text describes.

## Where things are

- The terms' text: `apps/office/content/terms.tsx` (title, date, key points, the full document). The
  registration page shows `terms.keyPoints`.
- `TERMS_VERSION` in `apps/office/lib/terms.ts` is the single source. **Any change to the text needs a new
  version and a new date**: accounts store the version they accepted, and a new one asks for consent again.
  Exception until launch: with no real accounts yet, Rainer may decide a change isn't a new version (2026-10-31:
  the free budget as its own flag).
- **Consent in the code:** registration and `/consent` ask with the same fields
  (`components/consent-fields.tsx`: the key points, the terms checkbox, and the separate, explicit consent of
  section 8, linked to `#datenverarbeitung`; its wording is `texts.register.aiConsent*`). `requireSession` sends
  every account with an older `terms_version` to `/consent` first (§ 15 "bei der nächsten Anmeldung"); the
  seeded admin has no profile and is never asked. Section ids are link targets: keep them when editing.

## The terms promise things the code must keep

When one of these changes in the code, change the terms in the same change (with a new version):

- Adults' personal data stored and processed in the EU (Postgres, App Service, Key Vault); only the AI check
  of registrations and applications leaves it.
- AI processing may happen outside the EU (Anthropic, OpenRouter, TypeSafe/Jev), named by provider.
- Kids' conversations and games may be stored (in the EU) and analysed to improve and secure the service and
  for research; never sold; only short excerpts, aggregates or derived findings published, never anything that
  points to a person.
  Error logs may hold messages.
- The Scratch library comes from the Scratch Foundation's CDN in the US (kids' IP addresses).
- Codes: at most 4 hours (`CODE_MAX_HOURS`); own OpenRouter keys: a limit, at most $25 left when a code is
  created (checked only then; resetting limits allowed), stored encrypted in the EU.
- No accounts for kids; the app never asks kids for personal data.

## Austrian consumer law traps (researched 2026-10-31, not legal advice)

- **No "soweit gesetzlich zulässig".** The OGH treats such reduction clauses as intransparent (§ 6 Abs 3
  KSchG). Say exactly what applies.
- **Liability:** personal injury can't be excluded (§ 6 Abs 1 Z 9 KSchG); a blanket exclusion of slight
  negligence can be grossly disadvantageous (§ 879 Abs 3 ABGB). The text limits liability to intent and gross
  negligence because the service is free, and keeps personal injury at slight negligence too.
- **Severability:** only the form "the statutory rule replaces the invalid one" (OGH 8 Ob 132/15t); clauses
  that oblige the consumer to agree to an unforeseeable replacement are intransparent.
- **No venue clause:** consumers sue and are sued at home (§ 14 KSchG). Austrian law, with the consumer's
  mandatory home-country protections (Rome I, Art. 6).
- **Changes need fresh consent** (the version check), no "silence means consent".
- § 6 KSchG was amended effective 2026-01-01 (BGBl I 110/2025); not yet checked what changed.

## Open, for Rainer and the lawyer

- Impressum (§ 5 ECG, § 25 MedienG) and Datenschutzerklärung (Art. 13 GDPR) pages: not written yet; they need
  a postal address and the processors (Azure, Resend, Cloudflare Turnstile, Anthropic, OpenRouter, TypeSafe).
- The name "AI-Scratch": Scratch's trademark notice says the marks "may not be used to endorse or promote
  products derived from this software without specific prior written permission" (`TRADEMARK` in
  `@scratch/scratch-gui`). The terms carry a non-affiliation disclaimer; that doesn't settle the name.
- Whether KSchG applies at all to a private, non-commercial operator, and whether teachers act as consumers or
  for their school.
- Kids' games are their works (copyright): whether adults can grant the use in section 9 for them (parents as
  guardians can; teachers probably can't for their pupils).
- Storing kids' conversations and games: the legal basis (legitimate interest? research, Art. 89 GDPR), how long they
  are kept, how kids and parents are told (the privacy statement, maybe a line in the kids' app), and how
  excerpts are checked before publishing.
- Kids' data: who is the controller in school use, whether schools need a data processing agreement, the
  digital-consent age (14 in Austria, § 4 Abs 4 DSG) even though kids are anonymous.
- AI Act Art. 50 (applies since 2026-08-02): kids must see that they talk to an AI from the first interaction;
  the plan's line under the chat input ("Du schreibst mit einer KI.") is still to build.
- Gaps from `platform-plan.md` ("Where data is processed"): videos from descript, Resend's subprocessors,
  where TypeSafe processes data, the legal basis for US transfers.
