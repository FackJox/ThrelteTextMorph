<script lang="ts">
import { T } from '@threlte/core';
import * as THREE from 'three';
import { createEventDispatcher, onDestroy, onMount } from 'svelte';
import type {
	EasingPreset,
	FontConfig,
	MorphEventPayload,
	MorphMode,
	SequenceMode
} from './types';
import { preloadFonts, areFontsReady } from './internal/fontLoader';
import {
	buildMorphGeometry,
	buildWordMorph,
	type LayoutConfig,
	type SimpleSDFInfo
} from './internal/sdf';
import {
	createMorphMaterial,
	updateMaterialColors,
	updateMorphUniforms
} from './internal/morphMaterial';
import {
	createWordMorphMaterial,
	updateWordMorphColors,
	updateWordMorphUniforms,
	refreshWordMorphResources
} from './internal/wordMorphMaterial';
import type { WordMorphResources } from './internal/wordMorph';
import type { ColorRepresentation } from 'three';

export let fonts: FontConfig[] = [];
export let mode: MorphMode = 'font';
export let delimiter: string = ' ';
export let fontSequence: SequenceMode = 'forwards';
export let textSequence: SequenceMode = 'forwards';
export let fontDuration: number = 300;
export let textDuration: number = 300;
export let ease: EasingPreset = 'easeInOut';
export let fontSize: number = 1;
export let letterSpacing: number = 0;
export let lineHeight: number | string | undefined = undefined;
export let position: [number, number, number] = [0, 0, 0];
export let color: ColorRepresentation = '#ffffff';
export let outlineWidth: number | string = 0;
export let outlineColor: ColorRepresentation = '#000000';
export let outlineOpacity: number = 1;
export let fillOpacity: number = 1;
export let fontWeight: number | string | undefined = undefined;
export let maxWidth: number | undefined = undefined;
export let anchorX: number | string | undefined = undefined;
export let anchorY: number | string | undefined = undefined;
export let textAlign: 'left' | 'right' | 'center' | 'justify' | undefined = undefined;
export let rotation: [number, number, number] = [0, 0, 0];
export let scale: [number, number, number] = [1, 1, 1];
export let castShadow: boolean = false;
export let receiveShadow: boolean = false;
export let frustumCulled: boolean = true;
export let text: string | null = null;
export let duplicateMissingGlyphs: boolean = false;
export let blendGlyphIndices: boolean = false;
export let postProcessMorph: boolean = false;

const dispatch = createEventDispatcher<{
	ready: MorphEventPayload;
	stepstart: MorphEventPayload;
	stepend: MorphEventPayload;
}>();

