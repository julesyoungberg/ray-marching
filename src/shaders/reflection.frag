#version 300 es
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform vec2 mousePosition;
uniform vec2 resolution;
uniform float time;

@import ./primitives/sphereDist;
@import ./util/config;
@import ./util/rand;
@import ./util/calculateNormal;
@import ./util/calculateShading;
@import ./util/castRay;
@import ./util/getShadowMultiplier;
@import ./util/getSurfaceColor;
@import ./util/rayMarch;

const vec3 spherePos = vec3(10.0, 3.0, 10.0);

float distFromWalls(in vec3 p) {
    float s = 40.0;
    float x = min(p.x, s - p.x);
    float y = min(p.y, s - p.y);
    float z = min(p.z, s - p.z);
    return min(x, min(y, z));
}

float distFromNearest(in vec3 p) {
    return min(distFromWalls(p), sphereDist(p, spherePos, 3.0));
}

vec3 getWallColor(in vec3 position) {
    const float scale = 0.5;
    vec3 p = position * scale;
    float total = floor(p.x) + floor(p.y) + floor(p.z);
    bool isEven = mod(total, 2.0) == 0.0;
    return mix(vec3(0.4), vec3(0.9), float(isEven));
}

vec3 calculateReflection(in vec3 position, in vec3 normal, in vec3 lightPos) {
    vec3 rayStart = position + normal * 0.02;

    float dist = rayMarch(rayStart, normal);
    if (dist < 0.0) {
        return vec3(-1.0);
    }

    vec3 surfacePos = rayStart + normal * dist;
    vec3 surfaceNormal = calculateNormal(surfacePos);
    vec3 color = getWallColor(position);
    vec3 finalColor = calculateShading(surfacePos, surfaceNormal, position, lightPos, color);
    return finalColor;
}

vec3 calculateColor(in vec3 position, in vec3 normal, in vec3 eyePos) {
    vec3 lightPos = eyePos + vec3(0.0, 10.0, 15.0);
    bool isWall = distFromWalls(position) < MIN_HIT_DISTANCE;

    vec3 color;
    vec3 specColor;
    if (isWall) {
        color = getWallColor(position);
        specColor = color;
    } else {
        color = vec3(1, 0, 0);
        specColor = vec3(0.9);
    }

    vec3 finalColor = calculateShading(position, normal, eyePos, lightPos, color, specColor);

    if (!isWall) {
        vec3 reflection = calculateReflection(position, normal, lightPos);
        if (!all(equal(reflection, vec3(-1.0)))) {
            float reflectiveness = 0.2;
            finalColor = finalColor * (1.0 - reflectiveness) + reflection * reflectiveness;
        }
    }

    return finalColor;
}

void main() {
    vec3 camPos = vec3(20.0, 5.0, 15.0);
    const vec3 lookAt = spherePos;
    const float zoom = 1.0;

    vec3 rayDir = castRay(uv, camPos, lookAt, zoom);
    vec3 color = getSurfaceColor(camPos, rayDir, vec3(0));
    fragColor = vec4(color, 1);
}
