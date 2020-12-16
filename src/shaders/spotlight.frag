#version 300 es
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform vec2 mousePosition;
uniform vec2 resolution;
uniform float time;

@import ./primitives/util;
@import ./primitives/sdBox;
@import ./primitives/sdSphere;
@import ./primitives/udQuad;
@import ./util/config;
@import ./util/calculateNormal;
@import ./util/calculateshading;
@import ./util/castRay;
@import ./util/getShadowMultiplier;
@import ./util/getSmoothSurfaceColor;
@import ./util/getSurfaceColor;
@import ./util/getUV;
@import ./util/hash;
@import ./util/rand;
@import ./util/rayMarch;

const float SIZE = 20.0;

float floorDist(in vec3 p) {
    const float s = SIZE;
    return udQuad(p, vec3(0), vec3(s, 0, 0), vec3(s, 0, s), vec3(0, 0, s));
}

float shapeDist(in vec3 p) {
    vec3 center = vec3(SIZE / 2.0, 7.0, SIZE / 2.0);
    return max(sdBox(p - center, vec3(4.0)), -sdSphere(p, center, 5.0));
}

float distFromNearest(in vec3 p) {
    return min(floorDist(p), shapeDist(p));
}

vec3 getMaterialColor(in vec3 position) {
    vec3 color;
    if (shapeDist(position) < MIN_HIT_DISTANCE) {
        color = vec3(0.2, 0.5, 1.0);
    } else {
        color = vec3(0.7);
    }
    return color;
}

vec3 calculateColor(in vec3 position, in vec3 normal, in vec3 eyePos) {
    float ambientStrength = 0.3;
    vec3 lightPos = vec3(10.0, 30.0, 10.0);
    vec3 lightDir = normalize(lightPos - position);
    vec3 spotDir = normalize(vec3(SIZE / 2.0, 0, SIZE / 2.0) - lightPos);
    float cutoff = cos(3.14 / 12.0);
    float outerCutoff = cos((3.14 / 12.0) * 1.1);
    float theta = dot(spotDir, -lightDir);
    float epsilon = cutoff - outerCutoff;
    float intensity = clamp((theta - outerCutoff) / epsilon, 0.0, 1.0);

    vec3 color = getMaterialColor(position);

    vec3 finalColor = color * ambientStrength;
    if (theta > outerCutoff) {
        float diffuse = max(0.0, dot(normal, lightDir));
        vec3 diffuseColor = color * diffuse * intensity;

        const float specularStrength = 0.5;
        const float shininess = 64.0;
        vec3 eyeDir = normalize(eyePos - position);
        vec3 reflected = reflect(-lightDir, normal);
        float specular = pow(max(dot(eyeDir, reflected), 0.0), shininess) * specularStrength;
        vec3 specularColor = color * specular * intensity;

        finalColor += diffuseColor + specularColor;
    }

    // this lightDir * 2.2 is super hacky but not sure why it isn't detecting the object from the floor otherwise
    return finalColor * getShadowMultiplier(position + lightDir * 2.2, lightPos, 2.0, 0.0);
}

void main() {
    vec3 camPos = vec3(30.0, 10.0, 10.0);
    const vec3 lookAt = vec3(SIZE / 2.0);
    const float zoom = 1.0;
    vec3 color = getSmoothSurfaceColor(gl_FragCoord.xy, resolution, camPos, lookAt, zoom, vec3(0), 2);
    fragColor = vec4(color, 1);
}
