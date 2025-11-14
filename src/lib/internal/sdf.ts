import { Text as TroikaText } from 'troika-three-text';
import * as THREE from 'three';
import type { FontConfig } from '../types';
import type {
	ShaderUniforms,
	TextureInfo,
	SimpleGeometry,
	GlyphMorphOptions
} from './glyphGeometryBuilder4';
import { createMultiGlyphGeometry4 } from './glyphGeometryBuilder4';
import { buildWordMorphResources, type WordMorphResources } from './wordMorph';

export interface SimpleSDFInfo {
	texture: THREE.Texture;
	uniforms: ShaderUniforms;
	geometry: THREE.BufferGeometry;
	isReady: boolean;
}

export interface LayoutConfig {
	fontSize: number;
	letterSpacing: number;
	lineHeight?: number | string;
	maxWidth?: number;
	anchorX?: number | string;
	anchorY?: number | string;
	textAlign?: 'left' | 'right' | 'center' | 'justify';
	fontWeight?: number | string;
}

function makeCacheKey(
	text: string,
	font: FontConfig,
	layout: LayoutConfig
): string {
	return JSON.stringify({
		text,
		font: font.url,
		fontSize: layout.fontSize,
		letterSpacing: layout.letterSpacing,
		lineHeight: layout.lineHeight ?? null,
		maxWidth: layout.maxWidth ?? null,
		anchorX: layout.anchorX ?? null,
		anchorY: layout.anchorY ?? null,
		textAlign: layout.textAlign ?? null,
		fontWeight: layout.fontWeight ?? null,
		sizeOffset: font.sizeOffset ?? 0,
		letterSpacingOffset: font.letterSpacing ?? 0,
		baselineShift: font.baselineShift ?? 0,
		weight: font.weight ?? 0
	});
}

const sdfCache = new Map<string, Promise<SimpleSDFInfo>>();

export async function getSDFInfo(
	text: string,
	font: FontConfig,
	layout: LayoutConfig
): Promise<SimpleSDFInfo> {
	const key = makeCacheKey(text, font, layout);

	if (!sdfCache.has(key)) {
		sdfCache.set(key, extractSDFInfo(text, font, layout));
	}

	return sdfCache.get(key)!;
}

async function extractSDFInfo(
	text: string,
	font: FontConfig,
	layout: LayoutConfig
): Promise<SimpleSDFInfo> {
	const troika = new TroikaText();
	troika.text = text;
	troika.font = font.url;
	troika.fontSize = layout.fontSize;
	troika.letterSpacing = layout.letterSpacing;

	if (layout.lineHeight !== undefined) {
		troika.lineHeight = layout.lineHeight;
	}
	if (layout.maxWidth !== undefined) {
		troika.maxWidth = layout.maxWidth;
	}
	if (layout.anchorX !== undefined) {
		troika.anchorX = layout.anchorX as any;
	}
	if (layout.anchorY !== undefined) {
		troika.anchorY = layout.anchorY as any;
	}
	if (layout.textAlign !== undefined) {
		troika.textAlign = layout.textAlign;
	}
	if (layout.fontWeight !== undefined) {
		troika.fontWeight = layout.fontWeight as any;
	}

	return new Promise<SimpleSDFInfo>((resolve, reject) => {
		troika.sync(() => {
			try {
				const renderInfo = troika.textRenderInfo;

				if (!renderInfo || !renderInfo.sdfTexture) {
					throw new Error('Troika render info unavailable for SDF extraction.');
				}

				const clonedGeometry = troika.geometry.clone();

				const uniforms: ShaderUniforms = {
					uTroikaSDFGlyphSize: {
						value: renderInfo.sdfGlyphSize ?? 64
					},
					uTroikaSDFExponent: {
						value: renderInfo.sdfExponent ?? 8
					},
					uTroikaTotalBounds: {
						value: renderInfo.blockBounds ?? new Float32Array([0, 0, 0, 0])
					},
					uTroikaClipRect: {
						value: renderInfo.visibleBounds ?? new Float32Array([0, 0, 0, 0])
					}
				};

				resolve({
					texture: renderInfo.sdfTexture,
					uniforms,
					geometry: clonedGeometry,
					isReady: true
				});
			} catch (error) {
				reject(error);
			} finally {
				troika.dispose();
			}
		});
	});
}

