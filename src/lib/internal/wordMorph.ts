import * as THREE from 'three';
import type { SimpleSDFInfo } from './sdf';

const MAX_WORD_GLYPHS = 64;

export interface WordGlyphUniformData {
	glyphCount: number;
	glyphBounds: Float32Array; // length MAX_WORD_GLYPHS * 4
	glyphUVRects: Float32Array; // length MAX_WORD_GLYPHS * 4
	glyphChannels: Float32Array; // length MAX_WORD_GLYPHS
	glyphSize: number;
	sdfExponent: number;
	wordBounds: Float32Array; // [minX, minY, maxX, maxY]
}

export interface WordMorphResources {
	geometry: THREE.BufferGeometry;
	source: WordGlyphUniformData;
	target: WordGlyphUniformData;
	sourceTexture: SimpleSDFInfo;
	targetTexture: SimpleSDFInfo;
}

function createEmptyGlyphData(): WordGlyphUniformData {
	return {
		glyphCount: 0,
		glyphBounds: new Float32Array(MAX_WORD_GLYPHS * 4),
		glyphUVRects: new Float32Array(MAX_WORD_GLYPHS * 4),
		glyphChannels: new Float32Array(MAX_WORD_GLYPHS),
		glyphSize: 64,
		sdfExponent: 8,
		wordBounds: new Float32Array([0, 0, 0, 0])
	};
}

function fillGlyphData(info: SimpleSDFInfo): WordGlyphUniformData {
	const data = createEmptyGlyphData();
	const geometry = info.geometry;
	const glyphBoundsAttr = geometry.getAttribute('aTroikaGlyphBounds');
	const glyphIndexAttr = geometry.getAttribute('aTroikaGlyphIndex');

	if (!glyphBoundsAttr || !glyphIndexAttr) {
		return data;
	}

	const glyphCount = Math.min(glyphIndexAttr.count, MAX_WORD_GLYPHS);
	const glyphBoundsArray = glyphBoundsAttr.array as Float32Array;
	const glyphIndexArray = glyphIndexAttr.array as Float32Array;

	const textureWidth = info.texture.image.width;
	const textureHeight = info.texture.image.height;
	const glyphSizeUniform = info.uniforms.uTroikaSDFGlyphSize;
	const glyphSize =
		glyphSizeUniform && typeof glyphSizeUniform.value === 'number'
			? glyphSizeUniform.value
			: 64;
	const exponentUniform = info.uniforms.uTroikaSDFExponent;
	const sdfExponent =
		exponentUniform && typeof exponentUniform.value === 'number'
			? exponentUniform.value
			: 8;

	const atlasColumns = Math.max(1, Math.floor(textureWidth / glyphSize));
	const atlasRows = Math.max(1, Math.floor(textureHeight / glyphSize));

	for (let i = 0; i < glyphCount; i++) {
		const boundsOffset = i * 4;
		data.glyphBounds[boundsOffset + 0] = glyphBoundsArray[boundsOffset + 0];
		data.glyphBounds[boundsOffset + 1] = glyphBoundsArray[boundsOffset + 1];
		data.glyphBounds[boundsOffset + 2] = glyphBoundsArray[boundsOffset + 2];
		data.glyphBounds[boundsOffset + 3] = glyphBoundsArray[boundsOffset + 3];

		const glyphIndex = glyphIndexArray[i];
		const atlasIndex = Math.floor(glyphIndex / 4);
		const channel = glyphIndex % 4;
		const col = atlasIndex % atlasColumns;
		const row = Math.floor(atlasIndex / atlasColumns);
		const uvLeft = col / atlasColumns;
		const uvTop = row / atlasRows;
		const uvRight = (col + 1) / atlasColumns;
		const uvBottom = (row + 1) / atlasRows;

		data.glyphUVRects[boundsOffset + 0] = uvLeft;
		data.glyphUVRects[boundsOffset + 1] = uvTop;
		data.glyphUVRects[boundsOffset + 2] = uvRight;
		data.glyphUVRects[boundsOffset + 3] = uvBottom;

		data.glyphChannels[i] = channel;
	}

	data.glyphCount = glyphCount;
	data.glyphSize = glyphSize;
	data.sdfExponent = sdfExponent;

	const boundsUniform = info.uniforms.uTroikaTotalBounds;
	if (boundsUniform && boundsUniform.value) {
		const sourceBounds = boundsUniform.value;
		// Handle both Float32Array and regular Array
		if (Array.isArray(sourceBounds) || sourceBounds instanceof Float32Array) {
			data.wordBounds[0] = sourceBounds[0] ?? 0;
			data.wordBounds[1] = sourceBounds[1] ?? 0;
			data.wordBounds[2] = sourceBounds[2] ?? 0;
			data.wordBounds[3] = sourceBounds[3] ?? 0;
		}
	}

	return data;
}

function createWordQuad(
	sourceBounds: Float32Array,
	targetBounds: Float32Array
): THREE.BufferGeometry {
	const minX = Math.min(sourceBounds[0] ?? 0, targetBounds[0] ?? 0);
	const minY = Math.min(sourceBounds[1] ?? 0, targetBounds[1] ?? 0);
	const maxX = Math.max(sourceBounds[2] ?? 0, targetBounds[2] ?? 0);
	const maxY = Math.max(sourceBounds[3] ?? 0, targetBounds[3] ?? 0);

	const positions = new Float32Array([
		minX,
		minY,
		0,
		maxX,
		minY,
		0,
		minX,
		maxY,
		0,
		maxX,
		maxY,
		0
	]);

	function computeUV(bounds: Float32Array): Float32Array {
		const width = Math.max(1e-6, bounds[2] - bounds[0]);
		const height = Math.max(1e-6, bounds[3] - bounds[1]);
		return new Float32Array([
			(minX - bounds[0]) / width,
			(minY - bounds[1]) / height,
			(maxX - bounds[0]) / width,
			(minY - bounds[1]) / height,
			(minX - bounds[0]) / width,
			(maxY - bounds[1]) / height,
			(maxX - bounds[0]) / width,
			(maxY - bounds[1]) / height
		]);
	}

	const uvSource = computeUV(sourceBounds);
	const uvTarget = computeUV(targetBounds);

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvSource, 2));
	geometry.setAttribute('uv2', new THREE.Float32BufferAttribute(uvTarget, 2));
	geometry.setIndex(new THREE.Uint16BufferAttribute(new Uint16Array([0, 1, 2, 1, 3, 2]), 1));

	return geometry;
}

export function buildWordMorphResources(
	sourceInfo: SimpleSDFInfo,
	targetInfo: SimpleSDFInfo
): WordMorphResources {
	const sourceData = fillGlyphData(sourceInfo);
	const targetData = fillGlyphData(targetInfo);
	console.debug('[wordMorph] build resources', {
		sourceGlyphs: sourceData.glyphCount,
		targetGlyphs: targetData.glyphCount,
		sourceBounds: [...sourceData.wordBounds],
		targetBounds: [...targetData.wordBounds]
	});

	const geometry = createWordQuad(sourceData.wordBounds, targetData.wordBounds);
	geometry.computeBoundingBox();
	geometry.computeBoundingSphere();

	return {
		geometry,
		source: sourceData,
		target: targetData,
		sourceTexture: sourceInfo,
		targetTexture: targetInfo
	};
}

export const MAX_WORD_GLYPH_UNIFORMS = MAX_WORD_GLYPHS;
