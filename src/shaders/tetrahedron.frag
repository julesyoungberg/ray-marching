#version 300 es
precision highp float;

const float FRAME_OF_VIEW = 1.0;

in vec2 uv;
out vec4 fragColor;

uniform vec2 mousePosition;
uniform vec2 resolution;
uniform float time;

const int NUM_STEPS = 100;
const float MIN_HIT_DISTANCE = 0.01;
const float MAX_TRACE_DISTANCE = 1000.0;

@import ./primitives/sdTetrahedron;
@import ./util/calculateNormal;
@import ./util/calculateshading;
@import ./util/castRay;
@import ./util/createRotationMatrix;
@import ./util/getShadowMultiplier;
@import ./util/getSmoothSurfaceColor;
@import ./util/getSurfaceColor;
@import ./util/getUV;
@import ./util/hash;
@import ./util/rayMarch;

const vec3 LIGHT_POS = vec3(3.0, 10.0, 5.0);

float floorDist(in vec3 p) { return p.y + 1.0; }

float shapeDist(in vec3 pos) {
    mat4 rot = createRotationMatrix(vec3(35., 0., -45.));
    vec3 p = (rot * vec4(pos, 1.)).xyz;
    return sdTetrahedron(p, 1.0, 10);
}

float distFromNearest(in vec3 p) {
    return min(floorDist(p), shapeDist(p));
}

vec3 getWallColor(in vec3 position) {
    const float scale = 0.5;
    vec3 p = position * scale;
    float total = floor(p.x) + floor(p.y) + floor(p.z);
    bool isEven = mod(total, 2.0) == 0.0;
    return mix(vec3(0.4), vec3(0.9), float(isEven));
}

vec3 calculateColor(in vec3 position, in vec3 normal, in vec3 eyePos) {
    vec3 lightDir = normalize(LIGHT_POS - position);
    vec3 color;
    if (floorDist(position) < MIN_HIT_DISTANCE) {
        color = getWallColor(position);
    } else {
        color = vec3(0.0, 1.0, 0.75);
    }
    return calculateShading(position, normal, eyePos, LIGHT_POS, color);
}

float getAmbientOcclusion(in vec3 position, in vec3 normal) {
    float result = 0.0;

    float weight = 1.0;
    for (float i = 0.0; i < 5.0; i++) {
        float dist = 0.005 + 0.02 * i;
        vec3 currentPos = position + normal * dist;
        float aoDist = distFromNearest(currentPos);
        float val = (dist - aoDist) * weight;
        result += val;
        weight *= 0.95;
    }

    result *= 3.0;
    float intensity = 0.99;
    result = clamp(1.0 - result, 1.0 - intensity, 1.0);
    return result;
}

// vec3 calculateReflections(in vec3 position, in vec3 normal, in vec3 color, in vec3 eyePos, in vec3 bg) {
//     vec3 rayPos = normalize(position - eyePos);
//     vec3 reflectDir = reflect(rayDir, normal);
//     vec3 finalColor = bg;

//     float dist = rayMarch(position + reflectDir * 0.02, relfectDir);
//     if (dist >= 0.0) {
//         vec3 surfacePos = position + reflectDir * dist;
//         vec3 surfaceNorm = calculateNormal(surfacePos);
//         finalColor = calculateColor(surfacePos, surfaceNorm, eyePos);
//     }
// }

void main() {
    const vec3 camPos = vec3(2.0, 1.0, 2.0);
    const vec3 lookAt = vec3(0.0);
    const float zoom = 1.0;

    vec3 rayDir = castRay(uv, camPos, lookAt, zoom);
    float dist = rayMarch(camPos, rayDir);
    vec3 color = vec3(0.0);
    if (dist >= 0.0) {
        vec3 surfacePos = camPos + rayDir * dist;
        vec3 surfaceNorm = calculateNormal(surfacePos);
        color = calculateColor(surfacePos, surfaceNorm, camPos);
        color *= getShadowMultiplier(surfacePos, LIGHT_POS, 5.0, 0.3);
        color *= getAmbientOcclusion(surfacePos, surfaceNorm);

        // if (floorDist(surfacePos) < MIN_HIT_DISTANCE) {
        //     color = calculateReflections(surfacePos, surfaceNorm, color, rayDir, vec3(0.0));
        // }
    }
    fragColor = vec4(color, 1);
}
