# Threlte Text Morph Release Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a releasable `@jackfoxdev/threlte-text-morph` package whose core component reacts to runtime prop changes, handles late font availability, documents/falls back when word-level morphs exceed shader limits, and ships without noisy logging or naming mismatches.

**Architecture:** Extend `TextMorph.svelte` with a small lifecycle state machine that listens to `fonts`, `text`, and layout props, rebuilding geometry/materials even when no animation is in flight. Detect >64 glyph word morphs and fall back to glyph pipeline with surfaced warnings. Align package metadata/docs with actual scoped name and keep console output silent outside an opt-in debug flag.

**Tech Stack:** Svelte 4 + Threlte, Three.js, Troika Text, Vitest, TypeScript.

---

### Task 1: Robust font lifecycle & late prop updates

**Files:**
- Modify: `src/lib/TextMorph.svelte`
- Modify: `src/lib/internal/fontLoader.ts`
- Create: `src/lib/TextMorph.reactivity.spec.ts`

**Step 1: Write the failing test**

`src/lib/TextMorph.reactivity.spec.ts`
```ts
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it, vi } from 'vitest';

const preloadFontsMock = vi.fn(() => Promise.resolve());
vi.mock('./internal/fontLoader', () => ({ preloadFonts: preloadFontsMock }));

describe('TextMorph font hydration', () => {
  it('initializes once fonts arrive after mount', async () => {
    const { default: TextMorph } = await import('./TextMorph.svelte');
    const { component } = render(TextMorph, { props: { fonts: [], text: 'Late font' } });

    component.$set({ fonts: [{ url: 'font-late' }] });
    await Promise.resolve();

    expect(preloadFontsMock).toHaveBeenCalledWith([{ url: 'font-late' }]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- TextMorph.reactivity.spec.ts -t "font hydration"`
Expected: FAIL because component short-circuits when fonts array is empty.

**Step 3: Write minimal implementation**

`src/lib/internal/fontLoader.ts`
```ts
export function areFontsReady(fonts: FontConfig[]): boolean {
  return Array.isArray(fonts) && fonts.some((font) => typeof font?.url === 'string' && font.url.length > 0);
}
```

`src/lib/TextMorph.svelte`
```ts
import { preloadFonts, areFontsReady } from './internal/fontLoader';
let pendingFonts: FontConfig[] = [];
let initializationPromise: Promise<void> | null = null;

function scheduleInitialization(reason: 'fonts' | 'text') {
  if (!areFontsReady(fonts) || preparing || animating) return;
  initializationPromise = preloadFonts(fonts).then(async () => {
    pendingFonts = fonts.slice();
    await prepareMorphStep();
    ready = true;
    dispatchEvent('ready', now());
  });
}

$: if (areFontsReady(fonts) && !ready && !initializationPromise) {
  scheduleInitialization('fonts');
}

$: if (ready && fonts !== pendingFonts) {
  scheduleInitialization('fonts');
}
```

**Step 4: Run tests to verify they pass**

Run: `npm run test -- TextMorph.reactivity.spec.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/internal/fontLoader.ts src/lib/TextMorph.svelte src/lib/TextMorph.reactivity.spec.ts
git commit -m "fix: reinitialize fonts when props change"
```

---

### Task 2: Idle reactivity for text/layout props

**Files:**
- Modify: `src/lib/TextMorph.svelte`
- Extend tests: `src/lib/TextMorph.reactivity.spec.ts`

**Step 1: Write the failing test**

Add to `src/lib/TextMorph.reactivity.spec.ts`:
```ts
it('rebuilds geometry when text prop changes while idle', async () => {
  const { default: TextMorph } = await import('./TextMorph.svelte');
  const buildMorphGeometry = vi.fn(() => ({
    geometry: { geometry: { dispose: vi.fn() } },
    textures: new Array(4).fill({
      texture: {},
      uniforms: {}
    })
  }));
  vi.mocked(await import('./internal/sdf')).buildMorphGeometry = buildMorphGeometry;

  const { component } = render(TextMorph, {
    props: { fonts: [{ url: 'font-1' }], text: 'one', mode: 'font' }
  });

  await Promise.resolve();
  component.$set({ text: 'two' });
  await Promise.resolve();

  expect(buildMorphGeometry).toHaveBeenCalledTimes(2);
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- TextMorph.reactivity.spec.ts -t "text prop changes"`
Expected: FAIL because geometry is only rebuilt during scheduled morph steps.

**Step 3: Implement reactive rebuild path**

`src/lib/TextMorph.svelte`
```ts
$: if (ready && !animating && !preparing) {
  if (resolvedText !== lastPreparedText || fontsChangedSinceLastBuild) {
    prepareMorphStep().catch((error) => {
      console.error('[TextMorph] Failed to rebuild after prop change', error);
      errored = true;
    });
  }
}

const watchedLayoutProps = [
  fontSize,
  letterSpacing,
  lineHeight,
  maxWidth,
  anchorX,
  anchorY,
  textAlign,
  fontWeight
];

$: if (ready && watchedLayoutProps.some((value, idx) => value !== previousLayoutProps[idx])) {
  previousLayoutProps = watchedLayoutProps.slice();
  rebuildQueued = true;
}
```

