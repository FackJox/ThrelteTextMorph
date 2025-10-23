import * as THREE from 'three';
import vertexShaderSource from './wordMorph.vert?raw';
import fragmentShaderSource from './wordMorph.frag?raw';
import type { WordMorphResources } from './wordMorph';

export interface WordMorphMaterialOptions {
	fillColor: THREE.ColorRepresentation;
	fillOpacity: number;
	outlineColor: THREE.ColorRepresentation;
	outlineOpacity: number;
	outlineThickness: number;
}

function toVector4Array(buffer: Float32Array, maxCount: number): THREE.Vector4[] {
	const vectors: THREE.Vector4[] = [];
	for (let i = 0; i < maxCount; i++) {
		const offset = i * 4;
		const x = buffer[offset + 0] ?? 0;
		const y = buffer[offset + 1] ?? 0;
		const z = buffer[offset + 2] ?? 0;
		const w = buffer[offset + 3] ?? 0;
		vectors.push(new THREE.Vector4(x, y, z, w));
	}
	return vectors;
}

function toFloatArray(buffer: Float32Array, maxCount: number): number[] {
	const array: number[] = [];
	for (let i = 0; i < maxCount; i++) {
		array.push(buffer[i] ?? 0);
	}
	return array;
}

function applyGlyphDataToUniforms(
	material: THREE.ShaderMaterial,
	resources: WordMorphResources
) {
	const maxSource = resources.source.glyphBounds.length / 4;
	const maxTarget = resources.target.glyphBounds.length / 4;

	material.uniforms.uSourceGlyphBounds.value = toVector4Array(
		resources.source.glyphBounds,
		maxSource
	);
	material.uniforms.uSourceGlyphUvRects.value = toVector4Array(
		resources.source.glyphUVRects,
		maxSource
	);
	material.uniforms.uSourceGlyphChannels.value = toFloatArray(
		resources.source.glyphChannels,
		maxSource
	);
	material.uniforms.uTargetGlyphBounds.value = toVector4Array(
		resources.target.glyphBounds,
		maxTarget
	);
	material.uniforms.uTargetGlyphUvRects.value = toVector4Array(
		resources.target.glyphUVRects,
		maxTarget
	);
	material.uniforms.uTargetGlyphChannels.value = toFloatArray(
		resources.target.glyphChannels,
		maxTarget
	);

	material.uniforms.sdfTextureSource.value = resources.sourceTexture.texture;
	material.uniforms.sdfTextureTarget.value = resources.targetTexture.texture;
	material.uniforms.uSourceGlyphCount.value = resources.source.glyphCount;
	material.uniforms.uTargetGlyphCount.value = resources.target.glyphCount;
	material.uniforms.uSourceGlyphSize.value = resources.source.glyphSize;
	material.uniforms.uTargetGlyphSize.value = resources.target.glyphSize;
	material.uniforms.uSourceSDFExponent.value = resources.source.sdfExponent;
	material.uniforms.uTargetSDFExponent.value = resources.target.sdfExponent;
	(material.uniforms.uSourceWordBounds.value as THREE.Vector4).set(
		resources.source.wordBounds[0],
		resources.source.wordBounds[1],
		resources.source.wordBounds[2],
		resources.source.wordBounds[3]
	);
	(material.uniforms.uTargetWordBounds.value as THREE.Vector4).set(
		resources.target.wordBounds[0],
		resources.target.wordBounds[1],
		resources.target.wordBounds[2],
		resources.target.wordBounds[3]
	);
}

