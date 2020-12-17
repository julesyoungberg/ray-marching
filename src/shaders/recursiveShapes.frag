#version 300 es
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform bool drawFloor;
uniform float fogDist;
uniform vec2 mousePosition;
uniform float quality;
uniform vec2 resolution;
uniform vec3 rsRotation1;
uniform vec3 rsRotation2;
uniform vec3 shapeColor;
uniform bool spin;
uniform float time;

// ray marching
#define FRAME_OF_VIEW 1.0
#define MAX_RAY_LENGTH 22.0
#define MIN_HIT_DISTANCE 0.01
#define NUM_STEPS 100
#define RAY_PUSH 0.02

// shading
#define LIGHT_POS vec3(2.0, 10.0, 8.0)
#define REFLECTIVITY 0.3
#define SHADOW_INTENSITY 0.9
#define SHADOW_FACTOR 128.0
#define MATERIAL_SHININESS 4.
#define MATERIAL_AMBIENT_STRENGTH 0.04
#define MATERIAL_DIFFUSE_STRENGTH 0.8
#define MATERIAL_SPECULAR_STRENGTH 0.6

// Scene
#define FLOOR_FADE_START 25.
#define FLOOR_FADE_END 50.
#define CAMERA_MOVEMENT_SPEED -20.
#define CAMERA_INV_DISTANCE_MULTIPLIER 4.
#define FLOOR_LEVEL -1.5

#define EPSILON 1e-5

@import ./util/calculateAmbientOcclusion;
@import ./util/calculateFloorDist;
@import ./util/calculateNormal;
@import ./util/calculatePhong;
@import ./util/calculateReflections;
@import ./util/calculateShadow;
@import ./util/castRay;
@import ./util/getUV;
@import ./util/hash;
@import ./util/marchRay;
@import ./util/rotate;

vec3 getBackgroundColor(const vec2 st) {
    return vec3(0) * smoothstep(1.0, 0.0, abs(0.5 - st.y));
} 

void getRayData(const vec2 uv, const vec3 camPos, const vec3 lookAt, 
                const float time, out vec3 rayOrigin, out vec3 rayDir) {
    rayOrigin = camPos;
    vec3 rayTargetPoint = vec3(0.0);

    // We want to move camera around center of the scene
    float cameraAngle = time * CAMERA_MOVEMENT_SPEED;
    mat4 rotateCameraMatrix =
        createRotateAroundPointMatrix(vec3(0.0), vec3(0.0, cameraAngle, 0.0));
    rayOrigin = (rotateCameraMatrix * vec4(rayOrigin, 1.0)).xyz;

    vec3 worldUp = vec3(0.0, 1.0, 0.0);
    vec3 cameraForward = normalize(rayTargetPoint - rayOrigin);
    vec3 cameraRight = normalize(cross(cameraForward, worldUp));
    vec3 cameraUp = normalize(cross(cameraRight, cameraForward));
    mat3 cameraMatrix = mat3(cameraRight, cameraUp, cameraForward);

    rayDir = normalize(cameraMatrix *
                       vec3(uv, CAMERA_INV_DISTANCE_MULTIPLIER));
}

float sdTetrahedron(const vec3 pos, const float scale, const int iterations, const vec3 offset) {
    vec3 p = pos;
    float r = dot(p, p);
    mat4 rotation1 = createRotationMatrix(rsRotation1);
    mat4 rotation2 = createRotationMatrix(rsRotation2);
    int i;

    for (i = 0; i < iterations && r < 1000.0; i++) {
        p = rotateVec(p, rotation1);

        if (p.x + p.y < 0.0) { 
            p.xy = -p.yx;
        }
        if (p.x + p.z < 0.0) { 
            p.xz = -p.zx;
        }
        if (p.y + p.z < 0.0) { 
            p.yz = -p.zy;
        }

        p = rotateVec(p, rotation2);

        p.x = scale * p.x - (scale - 1.0);
        p.y = scale * p.y - (scale - 1.0);
        p.z = scale * p.z - (scale - 1.0);
        r = dot(p, p);
    }

    return (sqrt(r) - 2.0) * pow(scale, -float(i));
}

