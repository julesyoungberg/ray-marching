float rand(float n) { return fract(n * 1183.5437 + .42); }

float rand(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

float rand(vec3 co) {
    return fract(sin(dot(co, vec3(27.17, 112.61, 57.53))) * 43758.5453);
}
