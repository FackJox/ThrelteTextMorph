<script lang="ts">
  import { onMount } from 'svelte';
  import { T, Canvas } from '@threlte/core';
  import { OrbitControls } from '@threlte/extras';
  import { TextMorph, preloadFonts, type FontConfig, type EasingPreset, type MorphMode, type SequenceMode } from '@jackfoxdev/threlte-text-morph';

  const baseFonts: Array<FontConfig & { label: string; enabled: boolean }> = [
    {
      label: 'Adorjan',
      url: '/fonts/Adorjan-FreeTrial.woff',
      enabled: true,
      sizeOffset: 0,
      letterSpacing: 0,
      baselineShift: 0,
      weight: 0
    },
    {
      label: 'Cabinet Grotesk',
      url: '/fonts/CabinetGrotesk-Light.woff',
      enabled: true,
      sizeOffset: 0,
      letterSpacing: 0,
      baselineShift: 0,
      weight: 0
    },
    {
      label: 'Lobster',
      url: '/fonts/Lobster1_4.otf',
      enabled: false,
      sizeOffset: 0,
      letterSpacing: 0,
      baselineShift: 0,
      weight: 0
    }
  ];

  let fonts = baseFonts;

  const easeOptions: EasingPreset[] = [
    'easeInOut',
    'linear',
    'easeIn',
    'easeOut',
    'easeInOutQuad',
    'easeInOutCubic',
    'easeInOutSine',
    'easeInBack',
    'easeOutBack',
    'easeInOutBack',
    'anticipate',
    'easeInCirc',
    'easeOutCirc',
    'easeInOutCirc',
    'easeInExpo',
    'easeOutExpo',
    'easeInOutExpo'
  ];

  const modeOptions: MorphMode[] = ['font', 'text', 'combined'];
  const sequenceOptions: SequenceMode[] = ['forwards', 'backwards', 'random'];

  const examplePresets = [
    {
      label: 'Font Morph Loop',
      mode: 'font' as MorphMode,
      text: 'We Are One',
      delimiter: ' ',
      fontSequence: 'forwards' as SequenceMode,
      textSequence: 'forwards' as SequenceMode
    },
    {
      label: 'Word Shuffle',
      mode: 'text' as MorphMode,
      text: 'We Are One Together',
      delimiter: ' ',
      fontSequence: 'forwards' as SequenceMode,
      textSequence: 'random' as SequenceMode
    },
    {
      label: 'Combined Showcase',
      mode: 'combined' as MorphMode,
      text: 'Future Ready Vision',
      delimiter: ' ',
      fontSequence: 'backwards' as SequenceMode,
      textSequence: 'forwards' as SequenceMode
    }
  ];

  let selectedPreset = examplePresets[0];
  let textInput = selectedPreset.text;
  let delimiter = selectedPreset.delimiter;
  let mode: MorphMode = selectedPreset.mode;
  let fontSequence: SequenceMode = selectedPreset.fontSequence;
  let textSequence: SequenceMode = selectedPreset.textSequence;
  let fontDuration = 300;
  let textDuration = 300;
  let ease: EasingPreset = 'easeInOut';
  let color = '#f5f1ff';
  let outlineColor = '#9f7aea';
  let outlineWidth = 0.06;
  let outlineOpacity = 0.8;
  let fillOpacity = 1;
  let baseLetterSpacing = 0;
  let baseSize = 1.4;
  let baseline = 0;
  let innerWidth = 0;
  let innerHeight = 0;
  let duplicateMissingGlyphs = false;
  let blendGlyphIndices = false;
  let postProcessMorph = false;

  let lastEvent: string | null = null;

  $: enabledFonts = fonts
    .filter((font) => font.enabled)
    .map(({ label: _label, enabled: _enabled, ...rest }) => rest);

  onMount(async () => {
    try {
      if (enabledFonts.length > 0) {
        await preloadFonts(enabledFonts);
      }
    } catch (err) {
      console.error('Preload failed', err);
    }
  });

  function handlePresetChange(index: number) {
    selectedPreset = examplePresets[index];
    mode = selectedPreset.mode;
    textInput = selectedPreset.text;
    delimiter = selectedPreset.delimiter;
    fontSequence = selectedPreset.fontSequence;
    textSequence = selectedPreset.textSequence;
  }

  function handleFontToggle(idx: number) {
    fonts = fonts.map((font, index) =>
      index === idx ? { ...font, enabled: !font.enabled } : font
    );
  }

  function updateFontOffset(idx: number, key: keyof FontConfig, value: number) {
    fonts = fonts.map((font, index) =>
      index === idx ? { ...font, [key]: value } : font
    );
  }

  function handleEvent(type: 'ready' | 'stepstart' | 'stepend', detail: any) {
    const timestamp = new Date().toLocaleTimeString();
    lastEvent = `${timestamp} · ${type} → font ${detail.fontIndex} · text ${detail.text}`;
  }
