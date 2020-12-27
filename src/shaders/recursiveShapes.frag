#version 300 es
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform int colorMode;
uniform bool drawFloor;
uniform float fogDist;
uniform vec2 mousePosition;
uniform vec3 paletteColor1;
uniform vec3 paletteColor2;
uniform vec3 paletteColor3;
uniform float quality;
uniform vec2 resolution;
uniform int rsBaseShape;
uniform vec3 rsCenterScale;
uniform bool rsRenderTrap;
uniform vec3 rsRotation1;
uniform vec3 rsRotation2;
uniform vec3 shapeColor;
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

@import ./util/calculateAmbientOcclusion;
@import ./util/calculateFloorDist;
@import ./util/calculateNormal;
@import ./util/calculatePhong;
@import ./util/calculateReflectionsWithTrap;
@import ./util/calculateShadow;
@import ./util/castRay;
@import ./util/folding;
@import ./util/getRayData;
@import ./util/getUV;
@import ./util/hash;
@import ./util/marchRayWithTrap;
@import ./util/rotate;

vec3 getBackgroundColor(const vec2 st) {
    return vec3(0) * smoothstep(1.0, 0.0, abs(0.5 - st.y));
}

float sdShape(const vec3 pos, const float scale, const int iterations, const vec3 offset, out vec3 orbitTrap) {
    vec3 p = pos;
    float r = dot(p, p);
    mat4 rotation1 = createRotationMatrix(rsRotation1);
    mat4 rotation2 = createRotationMatrix(rsRotation2);
    
    orbitTrap = vec3(1e20);

    int i;
    for (i = 0; i < iterations && r < 1000.0; i++) {
        p = rotateVec(p, rotation1);

        switch(rsBaseShape) {
            case 0:
                p = foldCube(p);
                break;
            case 1:
                p = foldOctahedralFull(p);
                p.z -= 0.5 * rsCenterScale.z * (scale - 1.0) / scale;
                p.z = -abs(p.z);
                p.z += 0.5 * rsCenterScale.z * (scale - 1.0) / scale;
                break;
            case 2:
                p = foldOctahedral(p);
                break;
            case 3:
                p = foldOctahedralFull(p);
                break;
            case 5:
                p = foldTetrahedronFull(p);
                break;
            default:
                p = foldTetrahedron(p);
        }

        p = rotateVec(p, rotation2);

        p.x = scale * p.x - rsCenterScale.x * (scale - 1.0);
        p.y = scale * p.y - rsCenterScale.y * (scale - 1.0);
        if (rsBaseShape == 1) {
            p.z *= scale;
        } else {
            p.z = scale * p.z - rsCenterScale.z * (scale - 1.0);
        }

        r = dot(p, p);

        orbitTrap.x = min(pow(abs(p.z), 0.1), orbitTrap.x);
        orbitTrap.y = min(abs(p.x) - 0.15, orbitTrap.y);
        orbitTrap.z = min(r, orbitTrap.z);
    }

    return (sqrt(r) - 2.0) * pow(scale, -float(i));
}

float shapeDist(in vec3 pos, out vec3 orbitTrap) {
    mat4 rot = createRotationMatrix(shapeRotation);
    vec3 p = (rot * vec4(pos, 1.)).xyz;
    return sdShape(p, 2.0, 10, vec3(0, 1, 0), orbitTrap);
}

float distFromNearest(in vec3 p, out vec3 trap) {
    return shapeDist(p, trap);
}

float distFromNearest(in vec3 p) {
    vec3 dummyTrap;
    return distFromNearest(p, dummyTrap);
}

vec3 calculateColor(in vec3 position, in vec3 normal, in vec3 eyePos, in vec3 trap) {
    vec3 lightDir = normalize(LIGHT_POS - position);
    vec3 color = shapeColor;

    if (colorMode == 1) {
        color = paletteColor1 * clamp(pow(trap.x, 20.0), 0.0, 1.0);
        color += paletteColor2 * clamp(pow(trap.y, 20.0), 0.0, 1.0);
        color += paletteColor3 * clamp(pow(trap.z, 20.0), 0.0, 1.0);
    }

    color = calculatePhong(position, normal, eyePos, LIGHT_POS, color);
    color *= calculateShadow(position, normal, LIGHT_POS);
    return color;
}

void main() {
    const vec3 camPos = vec3(5.0, 3.0, 5.0);
    const vec3 lookAt = vec3(0.0);
    const float zoom = 1.0;

    vec3 finalColor = vec3(0.0);
    vec2 currentUV = uv;
    vec3 backgroundColor;
    vec3 rayOrigin;
    vec3 rayDir;
    float d = quality;
    float numSubPixels = pow(d, 2.0);
    vec3 trap;

    for (float i = 1.0; i <= numSubPixels; i += 1.0) {
        float x = mod(i - 1.0, d);
        float y = mod(floor(i / d), d);
        vec2 jitter = hash(i) / d;
        jitter.x += x / d;
        jitter.y += y / d;

        currentUV = getUV(gl_FragCoord.xy + jitter, resolution);
        if (spin) {
            getRayData(currentUV, camPos, lookAt, time, rayOrigin, rayDir);
        } else {
            getRayData(currentUV, camPos, lookAt, 0.0, rayOrigin, rayDir);
        }
        backgroundColor = getBackgroundColor(uv);

        float dist = marchRayWithTrap(rayOrigin, rayDir, 0.0, trap);
        vec3 color = vec3(1.0);
        bool isFloor = false;
        vec3 surfacePos, surfaceNorm;
        if (dist < 0.0) {
            if (drawFloor) {
                dist = calculateFloorDist(rayOrigin, rayDir, FLOOR_LEVEL);
                if (dist >= 0.0) {
                    isFloor = true;
                    surfacePos = rayOrigin + rayDir * dist;
                    surfaceNorm = vec3(0, 1, 0);
                    color = vec3(1.0);
                    color = calculatePhong(surfacePos, surfaceNorm, rayOrigin, LIGHT_POS, color);
                    color *= calculateShadow(surfacePos, surfaceNorm, LIGHT_POS);
                }
            } else {
                dist = fogDist;
            }
        } else {
            surfacePos = rayOrigin + rayDir * dist;
            surfaceNorm = calculateNormal(surfacePos);
            color = calculateColor(surfacePos, surfaceNorm, rayOrigin, trap);
        }
        
        color *= calculateAmbientOcclusion(surfacePos, surfaceNorm);
        color = calculateReflectionsWithTrap(surfacePos, surfaceNorm, color, rayOrigin, vec3(0.0));

        float backgroundBlend = smoothstep(FLOOR_FADE_START, FLOOR_FADE_END, dist);
        color = mix(color, backgroundColor, backgroundBlend);
        color = mix(color, vec3(0.5), pow(dist / fogDist, 2.0));
        finalColor = mix(finalColor, color, 1.0 / i);
    }

    fragColor = vec4(pow(finalColor, vec3(1. / 2.2)), 1);
}
