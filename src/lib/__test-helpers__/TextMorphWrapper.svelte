<script lang="ts">
  import TextMorph from '../TextMorph.svelte';
  import type { FontConfig } from '../types';

  export let fonts: FontConfig[] = [];
  export let text: string = '';
  export let mode: 'font' | 'text' | 'combined' = 'font';
</script>

<TextMorph {fonts} {text} {mode} />
