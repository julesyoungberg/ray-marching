// From 0 to 2 (highest)
#define QUALITY 1
// If 1 when ray will hit some SDF, it's ID will be returned. That give us
// ability to (among others) use cumulative soft shadows (soft shadows from more
// than one objects)
#define USE_SDF_IDS 0
// If 1 simple positions of SDF will be used instead of complex matrix
// transformations. Beside that in SDF struct there is additional place for SDF
// position.
#define USE_SIMPLE_SDF_POSITIONS 1

// Max length of the ray used in basic ray marching (depends on size of the
// biggest SDF)
#define MAX_RAY_LENGTH 22.
#define RAY_ORIGIN vec3(11.0, 5., 11.0)
// If distance from point to SDF shape is smaller that this, we assume ray
// hittted something
#define MIN_DISTANCE_TO_ASSUME_RAY_HIT .01

#define CAMERA_MOVEMENT_SPEED -20.
#define CAMERA_INV_DISTANCE_MULTIPLIER 4.

#define BACKGROUND_COLOR (vec3(40., 80., 126.) / 255.)

#define FLOOR_FIRST_COLOR vec3(0.9)
#define FLOOR_SECOND_COLOR vec3(0.6)
#define FLOOR_Z_POSITION -1.8
#define FLOOR_NORMAL vec3(0., 1., 0.)
#define FLOOR_START_FADING_EDGE 25.
#define FLOOR_STOP_FADING_EDGE 50.

// How many samplings ambient occlusion will have
#define AO_STEPS_NUMBER 5.
// How far from hit point first step of ambient occlusion needs to be performed
#define AO_FIRST_STEP_DISTANCE_FROM_HIT_POINT 0.005
// Value of distance between all AO steps
#define AO_DISTANCE_BETWEEN_STEPS 0.02
// How much weight of each step changes
#define AO_EACH_STEP_WEIGHT_MODIFIER 0.95
// Multiplier of AO effect
#define AO_STRENGTH 3.
#define AO_INTENSITY 0.99

#define REFLECTIONS_INTENSITY 0.2

#define SHADOW_INTENSITY 0.9
// How soft soft-shadows will be
#define PENUMBRA_FACTOR 128.

#define LIGHT_COLOR vec3(1., 1., 1.)
#define LIGHT_POSITION (vec3(10., 50., 40.) * 0.2)

#define MATERIAL_SHININESS 4.
#define MATERIAL_AMBIENT_STRENGTH 0.04
#define MATERIAL_DIFFUSE_STRENGTH 0.8
#define MATERIAL_SPECULAR_STRENGTH 0.6

// How smooth SDF union will be
#define SDF_UNION_SMOOTHNESS 16.

////////////////////////////////////////////// END OF CHANGEABLE CODE

#define EPSILON 1e-5
#define PI 3.1416

// To start calculate soft shadows of given point, we're taking hit point and
// move it by this value in direction of the light source
#define DISTANCE_FROM_HIT_POINT_TO_START_CALCULATE_SHADOW 1e-2
// To start calculate reflections of given point, we're taking hit point and
// move it by this value in direction of reflected camera direction
#define REFLECTIONS_DISTANCE_FROM_HIT_POINT_TO_START_CALCULATE 1e-2
// Value used when we want to show that calculated distance is invalid
#define INVALID_DISTANCE -1.

const vec2[] ALL_MSAA_SAMPLE_POINTS =
    vec2[](vec2(6. / 16., 2. / 16.), vec2(14. / 16., 6. / 16.),
           vec2(2. / 16., 10. / 16.), vec2(10. / 16., 14. / 16.));

////////////////////////////////////////////// Basic SDF functions

struct SDFSphereData {
#if USE_SIMPLE_SDF_POSITIONS == 1
    vec3 position;
#endif
    float radius;
    vec3 color;
#if USE_SDF_IDS == 1
    int id;
#endif
};

struct SDFBoxData {
#if USE_SIMPLE_SDF_POSITIONS == 1
    vec3 position;
#endif
    vec3 size;
    vec3 color;
#if USE_SDF_IDS == 1
    int id;
#endif
};

struct SDFCylinderData {
#if USE_SIMPLE_SDF_POSITIONS == 1
    vec3 position;
#endif
    float height;
    float radius;
    vec3 color;
#if USE_SDF_IDS == 1
    int id;
#endif
};

float getDistanceToSphereSDF(vec3 pointWS, const vec3 spherePosition,
                             const float sphereRadius) {
#if USE_SIMPLE_SDF_POSITIONS == 1
    pointWS -= spherePosition;
#endif
    return length(pointWS) - sphereRadius;
}

float getDistanceToSphereSDF(vec3 pointWS, const SDFSphereData sphereData) {
    return getDistanceToSphereSDF(pointWS,
#if USE_SIMPLE_SDF_POSITIONS == 1
                                  sphereData.position,
#else
                                  vec3(0.),
#endif
                                  sphereData.radius);
}