float shapeDist(in vec3 pos) {
    mat4 rot = createRotationMatrix(vec3(35., 0., -45.));
    vec3 p = (rot * vec4(pos, 1.)).xyz;
    return sdTetrahedron(p, 2.0, 10, vec3(0, 1, 0));
}

float distFromNearest(in vec3 p) {
    return shapeDist(p); //opTwist(p, 0.01));
}

vec3 getWallColor(in vec3 position) {
    const float scale = 1.0;
    vec3 p = position * scale;
    float total = floor(p.x) + floor(p.y) + floor(p.z);
    bool isEven = mod(total, 2.0) == 0.0;
    return mix(vec3(0.4), vec3(0.9), float(isEven));
}

vec3 calculateColor(in vec3 position, in vec3 normal, in vec3 eyePos) {
    vec3 lightDir = normalize(LIGHT_POS - position);
    vec3 color = shapeColor;
    color = calculatePhong(position, normal, eyePos, LIGHT_POS, color);
    color *= calculateShadow(position, normal, LIGHT_POS);
    return color;
}

void main() {
    const vec3 camPos = vec3(5.0, 3.0, 5.0);
    const vec3 lookAt = vec3(0.0);
    const float zoom = 1.0;

    vec3 finalColor = vec3(0.0);
    vec2 currentUV = uv;
    vec3 backgroundColor;
    vec3 rayOrigin;
    vec3 rayDir;
    float d = quality;
    float numSubPixels = pow(d, 2.0);

    for(float i = 1.0; i <= numSubPixels; i += 1.0) {
        float x = mod(i - 1.0, d);
        float y = mod(floor(i / d), d);
        vec2 jitter = hash(i) / d;
        jitter.x += x / d;
        jitter.y += y / d;

        currentUV = getUV(gl_FragCoord.xy + jitter, resolution);
        if (spin) {
            getRayData(currentUV, camPos, lookAt, time, rayOrigin, rayDir);
        } else {
            getRayData(currentUV, camPos, lookAt, 0.0, rayOrigin, rayDir);
        }
        backgroundColor = getBackgroundColor(uv);

        float dist = marchRay(rayOrigin, rayDir, 0.0);
        vec3 color = vec3(1.0);
        bool isFloor = false;
        vec3 surfacePos, surfaceNorm;
        if (dist < 0.0) {
            if (drawFloor) {
                dist = calculateFloorDist(rayOrigin, rayDir, FLOOR_LEVEL);
                if (dist >= 0.0) {
                    isFloor = true;
                    surfacePos = rayOrigin + rayDir * dist;
                    surfaceNorm = vec3(0, 1, 0);
                    color = vec3(1.0);
                    color = calculatePhong(surfacePos, surfaceNorm, rayOrigin, LIGHT_POS, color);
                    color *= calculateShadow(surfacePos, surfaceNorm, LIGHT_POS);
                }
            } else {
                dist = fogDist;
            }
        } else {
            surfacePos = rayOrigin + rayDir * dist;
            surfaceNorm = calculateNormal(surfacePos);
            color = calculateColor(surfacePos, surfaceNorm, rayOrigin);
        }
        
        color *= calculateAmbientOcclusion(surfacePos, surfaceNorm);
        color = calculateReflections(surfacePos, surfaceNorm, color, rayOrigin, vec3(0.0));

        float backgroundBlend = smoothstep(FLOOR_FADE_START, FLOOR_FADE_END, dist);
        color = mix(color, backgroundColor, backgroundBlend);
        color = mix(color, vec3(0.5), pow(dist / fogDist, 2.0));
        finalColor = mix(finalColor, color, 1.0 / i);
    }

    fragColor = vec4(pow(finalColor, vec3(1. / 2.2)), 1);
}
