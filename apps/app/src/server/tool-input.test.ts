import { InvalidToolInputError, JSONParseError } from 'ai';
import { describe, expect, test } from 'vitest';
import { repairBrackets, toolErrorText } from './tool-input.ts';

const invalid = (text: string) => {
  let cause: unknown;
  try {
    JSON.parse(text);
  } catch (e) {
    cause = e;
  }
  return new InvalidToolInputError({
    toolName: 'add_scripts',
    toolInput: text,
    cause: new JSONParseError({ text, cause }),
  });
};

test('broken JSON: where it broke, not the whole input again', () => {
  const steps = '{"op":"motion_movesteps","STEPS":10},'.repeat(100);
  const text = `{"sprite":"Katze","scripts":[[{"op":"event_whenflagclicked"},${steps}{"op":"looks_hide"}]]]}`;
  const message = toolErrorText(invalid(text));
  expect(message).toMatch(/^Not run: the input of add_scripts is not valid JSON \(.*position \d+/);
  expect(message).toContain('{"op":"looks_hide"}]]⟪HERE⟫]}');
  expect(message).toMatch(/one script each/);
  expect(message.length).toBeLessThan(600);
});

test('the same for the error already turned into its message, as the AI SDK sometimes hands it over', () => {
  const text = '{"sprite":"Katze","scripts":[[{"op":"looks_hide",}]]}';
  const message = toolErrorText(String(invalid(text)));
  expect(message).toMatch(
    /^Not run: the input of add_scripts is not valid JSON \(Expected double-quoted property name/,
  );
  expect(message).toContain('{"op":"looks_hide",⟪HERE⟫}]]}');
});

test('other errors keep their message', () => {
  expect(toolErrorText(new Error('Overloaded'))).toBe('Overloaded');
});

describe('repairBrackets', () => {
  test('the mistakes Haiku made: one closer too many, mid-input or at the end', () => {
    const extraBrace = '{"s":[[{"op":"a","ITEM":{"op":"b","V":"x"}}}],[{"op":"c"}]]}';
    expect(JSON.parse(repairBrackets(extraBrace) ?? '')).toEqual({
      s: [[{ op: 'a', ITEM: { op: 'b', V: 'x' } }], [{ op: 'c' }]],
    });
    const extraBracket = '{"s":[[{"op":"if","SUBSTACK":[{"op":"hide"}]}]]]}';
    expect(JSON.parse(repairBrackets(extraBracket) ?? '')).toEqual({ s: [[{ op: 'if', SUBSTACK: [{ op: 'hide' }] }]] });
    expect(repairBrackets('{"s":[[{"op":"a"}]')).toBe('{"s":[[{"op":"a"}]]}'); // cut short: closed
  });

  test('brackets in strings count as text; valid or hopeless input is left alone', () => {
    expect(JSON.parse(repairBrackets('{"MESSAGE":"}]{[ :)"}}') ?? '')).toEqual({ MESSAGE: '}]{[ :)' });
    expect(repairBrackets('{"a":[1]}')).toBeUndefined();
    expect(repairBrackets('{"a":[1,}')).toBeUndefined(); // not a bracket mistake
    expect(repairBrackets('{"a":[[[[1')).toBeUndefined(); // too much missing to guess
  });
});
