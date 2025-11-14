import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

const preloadFontsMock = vi.fn(() => Promise.resolve());
vi.mock('./internal/fontLoader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./internal/fontLoader')>();
  return {
    ...actual,
    preloadFonts: preloadFontsMock
  };
});

describe('TextMorph font hydration', () => {
  it('initializes once fonts arrive after mount', async () => {
    const { default: TextMorph } = await import('./TextMorph.svelte');
    const { component } = render(TextMorph, { props: { fonts: [], text: 'Late font' } });

    component.$set({ fonts: [{ url: 'font-late' }] });
    await Promise.resolve();

    expect(preloadFontsMock).toHaveBeenCalledWith([{ url: 'font-late' }]);
  });
});