export interface MorphGeometryResult {
	geometry: SimpleGeometry | null;
	textures: [SimpleSDFInfo, SimpleSDFInfo, SimpleSDFInfo, SimpleSDFInfo];
}

export type MorphGeometryOptions = GlyphMorphOptions;

export interface WordMorphResult {
	resources: WordMorphResources;
}

export async function buildMorphGeometry(
	source: { text: string; font: FontConfig; layout: LayoutConfig },
	target: { text: string; font: FontConfig; layout: LayoutConfig },
	options: MorphGeometryOptions = {}
): Promise<MorphGeometryResult> {
	const [sourceInfo, targetInfo] = await Promise.all([
		getSDFInfo(source.text, source.font, source.layout),
		getSDFInfo(target.text, target.font, target.layout)
	]);

	// Duplicate textures to fill remaining slots
	const textures: [SimpleSDFInfo, SimpleSDFInfo, SimpleSDFInfo, SimpleSDFInfo] = [
		sourceInfo,
		targetInfo,
		targetInfo,
		targetInfo
	];

	const sourceGlyphAttr = sourceInfo.geometry.getAttribute('aTroikaGlyphBounds');
	const targetGlyphAttr = targetInfo.geometry.getAttribute('aTroikaGlyphBounds');
	const sourceGlyphCount = sourceGlyphAttr?.count ?? 0;
	const targetGlyphCount = targetGlyphAttr?.count ?? 0;
	const glyphCount = Math.max(sourceGlyphCount, targetGlyphCount);

	let indexOverrides: Array<number[] | null> | undefined;

	if (options.textGlyphRemap && glyphCount > 0) {
		const targetMap = computeProportionalIndexMap(sourceGlyphCount, targetGlyphCount, glyphCount);
		indexOverrides = [null, targetMap, targetMap, targetMap];
	}

	const { normalizeSize = true, ...restOptions } = options;
	const builderOptions: GlyphMorphOptions = {
		...restOptions,
		indexOverrides
	};

	const geometry = createMultiGlyphGeometry4(
		toTextureInfo(sourceInfo),
		toTextureInfo(targetInfo),
		toTextureInfo(targetInfo),
		toTextureInfo(targetInfo),
		normalizeSize,
		builderOptions
	);

	return {
		geometry,
		textures
	};
}

function computeProportionalIndexMap(
	sourceCount: number,
	targetCount: number,
	glyphCount: number
): number[] {
	const map = new Array<number>(glyphCount).fill(-1);

	if (targetCount <= 0) {
		return map;
	}

	if (glyphCount === 1) {
		map[0] = 0;
		return map;
	}

	const targetMax = targetCount - 1;
	const denominator = Math.max(1, glyphCount - 1);

	for (let i = 0; i < glyphCount; i++) {
		const ratio = i / denominator;
		let targetIndex = Math.round(ratio * targetMax);
		targetIndex = Math.max(0, Math.min(targetMax, targetIndex));
		map[i] = targetIndex;
	}

	return map;
}

function toTextureInfo(info: SimpleSDFInfo): TextureInfo {
	return {
		texture: info.texture,
		geometry: info.geometry,
		uniforms: info.uniforms
	};
}

export async function buildWordMorph(
	source: { text: string; font: FontConfig; layout: LayoutConfig },
	target: { text: string; font: FontConfig; layout: LayoutConfig }
): Promise<WordMorphResult> {
	const [sourceInfo, targetInfo] = await Promise.all([
		getSDFInfo(source.text, source.font, source.layout),
		getSDFInfo(target.text, target.font, target.layout)
	]);

	const resources = buildWordMorphResources(sourceInfo, targetInfo);
	return { resources };
}