**Step 4: Run the targeted test & regression suite**

Run: `npm run test -- TextMorph.reactivity.spec.ts` then `npm run test`
Expected: All tests PASS.

**Step 5: Commit**

```bash
git add src/lib/TextMorph.svelte src/lib/TextMorph.reactivity.spec.ts
git commit -m "fix: rebuild geometry when idle props change"
```

---

### Task 3: Reactive transforms & baseline blending

**Files:**
- Modify: `src/lib/TextMorph.svelte`
- Extend tests: `src/lib/TextMorph.reactivity.spec.ts`

**Step 1: Write the failing test**

Append to `src/lib/TextMorph.reactivity.spec.ts`:
```ts
it('updates mesh position when base position changes', async () => {
  const { default: TextMorph } = await import('./TextMorph.svelte');
  const { component, getByTestId } = render(TextMorph, {
    props: { fonts: [{ url: 'font-1' }], position: [0, 0, 0], text: 'shift' }
  });
  await Promise.resolve();
  component.$set({ position: [0, 2, 0] });
  await Promise.resolve();

  const mesh = getByTestId('text-morph-mesh');
  expect(mesh.position.set).toHaveBeenLastCalledWith(0, 2, 0);
});
```

**Step 2: Run the test to see it fail**

Run: `npm run test -- TextMorph.reactivity.spec.ts -t "mesh position"`
Expected: FAIL because `mesh.position.set` is not re-run unless morph progress updates.

**Step 3: Implement reactive transform updates**

`src/lib/TextMorph.svelte`
```svelte
<T.Mesh
  data-testid="text-morph-mesh"
  ...
/>
```

```ts
$: if (mesh) {
  const eased = morphProgress;
  applyBaselineBlend(eased);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.frustumCulled = frustumCulled;
}

function applyBaselineBlend(value: number) {
  const baseX = position?.[0] ?? 0;
  const baseY = position?.[1] ?? 0;
  const baseZ = position?.[2] ?? 0;
  const sourceShift = fonts[sourceFontIndexForStep]?.baselineShift ?? 0;
  const targetShift = fonts[targetFontIndex]?.baselineShift ?? 0;
  mesh?.position.set(baseX, baseY + sourceShift + (targetShift - sourceShift) * value, baseZ);
}
```

**Step 4: Run tests**

Run: `npm run test -- TextMorph.reactivity.spec.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/TextMorph.svelte src/lib/TextMorph.reactivity.spec.ts
git commit -m "fix: reactively update mesh transforms"
```

---

### Task 4: Word morph glyph-limit fallback

**Files:**
- Modify: `src/lib/internal/wordMorph.ts`
- Modify: `src/lib/internal/wordMorphMaterial.ts`
- Modify: `src/lib/TextMorph.svelte`
- Add tests: `src/lib/internal/wordMorph.test.ts`

**Step 1: Write failing unit test for resource clamp detection**

`src/lib/internal/wordMorph.test.ts`
```ts
import { describe, expect, it } from 'vitest';
import { buildWordMorphResources, MAX_WORD_GLYPH_UNIFORMS } from './wordMorph';

describe('word morph resources', () => {
  it('flags when glyphs exceed shader capacity', async () => {
    const info = makeSdfInfoWithGlyphs(MAX_WORD_GLYPH_UNIFORMS + 4);
    const { exceededLimit } = buildWordMorphResources(info, info);
    expect(exceededLimit).toBe(true);
  });
});
```

**Step 2: Run the new test (expect fail)**

Run: `npm run test -- wordMorph.test.ts`
Expected: FAIL because no `exceededLimit` flag exists.

**Step 3: Implement clamp detection & fallback**

`src/lib/internal/wordMorph.ts`
```ts
export interface WordMorphResources {
  ...
  exceededLimit: boolean;
}

function fillGlyphData(info: SimpleSDFInfo): WordGlyphUniformData & { exceededLimit: boolean } {
  const glyphCount = glyphIndexAttr.count;
  const clampedGlyphCount = Math.min(glyphCount, MAX_WORD_GLYPHS);
  return {
    ...data,
    exceededLimit: glyphCount > MAX_WORD_GLYPHS,
    glyphCount: clampedGlyphCount
  };
}

export function buildWordMorphResources(...) {
  const sourceData = fillGlyphData(sourceInfo);
  const targetData = fillGlyphData(targetInfo);
  return {
    geometry,
    source: sourceData,
    target: targetData,
    sourceTexture: sourceInfo,
    targetTexture: targetInfo,
    exceededLimit: sourceData.exceededLimit || targetData.exceededLimit
  };
}
```

