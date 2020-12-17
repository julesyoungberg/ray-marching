#version 300 es
precision highp float;

const float FRAME_OF_VIEW = 1.0;

in vec2 uv;
out vec4 fragColor;

uniform vec2 mousePosition;
uniform vec2 resolution;
uniform float time;

@import ./primitives/sdSphere;
@import ./util/config;
@import ./util/calculateNormal;
@import ./util/calculateSoftShadow;
@import ./util/castRay;
@import ./util/getSurfaceColor;
@import ./util/rayMarch;

float floorDist(in vec3 p) { return p.y + 1.8; }

float distFromNearest(in vec3 p) {
    float t = sin(time * 0.5) * 2.0;
    float displacement = sin(6.0 * p.x * mousePosition.x) * sin(8.0 * p.y * mousePosition.y) * sin(5.0 * p.z * t + time * 0.5) * 0.25;
    float sphere1 = sdSphere(p, vec3(0), 1.0) + displacement;

    return min(sphere1, floorDist(p));
}

vec3 floorColor(in vec3 position, in vec3 normal, in vec3 eyePos, in vec3 lightPos) {
    return vec3(0.97) * calculateSoftShadow(position, lightPos, 30.0);
}

vec3 sphereColor(in vec3 position, in vec3 normal, in vec3 eyePos, in vec3 lightPos) {
    vec3 lightDir = normalize(lightPos - position);

    float diffuse = max(0.0, dot(normal, lightDir));
    vec3 diffuseColor = vec3(0.25) * diffuse;

    const float specularStrength = 0.5;
    const float shininess = 128.0;
    vec3 eyeDir = normalize(eyePos - position);
    vec3 reflected = reflect(-lightDir, normal);
    float specular = pow(max(dot(eyeDir, reflected), 0.0), shininess) * specularStrength;
    vec3 specularColor = vec3(0.8) * specular;

    return diffuseColor + specularColor;
}

vec3 calculateColor(in vec3 position, in vec3 normal, in vec3 eyePos) {
    const vec3 lightPos = vec3(3.0, 10.0, -2.0);

    if (floorDist(position) < MIN_HIT_DISTANCE) {
        return floorColor(position, normal, eyePos, lightPos);
    }

    return sphereColor(position, normal, eyePos, lightPos);
}

void main() {
    const vec3 camPos = vec3(0.0, 1.0, -5.0);
    const vec3 lookAt = vec3(0.0);
    const float zoom = 1.0;

    vec3 rayDir = castRay(uv, camPos, lookAt, zoom);
    vec3 color = getSurfaceColor(camPos, rayDir, vec3(1.0));
    fragColor = vec4(color, 1);
}
