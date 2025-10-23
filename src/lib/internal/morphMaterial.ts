import * as THREE from 'three';
import vertexShaderSource from './sdfMorph4.vert?raw';
import fragmentShaderSource from './sdfMorph4.frag?raw';
import type { SimpleSDFInfo } from './sdf';

export interface MorphMaterialOptions {
	fillColor: THREE.ColorRepresentation;
	fillOpacity: number;
	outlineColor: THREE.ColorRepresentation;
	outlineOpacity: number;
	outlineThickness: number;
}

export function createMorphMaterial(
	textures: [SimpleSDFInfo, SimpleSDFInfo, SimpleSDFInfo, SimpleSDFInfo],
	options: MorphMaterialOptions
): THREE.ShaderMaterial {
	const uniforms = {
		sdfTexture: { value: textures[0].texture },
		sdfTexture2: { value: textures[1].texture },
		sdfTexture3: { value: textures[2].texture },
		sdfTexture4: { value: textures[3].texture },
		morphProgress: { value: 0 },
		sourceFont: { value: 0 },
		targetFont: { value: 1 },
		outlineMode: { value: options.outlineThickness > 0 ? 1 : 0 },
		outlineThickness: { value: options.outlineThickness },
		fillColor: { value: new THREE.Color(options.fillColor) },
		fillOpacity: { value: options.fillOpacity },
		outlineColor: { value: new THREE.Color(options.outlineColor) },
		outlineOpacity: { value: options.outlineOpacity },
		uTroikaSDFGlyphSize: {
			value: textures[0].uniforms.uTroikaSDFGlyphSize?.value ?? 64
		},
		uTroikaSDFExponent: {
			value: textures[0].uniforms.uTroikaSDFExponent?.value ?? 8
		}
	};

	return new THREE.ShaderMaterial({
		vertexShader: vertexShaderSource,
		fragmentShader: fragmentShaderSource,
		uniforms,
		transparent: true,
		side: THREE.DoubleSide,
		extensions: {
			derivatives: true
		} as any
	});
}

export function updateMorphUniforms(
	material: THREE.ShaderMaterial,
	progress: number,
	sourceFontIndex: number,
	targetFontIndex: number
) {
	const clampedProgress = Math.max(0, Math.min(1, progress));
	const safeSource = Math.max(0, Math.min(3, sourceFontIndex));
	const safeTarget = Math.max(0, Math.min(3, targetFontIndex));

	material.uniforms.morphProgress.value = clampedProgress;
	material.uniforms.sourceFont.value = safeSource;
	material.uniforms.targetFont.value = safeTarget;
}

export function updateMaterialColors(
	material: THREE.ShaderMaterial,
	options: MorphMaterialOptions
) {
	(material.uniforms.fillColor.value as THREE.Color).set(options.fillColor);
	material.uniforms.fillOpacity.value = options.fillOpacity;
	(material.uniforms.outlineColor.value as THREE.Color).set(options.outlineColor);
	material.uniforms.outlineOpacity.value = options.outlineOpacity;
	material.uniforms.outlineThickness.value = options.outlineThickness;
	material.uniforms.outlineMode.value = options.outlineThickness > 0 ? 1 : 0;
}
