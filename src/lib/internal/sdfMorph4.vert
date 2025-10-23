// 4-way morphing vertex shader
varying vec2 vUv;
varying vec2 vMorphUv2;
varying vec2 vMorphUv3;
varying vec2 vMorphUv4;
varying float vChannel;
varying float vChannel2;
varying float vChannel3;
varying float vChannel4;
varying vec2 vTroikaGlyphDimensions;

// Attributes for all 4 fonts
attribute vec2 morphUv2;
attribute vec2 morphUv3;
attribute vec2 morphUv4;
attribute vec3 morphPosition2;
attribute vec3 morphPosition3;
attribute vec3 morphPosition4;
attribute float aChannel;
attribute float aChannel2;
attribute float aChannel3;
attribute float aChannel4;
attribute vec2 aTroikaGlyphDimensions;

// Uniforms
uniform float morphProgress; // 0.0-1.0 for transition progress
uniform float sourceFont;    // 0-3 for which font we're morphing FROM
uniform float targetFont;    // 0-3 for which font we're morphing TO

// Function to select the correct position based on font index
vec3 getFontPosition(float fontIndex, vec3 pos1, vec3 pos2, vec3 pos3, vec3 pos4) {
    if (fontIndex < 0.5) return pos1;
    else if (fontIndex < 1.5) return pos2;
    else if (fontIndex < 2.5) return pos3;
    else return pos4;
}

void main() {
    // Get source and target positions based on font indices
    vec3 sourcePosition = getFontPosition(sourceFont, position, morphPosition2, morphPosition3, morphPosition4);
    vec3 targetPosition = getFontPosition(targetFont, position, morphPosition2, morphPosition3, morphPosition4);
    
    // Direct morphing between source and target positions
    vec3 morphedPosition = mix(sourcePosition, targetPosition, morphProgress);
    
    // Pass all UVs and channels to fragment shader
    vUv = uv;
    vMorphUv2 = morphUv2;
    vMorphUv3 = morphUv3;
    vMorphUv4 = morphUv4;
    vChannel = aChannel;
    vChannel2 = aChannel2;
    vChannel3 = aChannel3;
    vChannel4 = aChannel4;
    vTroikaGlyphDimensions = aTroikaGlyphDimensions;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(morphedPosition, 1.0);
}
