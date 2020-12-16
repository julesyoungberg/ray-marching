#version 300 es
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform vec2 mousePosition;
uniform vec2 resolution;
uniform float time;

@import ./primitives/sdBox;
@import ./primitives/sdSphere;
@import ./util/config;
@import ./util/calculateNormal;
@import ./util/calculateShading;
@import ./util/castRay;
@import ./util/getReflectionAmount;
@import ./util/getShadowMultiplier;
@import ./util/getSmoothSurfaceColor;
@import ./util/getSurfaceColor;
@import ./util/getUV;
@import ./util/hash;
@import ./util/rand;
@import ./util/rayMarch;

const float REFLECTIVITY = 0.3;
const float TRANSMITTANCE = 0.4;
const int MAX_RAY_BOUNCES = 3;
const vec3 OBJECT_ABSORB = vec3(0.4, 0.2, 0.0); // for beers law
const float REFRACTIVE_INDEX_OUTSIDE = 1.00029;
const float REFRACTIVE_INDEX_INSIDE = 1.07;

const float sphereRadius = 3.0;
const vec3 spherePos = vec3(10.0, sphereRadius, 10.0);
const vec3 boxPos = vec3(17.0, sphereRadius / 3.0, 10.0);

float distFromWalls(in vec3 p) {
    float s = 40.0;
    float x = min(p.x, s - p.x);
    float y = min(p.y, s - p.y);
    float z = min(p.z, s - p.z);
    return min(x, min(y, z));
}

float sphere1(in vec3 p) { return sdSphere(p, spherePos, sphereRadius); }

float box1(in vec3 p) { return sdBox(p - boxPos, vec3(sphereRadius / 3.0)); }

float distFromNearest(in vec3 p) {
    return min(distFromWalls(p), min(sphere1(p), box1(p)));
}

vec3 getWallColor(in vec3 position) {
    const float scale = 0.5;
    vec3 p = position * scale;
    float total = floor(p.x) + floor(p.y) + floor(p.z);
    bool isEven = mod(total, 2.0) == 0.0;
    return mix(vec3(0.4), vec3(0.9), float(isEven));
}

vec3 calculateColorWithoutReflections(in vec3 position, in vec3 normal, in vec3 eyePos, in vec3 lightPos) {
    bool isWall = distFromWalls(position) < MIN_HIT_DISTANCE;
    bool isSphere = sphere1(position) < MIN_HIT_DISTANCE;

    vec3 color;
    vec3 specColor;
    if (isWall) {
        color = getWallColor(position);
        specColor = color;
    } else if (isSphere) {
        color = vec3(1, 1, 1);
        specColor = vec3(0.9);
    } else {
        color = vec3(1, 0, 0);
        specColor = vec3(0.8);
    }

    vec3 finalColor = calculateShading(position, normal, eyePos, lightPos, color, specColor);

    return finalColor;
}

vec3 calculateReflection(in vec3 position, in vec3 normal, in vec3 eyePos, in vec3 lightPos) {
    vec3 incident = normalize(position - eyePos);
    vec3 reflected = reflect(incident, normal);
    vec3 rayStart = position + reflected * 0.02;

    float dist = rayMarch(rayStart, reflected);
    if (dist < 0.0) {
        return vec3(0);
    }

    vec3 surfacePos = rayStart + reflected * dist;
    vec3 surfaceNormal = calculateNormal(surfacePos);
    vec3 color = calculateColorWithoutReflections(surfacePos, surfaceNormal, eyePos, lightPos);
    return color;
}

