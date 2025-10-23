// 4-way SDF morphing shader for cycling through 4 fonts
varying vec2 vUv;
varying vec2 vMorphUv2;
varying vec2 vMorphUv3;
varying vec2 vMorphUv4;
varying float vChannel;
varying float vChannel2;
varying float vChannel3;
varying float vChannel4;
varying vec2 vTroikaGlyphDimensions;
varying vec4 vPresence;

uniform sampler2D sdfTexture;   // Font 1
uniform sampler2D sdfTexture2;  // Font 2
uniform sampler2D sdfTexture3;  // Font 3
uniform sampler2D sdfTexture4;  // Font 4
uniform float morphProgress;     // 0.0-1.0 for transition progress
uniform float sourceFont;        // 0-3 for which font we're morphing FROM
uniform float targetFont;        // 0-3 for which font we're morphing TO
uniform float outlineMode;       // 0.0 for fill, 1.0 for outline
uniform float outlineThickness;  // Thickness of the outline
uniform vec3 fillColor;
uniform float fillOpacity;
uniform vec3 outlineColor;
uniform float outlineOpacity;
uniform float uTroikaSDFGlyphSize;
uniform float uTroikaSDFExponent;

// Troika's anti-aliasing distance calculation
float troikaGetAADist() {
    #if defined(GL_OES_standard_derivatives) || __VERSION__ >= 300
        return length(fwidth(vUv * vTroikaGlyphDimensions)) * 0.5;
    #else
        return vTroikaGlyphDimensions.x / 64.0;
    #endif
}

// Helper function to select channel from MSDF texture
float selectChannel(vec4 texSample, float channel) {
    if (channel < 0.5) return texSample.r;
    else if (channel < 1.5) return texSample.g;
    else if (channel < 2.5) return texSample.b;
    else return texSample.a;
}

// Function to select the correct SDF value based on font index
float getFontSDF(float fontIndex, float sdf1, float sdf2, float sdf3, float sdf4) {
    if (fontIndex < 0.5) return sdf1;
    else if (fontIndex < 1.5) return sdf2;
    else if (fontIndex < 2.5) return sdf3;
    else return sdf4;
}

float getFontPresence(float fontIndex, float p1, float p2, float p3, float p4) {
    if (fontIndex < 0.5) return p1;
    else if (fontIndex < 1.5) return p2;
    else if (fontIndex < 2.5) return p3;
    else return p4;
}

void main() {
    // Sample all 4 textures
    vec4 rawSample1 = texture2D(sdfTexture, vUv);
    vec4 rawSample2 = texture2D(sdfTexture2, vMorphUv2);
    vec4 rawSample3 = texture2D(sdfTexture3, vMorphUv3);
    vec4 rawSample4 = texture2D(sdfTexture4, vMorphUv4);
    
    // Select appropriate channel for each texture
    float sdfValue1 = selectChannel(rawSample1, vChannel);
    float sdfValue2 = selectChannel(rawSample2, vChannel2);
    float sdfValue3 = selectChannel(rawSample3, vChannel3);
    float sdfValue4 = selectChannel(rawSample4, vChannel4);
    
    // Get the source and target SDF values based on font indices
    float sourceSDF = getFontSDF(sourceFont, sdfValue1, sdfValue2, sdfValue3, sdfValue4);
    float targetSDF = getFontSDF(targetFont, sdfValue1, sdfValue2, sdfValue3, sdfValue4);
    float sourcePresence = getFontPresence(sourceFont, vPresence.x, vPresence.y, vPresence.z, vPresence.w);
    float targetPresence = getFontPresence(targetFont, vPresence.x, vPresence.y, vPresence.z, vPresence.w);
    float sharedPresence = sourcePresence * targetPresence;
    float sourceOnly = max(sourcePresence - sharedPresence, 0.0);
    float targetOnly = max(targetPresence - sharedPresence, 0.0);
    float fadeOut = 1.0 - smoothstep(0.7, 1.0, morphProgress);
    float fadeIn = smoothstep(0.0, 0.3, morphProgress);
    float visibility = clamp(
        sharedPresence + sourceOnly * fadeOut + targetOnly * fadeIn,
        0.0,
        1.0
    );
    
    // Direct morphing between source and target fonts
    // morphProgress goes from 0.0 (source) to 1.0 (target)
    float sdfValue = mix(sourceSDF, targetSDF, morphProgress);
    
    // Troika's exponential SDF decoding
    float maxDimension = uTroikaSDFGlyphSize;
    float absDist = (1.0 - pow(2.0 * (sdfValue > 0.5 ? 1.0 - sdfValue : sdfValue), 1.0 / uTroikaSDFExponent)) * maxDimension;
    float signedDist = absDist * (sdfValue > 0.5 ? 1.0 : -1.0);
    
    // Smooth edge with adaptive anti-aliasing
    float edgeWidth = troikaGetAADist();
    
    float fillAlpha = clamp(fillOpacity, 0.0, 1.0) * smoothstep(-edgeWidth, edgeWidth, signedDist) * visibility;
    
    float outlineAlpha = 0.0;
    if (outlineMode > 0.0 && outlineThickness > 0.0 && outlineOpacity > 0.0) {
        float dynamicThickness = outlineThickness * outlineMode;
        float outerEdge = dynamicThickness * maxDimension;
        float innerEdge = -dynamicThickness * maxDimension * 0.5;
        
        float outer = smoothstep(-edgeWidth - outerEdge, edgeWidth - outerEdge, signedDist);
        float inner = smoothstep(-edgeWidth - innerEdge, edgeWidth - innerEdge, signedDist);
        outlineAlpha = max(0.0, outer - inner) * outlineOpacity * visibility;
    }
    
    float combinedAlpha = clamp(fillAlpha + outlineAlpha * (1.0 - fillAlpha), 0.0, 1.0);
    vec3 combinedColor = fillColor;
    
    if (combinedAlpha > 0.0) {
        float outlineContribution = outlineAlpha * (1.0 - fillAlpha);
        combinedColor = (fillColor * fillAlpha + outlineColor * outlineContribution) / combinedAlpha;
    }
    
    gl_FragColor = vec4(combinedColor, combinedAlpha);
}
