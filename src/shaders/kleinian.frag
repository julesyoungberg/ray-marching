#version 300 es
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform int colorMode;
uniform vec3 knLightColor;
uniform vec3 knRotation;
uniform vec3 paletteColor1;
uniform vec3 paletteColor2;
uniform vec3 paletteColor3;
uniform float quality;
uniform vec2 resolution;
uniform vec3 shapeColor;
uniform bool spin;
uniform float time;

// ray marching
#define FRAME_OF_VIEW 1.0
#define MAX_RAY_LENGTH 20.0
#define MIN_HIT_DISTANCE 0.02
#define NUM_STEPS 99

@import ./util/calculateNormal;
@import ./util/castRay;
@import ./util/getRayData;
@import ./util/getUV;
@import ./util/hash;
@import ./util/lookAt;
@import ./util/randSeeded;
@import ./util/rotate;

// knighty's pseudo kleinian
float distFromNearest(in vec3 pos, inout vec3 mcol) {
    vec3 p = pos;
    const vec3 cSize = vec3(0.63248, 0.78632, 0.875);
    float factor = 1.0;

    mat4 rotationMatrix = createRotationMatrix(knRotation);

    for (int i = 0; i < 5; i++) {
        p = rotateVec(p, rotationMatrix);
        p = 2.0 * clamp(p, -cSize, cSize) - p;
        float k = max(0.70968 / dot(p, p), 1.0);
        p *= k;
        factor *= k;
    }

    if (mcol.r >= 0.0) {
        mcol += abs(p);
    }

    float rxy = length(p.xy);
    return max(rxy - 0.92784, abs(rxy * p.z) / length(p)) / factor;
}

float distFromNearest(in vec3 pos) {
    vec3 mcol = vec3(-1.0);
    return distFromNearest(pos, mcol);
}

vec3 getShapeColor(in vec3 p) {
    return shapeColor;
}

vec4 scene(in vec3 rayOrigin, in vec3 rayDir) {
    randSeed(gl_FragCoord.xy + time * 0.012);

    float pathSlider = 1.0;
    float pxl = 1.0 / min(resolution.x, resolution.y);
    vec3 ro = rayOrigin;
    vec3 lightPos = vec3(0.5, 0.5, 0);
    const float lightFactor = 40.0;
    vec3 p;
    vec3 rd = rayDir;
    
    lightPos.z += pathSlider;
    ro.z -= pathSlider;

    float dist = distFromNearest(ro) * 0.8;

    float totalDist = dist * rand();
    float nextDist = dist;
    float prevDist = 1.0;
    float fogDist = 0.0;

    vec4 color = vec4(0, 0, 0, 1);

    // stacks for hit alphas and dists
    vec4 alphaStack, distStack = vec4(-1);

    // ray march
    for (int i = 0; i < NUM_STEPS; i++) {
        if (nextDist > totalDist + fogDist) {
            // prepare for fog step
            p = ro + rd * (totalDist + fogDist);
            // sample the point on the plane z=0
            p += (lightPos - p) * (-p.z) / (lightPos.z - p.z);
        } else {
            // regular march
            p = ro + rd * totalDist;
        }

        dist = distFromNearest(p);

        if (nextDist > totalDist + fogDist) {
            // step through the fog and light it up
            float lightDist = 0.05 * length(ro + rd * (totalDist + fogDist) - lightPos);
            color.rgb += color.a * knLightColor * exp(-lightDist * lightFactor) * smoothstep(0.0, 0.01, dist);

            if (totalDist + fogDist + lightDist > nextDist) {
                fogDist = 0.0;
                totalDist = nextDist;

                if (totalDist > MAX_RAY_LENGTH) {
                    break;
                }
            } else {
                fogDist += lightDist;
            }
        } else {
            // save edge samples and march
            // if the current dist is less than prev, and the stack is not full
            if (dist < prevDist && distStack.w < 0.0) {
                float alpha = clamp(dist / (pxl * totalDist), 0.0, 1.0);
                if (alpha < 0.95) {
                    alphaStack = vec4(alpha, alphaStack.xyz);
                    distStack = vec4(totalDist, distStack.xyz);
                    color.a *= alpha;
                }
            }

            prevDist = dist;
            nextDist = totalDist + dist; // * (0.6 + 0.2 * rand());
        }
    }

    vec3 tcol = vec3(0.0);
    vec3 mcol;
    
    // now pop each hit and compute the surface color with volumetric lighting
    for (int i = 0; i < 4; i++) {
        if (distStack.x < 0.0) {
            continue;
        }

        mcol = vec3(0);
        p = ro + rd * distStack.x;

        vec3 N = calculateNormal(p);
        vec3 L = lightPos - p;
        vec3 scol;

        mcol = sin(mcol) * 0.3 + getShapeColor(p);
        float ls = exp(-dot(L, L) * 0.2);

        p += L * (-p.z) / L.z;
        L = normalize(L);
        scol = ls * mcol * max(0.0, dot(N, L));

        float v = max(0.0, dot(N, L));
        scol += exp(-totalDist) * mcol * v;
        dist = smoothstep(0.0, 0.005, distFromNearest(p, mcol));
        scol += ls * max(0.0, dot(N, L)) * dist * vec3(2, 2, 1.7);

        if (rd.z < 0.0 && dist > 0.0) {
            scol += ls * pow(max(0.0, dot(reflect(rd, N), L)), 5.0) * (1.0 - 0.25 * v) * dist * vec3(4, 3, 1.4);
        }

        tcol = mix(scol, tcol, alphaStack.x);
        alphaStack = alphaStack.yzwx;
        distStack = distStack.yzwx;
    }

    color.rgb = clamp(color.rgb + tcol, 0.0, 1.0);
    return vec4(color.rgb, totalDist);
}

void main() {
    const vec3 camPos = vec3(1.0, 0.0, 0.0);
    const vec3 camTarget = vec3(0);
    const vec3 worldUp = vec3(0, 0, 1);
    const float zoom = 1.0;

    vec4 color = vec4(0, 0, 0, 1);
    vec4 finalColor = vec4(0, 0, 0, 1);
    vec2 currentUV = uv;
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
            getRayData(currentUV, camPos, camTarget, time, worldUp, rayOrigin, rayDir);
        } else {
            rayOrigin = camPos;
            rayDir = lookAt(camTarget - camPos, worldUp) * normalize(vec3(currentUV, 1));
        }

        color = scene(rayOrigin, rayDir);
        finalColor = mix(finalColor, color, 1.0 / i);
    }

    fragColor = finalColor;
}
