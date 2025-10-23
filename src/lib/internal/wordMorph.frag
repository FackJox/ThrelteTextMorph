// Word-level SDF morph fragment shader
precision highp float;

varying vec2 vUvSource;
varying vec2 vUvTarget;
varying vec2 vWorldPosition;

uniform sampler2D sdfTextureSource;
uniform sampler2D sdfTextureTarget;

uniform int uSourceGlyphCount;
uniform int uTargetGlyphCount;

uniform vec4 uSourceGlyphBounds[64];
uniform vec4 uSourceGlyphUvRects[64];
uniform float uSourceGlyphChannels[64];

uniform vec4 uTargetGlyphBounds[64];
uniform vec4 uTargetGlyphUvRects[64];
uniform float uTargetGlyphChannels[64];

uniform float uSourceGlyphSize;
uniform float uTargetGlyphSize;
uniform float uSourceSDFExponent;
uniform float uTargetSDFExponent;

uniform vec4 uSourceWordBounds;
uniform vec4 uTargetWordBounds;

uniform float morphProgress;
uniform float outlineMode;
uniform float outlineThickness;
uniform vec3 fillColor;
uniform float fillOpacity;
uniform vec3 outlineColor;
uniform float outlineOpacity;

float selectChannel(vec4 texSample, float channel) {
    float ch = floor(channel + 0.5);
    if (ch < 0.5) return texSample.r;
    else if (ch < 1.5) return texSample.g;
    else if (ch < 2.5) return texSample.b;
    else return texSample.a;
}

vec2 remapToBounds(vec2 position, vec4 bounds) {
    vec2 size = vec2(bounds.z - bounds.x, bounds.w - bounds.y);
    size = max(size, vec2(1e-6));
    vec2 normalized = (position - bounds.xy) / size;
    return normalized;
}

vec2 mixUV(vec2 uv, vec4 rect) {
    vec2 clamped = clamp(uv, 0.0, 1.0);
    vec2 size = vec2(rect.z - rect.x, rect.w - rect.y);
    return rect.xy + clamped * size;
}

float decodeTroikaSDF(float sdfValue, vec2 glyphDimensions, float sdfExponent) {
    float maxDimension = max(glyphDimensions.x, glyphDimensions.y);
    float a = sdfValue > 0.5 ? 1.0 - sdfValue : sdfValue;
    float absDist = (1.0 - pow(2.0 * a, 1.0 / sdfExponent)) * maxDimension;
    return absDist * (sdfValue > 0.5 ? -1.0 : 1.0);
}

float evaluateWordSDF(
    vec2 point,
    sampler2D sdfTexture,
    int glyphCount,
    vec4 glyphBounds[64],
    vec4 glyphUVRects[64],
    float glyphChannels[64],
    float glyphSize,
    float sdfExponent
) {
    float minDistance = 1e6;
    float texelPadding = 0.5 / glyphSize;
    for (int i = 0; i < 64; i++) {
        if (i >= glyphCount) {
            break;
        }
        vec4 bounds = glyphBounds[i];
        vec4 uvRect = glyphUVRects[i];
        float channel = glyphChannels[i];
        vec2 glyphDimensions = vec2(bounds.z - bounds.x, bounds.w - bounds.y);
        vec2 glyphUV = remapToBounds(point, bounds);
        vec2 clampedGlyphUV = vec2(
            clamp(glyphUV.x, texelPadding, 1.0 - texelPadding),
            clamp(glyphUV.y, texelPadding, 1.0 - texelPadding)
        );
        vec2 atlasUV = mixUV(clampedGlyphUV, uvRect);
        vec4 sdfSample = texture2D(sdfTexture, atlasUV);
        float sdfValue = selectChannel(sdfSample, channel);
        float distance = decodeTroikaSDF(sdfValue, glyphDimensions, sdfExponent);
        vec2 delta = glyphUV - clampedGlyphUV;
        float extrapolation = length(delta * glyphDimensions);
        distance += extrapolation;
        minDistance = min(minDistance, distance);
    }
    return minDistance;
}

void main() {
    vec2 sourcePoint = vWorldPosition;
    vec2 targetPoint = vWorldPosition;

    float sourceDistance = evaluateWordSDF(
        sourcePoint,
        sdfTextureSource,
        uSourceGlyphCount,
        uSourceGlyphBounds,
        uSourceGlyphUvRects,
        uSourceGlyphChannels,
        uSourceGlyphSize,
        uSourceSDFExponent
    );

    float targetDistance = evaluateWordSDF(
        targetPoint,
        sdfTextureTarget,
        uTargetGlyphCount,
        uTargetGlyphBounds,
        uTargetGlyphUvRects,
        uTargetGlyphChannels,
        uTargetGlyphSize,
        uTargetSDFExponent
    );

    float morphDistance = mix(sourceDistance, targetDistance, morphProgress);

    float edgeWidth = max(fwidth(morphDistance), 1e-4);

    float fillAlpha = clamp(fillOpacity, 0.0, 1.0) * smoothstep(edgeWidth, -edgeWidth, morphDistance);

    float outlineAlpha = 0.0;
    if (outlineMode > 0.0 && outlineThickness > 0.0 && outlineOpacity > 0.0) {
        float outerEdge = outlineThickness;
        float innerEdge = -outlineThickness * 0.5;

        float outer = smoothstep(edgeWidth + outerEdge, -edgeWidth + outerEdge, morphDistance);
        float inner = smoothstep(edgeWidth + innerEdge, -edgeWidth + innerEdge, morphDistance);
        outlineAlpha = max(0.0, outer - inner) * outlineOpacity;
    }

    float combinedAlpha = clamp(fillAlpha + outlineAlpha * (1.0 - fillAlpha), 0.0, 1.0);
    vec3 combinedColor = fillColor;

    if (combinedAlpha > 0.0) {
        float outlineContribution = outlineAlpha * (1.0 - fillAlpha);
        combinedColor = (fillColor * fillAlpha + outlineColor * outlineContribution) / combinedAlpha;
    }

    gl_FragColor = vec4(combinedColor, combinedAlpha);
}