</script>

<svelte:window bind:innerWidth bind:innerHeight />

<div class="layout">
  <aside class="panel">
    <header>
      <h1>Threlte Text Morph Playground</h1>
      <p>Tweak parameters and preview transitions in real time.</p>
    </header>

    <section>
      <label>
        Example preset
        <select on:change={(event) => handlePresetChange(event.currentTarget.selectedIndex)}>
          {#each examplePresets as preset, index}
            <option value={preset.label} selected={preset === selectedPreset}>{preset.label}</option>
          {/each}
        </select>
      </label>
    </section>

    <section>
      <label>
        Text
        <textarea rows="2" bind:value={textInput}></textarea>
      </label>
      <label>
        Delimiter
        <input type="text" maxlength="3" bind:value={delimiter} placeholder="space" />
      </label>
    </section>

    <section class="grid">
      <label>
        Mode
        <select bind:value={mode}>
          {#each modeOptions as option}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </label>
      <label>
        Ease
        <select bind:value={ease}>
          {#each easeOptions as option}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </label>
      <label>
        Font sequence
        <select bind:value={fontSequence}>
          {#each sequenceOptions as option}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </label>
      <label>
        Text sequence
        <select bind:value={textSequence}>
          {#each sequenceOptions as option}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </label>
    </section>

    <section class="grid">
      <label>
        Font duration ({fontDuration}ms)
        <input type="range" min="50" max="2000" step="10" bind:value={fontDuration} />
      </label>
      <label>
        Text duration ({textDuration}ms)
        <input type="range" min="50" max="2000" step="10" bind:value={textDuration} />
      </label>
      <label>
        Base size ({baseSize.toFixed(2)})
        <input type="range" min="0.3" max="3" step="0.01" bind:value={baseSize} />
      </label>
      <label>
        Letter spacing ({baseLetterSpacing.toFixed(2)})
        <input type="range" min="-0.2" max="0.5" step="0.01" bind:value={baseLetterSpacing} />
      </label>
      <label>
        Baseline offset ({baseline.toFixed(2)})
        <input type="range" min="-1" max="1" step="0.01" bind:value={baseline} />
      </label>
    </section>

    <section class="grid">
      <label>
        Fill color
        <input type="color" bind:value={color} />
      </label>
      <label>
        Fill opacity ({fillOpacity.toFixed(2)})
        <input type="range" min="0" max="1" step="0.01" bind:value={fillOpacity} />
      </label>
      <label>
        Outline color
        <input type="color" bind:value={outlineColor} />
      </label>
      <label>
        Outline width ({outlineWidth.toFixed(2)})
        <input type="range" min="0" max="0.3" step="0.005" bind:value={outlineWidth} />
      </label>
      <label>
        Outline opacity ({outlineOpacity.toFixed(2)})
        <input type="range" min="0" max="1" step="0.01" bind:value={outlineOpacity} />
      </label>
    </section>

    <section>
      <h2>Morph helpers</h2>
      <label class="toggle">
        <input type="checkbox" bind:checked={duplicateMissingGlyphs} />
        <span>Duplicate missing glyphs</span>
      </label>
      <label class="toggle">
        <input type="checkbox" bind:checked={blendGlyphIndices} />
        <span>Weight blend glyph indices</span>
      </label>
      <label class="toggle">
        <input type="checkbox" bind:checked={postProcessMorph} />
        <span>Enable post-processing</span>
      </label>
    </section>

    <section>
      <h2>Fonts</h2>
      {#each fonts as font, index}
        <div class="font-card">
          <label class="toggle">
            <input type="checkbox" checked={font.enabled} on:change={() => handleFontToggle(index)} />
            <span>{font.label}</span>
          </label>
          <div class="font-controls" aria-hidden={!font.enabled}>
            <label>
              Size offset ({font.sizeOffset?.toFixed(2) ?? '0'})
              <input type="range" min="-1" max="1" step="0.01" value={font.sizeOffset ?? 0} on:input={(event) => updateFontOffset(index, 'sizeOffset', parseFloat(event.currentTarget.value))} />
            </label>
            <label>
              Letter spacing ({font.letterSpacing?.toFixed(2) ?? '0'})
              <input type="range" min="-0.5" max="0.5" step="0.01" value={font.letterSpacing ?? 0} on:input={(event) => updateFontOffset(index, 'letterSpacing', parseFloat(event.currentTarget.value))} />
            </label>
            <label>
              Baseline shift ({font.baselineShift?.toFixed(2) ?? '0'})
              <input type="range" min="-1" max="1" step="0.01" value={font.baselineShift ?? 0} on:input={(event) => updateFontOffset(index, 'baselineShift', parseFloat(event.currentTarget.value))} />
            </label>
            <label>
              Weight offset ({font.weight?.toFixed(2) ?? '0'})
              <input type="range" min="-1" max="1" step="0.01" value={font.weight ?? 0} on:input={(event) => updateFontOffset(index, 'weight', parseFloat(event.currentTarget.value))} />
            </label>
          </div>
        </div>
      {/each}
      {#if enabledFonts.length === 0}
        <p class="warning">Enable at least one font to preview.</p>
      {/if}
    </section>

    <section>
      <h2>Events</h2>
      <div class="event-log">
        {#if lastEvent}
          <code>{lastEvent}</code>
        {:else}
          <span>No events yet.</span>
        {/if}
      </div>
    </section>
  </aside>

  <main class="canvas">
    <Canvas dpr={Math.min(2, window.devicePixelRatio)}>
      <T.Color attach="background" args={['#060606']} />
      <T.AmbientLight intensity={0.6} />
      <T.DirectionalLight position={[3, 5, 4]} intensity={1} />
      <T.PerspectiveCamera makeDefault position={[0, 0, 6]} fov={45}>
        <OrbitControls enableDamping />
      </T.PerspectiveCamera>

      {#if enabledFonts.length > 0}
        <TextMorph
          fonts={enabledFonts}
          mode={mode}
          delimiter={delimiter}
          fontSequence={fontSequence}
          textSequence={textSequence}
          fontDuration={Number(fontDuration)}
          textDuration={Number(textDuration)}
          ease={ease}
          fontSize={baseSize}
          letterSpacing={baseLetterSpacing}
          position={[0, baseline, 0]}
          color={color}
          fillOpacity={fillOpacity}
          outlineColor={outlineColor}
          outlineOpacity={outlineOpacity}
          outlineWidth={outlineWidth}
          text={textInput}
          duplicateMissingGlyphs={duplicateMissingGlyphs}
          blendGlyphIndices={blendGlyphIndices}
          postProcessMorph={postProcessMorph}
          on:ready={(event) => handleEvent('ready', event.detail)}
          on:stepstart={(event) => handleEvent('stepstart', event.detail)}
          on:stepend={(event) => handleEvent('stepend', event.detail)}
        />
      {/if}
    </Canvas>
  </main>
</div>

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(320px, 400px) 1fr;
    height: 100vh;
    background: radial-gradient(circle at top, rgba(68, 51, 122, 0.25), transparent 60%), #0d0d16;
  }

  .panel {
    overflow-y: auto;
    padding: 1.5rem;
    background: rgba(12, 12, 20, 0.92);
    border-right: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  header h1 {
    margin: 0 0 0.25rem;
    font-size: 1.4rem;
  }

  header p {
    margin: 0;
    color: rgba(255, 255, 255, 0.65);
    font-size: 0.9rem;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));
    gap: 0.75rem;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(255, 255, 255, 0.7);
  }

  select,
  textarea,
  input[type="text"],
  input[type="color"] {
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
    color: inherit;
    padding: 0.55rem 0.65rem;
    font-size: 0.95rem;
  }

  textarea {
    resize: vertical;
  }

  input[type="range"] {
    width: 100%;
  }

  .font-card {
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.05);
    padding: 0.75rem;
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .font-controls {
    display: grid;
    gap: 0.5rem;
  }

  .warning {
    margin: 0;
    color: #fbbf24;
    font-size: 0.85rem;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 1rem;
    text-transform: none;
  }

  .toggle input {
    width: 1rem;
    height: 1rem;
  }

  .event-log {
    min-height: 2.5rem;
    border-radius: 0.5rem;
    background: rgba(0, 0, 0, 0.3);
    padding: 0.75rem;
    font-family: 'Fira Code', monospace;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  code {
    white-space: break-spaces;
  }

  .canvas {
    position: relative;
  }

  .canvas :global(canvas) {
    display: block;
  }

  @media (max-width: 1080px) {
    .layout {
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr;
    }

    .panel {
      max-height: 60vh;
    }
  }
</style>