// bounce around inside the object reflecting and transmitting / refracting the ray
// https://blog.demofox.org/2017/01/09/raytracing-reflection-refraction-fresnel-total-internal-reflection-and-beers-law/
// https://www.shadertoy.com/view/4tyXDR
vec3 calculateTransmitted(in vec3 position, in vec3 normal, in vec3 eyePos, in vec3 lightPos) {
    float multiplier = 1.0;
    vec3 result = vec3(0.0);
    float absorbDistance = 0.0;

    vec3 rayPos = position;
    vec3 rayDir = normalize(position - eyePos);
    rayDir = refract(rayDir, normal, REFRACTIVE_INDEX_OUTSIDE / REFRACTIVE_INDEX_INSIDE);
    rayPos += rayDir * 0.01; // make sure the ray goes through the object

    for (int i = 0; i < MAX_RAY_BOUNCES; i++) {
        float dist = rayMarchInternal(rayPos, rayDir);
        if (dist < 0.0) {
            return vec3(1, 0, 0);
        }

        vec3 prevPos = rayPos;
        rayPos += rayDir * dist;
        vec3 currentNormal = -calculateNormal(rayPos + rayDir * 0.01);

        // calculate beer's law absorption.
        absorbDistance += dist;
        vec3 absorb = exp(-OBJECT_ABSORB * absorbDistance);

        // calculate how much to reflect or transmit (refract or diffuse)
        float reflectAmount = getReflectionAmount(REFRACTIVE_INDEX_INSIDE, REFRACTIVE_INDEX_OUTSIDE, rayDir, currentNormal, REFLECTIVITY);
        float refractAmount = 1.0 - reflectAmount;

        // refract the internal ray and raymarch to find the outside color
        vec3 refractDir = refract(rayDir, currentNormal, REFRACTIVE_INDEX_INSIDE / REFRACTIVE_INDEX_OUTSIDE);
        vec3 refractOrg = rayPos + refractDir * 0.01;
        float refractDist = rayMarch(refractOrg, refractDir);
        vec3 refractColor = vec3(0);
        if (refractDist >= 0.0) {
            vec3 surfacePos = refractOrg + refractDist * refractDir;
            vec3 surfaceNormal = calculateNormal(surfacePos);
            refractColor = calculateColorWithoutReflections(surfacePos, surfaceNormal, refractOrg, lightPos);
        }
        result += refractColor * refractAmount * multiplier * absorb;

        // add specular highlight based on refracted ray direction
        result += calculateShading(rayPos, refractDir, prevPos, lightPos, vec3(0)) * refractAmount * multiplier; // * absorb;

        // follow the ray down the internal reflection path.
        rayDir = reflect(rayDir, currentNormal);
        rayPos += rayDir * 0.01;

        multiplier *= reflectAmount;
    }

    return result;
}

vec3 calculateSphereColor(in vec3 position, in vec3 normal, in vec3 eyePos, in vec3 lightPos, in vec3 color) {
    vec3 finalColor = color;
    float weightSum = 0.0;
    vec3 contribution = vec3(0.0);
    vec3 incident = normalize(position - eyePos);
    float reflectAmount = getReflectionAmount(REFRACTIVE_INDEX_OUTSIDE, REFRACTIVE_INDEX_INSIDE, normal, incident, REFLECTIVITY);
    float refractAmount = 1.0 - reflectAmount;

    if (REFLECTIVITY > 0.0) {
        vec3 reflection = calculateReflection(position, normal, eyePos, lightPos) * reflectAmount;
        weightSum += REFLECTIVITY;
        contribution += reflection * REFLECTIVITY;
    }

    if (TRANSMITTANCE > 0.0) {
        vec3 transmitted = calculateTransmitted(position, normal, eyePos, lightPos) * refractAmount;
        weightSum += TRANSMITTANCE;
        contribution += transmitted * TRANSMITTANCE;
    }

    finalColor = finalColor * (1.0 - weightSum) + contribution;

    return finalColor;
}

vec3 calculateColor(in vec3 position, in vec3 normal, in vec3 eyePos) {
    vec3 lightPos = vec3(20.0, 25.0, 20.0);
    bool isSphere = sphere1(position) < MIN_HIT_DISTANCE;

    vec3 finalColor = calculateColorWithoutReflections(position, normal, eyePos, lightPos);

    if (isSphere) {
        finalColor = calculateSphereColor(position, normal, eyePos, lightPos, finalColor);
    }

    return finalColor;
}

void main() {
    vec3 camPos = vec3(20.0, 5.0, 15.0);
    const vec3 lookAt = spherePos;
    const float zoom = 1.0;

    vec3 finalColor = getSmoothSurfaceColor(gl_FragCoord.xy, resolution, camPos, lookAt, zoom, vec3(0), 2);

    fragColor = vec4(finalColor, 1.0);
}