export function createWordMorphMaterial(
	resources: WordMorphResources,
	options: WordMorphMaterialOptions
): THREE.ShaderMaterial {
	const { source, target, sourceTexture, targetTexture } = resources;

	const maxSource = source.glyphBounds.length / 4;
	const maxTarget = target.glyphBounds.length / 4;

	const uniforms = {
		sdfTextureSource: { value: sourceTexture.texture },
		sdfTextureTarget: { value: targetTexture.texture },
		morphProgress: { value: 0 },
		outlineMode: { value: options.outlineThickness > 0 ? 1 : 0 },
		outlineThickness: { value: options.outlineThickness },
		fillColor: { value: new THREE.Color(options.fillColor) },
		fillOpacity: { value: options.fillOpacity },
		outlineColor: { value: new THREE.Color(options.outlineColor) },
		outlineOpacity: { value: options.outlineOpacity },
		uSourceGlyphCount: { value: source.glyphCount },
		uTargetGlyphCount: { value: target.glyphCount },
		uSourceGlyphBounds: { value: toVector4Array(source.glyphBounds, maxSource) },
		uSourceGlyphUvRects: { value: toVector4Array(source.glyphUVRects, maxSource) },
		uSourceGlyphChannels: { value: toFloatArray(source.glyphChannels, maxSource) },
		uTargetGlyphBounds: { value: toVector4Array(target.glyphBounds, maxTarget) },
		uTargetGlyphUvRects: { value: toVector4Array(target.glyphUVRects, maxTarget) },
		uTargetGlyphChannels: { value: toFloatArray(target.glyphChannels, maxTarget) },
		uSourceGlyphSize: { value: source.glyphSize },
		uTargetGlyphSize: { value: target.glyphSize },
		uSourceSDFExponent: { value: source.sdfExponent },
		uTargetSDFExponent: { value: target.sdfExponent },
		uSourceWordBounds: {
			value: new THREE.Vector4(
				source.wordBounds[0],
				source.wordBounds[1],
				source.wordBounds[2],
				source.wordBounds[3]
			)
		},
		uTargetWordBounds: {
			value: new THREE.Vector4(
				target.wordBounds[0],
				target.wordBounds[1],
				target.wordBounds[2],
				target.wordBounds[3]
			)
		}
	};

	const material = new THREE.ShaderMaterial({
		vertexShader: vertexShaderSource,
		fragmentShader: fragmentShaderSource,
		uniforms,
		transparent: true,
		side: THREE.DoubleSide,
		extensions: {
			derivatives: true
		} as any
	});

	console.debug('[wordMorphMaterial] create', {
		sourceGlyphCount: source.glyphCount,
		targetGlyphCount: target.glyphCount,
		sourceWordBounds: Array.from(source.wordBounds),
		targetWordBounds: Array.from(target.wordBounds),
		sourceGlyphBounds: Array.from(source.glyphBounds.slice(0, source.glyphCount * 4)),
		targetGlyphBounds: Array.from(target.glyphBounds.slice(0, target.glyphCount * 4))
	});

	applyGlyphDataToUniforms(material, resources);

	return material;
}

export function updateWordMorphUniforms(material: THREE.ShaderMaterial, progress: number) {
	const clamped = Math.max(0, Math.min(1, progress));
	material.uniforms.morphProgress.value = clamped;
}

export function updateWordMorphColors(
	material: THREE.ShaderMaterial,
	options: WordMorphMaterialOptions
) {
	(material.uniforms.fillColor.value as THREE.Color).set(options.fillColor);
	material.uniforms.fillOpacity.value = options.fillOpacity;
	(material.uniforms.outlineColor.value as THREE.Color).set(options.outlineColor);
	material.uniforms.outlineOpacity.value = options.outlineOpacity;
	material.uniforms.outlineThickness.value = options.outlineThickness;
	material.uniforms.outlineMode.value = options.outlineThickness > 0 ? 1 : 0;
}

export function refreshWordMorphResources(
	material: THREE.ShaderMaterial,
	resources: WordMorphResources
) {
	applyGlyphDataToUniforms(material, resources);
	console.debug('[wordMorphMaterial] refresh', {
		sourceGlyphCount: resources.source.glyphCount,
		targetGlyphCount: resources.target.glyphCount
	});
}
