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
#define MIN_HIT_DISTANCE 0.06
#define NUM_STEPS 100
#define RAY_PUSH 0.1

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

#define CUBE_SIZE vec3(2)
#define CUBE_HALF vec3(1)

@import ./primitives/cube;
@import ./primitives/sdBox;
@import ./util/calculateFloorDist;
@import ./util/calculateNormal;
@import ./util/calculatePhong;
@import ./util/calculateShadow;
@import ./util/getRayData;
@import ./util/getUV;
@import ./util/hash;
@import ./util/rand;
@import ./util/rotate;

const float gridRes = 2.0;

vec4 veroni(vec3 p) {
    // map cube to (0, 0, 0)-(1, 1, 1)
    vec3 coord = (p + CUBE_HALF) / CUBE_SIZE;
    if (any(lessThan(coord, vec3(0))) || any(greaterThan(coord, vec3(1)))) {
        return vec4(-1);
    }

    // Tile the space
    coord *= gridRes;
    vec3 binCoord = floor(coord);
    vec3 binPos = fract(coord);

    float minDist = 0.0;
    vec3 minPoint;
    float binSize = 1.5 / gridRes;

    // search neighborhood
    for (int x = -1; x <= 1; x++) {
        for (int y = -1; y <= 1; y++) {
            for (int z = -1; z <= 1; z++) {
                vec3 neighbor = vec3(x, y, z);
                vec3 point = rand3(binCoord + neighbor);

                if (vAnimateCells) {
                    point = 0.5 + 0.5 * sin(time * 0.5 + 6.2831 * point);
                }

                vec3 diff = neighbor + point - binPos;
                float dist = length(diff);
                dist = binSize - dist;

                if (dist > minDist) {
                    minDist = dist;
                    minPoint = point;
                }
            }
        }
    }

    return vec4(minPoint, minDist); // step(0.06, minDist));
}

float distFromNearest(in vec3 pos) {
    return veroni(pos).a;
}

vec3 getShapeColor(in vec3 ro, in vec3 rd) {
    float pxl = 1.0 / min(resolution.x, resolution.y);
    
    vec2 intersection = cubeIntersect(ro, rd, -CUBE_HALF, CUBE_HALF);
    if (intersection.x > intersection.y) {
        return vec3(-1);
    }

    // we have an intersection, march within the cube
    float totalDist = intersection.x;
    vec3 currentPos;
    float currentDist;

    while (totalDist <= intersection.y) {
        currentPos = ro + rd * totalDist;
        currentDist = distFromNearest(currentPos);

        if (currentDist < 0.1) {
            break;
        }

        totalDist += currentDist;
    }

    if (totalDist > intersection.y) {
        return vec3(-1);
    }

    vec3 surfacePos = ro + rd * totalDist;
    vec3 surfaceNorm = calculateNormal(surfacePos);
    vec3 color = vec3(0.1, 0, 0);
    color = calculatePhong(surfacePos, surfaceNorm, ro, LIGHT_POS, color);
    // color *= calculateShadow(surfacePos, surfaceNorm, LIGHT_POS);
    return color;
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
    // color *= calculateShadow(surfacePos, surfaceNorm, LIGHT_POS);
    return color;
}

void main() {
    const vec3 camPos = vec3(3.0);
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
        getRayData(currentUV, camPos, camTarget, 0.0, rayOrigin, rayDir);

        color = getShapeColor(rayOrigin, rayDir);
        if (all(lessThan(color, vec3(0)))) {
            // no hit - must be the floor
            color = vec3(1); //getFloorColor(rayOrigin, rayDir);
        }

        finalColor = mix(finalColor, color, 1.0 / i);
    }

    fragColor = vec4(pow(finalColor, vec3(0.5)), 1);
}
