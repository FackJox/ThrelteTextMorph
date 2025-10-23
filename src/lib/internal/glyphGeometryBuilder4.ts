import * as THREE from 'three';

export interface ShaderUniforms {
	[uniform: string]: { value: unknown };
}

export interface SimpleGeometry {
	geometry: THREE.BufferGeometry;
	normalizedBounds?: {
		width: number;
		height: number;
		centerX: number;
		centerY: number;
	};
}

export interface TextureInfo {
	geometry: THREE.BufferGeometry;
	texture: THREE.Texture;
	uniforms: ShaderUniforms;
}

// Multi-glyph geometry builder for 4 fonts
export function createMultiGlyphGeometry4(
	textureInfo1: TextureInfo,
	textureInfo2: TextureInfo | null,
	textureInfo3: TextureInfo | null,
	textureInfo4: TextureInfo | null,
	normalizeSize: boolean = true
): SimpleGeometry | null {
	// We need the original geometry to get glyph data
	const troikaGeometry1 = textureInfo1.geometry;
	if (!troikaGeometry1) {
		return null;
	}

	// Get glyph data from Troika for all 4 fonts
	const glyphBoundsAttr1 = troikaGeometry1.getAttribute('aTroikaGlyphBounds');
	const glyphIndexAttr1 = troikaGeometry1.getAttribute('aTroikaGlyphIndex');

	const glyphBoundsAttr2 = textureInfo2?.geometry?.getAttribute('aTroikaGlyphBounds');
	const glyphIndexAttr2 = textureInfo2?.geometry?.getAttribute('aTroikaGlyphIndex');

	const glyphBoundsAttr3 = textureInfo3?.geometry?.getAttribute('aTroikaGlyphBounds');
	const glyphIndexAttr3 = textureInfo3?.geometry?.getAttribute('aTroikaGlyphIndex');

	const glyphBoundsAttr4 = textureInfo4?.geometry?.getAttribute('aTroikaGlyphBounds');
	const glyphIndexAttr4 = textureInfo4?.geometry?.getAttribute('aTroikaGlyphIndex');

	if (!glyphBoundsAttr1 || !glyphIndexAttr1) {
		return null;
	}

	const glyphCount = Math.max(
		glyphBoundsAttr1.count,
		glyphBoundsAttr2?.count ?? 0,
		glyphBoundsAttr3?.count ?? 0,
		glyphBoundsAttr4?.count ?? 0
	);

	if (glyphCount === 0) {
		return null;
	}

	// Extract atlas parameters
	const textureWidth = textureInfo1.texture.image.width;
	const textureHeight = textureInfo1.texture.image.height;
	const glyphSizeUniform = textureInfo1.uniforms.uTroikaSDFGlyphSize;
	const glyphSize =
		glyphSizeUniform && typeof glyphSizeUniform.value === 'number' ? glyphSizeUniform.value : 64;
	const atlasColumns = Math.floor(textureWidth / glyphSize);
	const atlasRows = Math.floor(textureHeight / glyphSize);

	// Build geometry with one quad per glyph
	const geometry = new THREE.BufferGeometry();
	const totalVertices = glyphCount * 4; // 4 vertices per glyph
	const totalIndices = glyphCount * 6; // 6 indices per glyph (2 triangles)

	const positions = new Float32Array(totalVertices * 3);
	const positions2 = new Float32Array(totalVertices * 3);
	const positions3 = new Float32Array(totalVertices * 3);
	const positions4 = new Float32Array(totalVertices * 3);
	const uvs = new Float32Array(totalVertices * 2);
	const uvs2 = new Float32Array(totalVertices * 2);
	const uvs3 = new Float32Array(totalVertices * 2);
	const uvs4 = new Float32Array(totalVertices * 2);
	const normals = new Float32Array(totalVertices * 3);
	const channels = new Float32Array(totalVertices);
	const channels2 = new Float32Array(totalVertices);
	const channels3 = new Float32Array(totalVertices);
	const channels4 = new Float32Array(totalVertices);
	const glyphDimensions = new Float32Array(totalVertices * 2);
	const indices = new Uint16Array(totalIndices);

	// Calculate bounding boxes for each font to normalize sizes
	function calculateFontBounds(
		glyphBoundsAttr: THREE.BufferAttribute | null
	): { minX: number; minY: number; maxX: number; maxY: number } | null {
		if (!glyphBoundsAttr) return null;

		let minX = Infinity,
			minY = Infinity;
		let maxX = -Infinity,
			maxY = -Infinity;

		const glyphBounds = glyphBoundsAttr.array;
		for (let glyphIdx = 0; glyphIdx < glyphCount; glyphIdx++) {
			if (glyphIdx >= glyphBoundsAttr.count) {
				continue;
			}

			const boundsIdx = glyphIdx * 4;
			const left = glyphBounds[boundsIdx + 0];
			const bottom = glyphBounds[boundsIdx + 1];
			const right = glyphBounds[boundsIdx + 2];
			const top = glyphBounds[boundsIdx + 3];

			minX = Math.min(minX, left);
			minY = Math.min(minY, bottom);
			maxX = Math.max(maxX, right);
			maxY = Math.max(maxY, top);
		}

		return { minX, minY, maxX, maxY };
	}

	// Calculate bounds for all fonts
	const bounds1 = calculateFontBounds(glyphBoundsAttr1);
	const bounds2 = calculateFontBounds(glyphBoundsAttr2);
	const bounds3 = calculateFontBounds(glyphBoundsAttr3);
	const bounds4 = calculateFontBounds(glyphBoundsAttr4);

	// Use font 1 as the target reference for normalization
	let targetWidth = 0,
		targetHeight = 0;
	let targetCenterX = 0,
		targetCenterY = 0;

	if (bounds1) {
		targetWidth = bounds1.maxX - bounds1.minX;
		targetHeight = bounds1.maxY - bounds1.minY;
		targetCenterX = (bounds1.minX + bounds1.maxX) / 2;
		targetCenterY = (bounds1.minY + bounds1.maxY) / 2;
	}

	// Calculate scale factors for each font to normalize to the target dimensions
	const scaleFactors = [1, 1, 1, 1];
	const offsets = [
		{ x: 0, y: 0 },
		{ x: 0, y: 0 },
		{ x: 0, y: 0 },
		{ x: 0, y: 0 }
	];

	// Only apply normalization if enabled and we have a valid target
	if (normalizeSize && targetWidth > 0 && targetHeight > 0) {
		// Font 1 stays as-is (scale factor = 1, no offset needed since it's the reference)
		if (bounds1) {
			scaleFactors[0] = 1;
			offsets[0] = { x: 0, y: 0 };
		}

		// Scale font 2 to match font 1's dimensions
		if (bounds2) {
			const width2 = bounds2.maxX - bounds2.minX;
			const height2 = bounds2.maxY - bounds2.minY;
			// Use the smaller scale factor to maintain aspect ratio
			scaleFactors[1] = Math.min(targetWidth / width2, targetHeight / height2);
			const center2X = (bounds2.minX + bounds2.maxX) / 2;
			const center2Y = (bounds2.minY + bounds2.maxY) / 2;
			offsets[1] = {
				x: targetCenterX - center2X * scaleFactors[1],
				y: targetCenterY - center2Y * scaleFactors[1]
			};
		}

		// Scale font 3 to match font 1's dimensions
		if (bounds3) {
			const width3 = bounds3.maxX - bounds3.minX;
			const height3 = bounds3.maxY - bounds3.minY;
			scaleFactors[2] = Math.min(targetWidth / width3, targetHeight / height3);
			const center3X = (bounds3.minX + bounds3.maxX) / 2;
			const center3Y = (bounds3.minY + bounds3.maxY) / 2;
			offsets[2] = {
				x: targetCenterX - center3X * scaleFactors[2],
				y: targetCenterY - center3Y * scaleFactors[2]
			};
		}

		// Scale font 4 to match font 1's dimensions
		if (bounds4) {
			const width4 = bounds4.maxX - bounds4.minX;
			const height4 = bounds4.maxY - bounds4.minY;
			scaleFactors[3] = Math.min(targetWidth / width4, targetHeight / height4);
			const center4X = (bounds4.minX + bounds4.maxX) / 2;
			const center4Y = (bounds4.minY + bounds4.maxY) / 2;
			offsets[3] = {
				x: targetCenterX - center4X * scaleFactors[3],
				y: targetCenterY - center4Y * scaleFactors[3]
			};
		}
	}

	// Helper function to process glyph data for each font
	function processFont(
		glyphBoundsAttr: THREE.BufferAttribute | null,
		glyphIndexAttr: THREE.BufferAttribute | null,
		positionsArray: Float32Array,
		uvsArray: Float32Array,
		channelsArray: Float32Array,
		fontIndex: number,
		scaleFactor: number,
		offset: { x: number; y: number }
	) {
		const glyphBounds = glyphBoundsAttr?.array ?? null;
		const glyphIndices = glyphIndexAttr?.array ?? null;

		for (let glyphIdx = 0; glyphIdx < glyphCount; glyphIdx++) {
			const vertexOffset = glyphIdx * 4;
			const boundsIdx = glyphIdx * 4;

			const hasGlyphBounds = glyphBoundsAttr && glyphIdx < glyphBoundsAttr.count;
			const hasGlyphIndex = glyphIndexAttr && glyphIdx < glyphIndexAttr.count;

			const left = hasGlyphBounds ? glyphBounds![boundsIdx + 0] : 0;
			const bottom = hasGlyphBounds ? glyphBounds![boundsIdx + 1] : 0;
			const right = hasGlyphBounds ? glyphBounds![boundsIdx + 2] : 0;
			const top = hasGlyphBounds ? glyphBounds![boundsIdx + 3] : 0;

			const glyphIndex = hasGlyphIndex ? glyphIndices![glyphIdx] : 0;
			const atlasIndex = Math.floor(glyphIndex / 4);
			const channel = glyphIndex % 4;

			const col = atlasIndex % atlasColumns;
			const row = Math.floor(atlasIndex / atlasColumns);

			const uvLeft = col / atlasColumns;
			const uvTop = row / atlasRows;
			const uvRight = (col + 1) / atlasColumns;
			const uvBottom = (row + 1) / atlasRows;

			const quadPositions = hasGlyphBounds
				? [
						[left, bottom, 0],
						[right, bottom, 0],
						[left, top, 0],
						[right, top, 0]
					]
				: [
						[0, 0, 0],
						[0, 0, 0],
						[0, 0, 0],
						[0, 0, 0]
					];

			const quadUVs = hasGlyphIndex
				? [
						[uvLeft, uvTop],
						[uvRight, uvTop],
						[uvLeft, uvBottom],
						[uvRight, uvBottom]
					]
				: [
						[0, 0],
						[0, 0],
						[0, 0],
						[0, 0]
					];

			for (let vertIdx = 0; vertIdx < 4; vertIdx++) {
				const posIdx = (vertexOffset + vertIdx) * 3;
				const uvIdx = (vertexOffset + vertIdx) * 2;

				positionsArray[posIdx + 0] = quadPositions[vertIdx][0] * scaleFactor + offset.x;
				positionsArray[posIdx + 1] = quadPositions[vertIdx][1] * scaleFactor + offset.y;
				positionsArray[posIdx + 2] = quadPositions[vertIdx][2];

				uvsArray[uvIdx + 0] = quadUVs[vertIdx][0];
				uvsArray[uvIdx + 1] = quadUVs[vertIdx][1];

				channelsArray[vertexOffset + vertIdx] = channel;

				if (fontIndex === 0) {
					normals[posIdx + 0] = 0;
					normals[posIdx + 1] = 0;
					normals[posIdx + 2] = 1;

					const width = right - left;
					const height = top - bottom;
					const dimIdx = (vertexOffset + vertIdx) * 2;
					glyphDimensions[dimIdx] = width;
					glyphDimensions[dimIdx + 1] = height;
				}
			}

			if (fontIndex === 0) {
				const indexOffset = glyphIdx * 6;
				const baseVertex = vertexOffset;
				indices[indexOffset + 0] = baseVertex + 0;
				indices[indexOffset + 1] = baseVertex + 1;
				indices[indexOffset + 2] = baseVertex + 2;
				indices[indexOffset + 3] = baseVertex + 1;
				indices[indexOffset + 4] = baseVertex + 3;
				indices[indexOffset + 5] = baseVertex + 2;
			}
		}
	}

	// Process all 4 fonts with normalization
	processFont(
		glyphBoundsAttr1,
		glyphIndexAttr1,
		positions,
		uvs,
		channels,
		0,
		scaleFactors[0],
		offsets[0]
	);
	processFont(
		glyphBoundsAttr2,
		glyphIndexAttr2,
		positions2,
		uvs2,
		channels2,
		1,
		scaleFactors[1],
		offsets[1]
	);
	processFont(
		glyphBoundsAttr3,
		glyphIndexAttr3,
		positions3,
		uvs3,
		channels3,
		2,
		scaleFactors[2],
		offsets[2]
	);
	processFont(
		glyphBoundsAttr4,
		glyphIndexAttr4,
		positions4,
		uvs4,
		channels4,
		3,
		scaleFactors[3],
		offsets[3]
	);

	// Set geometry attributes
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
	geometry.setAttribute('morphPosition2', new THREE.Float32BufferAttribute(positions2, 3));
	geometry.setAttribute('morphPosition3', new THREE.Float32BufferAttribute(positions3, 3));
	geometry.setAttribute('morphPosition4', new THREE.Float32BufferAttribute(positions4, 3));
	geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
	geometry.setAttribute('morphUv2', new THREE.Float32BufferAttribute(uvs2, 2));
	geometry.setAttribute('morphUv3', new THREE.Float32BufferAttribute(uvs3, 2));
	geometry.setAttribute('morphUv4', new THREE.Float32BufferAttribute(uvs4, 2));
	geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
	geometry.setAttribute('aChannel', new THREE.Float32BufferAttribute(channels, 1));
	geometry.setAttribute('aChannel2', new THREE.Float32BufferAttribute(channels2, 1));
	geometry.setAttribute('aChannel3', new THREE.Float32BufferAttribute(channels3, 1));
	geometry.setAttribute('aChannel4', new THREE.Float32BufferAttribute(channels4, 1));
	geometry.setAttribute(
		'aTroikaGlyphDimensions',
		new THREE.Float32BufferAttribute(glyphDimensions, 2)
	);
	geometry.setIndex(new THREE.Uint16BufferAttribute(indices, 1));

	return {
		geometry,
		normalizedBounds: normalizeSize
			? {
					width: targetWidth,
					height: targetHeight,
					centerX: targetCenterX,
					centerY: targetCenterY
				}
			: undefined
	};
}
