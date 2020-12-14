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

float distFromBoxes(in vec3 p) {
    const int d = 10;

    const float size = 0.5;
    const float stp = size * 4.0; 
    const vec3 dims = vec3(size);
    float minimum = sdBoxDist(p - dims, dims);

    for (int x = 0; x < d; x++) {
        for (int z = 0; z < d; z++) {
            if (x == 0 && z == 0) {
                continue;
            }

            vec3 offset = vec3(stp * float(x), 0, stp * float(z)) + dims;
            minimum = min(minimum, sdBoxDist(p - offset, dims));
        }
    }

    return minimum;
}

float distFromNearest(in vec3 p) {
    return min(p.z, min(p.x, min(p.y, distFromBoxes(p))));
}

@import ./util/calculateNormal;
@import ./util/rayMarch;

float getShadowMultiplier(in vec3 position, in vec3 lightPos) {
    vec3 lightRay = lightPos - position;
    vec3 lightDir = normalize(lightRay);
    float maxLength = length(lightDir);

    float finalDist = 1000.0;
    vec3 rayPos = position;
    float totalDist = 0.1;
    rayPos += totalDist * lightDir;
    float res = 1.0;
    const float shadowConst = 30.0;

    for (int i = 0; i < NUM_STEPS && totalDist < maxLength; i++) {
        if (finalDist < MIN_HIT_DISTANCE) {
            return 0.3;
        }

        finalDist = distFromNearest(rayPos);
        totalDist += finalDist;
        res = min(res, shadowConst * finalDist / totalDist);
        rayPos += finalDist * lightDir;
    }

    return res;
}

vec3 calculateColor(in vec3 position, in vec3 normal, in vec3 eyePos) {
    vec3 lightPos = vec3(7.0, 17.0, 7.0);
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
    return color * getShadowMultiplier(position, lightPos);
}

void main() {
    const vec3 camPos = vec3(15.0, 7.0, 12.0);
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