float getDistanceToBoxSDF(vec3 pointWS, const vec3 boxPosition,
                          const vec3 boxSize) {
#if USE_SIMPLE_SDF_POSITIONS == 1
    pointWS -= boxPosition;
#endif
    vec3 boxHalfSize = boxSize / 2.;
    vec3 distanceToBox = abs(pointWS) - boxHalfSize;
    return length(max(distanceToBox, 0.0)) +
           min(max(distanceToBox.x, max(distanceToBox.y, distanceToBox.z)),
               0.0);
}

float getDistanceToBoxSDF(vec3 pointWS, const SDFBoxData boxData) {
    return getDistanceToBoxSDF(pointWS,
#if USE_SIMPLE_SDF_POSITIONS == 1
                               boxData.position,
#else
                               vec3(0.),
#endif
                               boxData.size);
}

float getDistanceToCylinderSDF(vec3 pointWS, const vec3 cylinderPosition,
                               const float cylinderHeight,
                               const float cylinderRadius) {
#if USE_SIMPLE_SDF_POSITIONS == 1
    pointWS -= cylinderPosition;
#endif
    float halfHeight = cylinderHeight * 0.5;
    vec2 distanceToCylinder = abs(vec2(length(pointWS.xz), pointWS.y)) -
                              vec2(cylinderRadius, halfHeight);
    return min(max(distanceToCylinder.x, distanceToCylinder.y), 0.0) +
           length(max(distanceToCylinder, 0.0));
}

float getDistanceToCylinderSDF(vec3 pointWS,
                               const SDFCylinderData cylinderData) {
    return getDistanceToCylinderSDF(pointWS,
#if USE_SIMPLE_SDF_POSITIONS == 1
                                    cylinderData.position,
#else
                                    vec3(0.),
#endif
                                    cylinderData.height, cylinderData.radius);
}

////////////////////////////////////////////// Functions to
/// intersect/unite/substract different SDF

float getSDFBlend(const float distanceA, const vec3 distanceAColor,
                  const int distanceASDFId, const float distanceB,
                  const vec3 distanceBColor, const int distanceBSDFId,
                  const float blendValue, out vec3 resultColor,
                  out int resultSDFId) {
    float resultDistance = mix(distanceA, distanceB, blendValue);
    resultColor = mix(distanceAColor, distanceBColor, blendValue);
#if USE_SDF_IDS == 1
    if (abs(resultDistance - distanceA) < abs(resultDistance - distanceB))
        resultSDFId = distanceASDFId;
    else
        resultSDFId = distanceBSDFId;
#endif
    return resultDistance;
}

float getSDFBlend(const float distanceA, const vec3 distanceAColor,
                  const float distanceB, const vec3 distanceBColor,
                  const float blendValue, out vec3 resultColor) {
    int dummyResultSDFId;
    return getSDFBlend(distanceA, distanceAColor, 0, distanceB, distanceBColor,
                       0, blendValue, resultColor, dummyResultSDFId);
}

float getSDFIntersection(const float distanceA, const vec3 distanceAColor,
                         const int distanceASDFId, const float distanceB,
                         const vec3 distanceBColor, const int distanceBSDFId,
                         out vec3 resultColor, out int resultSDFId) {
    if (max(distanceA, distanceB) == distanceA) {
        resultColor = distanceAColor;
        resultSDFId = distanceASDFId;
        return distanceA;
    }
    resultColor = distanceBColor;
    resultSDFId = distanceBSDFId;
    return distanceB;
}

float getSDFIntersection(const float distanceA, const vec3 distanceAColor,
                         const float distanceB, const vec3 distanceBColor,
                         out vec3 resultColor) {
    int dummyResultSDFId;
    return getSDFIntersection(distanceA, distanceAColor, 0, distanceB,
                              distanceBColor, 0, resultColor, dummyResultSDFId);
}

float getSDFUnion(const float distanceA, const vec3 distanceAColor,
                  const int distanceASDFId, const float distanceB,
                  const vec3 distanceBColor, const int distanceBSDFId,
                  const bool useSmoothness, out vec3 resultColor,
                  out int resultSDFId) {
    bool distanceAIsCloser = false;
    float resultDistance;
    if (useSmoothness) {
        float res = exp(-SDF_UNION_SMOOTHNESS * distanceA) +
                    exp(-SDF_UNION_SMOOTHNESS * distanceB);
        resultDistance = -log(max(EPSILON, res)) / SDF_UNION_SMOOTHNESS;
        distanceAIsCloser =
            abs(resultDistance - distanceA) < abs(resultDistance - distanceB);
    } else {
        resultDistance = min(distanceA, distanceB);
        distanceAIsCloser = resultDistance == distanceA;
    }

    if (distanceAIsCloser) {
        resultColor = distanceAColor;
        resultSDFId = distanceASDFId;
    } else {
        resultColor = distanceBColor;
        resultSDFId = distanceBSDFId;
    }
    return resultDistance;
}

float getSDFUnion(const float distanceA, const vec3 distanceAColor,
                  const float distanceB, const vec3 distanceBColor,
                  const bool useSmoothness, out vec3 resultColor) {
    int dummyResultSDFId;
    return getSDFUnion(distanceA, distanceAColor, 0, distanceB, distanceBColor,
                       0, useSmoothness, resultColor, dummyResultSDFId);
}

