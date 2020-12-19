#version 300 es
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform bool drawFloor;
uniform float fogDist;
uniform vec2 mousePosition;
uniform float quality;
uniform vec2 resolution;
uniform vec3 shapeColor;
uniform vec3 shapeRotation;
uniform bool spin;
uniform float time;

// ray marching
#define FRAME_OF_VIEW 1.0
#define MAX_RAY_LENGTH 100.0
#define MIN_HIT_DISTANCE 0.003
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
#define FLOOR_LEVEL -2.0

#define EPSILON 1e-5

@import ./util/calculateAmbientOcclusion;
@import ./util/calculateFloorDist;
@import ./util/calculateNormal;
@import ./util/calculatePhong;
@import ./util/calculateReflections;
@import ./util/calculateShadow;
@import ./util/castRay;
@import ./util/folding;
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

float sdMandelbulb(const vec3 pos, const int iterations, 
                   const float bailout, const float power) {
    vec3 z = pos;
	float dr = 1.0;
	float r = 0.0;
	for (int i = 0; i < iterations ; i++) {
		r = length(z);
		if (r > bailout) {
            break;
        }
		
		// convert to polar coordinates
		float theta = acos(z.z / r);
		float phi = atan(z.y, z.x);
		dr = pow(r, power - 1.0) * power * dr + 1.0;
		
		// scale and rotate the point
		float zr = pow(r, power);
		theta = theta * power;
		phi = phi * power;
		
		// convert back to cartesian coordinates
		z = zr * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta));
		z += pos;
	}
	return 0.5 * log(r) * r / dr;
}

float shapeDist(in vec3 pos) {
    mat4 rot = createRotationMatrix(shapeRotation);
    vec3 p = (rot * vec4(pos, 1.)).xyz;
    return sdMandelbulb(p, 10, 4.0, 8.0);
}

float distFromNearest(in vec3 p) {
    return shapeDist(p); //opTwist(p, 0.01));
}

float rayMarch(const vec3 rayOrg, const vec3 rayDir, const float startDist) {
    for (float totalDist = startDist; totalDist < MAX_RAY_LENGTH;) {
        vec3 currentPos = rayOrg + rayDir * totalDist;
        float currentDist = distFromNearest(currentPos);
        if (currentDist < MIN_HIT_DISTANCE) {
            return totalDist;
        }
        totalDist += currentDist * 0.75;
    }
    return -1.0;
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

    for (float i = 1.0; i <= numSubPixels; i += 1.0) {
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

        float dist = rayMarch(rayOrigin, rayDir, 0.0);
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
