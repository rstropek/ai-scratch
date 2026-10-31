import { terms } from '../content/terms.tsx';
import type { FieldErrors } from '../lib/registration.ts';
import { texts } from '../lib/texts.ts';
import { Callout } from './ui/callout.tsx';
import { Checkbox } from './ui/checkbox.tsx';
import { TextLink } from './ui/text-link.tsx';

const t = texts.register;

/**
 * The terms' key points and the two consents (terms, AI processing outside the EU), as the registration and the
 * page for a new terms version ask them. The links open beside the form, so its answers stay.
 */
export function ConsentFields({
  checked,
  errors,
}: {
  checked: (name: 'terms' | 'aiConsent') => boolean;
  errors: FieldErrors<'terms' | 'aiConsent'>;
}) {
  return (
    <>
      <Callout title={terms.keyPointsTitle}>
        <ul className="grid list-disc gap-1 pl-4.5 text-sm">
          {terms.keyPoints.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </Callout>
      <Checkbox
        name="terms"
        label={
          <>
            {t.termsBefore}
            <TextLink href="/terms" newTab={t.newTab}>
              {t.termsLink}
            </TextLink>
            {t.termsAfter}
          </>
        }
        defaultChecked={checked('terms')}
        error={errors.terms}
      />
      <Checkbox
        name="aiConsent"
        label={
          <>
            {t.aiConsentBefore}
            <TextLink href="/terms#datenverarbeitung" newTab={t.newTab}>
              {t.aiConsentLink}
            </TextLink>
            {t.aiConsentAfter}
          </>
        }
        defaultChecked={checked('aiConsent')}
        error={errors.aiConsent}
      />
    </>
  );
}
