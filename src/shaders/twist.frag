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
#define REFLECTIVITY 0.3
#define SHADOW_INTENSITY 0.9
#define SHADOW_FACTOR 128.0
#define MATERIAL_SHININESS 128.
#define MATERIAL_AMBIENT_STRENGTH 0.2
#define MATERIAL_DIFFUSE_STRENGTH 0.8
#define MATERIAL_SPECULAR_STRENGTH 0.6

// Scene
#define FLOOR_FADE_START 25.
#define FLOOR_FADE_END 50.
#define CAMERA_MOVEMENT_SPEED -20.
#define CAMERA_INV_DISTANCE_MULTIPLIER 4.
#define FLOOR_LEVEL -1.8

#define EPSILON 1e-5

@import ./primitives/opTwist;
@import ./primitives/sdLink;
@import ./util/config;
@import ./util/calculateAmbientOcclusion;
@import ./util/calculateFloorDist;
@import ./util/calculateNormal;
@import ./util/calculatePhong;
@import ./util/calculateReflections;
@import ./util/calculateSoftShadow;
@import ./util/getUV;
@import ./util/hash;
@import ./util/rayMarch;
@import ./util/marchRay;
@import ./util/rotate;

vec3 getBackgroundColor(const vec2 st) {
    return vec3(0) * smoothstep(1.0, 0.0, abs(0.5 - st.y));
} 

void getRayData(const vec2 uv, const vec3 camPos, const vec3 lookAt, 
                const float time, out vec3 rayOrigin, out vec3 rayDir) {
    rayOrigin = camPos;
    vec3 rayTargetPoint = vec3(0.0);

    // We want to move camera around center of the scene
    float cameraAngle = time * CAMERA_MOVEMENT_SPEED;
    mat4 rotateCameraMatrix =
        createRotateAroundPointMatrix(vec3(0.0), vec3(0.0, cameraAngle, 0.0));
    rayOrigin = (rotateCameraMatrix * vec4(rayOrigin, 1.0)).xyz;

    vec3 worldUp = vec3(0.0, 1.0, 0.0);
    vec3 cameraForward = normalize(rayTargetPoint - rayOrigin);
    vec3 cameraRight = normalize(cross(cameraForward, worldUp));
    vec3 cameraUp = normalize(cross(cameraRight, cameraForward));
    mat3 cameraMatrix = mat3(cameraRight, cameraUp, cameraForward);

    rayDir = normalize(cameraMatrix *
                       vec3(uv, CAMERA_INV_DISTANCE_MULTIPLIER));
}

float distFromNearest(in vec3 p) {
    return sdLink(
        opTwist(p, 2.0),
        1.0, 1.0, .5);
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
    vec3 color = vec3(0.0, 0.2, 1.0);
    color = calculatePhong(position, normal, eyePos, LIGHT_POS, color);
    return color;
}

void main() {
    const vec3 camPos = vec3(11.0, 5., 11.0);
    const vec3 lookAt = vec3(0.0);
    const float zoom = 1.0;

    vec3 finalColor = vec3(0.0);
    vec2 currentUV = uv;
    vec3 backgroundColor;
    vec3 rayOrigin;
    vec3 rayDir;
    float d = 2.0;
    float numSubPixels = pow(d, 2.0);

    for(float i = 1.0; i <= numSubPixels; i += 1.0) {
        float x = mod(i - 1.0, d);
        float y = mod(floor(i / d), d);
        vec2 jitter = hash(i) / d;
        jitter.x += x / d;
        jitter.y += y / d;

        currentUV = getUV(gl_FragCoord.xy + jitter, resolution);
        getRayData(currentUV, camPos, lookAt, time, rayOrigin, rayDir);
        backgroundColor = getBackgroundColor(uv);

        float dist = rayMarch(rayOrigin, rayDir);
        vec3 color = backgroundColor;
        bool isFloor = false;
        vec3 surfacePos, surfaceNorm;
        if (dist < 0.0) {
            float floorDist = calculateFloorDist(rayOrigin, rayDir, FLOOR_LEVEL);
            if (floorDist >= 0.0) {
                isFloor = true;
                surfacePos = rayOrigin + rayDir * floorDist;
                surfaceNorm = vec3(0, 1, 0);
                color = vec3(1.0);
                color = calculatePhong(surfacePos, surfaceNorm, rayOrigin, LIGHT_POS, color);
            }
        } else {
            surfacePos = rayOrigin + rayDir * dist;
            surfaceNorm = calculateNormal(surfacePos);
            color = calculateColor(surfacePos, surfaceNorm, rayOrigin);
        }
        
        color *= calculateSoftShadow(surfacePos, LIGHT_POS, 16.0);
        color *= calculateAmbientOcclusion(surfacePos, surfaceNorm);
        color = calculateReflections(surfacePos, surfaceNorm, color, rayOrigin, vec3(0.0));

        float backgroundBlend = smoothstep(FLOOR_FADE_START, FLOOR_FADE_END, dist);
        color = mix(color, backgroundColor, backgroundBlend);
        finalColor = mix(finalColor, color, 1.0 / i);
    }

    fragColor = vec4(pow(finalColor, vec3(1. / 2.2)), 1);
}
