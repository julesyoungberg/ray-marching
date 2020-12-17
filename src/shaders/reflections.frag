#version 300 es
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform vec2 mousePosition;
uniform vec2 resolution;
uniform float time;

// ray marching
#define FRAME_OF_VIEW 1.0
#define MAX_RAY_LENGTH 22.0
#define RAY_PUSH 0.02

// shading
#define LIGHT_POS vec3(2.0, 10.0, 8.0)
#define REFLECTIVITY 0.5
#define REFLECTION_BOUNCES 5
#define SHADOW_INTENSITY 0.9
#define SHADOW_FACTOR 128.0
#define MATERIAL_SHININESS 4.
#define MATERIAL_AMBIENT_STRENGTH 0.2
#define MATERIAL_DIFFUSE_STRENGTH 0.8
#define MATERIAL_SPECULAR_STRENGTH 0.6

// Scene
#define FLOOR_FADE_START 100.
#define FLOOR_FADE_END 500.
#define CAMERA_MOVEMENT_SPEED -20.
#define CAMERA_INV_DISTANCE_MULTIPLIER 4.
#define FLOOR_LEVEL -1.8

#define EPSILON 1e-5

@import ./primitives/sdSphere;
@import ./util/config;
@import ./util/calculateAmbientOcclusion;
@import ./util/calculateFloorDist;
@import ./util/calculateNormal;
@import ./util/calculatePhong;
@import ./util/calculateShadow;
@import ./util/castRay;
@import ./util/getUV;
@import ./util/hash;
@import ./util/marchRay;
@import ./util/rayMarch;
@import ./util/rotate;

vec3 getBackgroundColor(const vec2 st) {
    return vec3(0) * smoothstep(1.0, 0.0, abs(0.5 - st.y));
}

float distFromNearest(in vec3 p) {
    const float size = 1.0;
    const float d = size * 2.0;
    vec3 pos = vec3(mod(p.x + d, d * 2.0) - d, p.y,mod(p.z + d, d * 2.0) - d);
    if (pos.y >= 0.0) {
        pos.y = mod(p.y + d * 2.0, d * 4.0) - d * 2.0;
    }
    return sdSphere(pos, vec3(0), 1.0);
}

vec3 getWallColor(in vec3 position) {
    const float scale = 1.0;
    vec3 p = position * scale;
    float total = floor(p.x) + floor(p.y) + floor(p.z);
    bool isEven = mod(total, 2.0) == 0.0;
    return mix(vec3(0.4), vec3(0.9), float(isEven));
}

vec3 calculateColor(in vec3 position, in vec3 normal, in vec3 eyePos) {
    vec3 lightDir = normalize(LIGHT_POS - position);
    vec3 color = vec3(1.0, 1.0, 1.0);
    color = calculatePhong(position, normal, eyePos, LIGHT_POS, color);
    color *= calculateShadow(position, normal, LIGHT_POS);
    return color;
}

vec3 calculateReflections(in vec3 position, in vec3 normal, in vec3 color, in vec3 eyePos) {
    vec3 rayOrigin = position;
    vec3 rayDir = normalize(position - eyePos);
    rayDir = reflect(rayDir, normal);
    
    vec3 finalColor = color;

    for (int i = 0; i < REFLECTION_BOUNCES; i++) {
        float dist = marchRay(position, rayDir, RAY_PUSH);
        if (dist < 0.0) {
            break;
        }

        vec3 surfacePos = position + rayDir * dist;
        vec3 surfaceNorm = calculateNormal(surfacePos);
        vec3 surfaceColor = calculateColor(surfacePos, surfaceNorm, eyePos);
        finalColor = mix(finalColor, surfaceColor, REFLECTIVITY);
    }

    return finalColor;
}

void main() {
    const vec3 camPos = vec3(11.0, 5., 11.0);
    const vec3 lookAt = vec3(0.0);
    const float zoom = 1.0;

    vec3 finalColor = vec3(0.0);
    vec2 currentUV = uv;
    vec3 backgroundColor;
    vec3 rayOrigin = camPos;
    vec3 rayDir;
    float d = 4.0;
    float numSubPixels = pow(d, 2.0);

    for(float i = 1.0; i <= numSubPixels; i += 1.0) {
        float x = mod(i - 1.0, d);
        float y = mod(floor(i / d), d);
        vec2 jitter = hash(i) / d;
        jitter.x += x / d;
        jitter.y += y / d;

        currentUV = getUV(gl_FragCoord.xy + jitter, resolution);
        rayDir = castRay(currentUV, camPos, lookAt, zoom);
        backgroundColor = getBackgroundColor(uv);

        float dist = rayMarch(rayOrigin, rayDir);
        vec3 color = backgroundColor;
        vec3 surfacePos, surfaceNorm;
        if (dist < 0.0) {
            float floorDist = calculateFloorDist(rayOrigin, rayDir, FLOOR_LEVEL);
            if (floorDist >= 0.0) {
                surfacePos = rayOrigin + rayDir * floorDist;
                surfaceNorm = vec3(0, 1, 0);
                color = getWallColor(surfacePos);
                color = calculatePhong(surfacePos, surfaceNorm, rayOrigin, LIGHT_POS, color);
                color *= calculateShadow(surfacePos, surfaceNorm, LIGHT_POS);
                color *= calculateAmbientOcclusion(surfacePos, surfaceNorm);
                // color = calculateReflections(surfacePos, surfaceNorm, color, rayOrigin);
            }
        } else {
            surfacePos = rayOrigin + rayDir * dist;
            surfaceNorm = calculateNormal(surfacePos);
            color = calculateColor(surfacePos, surfaceNorm, rayOrigin);
            color *= calculateAmbientOcclusion(surfacePos, surfaceNorm);
            color = calculateReflections(surfacePos, surfaceNorm, color, rayOrigin);
        }
        
        color *= calculateAmbientOcclusion(surfacePos, surfaceNorm);

        float backgroundBlend = smoothstep(FLOOR_FADE_START, FLOOR_FADE_END, dist);
        color = mix(color, backgroundColor, backgroundBlend);
        finalColor = mix(finalColor, color, 1.0 / i);
    }

    fragColor = vec4(pow(finalColor, vec3(1. / 2.2)), 1);
}
