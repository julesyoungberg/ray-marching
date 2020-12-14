#version 300 es
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform vec2 mousePosition;
uniform vec2 resolution;
uniform float time;

@import ./primitives/sdBoxDist;
@import ./util/config;
@import ./util/castRay;

float distFromNearest(in vec3 p) {
    return min(p.z, min(p.x, min(p.y, sdBoxDist(p, vec3(0.5)))));
}

@import ./util/calculateNormal;

vec3 floorColor(in vec3 position, in vec3 normal, in vec3 eyePos) {
    return vec3(0.8);
}

vec3 calculateColor(in vec3 position, in vec3 normal, in vec3 eyePos) {
    const vec3 lightPosition = vec3(-2.0, -5.0, 3.0);
    vec3 lightDir = normalize(position - lightPosition);

    float diffuse = max(0.0, dot(normal, lightDir));
    vec3 diffuseColor = vec3(0.5) * diffuse;

    const float specularStrength = 0.5;
    const float shininess = 64.0;
    vec3 eyeDir = normalize(eyePos - position);
    vec3 reflected = reflect(-lightDir, normal);
    float specular = pow(max(dot(eyeDir, reflected), 0.0), shininess) * specularStrength;
    vec3 specularColor = vec3(0.8) * specular;

    return vec3(0.2) * 0.5 + diffuseColor + specularColor;
}

@import ./util/rayMarch;

void main() {
    const vec3 camPos = vec3(2.0, 1.0, 1.5);
    const vec3 lookAt = vec3(0);
    const float zoom = 1.0;
    vec3 rayDir = castRay(uv, camPos, lookAt, zoom);

    fragColor = vec4(rayMarch(camPos, rayDir, vec3(1)), 1);
}
