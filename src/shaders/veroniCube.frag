#version 300 es
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform int colorMode;
uniform bool drawFloor;
uniform float fogDist;
uniform float quality;
uniform vec2 resolution;
uniform vec3 shapeRotation;
uniform bool spin;
uniform float time;

// ray marching
#define FRAME_OF_VIEW 1.0
#define MAX_RAY_LENGTH 22.0
#define MIN_HIT_DISTANCE 0.01
#define NUM_STEPS 100
#define RAY_PUSH 0.02

// shading
#define LIGHT_POS vec3(2.0, 10.0, 8.0)
#define REFLECTIVITY 0.3
#define SHADOW_INTENSITY 0.9
#define SHADOW_FACTOR 128.0
#define MATERIAL_SHININESS 4.
#define MATERIAL_AMBIENT_STRENGTH 0.04
#define MATERIAL_DIFFUSE_STRENGTH 0.8
#define MATERIAL_SPECULAR_STRENGTH 0.6

// Scene
#define FLOOR_FADE_START 25.
#define FLOOR_FADE_END 50.
#define FLOOR_LEVEL -2.0

#define EPSILON 1e-5

const vec3 CUBE_SIZE = vec3(2);
const vec3 CUBE_HALF = CUBE_SIZE / 2.0;

@import ./primitives/cube;
@import ./primitives/sdBox;
@import ./util/getRayData;
@import ./util/getUV;
@import ./util/hash;
@import ./util/rotate;

vec4 scene(in vec3 ro, in vec3 rd) {
    float pxl = 1.0 / min(resolution.x, resolution.y);
    const vec3 lightPos = vec3(0, 3.0, 0);
    vec4 color = vec4(0, 0, 0, 1);
    
    vec2 intersection = cubeIntersect(ro, rd, -CUBE_HALF, CUBE_HALF);

    if (intersection.x <= intersection.y) {
        // we have an intersection
        vec3 surfacePos = ro + rd * intersection.x;
        vec3 surfaceNorm = cubeNormal(surfacePos, CUBE_SIZE);
        color.xyz = abs(surfaceNorm);
    } else {
        // this ray doesn't intersect the cube
        // must be the floor or background
        color.xyz = vec3(1);
    }

    return color;
}

void main() {
    const vec3 camPos = vec3(6.0);
    const vec3 camTarget = vec3(CUBE_SIZE / 2.0);
    const vec3 worldUp = vec3(0, 0, 1);
    const float zoom = 1.0;

    vec4 color = vec4(0, 0, 0, 1);
    vec4 finalColor = vec4(0, 0, 0, 1);
    vec2 currentUV = uv;
    vec3 rayOrigin, rayDir;
    float d = quality;
    float numSubPixels = pow(d, 2.0);

    for (float i = 1.0; i <= numSubPixels; i += 1.0) {
        float x = mod(i - 1.0, d);
        float y = mod(floor(i / d), d);
        vec2 jitter = hash(i) / d;
        jitter.x += x / d;
        jitter.y += y / d;

        currentUV = getUV(gl_FragCoord.xy + jitter, resolution);
        if (spin) {
            getRayData(currentUV, camPos, camTarget, time, rayOrigin, rayDir);
        } else {
            getRayData(currentUV, camPos, camTarget, 0.0, rayOrigin, rayDir);
        }

        color = scene(rayOrigin, rayDir);
        finalColor = mix(finalColor, color, 1.0 / i);
    }

    fragColor = vec4(pow(finalColor.xyz, vec3(0.5)), finalColor.w);
}
