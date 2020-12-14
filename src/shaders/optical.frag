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
@import ./util/rotate;

float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

float cubeRow(in vec3 p, in float size, in int n) {
    vec3 pos = p;
    float d = size * 2.0;
    vec3 dims = vec3(size);

    float minimum = sdBoxDist(pos, dims);

    for (int i = 0; i < n; i++) {
        vec3 offset = vec3(d * float(i), 0, d * float(i));
        minimum = min(
            minimum, 
            min(
                sdBoxDist(pos - offset, dims),
                sdBoxDist(pos + offset, dims)
            )
        );
    }

    return minimum;
}

float cubeRows(in vec3 pos, in float size, in int n) {
    float minimum = cubeRow(pos, size, n);

    for (int i = 0; i < n; i++) {
        vec3 offset = vec3(size * 2.0 * float(i), size * 2.0 * float(i), 0);
        minimum = min(
            minimum,
            min(
                cubeRow(pos - offset, size, n),
                cubeRow(pos + offset, size, n)
            )
        );
    }

    return minimum;
}

float distFromBoxes(in vec3 p) {
    const float size = 0.5;
    const float d = size * 2.0;
    const vec3 dims = vec3(size);

    vec3 pos = p;
    mat4 matrix = rotateY(3.14 / 4.0);
    pos = rotateVec(pos, matrix);

    return cubeRows(pos, size, 4);
}

float distFromNearest(in vec3 p) {
    return distFromBoxes(p);
}

@import ./util/calculateNormal;
@import ./util/rayMarch;

vec3 calculateColor(in vec3 position, in vec3 normal, in vec3 eyePos) {
    vec3 lightPos = vec3(2.0, 10.0, 5.0);
    vec3 lightDir = normalize(lightPos - position);

    float diffuse = max(0.0, dot(normal, lightDir));
    vec3 diffuseColor = vec3(0.5) * diffuse;

    const float specularStrength = 0.5;
    const float shininess = 64.0;
    vec3 eyeDir = normalize(eyePos - position);
    vec3 reflected = reflect(-lightDir, normal);
    float specular = pow(max(dot(eyeDir, reflected), 0.0), shininess) * specularStrength;
    vec3 specularColor = vec3(0.7) * specular;

    vec3 color = vec3(0.2) * 0.5 + diffuseColor + specularColor;
    return color;
}

void main() {
    vec3 camPos = vec3(0, 2, 2.5);
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
