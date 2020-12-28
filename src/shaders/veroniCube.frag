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
uniform bool vAnimateCells;

// ray marching
#define FRAME_OF_VIEW 1.0
#define MAX_RAY_LENGTH 22.0
#define MIN_HIT_DISTANCE 0.01
#define NUM_STEPS 100
#define RAY_PUSH 0.02

// shading
#define LIGHT_POS vec3(1.0, 10.0, 1.0)
#define REFLECTIVITY 0.3
#define SHADOW_INTENSITY 0.9
#define SHADOW_FACTOR 128.0
#define MATERIAL_SHININESS 4.
#define MATERIAL_AMBIENT_STRENGTH 0.1
#define MATERIAL_DIFFUSE_STRENGTH 0.8
#define MATERIAL_SPECULAR_STRENGTH 0.6

// Scene
#define FLOOR_LEVEL -1.5
#define FLOOR_COLOR vec3(0.7)
#define BACKGROUND vec3(1.0, 1.0, 1.0)

#define EPSILON 1e-5

const vec3 CUBE_SIZE = vec3(2);
const vec3 CUBE_HALF = CUBE_SIZE / 2.0;

@import ./primitives/cube;
@import ./primitives/sdBox;
@import ./util/calculateFloorDist;
@import ./util/calculatePhong;
@import ./util/calculateShadow;
@import ./util/getRayData;
@import ./util/getUV;
@import ./util/hash;
@import ./util/rand;
@import ./util/rotate;

vec4 veroni(vec3 c) {
    vec3 coord = c;

    // Tile the space
    const float gridRes = 5.0;
    coord *= gridRes;

    vec3 binCoord = floor(coord);
    vec3 binPos = fract(coord);

    float minDist = gridRes;
    vec3 minPoint;

    // search neighborhood
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            for (int z = -1; z <= 1; z++) {
                vec3 neighbor = vec3(x, y, z);
                vec3 point = rand3(binCoord + neighbor);

                if (vAnimateCells) {
                    point = 0.5 + 0.5 * sin(time + 6.2831 * point);
                }

                vec3 diff = neighbor + point - binPos;
                float dist = length(diff);

                if (dist < minDist) {
                    minDist = dist;
                    minPoint = point;
                }
            }
        }
    }

    return vec4(minPoint, minDist);
}

float distFromNearest(in vec3 pos) {
    return sdBox(pos, CUBE_HALF);
}

vec3 getShapeColor(in vec3 ro, in vec3 rd) {
    float pxl = 1.0 / min(resolution.x, resolution.y);
    
    vec2 intersection = cubeIntersect(ro, rd, -CUBE_HALF, CUBE_HALF);
    if (intersection.x > intersection.y) {
        return vec3(-1);
    }

    // we have an intersection
    vec3 surfacePos = ro + rd * intersection.x;
    vec3 surfaceNorm = cubeNormal(surfacePos, CUBE_SIZE);

    float dist = distFromNearest(surfacePos);
    if (dist < -0.9) {
        return vec3(-1);
    }

    // map cube to (0, 0, 0)-(1, 1, 1)
    vec4 cell = veroni((surfacePos + CUBE_HALF) / CUBE_SIZE);

    vec3 color = cell.xyz;
    return calculatePhong(surfacePos, surfaceNorm, ro, LIGHT_POS, color);
}

vec3 calculateReflection(in vec3 position, in vec3 normal, in vec3 color, in vec3 eyePos) {
    vec3 rayDir = normalize(position - eyePos);
    vec3 reflectDir = reflect(rayDir, normal);
    vec3 reflected = getShapeColor(position, reflectDir);
    if (all(lessThan(reflected, vec3(0)))) {
        return color;
    }

    return mix(color, reflected, REFLECTIVITY);
}

vec3 getFloorColor(vec3 ro, vec3 rd) {
    float dist = calculateFloorDist(ro, rd, FLOOR_LEVEL);
    if (dist < 0.0) {
        // should never really happen
        return BACKGROUND;
    }

    vec3 surfacePos = ro + rd * dist;
    vec3 surfaceNorm = vec3(0, 1, 0);
    vec3 color = calculatePhong(surfacePos, surfaceNorm, ro, LIGHT_POS, FLOOR_COLOR);
    color *= calculateShadow(surfacePos, surfaceNorm, LIGHT_POS);
    color = calculateReflection(surfacePos, surfaceNorm, color, ro);
    return color;
}

void main() {
    const vec3 camPos = vec3(7.0, 4.0, 7.0);
    const vec3 camTarget = vec3(CUBE_SIZE / 2.0);
    const vec3 worldUp = vec3(0, 0, 1);
    const float zoom = 1.0;

    vec3 color = vec3(0);
    vec3 finalColor = vec3(0);
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

        color = getShapeColor(rayOrigin, rayDir);
        if (all(lessThan(color, vec3(0)))) {
            // no hit - must be the floor
            color = getFloorColor(rayOrigin, rayDir);
        }

        finalColor = mix(finalColor, color, 1.0 / i);
    }

    fragColor = vec4(pow(finalColor, vec3(0.5)), 1);
}
