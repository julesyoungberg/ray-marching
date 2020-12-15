#version 300 es
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform vec2 mousePosition;
uniform vec2 resolution;
uniform float time;

@import ./primitives/sdBox;
@import ./primitives/sdSphere;
@import ./util/config;
@import ./util/rand;
@import ./util/calculateNormal;
@import ./util/calculateShading;
@import ./util/castRay;
@import ./util/getShadowMultiplier;
@import ./util/getSurfaceColor;
@import ./util/rayMarch;

const float sphereRadius = 3.0;
const vec3 spherePos = vec3(10.0, sphereRadius, 10.0);

const vec3 boxPos = vec3(18.0, sphereRadius / 3.0, 10.0);

float distFromWalls(in vec3 p) {
    float s = 40.0;
    float x = min(p.x, s - p.x);
    float y = min(p.y, s - p.y);
    float z = min(p.z, s - p.z);
    return min(x, min(y, z));
}

float sphere1(in vec3 p) { return sdSphere(p, spherePos, sphereRadius); }

float box1(in vec3 p) { return sdBox(p - boxPos, vec3(sphereRadius / 3.0)); }

float distFromNearest(in vec3 p) {
    return min(distFromWalls(p), min(sphere1(p), box1(p)));
}

vec3 getWallColor(in vec3 position) {
    const float scale = 0.5;
    vec3 p = position * scale;
    float total = floor(p.x) + floor(p.y) + floor(p.z);
    bool isEven = mod(total, 2.0) == 0.0;
    return mix(vec3(0.4), vec3(0.9), float(isEven));
}

vec3 calculateColorWithoutReflections(in vec3 position, in vec3 normal, in vec3 eyePos, in vec3 lightPos) {
    bool isWall = distFromWalls(position) < MIN_HIT_DISTANCE;
    bool isSphere = sphere1(position) < MIN_HIT_DISTANCE;

    vec3 color;
    vec3 specColor;
    if (isWall) {
        color = normal; // getWallColor(position);
        specColor = color;
    } else if (isSphere) {
        color = vec3(1, 1, 1);
        specColor = vec3(0.9);
    } else {
        color = vec3(0, 0, 1);
        specColor = vec3(0.8);
    }

    vec3 finalColor = calculateShading(position, normal, eyePos, lightPos, color, specColor);

    return finalColor;
}

vec3 calculateReflection(in vec3 position, in vec3 normal, in vec3 eyePos, in vec3 lightPos) {
    vec3 incident = normalize(position - eyePos);
    vec3 reflected = reflect(incident, normal);
    vec3 rayStart = position + reflected * 0.02;

    float dist = rayMarch(rayStart, reflected);
    if (dist < 0.0) {
        return vec3(-1.0);
    }

    vec3 surfacePos = rayStart + reflected * dist;
    vec3 surfaceNormal = calculateNormal(surfacePos);
    vec3 color = calculateColorWithoutReflections(surfacePos, surfaceNormal, eyePos, lightPos);
    vec3 finalColor = calculateShading(surfacePos, surfaceNormal, position, lightPos, color);
    return finalColor;
}

// vec3 calculateTransparency(in vec3 position, in vec3 eyePos, in vec3 lightPos) {
//     vec3 rayDir = normalize(position - eyePos);
//     vec3 rayStart = position + rayDir * 0.02;

//     float dist = 0.0;

//     for (int i = 0; i < NUM_STEPS; i++) {
//         vec3 currentPosition = rayStart + rayDir * dist;
//         float currentDist = distFromNearest(currentPosition);

//         if (dist > MAX_TRACE_DISTANCE) {
//             break;
//         }

//         if (dist < MIN_HIT_DISTANCE) {
//             if (sphere1(currentPosition) != currentDist) {
//                 break;
//             }
//         }

//         dist += currentDist;
//     }

//     vec3 surfacePos = rayStart + rayDir * dist;
//     vec3 surfaceNormal = calculateNormal(surfacePos);
//     vec3 color = getWallColor(position);
//     vec3 finalColor = calculateShading(surfacePos, surfaceNormal, position, lightPos, color);
//     return finalColor;
// }

vec3 calculateSphereColor(in vec3 position, in vec3 normal, in vec3 eyePos, in vec3 lightPos, in vec3 color) {
    const float reflectivity = 0.5;
    const float transparency = 0.0;
    vec3 finalColor = color;

    float weightSum = 0.0;
    vec3 contribution = vec3(0.0);

    if (reflectivity > 0.0) {
        vec3 reflection = calculateReflection(position, normal, eyePos, lightPos);
        if (!all(equal(reflection, vec3(-1.0)))) {
            weightSum += reflectivity;
            contribution += reflection * reflectivity;
        }
    }

    // if (transparency > 0.0) {
    //     vec3 transparent = calculateTransparency(position, eyePos, lightPos);
    //     if (!all(equal(transparent, vec3(-1.0)))) {
    //         weightSum += transparency;
    //         contribution += transparent * transparency;
    //     }
    // }

    finalColor = finalColor * (1.0 - weightSum) + contribution;

    return finalColor;
}

vec3 calculateColor(in vec3 position, in vec3 normal, in vec3 eyePos) {
    vec3 lightPos = eyePos + vec3(0.0, 10.0, 15.0);
    bool isSphere = sphere1(position) < MIN_HIT_DISTANCE;

    vec3 finalColor = calculateColorWithoutReflections(position, normal, eyePos, lightPos);

    if (isSphere) {
        finalColor = calculateSphereColor(position, normal, eyePos, lightPos, finalColor);
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