float getSDFDifference(const float distanceA, const vec3 distanceAColor,
                       const int distanceASDFId, const float distanceB,
                       const vec3 distanceBColor, const int distanceBSDFId,
                       out vec3 resultColor, out int resultSDFId) {
    // Difference is just a intersection between shape A and inversion of shape
    // B
    return getSDFIntersection(distanceA, distanceAColor, distanceASDFId,
                              -distanceB, distanceBColor, distanceBSDFId,
                              resultColor, resultSDFId);
}

float getSDFDifference(const float distanceA, const vec3 distanceAColor,
                       const float distanceB, const vec3 distanceBColor,
                       out vec3 resultColor) {
    // Difference is just a intersection between shape A and inversion of shape
    // B
    return getSDFIntersection(distanceA, distanceAColor, -distanceB,
                              distanceBColor, resultColor);
}

////////////////////////////////////////////// Functions which helps with
/// creating matrix that
// can help with rotating/moving SDF

mat4 createTranslationMatrix(vec3 position) {
    mat4 translationMatrix =
        mat4(vec4(1., 0., 0., 0.), vec4(0., 1., 0., 0.), vec4(0., 0., 1., 0.),
             vec4(position.x, position.y, position.z, 1.));
    return translationMatrix;
}

mat4 createRotationMatrix(vec3 rotationEuler) {
    // Input is in degrees, but to calculate everything property we need radians
    vec3 rotationTheta = rotationEuler * (PI / 180.);

    vec3 cosTheta = cos(rotationTheta);
    vec3 sinTheta = sin(rotationTheta);

    mat4 rotateAroundXMatrix =
        mat4(vec4(1., 0., 0., 0.), vec4(0., cosTheta.x, sinTheta.x, 0.),
             vec4(0., -sinTheta.x, cosTheta.x, 0.), vec4(0., 0., 0., 1.));
    mat4 rotateAroundYMatrix =
        mat4(vec4(cosTheta.y, 0., -sinTheta.y, 0.), vec4(0., 1., 0., 0.),
             vec4(sinTheta.y, 0., cosTheta.y, 0.), vec4(0., 0., 0., 1.));
    mat4 rotateAroundZMatrix = mat4(vec4(cosTheta.z, sinTheta.z, 0., 0.),
                                    vec4(-sinTheta.z, cosTheta.z, 0., 0.),
                                    vec4(0., 0., 1., 0.), vec4(0., 0., 0., 1.));
    // Order of multiplication is crucial!
    mat4 rotationMatrix =
        rotateAroundZMatrix * rotateAroundYMatrix * rotateAroundXMatrix;

    return rotationMatrix;
}

// Creates classic matrix which translates and then rotates
mat4 createTransformationMatrix(vec3 position, vec3 rotationEuler) {
    mat4 translationMatrix = createTranslationMatrix(position);
    mat4 rotationMatrix = createRotationMatrix(rotationEuler);

    // Scale in case of ray marching needs to be applied in slightly different
    // way, because result of getDistance function needs to be modified. So
    // we're not adding scale matrix

    // Order of multiplication is crucial!
    mat4 transformationMatrix =
        rotationMatrix * translationMatrix; // * scaleMatrix;
    return transformationMatrix;
}

// Creates matrix which rotates around given point
mat4 createRotateAroundPointMatrix(vec3 point, vec3 rotationEuler) {
    // When rotating around a point we need to use two translation matrices
    mat4 translationMatrix = createTranslationMatrix(point);
    mat4 secTranslationMatrix = createTranslationMatrix(-point);
    mat4 rotationMatrix = createRotationMatrix(rotationEuler);

    return translationMatrix * rotationMatrix * secTranslationMatrix;
}

////////////////////////////////////////////// Function which creates basic ray

void getRayData(const vec2 screenCoord, const vec3 iResolution,
                const float iTime, out vec3 rayOrigin, out vec3 rayDir) {
    vec2 screenUV = screenCoord / iResolution.xy;
    vec2 screenPos = 2. * screenUV - 1.;
    screenPos.x *= iResolution.x / iResolution.y;

    rayOrigin = RAY_ORIGIN;
    vec3 rayTargetPoint = vec3(0.);

    // We want to move camera around center of the scene
    float cameraAngle = iTime * CAMERA_MOVEMENT_SPEED;
    mat4 rotateCameraMatrix =
        createRotateAroundPointMatrix(vec3(0.), vec3(0., cameraAngle, 0.));
    rayOrigin = (rotateCameraMatrix * vec4(rayOrigin, 1.)).xyz;

    vec3 worldUp = vec3(0., 1., 0.);
    vec3 cameraForward = normalize(rayTargetPoint - rayOrigin);
    vec3 cameraRight = normalize(cross(cameraForward, worldUp));
    vec3 cameraUp = normalize(cross(cameraRight, cameraForward));
    mat3 cameraMatrix = mat3(cameraRight, cameraUp, cameraForward);

    rayDir = normalize(cameraMatrix *
                       vec3(screenPos, CAMERA_INV_DISTANCE_MULTIPLIER));
}