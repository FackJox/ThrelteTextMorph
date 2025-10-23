# @jackfoxdev/ThrelteTextMorph

Threlte component that morphs signed-distance-field text across fonts and phrases. Extracted from the *We Are One* project and expanded into a reusable package.

## Installation

```bash
npm install @jackfoxdev/threlte-text-morph
```

Peer dependencies:

- `svelte >=4`
- `@threlte/core >=7`
- `@threlte/extras >=7`
- `three >=0.158`
- `troika-three-text >=0.50`

## Usage

```svelte
<script lang="ts">
  import { TextMorph } from '@jackfoxdev/threlte-text-morph';

  const fonts = [
    { url: '/fonts/FontOne.otf' },
    { url: '/fonts/FontTwo.otf', sizeOffset: -0.1, letterSpacing: 0.02 }
  ];
</script>

<TextMorph
  {fonts}
  mode="combined"
  fontSequence="forwards"
  textSequence="backwards"
  fontDuration={300}
  textDuration={450}
  ease="easeInOut"
>
  We Are One
</TextMorph>
```

### Modes

- `font` (default) – text stays fixed, fonts cycle.
- `text` – text segments morph while first font remains active.
- `combined` – both text and fonts morph together; sequences wrap independently even if array lengths differ.

### Props

| Prop | Type | Default | Description |
| ---- | ---- | ------- | ----------- |
| `fonts` | `FontConfig[]` | – | Array of font descriptors `{ url, sizeOffset?, letterSpacing?, baselineShift?, weight? }`. |
| `mode` | `'font' \| 'text' \| 'combined'` | `'font'` | Morphing mode. |
| `delimiter` | `string` | `' '` | Token separator when morphing text. |
| `fontSequence` | `'forwards' \| 'backwards' \| 'random'` | `'forwards'` | Sequence strategy for fonts. |
| `textSequence` | `'forwards' \| 'backwards' \| 'random'` | `'forwards'` | Sequence strategy for text segments. |
| `fontDuration` | `number` | `300` | Transition duration (ms) for font morphs. |
| `textDuration` | `number` | `300` | Transition duration (ms) for text morphs. |
| `ease` | `EasingPreset` | `'easeInOut'` | Interpolation curve (Framer Motion-inspired names). |
| `fontSize` | `number` | `1` | Base font size passed to Troika geometry. |
| `letterSpacing` | `number` | `0` | Base letter spacing. |
| `lineHeight` | `number \| string` | – | Troika line height. |
| `position` | `[number, number, number]` | `[0,0,0]` | Base position; baseline shifts are blended on top. |
| `rotation` | `[number, number, number]` | `[0,0,0]` | Mesh rotation. |
| `scale` | `[number, number, number]` | `[1,1,1]` | Mesh scale. |
| `color` | `ColorRepresentation` | `'#ffffff'` | Fill color. |
| `fillOpacity` | `number` | `1` | Fill opacity. |
| `outlineWidth` | `number \| string` | `0` | Outline thickness (supports percentages). |
| `outlineColor` | `ColorRepresentation` | `'#000000'` | Outline color. |
| `outlineOpacity` | `number` | `1` | Outline opacity. |
| `maxWidth` | `number` | – | Max text width. |
| `anchorX`, `anchorY` | `number \| string` | – | Anchor controls forwarded to Troika. |
| `textAlign` | `'left' \| 'right' \| 'center' \| 'justify'` | – | Troika alignment. |
| `castShadow`, `receiveShadow`, `frustumCulled` | `boolean` | `false`, `false`, `true` | Mesh rendering flags. |

Per-font adjustments (`sizeOffset`, `letterSpacing`, `baselineShift`, `weight`) are additive to the global props, except `weight`, which maps directly if supported.

### Events

```svelte
<TextMorph
  fonts={fonts}
  on:ready={(event) => console.log('ready', event.detail)}
  on:stepstart={(event) => console.log('start', event.detail)}
  on:stepend={(event) => console.log('end', event.detail)}
>
  Morphing Example
</TextMorph>
```

Each payload:

```ts
interface MorphEventPayload {
  elapsedTime: number; // ms since mount
  fontIndex: number;
  textIndex: number;
  fontUrl: string | null;
  text: string;
}
```

### Helpers

```ts
import { preloadFonts } from '@jackfoxdev/threlte-text-morph';

await preloadFonts([
  { url: '/fonts/FontOne.otf' },
  { url: '/fonts/FontTwo.otf' }
]);
```

Use in loaders to warm fonts before mounting.

## Development

```bash
npm install
npm run test
npm run build

# install playground deps once
cd examples/playground
npm install
cd ../..

# launch playground with hot reload (from repo root)
npm run dev:playground

# or from the playground folder directly
cd examples/playground
npm run dev
```

- Tests use Vitest + jsdom.
- Build uses `svelte-package` producing ESM output with type declarations.
- Playground web app (in `examples/playground`) exposes interactive controls for modes, sequences, durations, colors, and per-font offsets.

## License

MIT © Jack Fox Dev
