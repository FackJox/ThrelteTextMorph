// Word-level morph vertex shader
varying vec2 vUvSource;
varying vec2 vUvTarget;
varying vec2 vWorldPosition;

void main() {
	vec4 worldPosition = modelViewMatrix * vec4(position, 1.0);
	gl_Position = projectionMatrix * worldPosition;
	vUvSource = uv;
	vUvTarget = uv2;
	vWorldPosition = position.xy;
}
