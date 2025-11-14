import { render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@threlte/core', async () => {
  const StubMesh = (await import('./__mocks__/StubMesh.svelte')).default;
  return {
    T: {
      Mesh: StubMesh
    }
  };
});

const preloadFontsMock = vi.fn(() => Promise.resolve());
vi.mock('./internal/fontLoader', () => ({
  preloadFonts: preloadFontsMock
}));

const buildMorphCalls: Array<{ source: string; target: string }> = [];
const buildMorphGeometryMock = vi.fn(async (source, target, _options) => {
  buildMorphCalls.push({ source: source.font.url, target: target.font.url });
  return {
    geometry: { geometry: {} },
    textures: [0, 1, 2, 3].map(() => ({
      texture: {},
      uniforms: {}
    }))
  };
});

vi.mock('./internal/sdf', () => ({
  buildMorphGeometry: buildMorphGeometryMock,
  buildWordMorph: vi.fn(async () => ({
    resources: {
      geometry: {},
      source: {
        glyphCount: 0,
        glyphBounds: new Float32Array(),
        glyphUVRects: new Float32Array(),
        glyphChannels: new Float32Array(),
        glyphSize: 64,
        sdfExponent: 8,
        wordBounds: new Float32Array([0, 0, 0, 0])
      },
      target: {
        glyphCount: 0,
        glyphBounds: new Float32Array(),
        glyphUVRects: new Float32Array(),
        glyphChannels: new Float32Array(),
        glyphSize: 64,
        sdfExponent: 8,
        wordBounds: new Float32Array([0, 0, 0, 0])
      },
      sourceTexture: { texture: {}, uniforms: {} },
      targetTexture: { texture: {}, uniforms: {} }
    }
  }))
}));

vi.mock('./internal/morphMaterial', () => ({
  createMorphMaterial: () => ({
    uniforms: {
      sdfTexture: { value: null },
      sdfTexture2: { value: null },
      sdfTexture3: { value: null },
      sdfTexture4: { value: null }
    }
  }),
  updateMaterialColors: vi.fn(),
  updateMorphUniforms: vi.fn()
}));

vi.mock('./internal/wordMorphMaterial', () => ({
  createWordMorphMaterial: vi.fn(() => ({ uniforms: {} })),
  updateWordMorphColors: vi.fn(),
  updateWordMorphUniforms: vi.fn(),
  refreshWordMorphResources: vi.fn()
}));

// Provide deterministic requestAnimationFrame
const rafQueue: Array<(time: number) => void> = [];
let rafId = 0;

beforeEach(() => {
  buildMorphCalls.length = 0;
  preloadFontsMock.mockClear();
  buildMorphGeometryMock.mockClear();
  rafQueue.length = 0;
  rafId = 0;

  vi.stubGlobal('requestAnimationFrame', (cb: (time: number) => void) => {
    rafQueue.push(cb);
    return rafId++;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafQueue[id] = () => {};
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function flushRaf(time: number) {
  const cb = rafQueue.shift();
  if (cb) {
    cb(time);
  }
}

function flushMicrotasks() {
  return Promise.resolve();
}

describe('TextMorph font mode sequencing', () => {
  it('uses the previous target font as the next source', async () => {
    const { default: TextMorph } = await import('./TextMorph.svelte');

    render(TextMorph, {
      props: {
        fonts: [
          { url: 'font-1' },
          { url: 'font-2' },
          { url: 'font-3' }
        ],
        mode: 'font',
        text: 'Hello world',
        fontSequence: 'forwards',
        fontDuration: 1
      }
    });

    // Initial preload + geometry
    await flushMicrotasks();

    // Step 1: schedule + run start loop
    flushRaf(0);
    await flushMicrotasks();
    // Run animation frame that completes first morph
    flushRaf(16);
    await flushMicrotasks();

    // Step 2: start loop again and prepare second morph
    flushRaf(32);
    await flushMicrotasks();

    expect(buildMorphCalls.length).toBeGreaterThanOrEqual(3);
    const [, firstStep, secondStep] = buildMorphCalls;
    expect(firstStep).toEqual({ source: 'font-1', target: 'font-2' });
    expect(secondStep).toEqual({ source: 'font-2', target: 'font-3' });
  });
});
