#version 300 es
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform vec2 mousePosition;
uniform vec2 resolution;
uniform float time;

@import ./util/config;
@import ./util/distFromFloor;
@import ./util/distFromSphere;

float mDistFromFloor(in vec3 p) { return distFromFloor(p, -200.0); }

float distFromNearest(in vec3 p) {
    float t = sin(time * 0.5) * 2.0;
    float displacement = sin(6.0 * p.x * mousePosition.x) * sin(8.0 * p.y * mousePosition.y) * sin(5.0 * p.z * t + time * 0.5) * 0.25;
    float sphere1 = distFromSphere(p, vec3(0), 1.0) + displacement;

    return min(mDistFromFloor(p), sphere1);
}

@import ./util/calculateNormal;

vec3 floorColor(in vec3 position, in vec3 normal, in vec3 eyePos) {
    return vec3(0.8);
}

vec3 sphereColor(in vec3 position, in vec3 normal, in vec3 eyePos) {
    vec3 lightPosition = vec3(-2.0, -5.0, 3.0);
    vec3 lightDir = normalize(position - lightPosition);

    float diffuse = max(0.0, dot(normal, lightDir));
    vec3 diffuseColor = vec3(0.5) * diffuse;

    float specularStrength = 0.5;
    float shininess = 64.0;
    vec3 eyeDir = normalize(eyePos - position);
    vec3 reflected = reflect(-lightDir, normal);
    float specular = pow(max(dot(eyeDir, reflected), 0.0), shininess) * specularStrength;
    vec3 specularColor = vec3(0.8) * specular;

    return normal * 0.5 + 0.5;
}

vec3 calculateColor(in vec3 position, in vec3 normal, in vec3 eyePos) {
    if (mDistFromFloor(position) < MINIMUM_HIT_DISTANCE) {
        return floorColor(position, normal, eyePos);
    }

    return sphereColor(position, normal, eyePos);
}

@import ./util/rayMarch;

void main() {
    const vec3 cameraPosition = vec3(0, 0, -5);
    vec3 rayDirection = vec3(uv, FRAME_OF_VIEW);
    fragColor = vec4(rayMarch(cameraPosition, rayDirection, vec3(1)), 1);
}
