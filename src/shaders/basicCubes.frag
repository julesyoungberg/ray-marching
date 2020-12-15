#version 300 es
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform vec2 mousePosition;
uniform vec2 resolution;
uniform float time;

@import ./primitives/sdBoxDist;
@import ./util/config;
@import ./util/calculateNormal;
@import ./util/castRay;
@import ./util/getShadowMultiplier;
@import ./util/getSurfaceColor;
@import ./util/rand;
@import ./util/rayMarch;

float distFromBoxes(in vec3 p) {
    const float size = 0.5;
    const float d = size * 2.0;
    vec3 dims = vec3(size);
    float minimum = sdBoxDist(p - dims, dims);

    vec3 pos = p - dims;
    pos = vec3(mod(pos.x + d, d * 2.0) - d, pos.y, mod(pos.z + d, d * 2.0) - d);
    // dims.y *= rand(floor(p.zy / vec2(d * 4.0))) * 10.0;
    
    // vec2 coord = vec2((oPos.x + d) / (d * 2.0), (oPos.z + d) / (d * 2.0));
    // pos.y *= rand(floor(coord)) * 8.0;

    return sdBoxDist(pos, dims);
}

float distFromNearest(in vec3 p) {
    return min(p.z, min(p.x, min(p.y, distFromBoxes(p))));
}

vec3 calculateColor(in vec3 position, in vec3 normal, in vec3 eyePos) {
    vec3 lightPos = vec3(10.0, 40.0, 10.0);
    vec3 lightDir = normalize(lightPos - position);

    float diffuse = max(0.0, dot(normal, lightDir));
    vec3 diffuseColor = vec3(0.7) * diffuse;

    const float specularStrength = 0.5;
    const float shininess = 64.0;
    vec3 eyeDir = normalize(eyePos - position);
    vec3 reflected = reflect(-lightDir, normal);
    float specular = pow(max(dot(eyeDir, reflected), 0.0), shininess) * specularStrength;
    vec3 specularColor = vec3(0.7) * specular;

    vec3 color = vec3(0.2) * 0.5 + diffuseColor + specularColor;
    return color * getShadowMultiplier(position, lightPos, 30.0, 0.3);
}

void main() {
    float x = (cos(time * 0.7) * 0.5 + 0.5) * 30.0 + 5.0;
    float z = (sin(time * 0.7) * 0.5 + 0.5) * 20.0 + 4.0;
    vec3 camPos = vec3(x, 10, z);
    const vec3 lookAt = vec3(0);
    const float zoom = 1.0;

    vec3 rayDir = castRay(uv, camPos, lookAt, zoom);
    vec3 color = getSurfaceColor(camPos, rayDir);
    fragColor = vec4(color, 1);
}
