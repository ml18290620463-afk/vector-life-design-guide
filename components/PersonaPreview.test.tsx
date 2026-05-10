import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PersonaPreview } from './PersonaPreview';
import { TRANSLATIONS } from '../constants';
import { mintPersona } from '../services/personaService';

const t = TRANSLATIONS.zh;

const samplePersona = () =>
  mintPersona({
    name: '乔布斯',
    description: 'Apple 创始人',
    systemPrompt: 'You are 乔布斯, ...'.padEnd(800, '.'),
  });

describe('PersonaPreview', () => {
  afterEach(cleanup);

  it('pre-fills the three editable fields from the persona prop', () => {
    const persona = samplePersona();
    render(
      <PersonaPreview persona={persona} theme="dark" t={t} onConfirm={vi.fn()} onRetry={vi.fn()} />,
    );

    expect((screen.getByLabelText(t.personaPreviewName as string) as HTMLInputElement).value).toBe(
      persona.name,
    );
    expect(
      (screen.getByLabelText(t.personaPreviewDescription as string) as HTMLInputElement).value,
    ).toBe(persona.description);
    expect((screen.getByTestId('persona-preview-prompt') as HTMLTextAreaElement).value).toBe(
      persona.systemPrompt,
    );
  });

  it('save fires onConfirm with the EDITED persona, not the original', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const persona = samplePersona();
    render(
      <PersonaPreview
        persona={persona}
        theme="dark"
        t={t}
        onConfirm={onConfirm}
        onRetry={vi.fn()}
      />,
    );

    const nameInput = screen.getByLabelText(t.personaPreviewName as string);
    fireEvent.change(nameInput, { target: { value: '乔老板' } });

    fireEvent.click(screen.getByLabelText(t.personaPreviewSave as string));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
    const passed = onConfirm.mock.calls[0][0];
    expect(passed.name).toBe('乔老板');
    // Other fields preserve original values.
    expect(passed.systemPrompt).toBe(persona.systemPrompt);
  });

  it('save is disabled when name OR systemPrompt is empty', () => {
    const persona = samplePersona();
    render(
      <PersonaPreview persona={persona} theme="dark" t={t} onConfirm={vi.fn()} onRetry={vi.fn()} />,
    );
    const nameInput = screen.getByLabelText(t.personaPreviewName as string);
    fireEvent.change(nameInput, { target: { value: '' } });
    expect(
      (screen.getByLabelText(t.personaPreviewSave as string) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('clicking "Try again" fires onRetry', () => {
    const onRetry = vi.fn();
    render(
      <PersonaPreview
        persona={samplePersona()}
        theme="dark"
        t={t}
        onConfirm={vi.fn()}
        onRetry={onRetry}
      />,
    );
    fireEvent.click(screen.getByLabelText(t.personaPreviewRetry as string));
    expect(onRetry).toHaveBeenCalled();
  });
});
