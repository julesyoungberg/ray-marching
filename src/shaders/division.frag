#version 300 es
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform vec2 mousePosition;
uniform vec2 resolution;
uniform float time;

@import ./util/config;
@import ./primitives/sdBoxDist;
@import ./util/rand;
@import ./util/castRay;

float distFromNearest(in vec3 p) {
    return min(p.z, min(p.x, p.y));
}

@import ./util/calculateNormal;
@import ./util/getShadowMultiplier;
@import ./util/rayMarch;

vec3 getMaterialColor(in vec3 position) {
    const float scale = 0.5;
    vec3 p = position * scale;
    float total = floor(p.x) + floor(p.y) + floor(p.z);
    bool isEven = mod(total, 2.0) == 0.0;
    return mix(vec3(0.3), vec3(0.7), float(isEven));
}

vec3 calculateColor(in vec3 position, in vec3 normal, in vec3 eyePos) {
    vec3 lightPos = eyePos; // vec3(10.0, 40.0, 10.0);
    vec3 lightDir = normalize(lightPos - position);
    vec3 color = getMaterialColor(position);

    float diffuse = max(0.0, dot(normal, lightDir));
    vec3 diffuseColor = color * diffuse;

    const float specularStrength = 0.5;
    const float shininess = 64.0;
    vec3 eyeDir = normalize(eyePos - position);
    vec3 reflected = reflect(-lightDir, normal);
    float specular = pow(max(dot(eyeDir, reflected), 0.0), shininess) * specularStrength;
    vec3 specularColor = color * specular;

    vec3 finalColor = vec3(0.2) * 0.5 + diffuseColor + specularColor;
    return finalColor * getShadowMultiplier(position, lightPos, 30.0, 0.3);
}

void main() {
    float x = (cos(time * 0.7) * 0.5 + 0.5) * 30.0 + 5.0;
    float z = (sin(time * 0.7) * 0.5 + 0.5) * 20.0 + 4.0;
    vec3 camPos = vec3(25, 10, 15);
    const vec3 lookAt = vec3(0);
    const float zoom = 1.0;

    vec3 rayDir = castRay(uv, camPos, lookAt, zoom);
    float dist = rayMarch(camPos, rayDir);
    if (dist < 0.0) {
        fragColor = vec4(vec3(0), 1);
        return;
    }

    vec3 surfacePos = camPos + rayDir * dist;
    vec3 normal = calculateNormal(surfacePos);
    vec3 color = calculateColor(surfacePos, normal, camPos);
    fragColor = vec4(color, 1);
}
