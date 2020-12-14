#version 300 es
precision highp float;

const int NUM_STEPS = 32;
const float MINIMUM_HIT_DISTANCE = 0.001;
const float MAXIMUM_TRACE_DISTANCE = 1000.0;
const float FRAME_OF_VIEW = 1.0;

in vec2 uv;
out vec4 fragColor;

uniform vec2 resolution;
uniform float time;

float distFromSphere(in vec3 point, in vec3 center, float radius) {
	return length(point - center) - radius;
}

float distFromNearest(in vec3 p) {
    float t = sin(time * 0.5) * 2.0;
    float displacement = sin(3.0 * p.x * t) * sin(4.0 * p.y * t) * sin(5.0 * p.z * t) * 0.25;
    float sphere1 = distFromSphere(p, vec3(0), 1.0);

    return sphere1 + displacement;
}

vec3 calculateNormal(in vec3 point) {
    const vec3 stp = vec3(0.001, 0, 0);

    float x = distFromNearest(point + stp.xyy) - distFromNearest(point - stp.xyy);
    float y = distFromNearest(point + stp.yxy) - distFromNearest(point - stp.yxy);
    float z = distFromNearest(point + stp.yyx) - distFromNearest(point - stp.yyx);

    return normalize(vec3(x, y, z));
}

vec3 calculateColor(in vec3 position, in vec3 normal, in vec3 eyePos) {
    vec3 lightPosition = vec3(-2.0, -5.0, 3.0);
    vec3 lightDir = normalize(position - lightPosition);

    float diffuse = max(0.0, dot(normal, lightDir));
    vec3 diffuseColor = vec3(0.25) * diffuse;

    float specularStrength = 0.5;
    float shininess = 64.0;
    vec3 eyeDir = normalize(eyePos - position);
    vec3 reflected = reflect(-lightDir, normal);
    float specular = pow(max(dot(eyeDir, reflected), 0.0), shininess) * specularStrength;
    vec3 specularColor = vec3(0.8) * specular;

    return diffuseColor + specularColor;
}

vec3 rayMarch(in vec3 ro, in vec3 rd) {
    float totalDistancetraveled = 0.0;
    
    for (int i = 0; i < NUM_STEPS; i++) {
        vec3 currentPosition = ro + totalDistancetraveled * rd;
        float dist = distFromNearest(currentPosition);

        if (dist < MINIMUM_HIT_DISTANCE) {
            vec3 normal = calculateNormal(currentPosition);
            return calculateColor(currentPosition, normal, ro);
        }

        if (totalDistancetraveled > MAXIMUM_TRACE_DISTANCE) {
            break;
        }

        totalDistancetraveled += dist;
    }

    return vec3(1);
}

void main() {
    const vec3 cameraPosition = vec3(0, 0, -5);
    vec3 rayDirection = vec3(uv, FRAME_OF_VIEW);
    fragColor = vec4(rayMarch(cameraPosition, rayDirection), 1);
}