const easingMap: Record<string, (t: number) => number> = {
	linear: (t) => t,
	easeIn: (t) => t * t,
	easeOut: (t) => t * (2 - t),
	easeInOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
	easeInBack: (t) => {
		const c1 = 1.70158;
		const c3 = c1 + 1;
		return c3 * t * t * t - c1 * t * t;
	},
	easeOutBack: (t) => {
		const c1 = 1.70158;
		const c3 = c1 + 1;
		const t1 = t - 1;
		return 1 + c3 * t1 * t1 * t1 + c1 * t1 * t1;
	},
	easeInOutBack: (t) => {
		const c1 = 1.70158;
		const c2 = c1 * 1.525;
		return t < 0.5
			? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
			: (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
	},
	anticipate: (t) => {
		const s = 1.70158 * 1.525;
		return t * t * ((s + 1) * t - s);
	},
	easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
	easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
	easeInOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
	easeInCirc: (t) => 1 - Math.sqrt(1 - Math.pow(t, 2)),
	easeOutCirc: (t) => Math.sqrt(1 - Math.pow(t - 1, 2)),
	easeInOutCirc: (t) =>
		t < 0.5
			? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
			: (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,
	easeInExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
	easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
	easeInOutExpo: (t) => {
		if (t === 0) return 0;
		if (t === 1) return 1;
		return t < 0.5
			? Math.pow(2, 20 * t - 10) / 2
			: (2 - Math.pow(2, -20 * t + 10)) / 2;
	}
};

	let slotContainer: HTMLDivElement | null = null;
	let slotElement: HTMLSlotElement | null = null;
	let slotText = '';
	let resolvedText = '';
let ready = false;
let errored = false;
let pendingFonts: FontConfig[] = [];
let fontsChanged = false;
let initializationPromise: Promise<void> | null = null;

let elapsedStartMs = 0;
let animationHandle: number | null = null;
let lastTimestamp = 0;

let currentFontIndex = 0;
let currentTextIndex = 0;
let targetFontIndex = 0;
let targetTextIndex = 0;

let morphDuration = 300;
let morphProgress = 0;
let animating = false;
let preparing = false;
let stepToken = 0;
let sourceFontIndexForStep = 0;
let sourceTextIndexForStep = 0;
let targetSlotForStep = 0;

let mesh: THREE.Mesh | null = null;
let morphGeometry: THREE.BufferGeometry | null = null;
let morphMaterial: THREE.ShaderMaterial | null = null;
let morphTextures: [SimpleSDFInfo, SimpleSDFInfo, SimpleSDFInfo, SimpleSDFInfo] | null = null;
let wordMorphResources: WordMorphResources | null = null;
let currentPipeline: 'glyph' | 'word' = 'glyph';
let lastPreparedSignature = '';

	function updateTextFromSlot() {
		if (!slotElement) return;
		const nodes = slotElement.assignedNodes({ flatten: true });
		slotText = nodes
			.map((node) => (node.textContent ? node.textContent : ''))
			.join('')
			.trim();
	}

	function handleSlotChange() {
		updateTextFromSlot();
	}

	function now(): number {
		return typeof performance !== 'undefined' && typeof performance.now === 'function'
			? performance.now()
			: Date.now();
	}

	function getElapsedTime(timestamp: number) {
		return timestamp - elapsedStartMs;
	}

	function easingFn(t: number): number {
		const fn = easingMap[ease] ?? easingMap.easeInOut;
		const clamped = Math.max(0, Math.min(1, t));
		return fn(clamped);
	}

	$: resolvedText = typeof text === 'string' ? text.trim() : slotText;

	$: textSegments = (() => {
		if (mode === 'font') {
			return [resolvedText];
		}
		if (!resolvedText) {
			return [''];
		}
		const parts = delimiter ? resolvedText.split(delimiter) : [resolvedText];
		return parts.filter((part) => part.length > 0);
	})();

	$: if (textSegments.length === 0 && mode !== 'font') {
		currentTextIndex = 0;
		targetTextIndex = 0;
	}

	$: if (textSegments.length > 0 && currentTextIndex >= textSegments.length) {
		currentTextIndex = currentTextIndex % textSegments.length;
	}

	$: if (fonts.length > 0 && currentFontIndex >= fonts.length) {
		currentFontIndex = currentFontIndex % fonts.length;
	}

	$: if (textSegments.length > 0 && sourceTextIndexForStep >= textSegments.length) {
		sourceTextIndexForStep = sourceTextIndexForStep % textSegments.length;
	}

	$: if (fonts.length > 0 && sourceFontIndexForStep >= fonts.length) {
		sourceFontIndexForStep = sourceFontIndexForStep % fonts.length;
	}

	function clampDuration(value: number): number {
		return Number.isFinite(value) && value > 0 ? value : 300;
	}

	function nextIndex(sequence: SequenceMode, arrayLength: number, current: number): number {
		if (arrayLength === 0) return 0;
		if (arrayLength === 1) return 0;

		switch (sequence) {
			case 'backwards':
				return (current - 1 + arrayLength) % arrayLength;
			case 'random':
				return Math.floor(Math.random() * arrayLength);
			case 'forwards':
			default:
				return (current + 1) % arrayLength;
		}
	}

	function getCurrentText() {
		if (mode === 'font') {
			return resolvedText;
		}
		return textSegments[currentTextIndex] ?? '';
	}

	function getTextForIndex(index: number) {
		if (mode === 'font') {
			return resolvedText;
		}
		return textSegments[index] ?? '';
	}

	function getCurrentFontUrl() {
		return fonts[currentFontIndex]?.url ?? null;
	}

	function dispatchEvent(type: 'ready' | 'stepstart' | 'stepend', timestamp: number) {
		const payload: MorphEventPayload = {
			elapsedTime: getElapsedTime(timestamp),
			fontIndex: currentFontIndex,
			textIndex: currentTextIndex,
			fontUrl: getCurrentFontUrl(),
			text: getCurrentText()
		};
		dispatch(type, payload);
	}

	function startAnimationLoop(timestamp: number) {
		if (!ready || errored || animating || preparing) return;

		if ((mode === 'text' || mode === 'combined') && textSegments.length === 0) {
			console.warn('[TextMorph] No text segments available for morphing.');
			animationHandle = requestAnimationFrame(startAnimationLoop);
			return;
		}

		lastTimestamp = timestamp;

		const durations = [];
		if (mode === 'font' || mode === 'combined') {
			durations.push(clampDuration(fontDuration));
		}
		if (mode === 'text' || mode === 'combined') {
			durations.push(clampDuration(textDuration));
		}

		morphDuration = durations.length > 0 ? Math.max(...durations) : clampDuration(fontDuration);

		sourceFontIndexForStep = currentFontIndex;
		sourceTextIndexForStep = currentTextIndex;

		targetFontIndex =
			mode === 'text'
				? currentFontIndex
				: nextIndex(fontSequence, fonts.length, currentFontIndex);

		targetTextIndex =
			mode === 'font'
				? currentTextIndex
				: nextIndex(textSequence, textSegments.length, currentTextIndex);

		const isFontChange = targetFontIndex !== sourceFontIndexForStep;
		const isTextChange = targetTextIndex !== sourceTextIndexForStep;
		targetSlotForStep = isFontChange || isTextChange ? 1 : 0;

		if (targetFontIndex === currentFontIndex && targetTextIndex === currentTextIndex) {
			preparing = false;
			animationHandle = requestAnimationFrame(startAnimationLoop);
			return;
		}

		const stepId = ++stepToken;
		preparing = true;

		prepareMorphStep()
			.then(() => {
				if (stepToken !== stepId) {
					return;
				}
				morphProgress = 0;
				preparing = false;
				animating = true;
				updateMorphProgress(0);
				dispatchEvent('stepstart', now());
				updateMorphUniforms(morphMaterial!, 0, 0, targetSlotForStep);
				animationHandle = requestAnimationFrame(stepAnimation);
			})
			.catch((error) => {
				console.error('[TextMorph] Failed to prepare morph geometry.', error);
				preparing = false;
				animating = false;
				errored = true;
				animationHandle = requestAnimationFrame(startAnimationLoop);
			});
	}

	function completeStep(timestamp: number) {
		currentFontIndex = targetFontIndex;
		currentTextIndex = targetTextIndex;
		morphProgress = 1;
		animating = false;
		updateMorphProgress(1);
		dispatchEvent('stepend', timestamp);
		sourceFontIndexForStep = currentFontIndex;
		sourceTextIndexForStep = currentTextIndex;
		animationHandle = requestAnimationFrame(startAnimationLoop);
	}

	function stepAnimation(timestamp: number) {
		if (!animating) return;

		const delta = timestamp - lastTimestamp;
		lastTimestamp = timestamp;

		if (morphDuration <= 0) {
			completeStep(timestamp);
			return;
		}

		morphProgress += delta / morphDuration;

		if (morphProgress >= 1) {
			completeStep(timestamp);
			return;
		}

		const eased = easingFn(Math.max(0, Math.min(1, morphProgress)));
		updateMorphProgress(eased);
		animationHandle = requestAnimationFrame(stepAnimation);
	}

	function updateMorphProgress(value: number) {
		if (!morphMaterial) return;
		if (currentPipeline === 'word') {
			updateWordMorphUniforms(morphMaterial, value);
		} else {
			updateMorphUniforms(morphMaterial, value, 0, targetSlotForStep);
		}

		if (mesh) {
			const baseX = position?.[0] ?? 0;
			const baseY = position?.[1] ?? 0;
			const baseZ = position?.[2] ?? 0;
			const sourceShift = fonts[sourceFontIndexForStep]?.baselineShift ?? 0;
			const targetShift = fonts[targetFontIndex]?.baselineShift ?? 0;
			const y = baseY + sourceShift + (targetShift - sourceShift) * value;
			mesh.position.set(baseX, y, baseZ);
		}
	}

	$: if (mesh) {
		updateMorphProgress(morphProgress);
	}

	$: if (morphMaterial && fonts.length > 0) {
		const currentLayout = computeLayout(currentFontIndex);
		const colorOptions = {
			fillColor: color,
			fillOpacity,
			outlineColor,
			outlineOpacity,
			outlineThickness: parseLength(outlineWidth, currentLayout.fontSize)
		};
		if (currentPipeline === 'word') {
			updateWordMorphColors(morphMaterial, colorOptions);
		} else {
			updateMaterialColors(morphMaterial, colorOptions);
		}
	}

	async function prepareMorphStep() {
		const sourceFont = fonts[sourceFontIndexForStep];
		const targetFont = fonts[targetFontIndex];

		if (!sourceFont || !targetFont) {
			throw new Error('Invalid font configuration for morph step.');
		}

		const sourceText = getTextForIndex(sourceTextIndexForStep);
		const targetText = getTextForIndex(targetTextIndex);

		const sourceLayout = computeLayout(sourceFontIndexForStep);
		const targetLayout = computeLayout(targetFontIndex);

		const outlineThicknessValue = parseLength(outlineWidth, sourceLayout.fontSize);
		const colorOptions = {
			fillColor: color,
			fillOpacity,
			outlineColor,
			outlineOpacity,
			outlineThickness: outlineThicknessValue
		};

		const previousPipeline = currentPipeline;
		const useWordPipeline = mode !== 'font' && sourceText !== targetText;
		console.log('[TextMorph] prepareMorphStep', {
			mode,
			sourceText,
			targetText,
			sourceFontIndex: sourceFontIndexForStep,
			targetFontIndex,
			currentFontIndex,
			useWordPipeline
		});

		if (useWordPipeline) {
			const { resources } = await buildWordMorph(
				{
					text: sourceText,
					font: sourceFont,
					layout: sourceLayout
				},
				{
					text: targetText,
					font: targetFont,
					layout: targetLayout
				}
			);

			console.log('[TextMorph] word resources', {
				sourceGlyphCount: resources.source.glyphCount,
				targetGlyphCount: resources.target.glyphCount,
				sourceBounds: [...resources.source.wordBounds],
				targetBounds: [...resources.target.wordBounds]
			});
			wordMorphResources = resources;
			morphTextures = null;
			currentPipeline = 'word';

			if (morphGeometry && morphGeometry !== resources.geometry) {
				morphGeometry.dispose();
			}
			morphGeometry = resources.geometry;

			if (!morphMaterial || previousPipeline !== 'word') {
				if (morphMaterial) {
					morphMaterial.dispose();
				}
				morphMaterial = createWordMorphMaterial(resources, colorOptions);
				console.log('[TextMorph] created word morph material');
			} else {
				refreshWordMorphResources(morphMaterial, resources);
				updateWordMorphColors(morphMaterial, colorOptions);
				morphMaterial.uniformsNeedUpdate = true;
				console.log('[TextMorph] refreshed word morph material');
			}

			updateWordMorphUniforms(morphMaterial!, 0);
		} else {
			const { geometry, textures } = await buildMorphGeometry(
				{
					text: sourceText,
					font: sourceFont,
					layout: sourceLayout
				},
				{
					text: targetText,
					font: targetFont,
					layout: targetLayout
				},
				{
					duplicateMissingGlyphs,
					blendGlyphIndices,
					applyPostProcess: postProcessMorph,
					textGlyphRemap: mode === 'text',
					normalizeSize: mode !== 'font'
				}
			);

			if (!geometry) {
				throw new Error('Failed to build morph geometry.');
			}

			if (morphGeometry && morphGeometry !== geometry.geometry) {
				morphGeometry.dispose();
			}

			morphGeometry = geometry.geometry;
			morphTextures = textures;
			wordMorphResources = null;
			currentPipeline = 'glyph';

			if (!morphMaterial || previousPipeline !== 'glyph') {
				if (morphMaterial) {
					morphMaterial.dispose();
				}
				morphMaterial = createMorphMaterial(textures, colorOptions);
			} else {
				updateMaterialColors(morphMaterial, colorOptions);
				morphMaterial.uniforms.sdfTexture.value = textures[0].texture;
				morphMaterial.uniforms.sdfTexture2.value = textures[1].texture;
				morphMaterial.uniforms.sdfTexture3.value = textures[2].texture;
				morphMaterial.uniforms.sdfTexture4.value = textures[3].texture;
				if (textures[0].uniforms.uTroikaSDFGlyphSize) {
					morphMaterial.uniforms.uTroikaSDFGlyphSize.value =
						textures[0].uniforms.uTroikaSDFGlyphSize.value;
				}
				if (textures[0].uniforms.uTroikaSDFExponent) {
					morphMaterial.uniforms.uTroikaSDFExponent.value =
						textures[0].uniforms.uTroikaSDFExponent.value;
				}
			}

			updateMorphUniforms(morphMaterial!, 0, 0, targetSlotForStep);
		}

		if (mesh && morphGeometry) {
			mesh.geometry = morphGeometry;
		}
		if (mesh && morphMaterial) {
			mesh.material = morphMaterial;
			(mesh.material as THREE.ShaderMaterial).needsUpdate = true;
		}
	}

	function scheduleInitialization(reason: 'fonts' | 'text') {
		if (!areFontsReady(fonts) || preparing || animating) return;
		fontsChanged = false;
		initializationPromise = preloadFonts(fonts).then(async () => {
			pendingFonts = fonts;
			await prepareMorphStep();
			lastPreparedSignature = JSON.stringify({
				text: resolvedText,
				font: currentFontIndex,
				fontSize,
				letterSpacing,
				lineHeight,
				maxWidth,
				anchorX,
				anchorY,
				textAlign,
				fontWeight
			});
			ready = true;
			dispatchEvent('ready', now());
		});
	}

	$: fontsChanged = fonts !== pendingFonts;

	$: if (areFontsReady(fonts) && !ready && !initializationPromise) {
		scheduleInitialization('fonts');
	}

	$: if (ready && fontsChanged) {
		scheduleInitialization('fonts');
	}

	$: currentSignature = JSON.stringify({
		text: resolvedText,
		font: currentFontIndex,
		fontSize,
		letterSpacing,
		lineHeight,
		maxWidth,
		anchorX,
		anchorY,
		textAlign,
		fontWeight
	});

	$: if (ready && !animating && !preparing && currentSignature !== lastPreparedSignature && lastPreparedSignature !== '') {
		const signature = currentSignature;
		prepareMorphStep().then(() => {
			lastPreparedSignature = signature;
		}).catch((error) => {
			console.error('[TextMorph] Failed to rebuild after prop change', error);
			errored = true;
		});
	}

	onMount(() => {
		if (slotContainer) {
			const foundSlot = slotContainer.querySelector('slot');
			if (foundSlot) {
				slotElement = foundSlot;
				slotElement.addEventListener('slotchange', handleSlotChange);
				updateTextFromSlot();
			}
		}

		elapsedStartMs = now();

		// Font initialization is now handled by scheduleInitialization reactive statement
		// Once ready, start animation loop
		const unsubscribe = () => {};
		return unsubscribe;
	});

	$: if (ready && !animationHandle) {
		animationHandle = requestAnimationFrame(startAnimationLoop);
	}

	onDestroy(() => {
		if (slotElement) {
			slotElement.removeEventListener('slotchange', handleSlotChange);
		}
		if (animationHandle !== null) {
			cancelAnimationFrame(animationHandle);
			animationHandle = null;
		}
		if (morphGeometry) {
			morphGeometry.dispose();
			morphGeometry = null;
		}
		if (morphMaterial) {
			morphMaterial.dispose();
			morphMaterial = null;
		}
	});

	function computeLayout(fontIdx: number): LayoutConfig {
		const font = fonts[fontIdx];
		let resolvedFontWeight: number | string | undefined = fontWeight;

		if (font) {
			if (resolvedFontWeight === undefined && font.weight !== undefined) {
				resolvedFontWeight = font.weight;
			} else if (
				typeof resolvedFontWeight === 'number' &&
				typeof font.weight === 'number'
			) {
				resolvedFontWeight = resolvedFontWeight + font.weight;
			}
		}

		return {
			fontSize: (fontSize ?? 1) + (font?.sizeOffset ?? 0),
			letterSpacing: (letterSpacing ?? 0) + (font?.letterSpacing ?? 0),
			lineHeight,
			maxWidth,
			anchorX,
			anchorY,
			textAlign,
			fontWeight: resolvedFontWeight
		};
	}

	function parseLength(value: number | string, base: number): number {
		if (typeof value === 'number') {
			return value;
		}

		const trimmed = value.trim();
		if (trimmed.endsWith('%')) {
			const percent = parseFloat(trimmed.slice(0, -1));
			return (percent / 100) * base;
		}

		const numeric = parseFloat(trimmed);
		return Number.isFinite(numeric) ? numeric : 0;
	}
</script>

<div bind:this={slotContainer} style="display: none; visibility: hidden;" aria-hidden="true">
	<slot />
</div>

{#if ready && morphGeometry && morphMaterial && !errored}
	<T.Mesh
		bind:ref={mesh}
		geometry={morphGeometry}
		material={morphMaterial}
		rotation={rotation}
		scale={scale}
		castShadow={castShadow}
		receiveShadow={receiveShadow}
		frustumCulled={frustumCulled}
	/>
{/if}
