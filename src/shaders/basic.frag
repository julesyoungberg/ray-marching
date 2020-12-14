#version 300 es
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform vec2 resolution;
uniform float time;

void main() {
    fragColor = vec4(vec2(uv), 0, 1.0);
}
