#version 300 es
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform vec2 mousePosition;
uniform vec2 resolution;
uniform float time;

// ray marching
#define FRAME_OF_VIEW 1.0
#define MAX_RAY_LENGTH 20.0
#define RAY_PUSH 0.02

// shading
#define LIGHT_POS vec3(2.0, 10.0, 8.0)
#define REFLECTIVITY 0.5
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
#define FAR 30.0

@import ./primitives/sdBox;
@import ./primitives/sdSphere;
@import ./primitives/util;
@import ./util/config;
@import ./util/calculateNormal;
@import ./util/calculatePhong;
@import ./util/castRay;
@import ./util/getUV;
@import ./util/hash;
@import ./util/marchRay;
@import ./util/palette;
@import ./util/rand;
@import ./util/rayMarch;
@import ./util/rotate;

vec3 getBackgroundColor(const vec2 st) {
    return vec3(0) * smoothstep(1.0, 0.0, abs(0.5 - st.y));
}

float distFromNearest(in vec3 p) {
    float size = 0.25;

    float n = sin(dot(floor(p), vec3(27, 113, 57)));
    vec3 rnd = fract(vec3(2097152, 262144, 32768)*n) * (size / 2.0) - (size / 4.0);
    vec3 pos = fract(p + rnd) - size * 2.0;

    pos = abs(pos);
    return sdLerp(sdBox(pos, vec3(size)), sdSphere(pos, size), 0.3);
}

vec3 getObjectColor(vec3 p) {
    vec3 id = floor(p);    
    float rnd = rand(id);
    vec3 color = palette(rnd, vec3(0.5), vec3(0.5), vec3(2.0, 1.0, 0.0), vec3(0.5, 0.2, 0.25));
    if (rand(rnd) > .65) {
        color = color.zyx;
    }
    return color;
}

vec3 getColor(in vec3 position, in vec3 normal, in vec3 eyePos, in vec3 lightPos, float dist) {
    float lightDist = max(length(lightPos - position), .001);    
    float attenuation = 1.0 / (1.0 + lightDist * 0.2 + lightDist * lightDist * 0.1);
    
    vec3 color = getObjectColor(position);
    color = calculatePhong(position, normal, eyePos, lightPos, color);
    color *= attenuation;
    
    float fogFactor = smoothstep(0.0, 0.95, dist / FAR);
    color = mix(color, vec3(0.5), fogFactor); 
    return color;
}

vec3 applyReflections(vec3 position, vec3 normal, vec3 color, vec3 eyePos, vec3 lightPos) {
    vec3 rayDir = normalize(position - eyePos);
    rayDir = reflect(rayDir, normal);

    float dist = rayMarchFast(position + rayDir * RAY_PUSH, rayDir);
    if (dist < 0.0) {
        return color;
    }

    vec3 surfacePos = position + rayDir * (RAY_PUSH + dist);
    vec3 surfaceNorm = calculateNormal(surfacePos);
    vec3 reflectedColor = getColor(surfacePos, surfaceNorm, position, lightPos, dist);
    return color + reflectedColor * REFLECTIVITY;
}

float softShadow(vec3 position, vec3 lightPos, float k) {
    const int maxIterationsShad = 24; 
    vec3 rayDir = lightPos - position;

    float shade = 1.0;
    float dist = .002; 
    float end = max(length(rayDir), .001);
    float stepDist = end / float(maxIterationsShad);
    rayDir /= end;

    for (int i = 0; i < maxIterationsShad; i++) {
        float h = distFromNearest(position + rayDir * dist);
        shade = min(shade, smoothstep(0., 1., k * h / dist));
        dist += clamp(h, .02, .25);
        
        // Early exits from accumulative distance function calls tend to be a good thing.
        if (h < 0.0 || dist > end) {
            break;
        }
    }

    return min(max(shade, 0.0) + 0.25, 1.0); 
}

void main() {
    vec3 rayDir = normalize(vec3(uv, 1));
    float cs = cos(time * .25), si = sin(time * .25);
    rayDir.xy = mat2(cs, si, -si, cs) * rayDir.xy;
    rayDir.xz = mat2(cs, si, -si, cs) * rayDir.xz;
    vec3 camPos = vec3(0, 0, time * 1.0);

    float dist = rayMarch(camPos, rayDir);
    if (dist < 0.0) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    vec3 surfacePos = camPos + rayDir * dist;
    vec3 surfaceNorm = calculateNormal(surfacePos);
    // vec3 color = calculateColor(surfacePos, surfaceNorm, camPos);
    vec3 lightPos = camPos + vec3(0, 1, 5);
    vec3 color = getColor(surfacePos, surfaceNorm, camPos, lightPos, dist);
    color = applyReflections(surfacePos, surfaceNorm, color, camPos, lightPos);
    color *= softShadow(surfacePos + surfaceNorm * 0.01, lightPos, 16.0);

    fragColor = vec4(sqrt(clamp(color, 0., 1.)), 1);
}