`src/lib/TextMorph.svelte`
```ts
if (useWordPipeline) {
  const { resources } = await buildWordMorph(...);
  if (resources.exceededLimit) {
    console.warn('[TextMorph] Word morph exceeded 64 glyphs, using glyph pipeline.');
    return runGlyphPipeline();
  }
  // existing word pipeline
}
```

**Step 4: Add integration test verifying fallback**

Append to `TextMorph.reactivity.spec.ts`:
```ts
it('falls back to glyph morph when word glyph limit exceeded', async () => {
  buildWordMorphMock.mockResolvedValue({
    resources: { exceededLimit: true, geometry: {}, source: mockGlyphData, target: mockGlyphData }
  });
  const glyphPipeline = vi.spyOn(sdfModule, 'buildMorphGeometry');
  render(TextMorph, { props: { mode: 'text', text: 'a'.repeat(80), fonts: [{ url: 'font-1' }] } });
  await flushMicrotasks();
  expect(glyphPipeline).toHaveBeenCalled();
});
```

**Step 5: Run tests**

Run: `npm run test -- wordMorph.test.ts TextMorph.reactivity.spec.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add src/lib/internal/wordMorph.ts src/lib/internal/wordMorphMaterial.ts src/lib/TextMorph.svelte src/lib/internal/wordMorph.test.ts src/lib/TextMorph.reactivity.spec.ts
git commit -m "fix: handle word morph glyph limits with fallback"
```

---

### Task 5: Strip noisy logging & gate optional debug mode

**Files:**
- Modify: `src/lib/TextMorph.svelte`
- Modify: `src/lib/internal/wordMorph.ts`
- Modify: `src/lib/internal/wordMorphMaterial.ts`

**Step 1: Add prop and failing test**

`src/lib/TextMorph.reactivity.spec.ts`
```ts
it('emits debug logs only when debug prop is true', async () => {
  const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const { default: TextMorph } = await import('./TextMorph.svelte');
  render(TextMorph, { props: { fonts: [{ url: 'font-1' }], text: 'debug', debug: false } });
  await Promise.resolve();
  expect(consoleSpy).not.toHaveBeenCalled();
});
```

**Step 2: Run test (expect fail)**

Run: `npm run test -- TextMorph.reactivity.spec.ts -t "debug logs"`
Expected: FAIL because logs occur unconditionally.

**Step 3: Implement `debug` prop guard**

`src/lib/TextMorph.svelte`
```ts
export let debug = false;

function logDebug(message: string, payload?: unknown) {
  if (debug) {
    console.log(`[TextMorph] ${message}`, payload);
  }
}

logDebug('prepareMorphStep', { ... });
```

Remove raw `console.log`/`console.debug` calls or wrap via `logDebug`.

**Step 4: Run regression tests**

Run: `npm run test`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/lib/TextMorph.svelte src/lib/internal/wordMorph.ts src/lib/internal/wordMorphMaterial.ts src/lib/TextMorph.reactivity.spec.ts
git commit -m "chore: guard debug logging behind prop"
```

---

### Task 6: Align package naming & docs/imports

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `examples/playground/package.json`
- Modify: `examples/playground/src/App.svelte`

**Step 1: Update metadata**

`package.json`
```json
{
  "name": "@jackfoxdev/threlte-text-morph",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "svelte": "./dist/index.js",
      "import": "./dist/index.js"
    }
  },
  "svelte": "./dist/index.js"
}
```

**Step 2: Update documentation & playground imports**

`README.md` and `examples/playground/src/App.svelte`
```svelte
import { TextMorph } from '@jackfoxdev/threlte-text-morph';
```

**Step 3: Run build & lint sanity**

Run: `npm run build`
Expected: PASS.

**Step 4: Commit**

```bash
git add package.json README.md examples/playground/package.json examples/playground/src/App.svelte
git commit -m "chore: align package name and docs"
```

---

### Task 7: Regenerate types & ensure release bundle

**Files:**
- Modify: `package-lock.json`/`pnpm-lock.yaml` if needed
- No code changes; run builds/tests

**Step 1: Reinstall to refresh lockfiles**

Run: `rm -rf node_modules && npm install`

**Step 2: Run full test + build suite**

Commands:
```bash
npm run test
npm run build
```
Expected: PASS.

**Step 3: Commit release-ready state**

```bash
git add package-lock.json pnpm-lock.yaml
git commit -m "chore: refresh locks for release"
```

---

Plan complete and saved to `docs/plans/2025-11-14-threlte-text-morph-release-hardening.md`. Two execution options:

1. **Subagent-Driven (this session)** – Dispatch superpowers:subagent-driven-development, run fresh subagent per task with reviews between tasks for tight feedback loops.
2. **Parallel Session (separate)** – Open a new session in this worktree, load superpowers:executing-plans, and execute tasks in batches with checkpoints.

Which approach would you like to use?
