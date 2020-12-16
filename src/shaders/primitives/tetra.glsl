////////////////////////////////////////////// START OF CHANGEABLE CODE

#define TETRAHEDRON_ITERATIONS_NUMBER 10
#define TETRAHEDRON_SIZE 2.2
#define TETRAHEDRON_COLOR vec3(1., 0., 0.)

void updateClosestVertex(inout float distanceToClosestVertex,
                         inout vec3 closestVertex, const vec3 pointInLoop,
                         const vec3 curVertex) {
    float distanceToCurVertex = length(pointInLoop - curVertex);
    if (distanceToCurVertex < distanceToClosestVertex) {
        distanceToClosestVertex = distanceToCurVertex;
        closestVertex = curVertex;
    }
}

float getDistance(const vec3 pointWS, out vec3 colorInMinDistance,
                  out int idOfHitSDF) {
    const vec3 firstVertex = vec3(1., 1., 1.) * TETRAHEDRON_SIZE;
    const vec3 secondVertex = vec3(-1., -1., 1.) * TETRAHEDRON_SIZE;
    const vec3 thirdVertex = vec3(1., -1., -1.) * TETRAHEDRON_SIZE;
    const vec3 fourthVertex = vec3(-1., 1., -1.) * TETRAHEDRON_SIZE;

    mat4 rot = createRotationMatrix(vec3(35., 0., -45.));

    vec3 pointInLoop = (rot * vec4(pointWS, 1.)).xyz;
    float distanceToClosestVertex;
    ;
    int i;
    for (i = 0; i < TETRAHEDRON_ITERATIONS_NUMBER; i++) {
        // We search for a closest vertex
        vec3 closestVertex = firstVertex;
        distanceToClosestVertex = length(pointInLoop - firstVertex);
        updateClosestVertex(distanceToClosestVertex, closestVertex, pointInLoop,
                            secondVertex);
        updateClosestVertex(distanceToClosestVertex, closestVertex, pointInLoop,
                            thirdVertex);
        updateClosestVertex(distanceToClosestVertex, closestVertex, pointInLoop,
                            fourthVertex);

        // We're increasing world 2 times and moves in the direction of closest
        // vertex
        pointInLoop = 2. * pointInLoop - closestVertex;
    }

    colorInMinDistance = TETRAHEDRON_COLOR;
    // At this point world has been increased TETRAHEDRON_ITERATIONS_NUMBER
    // times, so to returns correct distance we need to decrease it the same
    // amount of times
    return length(pointInLoop) * pow(2., float(-i));
}

////////////////////////////////////////////// END OF CHANGEABLE CODE

float getDistance(const vec3 pointWS) {
    vec3 dummyColor;
    int dummyIdOfSDF;
    return getDistance(pointWS, dummyColor, dummyIdOfSDF);
}

// Basic ray march - returns distance to closest SDF object
float marchRayBasic(const vec3 rayOrigin, const vec3 rayDir,
                    const float distanceFromRayOrigin, out vec3 hitPointColor,
                    out int hitPointSDFId) {
    for (float distanceTraveledSoFar = distanceFromRayOrigin;
         distanceTraveledSoFar < MAX_RAY_LENGTH;) {
        vec3 hitPoint = rayOrigin + rayDir * distanceTraveledSoFar;
        float curPointDistance =
            getDistance(hitPoint, hitPointColor, hitPointSDFId);
        if (curPointDistance < MIN_DISTANCE_TO_ASSUME_RAY_HIT)
            return distanceTraveledSoFar;
        distanceTraveledSoFar += curPointDistance;
    }
    return INVALID_DISTANCE;
}

// Returns distance from ray origin to floor, also returns checkerboarded color
// in hit point
float calculateFloorColor(const vec3 rayDir, const vec3 rayOrigin,
                          out vec3 checkerboardColor) {
    // Floor is always directed up
    vec3 floorPlaneNormal = FLOOR_NORMAL;
    vec3 floorPlaneCenter = vec3(0., FLOOR_Z_POSITION, 0.);

    float angle = dot(floorPlaneNormal, rayDir);
    // If floor and ray are not parallel
    if (angle < -EPSILON) {
        // Some math to calculate intersection point between plane and ray
        vec3 floorRayOriginVec = rayOrigin - floorPlaneCenter;
        float distanceToIntersectionPoint =
            -dot(floorRayOriginVec, floorPlaneNormal) /
            dot(rayDir, floorPlaneNormal);
        vec3 hitPoint = rayOrigin + distanceToIntersectionPoint * rayDir;

        // Checkerboard index of calculated intersection point
        ivec3 hitPointCheckerboardIndex =
            ivec3(greaterThanEqual(mod(hitPoint, 2.), vec3(1.)));
        checkerboardColor =
            bool(hitPointCheckerboardIndex.x ^ hitPointCheckerboardIndex.z)
                ? FLOOR_FIRST_COLOR
                : FLOOR_SECOND_COLOR;

        return distanceToIntersectionPoint;
    }

    // Ray hasn't hit floor
    return INVALID_DISTANCE;
}

vec3 calculateBackgroundColor(const vec2 fragCoord) {
    vec2 screenUV = fragCoord / iResolution.xy;
    return BACKGROUND_COLOR * smoothstep(1., 0., abs(.5 - screenUV.y));
}

vec3 calculateNormal(const vec3 hitPoint) {
    float normalX = getDistance(hitPoint + vec3(EPSILON, 0., 0.)) -
                    getDistance(hitPoint - vec3(EPSILON, 0., 0.));
    float normalY = getDistance(hitPoint + vec3(0., EPSILON, 0.)) -
                    getDistance(hitPoint - vec3(0., EPSILON, 0.));
    float normalZ = getDistance(hitPoint + vec3(0., 0., EPSILON)) -
                    getDistance(hitPoint - vec3(0., 0., EPSILON));
    return normalize(vec3(normalX, normalY, normalZ));
}

vec3 calculatePhong(const vec3 rayDir, const vec3 hitPoint,
                    const vec3 hitNormal, const vec3 hitPointColor) {
    float ambientValue = MATERIAL_AMBIENT_STRENGTH;

    vec3 invLightDir = normalize(LIGHT_POSITION - hitPoint);
    float ndotl = max(dot(hitNormal, invLightDir), 0.);
    float diffuseValue = MATERIAL_DIFFUSE_STRENGTH * ndotl;

    vec3 reflectDir = reflect(invLightDir, hitNormal);
    float vdotr = max(dot(rayDir, reflectDir), 0.);
    float specularValue =
        MATERIAL_SPECULAR_STRENGTH * pow(vdotr, MATERIAL_SHININESS);

    vec3 resultColor = (ambientValue + diffuseValue + specularValue) *
                       LIGHT_COLOR * hitPointColor;
    return resultColor;
}

float calculateShadow(const vec3 hitPoint, const vec3 hitNormal) {
    vec3 rayDir = normalize(LIGHT_POSITION - hitPoint);
    // Affects maximum number of ray marching iterations (we don't want to
    // calculate shader behind the light)
    float distanceToLight = length(LIGHT_POSITION - hitPoint);
    float rayDotNormal = dot(rayDir, hitNormal);

    // Accumulated soft shadows factor from all objects close enough to ray
    float accumulatedSoftShadowsFactor = 1.;
    // Used in loop to store value of minimum soft shadows factor of single
    // object at ray's line
    float minSoftShadowsFactor = 1.;
    // Stores id of SDF which was the closest to ray in previous frames
    int idOfPreviouslyClosestSDF = -1;

    // Ray from hit point to light position
    for (float distanceTraveledSoFar =
             DISTANCE_FROM_HIT_POINT_TO_START_CALCULATE_SHADOW;
         distanceTraveledSoFar < distanceToLight;) {
        vec3 rayMarchPoint = hitPoint + rayDir * distanceTraveledSoFar;
        vec3 rayMarchPointColor;
        int rayMarchPointSDFId;
        float rayMarchPointDistance =
            getDistance(rayMarchPoint, rayMarchPointColor, rayMarchPointSDFId);

        // If shadow ray hit something we want to have full shade
        if (rayMarchPointDistance < MIN_DISTANCE_TO_ASSUME_RAY_HIT) {
            // Light is occluded by some objects, so we don't want soft shadows
            accumulatedSoftShadowsFactor = 0.;
            break;
        }

        // Soft shadows factor of SDF identified by id idOfHitSDF
        float curSoftShadowsFactor =
            PENUMBRA_FACTOR * rayMarchPointDistance / distanceTraveledSoFar;

        // We're constantly moving toward the light source
        distanceTraveledSoFar += rayMarchPointDistance;

#if USE_SDF_IDS == 1
        // If ID of closest SDF changes we need to reset min soft shadows factor
        if (idOfPreviouslyClosestSDF != rayMarchPointSDFId) {
            accumulatedSoftShadowsFactor *= minSoftShadowsFactor;
            minSoftShadowsFactor = 1.;
            idOfPreviouslyClosestSDF = rayMarchPointSDFId;
        }
#endif

        minSoftShadowsFactor = min(minSoftShadowsFactor, curSoftShadowsFactor);
    }

    accumulatedSoftShadowsFactor *= minSoftShadowsFactor;

    float shadowFactor = clamp(rayDotNormal * accumulatedSoftShadowsFactor,
                               1. - SHADOW_INTENSITY, 1.);
    return shadowFactor;
}

float calculateAmbientOcclusion(const vec3 hitPoint, const vec3 hitNormal) {
    float ambientOcclusionValue = 0.;
    // Weight of first step is 1.
    float curWeight = 1.;
    for (float i = 0.; i < AO_STEPS_NUMBER; i++) {
        float distanceFromHitPoint = AO_FIRST_STEP_DISTANCE_FROM_HIT_POINT +
                                     AO_DISTANCE_BETWEEN_STEPS * i;
        vec3 aoPosition = hitPoint + hitNormal * distanceFromHitPoint;
        float aoDistance = getDistance(aoPosition);
        float aoValueInStep = (distanceFromHitPoint - aoDistance) * curWeight;
        ambientOcclusionValue += aoValueInStep;
        curWeight *= AO_EACH_STEP_WEIGHT_MODIFIER;
    }
    ambientOcclusionValue *= AO_STRENGTH;
    float result = clamp(1. - ambientOcclusionValue, 1. - AO_INTENSITY, 1.);
    return result;
}

vec3 calculateReflections(const vec3 hitPoint, const vec3 hitNormal,
                          const vec3 hitPointColorSoFar, const vec3 baseRayDir,
                          const vec3 backgroundColor) {
    vec3 reflectionRayDir = normalize(reflect(baseRayDir, hitNormal));
    vec3 reflectionResultColor, reflectionHitPointColor;
    int reflectionHitSDFId;
    float distanceToReflectionRayHit =
        marchRayBasic(hitPoint, reflectionRayDir,
                      REFLECTIONS_DISTANCE_FROM_HIT_POINT_TO_START_CALCULATE,
                      reflectionHitPointColor, reflectionHitSDFId);
    // If we haven't hit anything, we just hit sky
    if (distanceToReflectionRayHit == INVALID_DISTANCE)
        reflectionResultColor = backgroundColor;
    else {
        vec3 reflectionHitPoint =
            hitPoint + reflectionRayDir * distanceToReflectionRayHit;
        vec3 reflectionHitPointNormal = calculateNormal(reflectionHitPoint);
        reflectionResultColor =
            calculatePhong(reflectionRayDir, reflectionHitPoint,
                           reflectionHitPointNormal, reflectionHitPointColor);
        reflectionResultColor *=
            calculateShadow(reflectionHitPoint, reflectionHitPointNormal);
    }
    // We want reflections only on floor, so if we're not on floor our
    // reflection color is hit point color so far (reflection color won't break
    // below mix instruction)
    return mix(hitPointColorSoFar, reflectionResultColor,
               REFLECTIONS_INTENSITY);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec3 resultColor;
#if QUALITY >= 2
    // Sum of colors sampled by MSAA
    vec3 allResultColors = vec3(0.);
    for (int i = ALL_MSAA_SAMPLE_POINTS.length() - 1; i >= 0; i--) {
        fragCoord = trunc(fragCoord) + ALL_MSAA_SAMPLE_POINTS[i];
#endif
        // Color of the background - used when nothing else hasn't been hit
        vec3 backgroundColor = calculateBackgroundColor(fragCoord);

        // Data of our main ray
        vec3 rayOrigin, rayDir;
        getRayData(fragCoord, iResolution, iTime, rayOrigin, rayDir);

        // Result of our main ray
        vec3 hitPointColor;
        int hitPointIdOfSDF;
        float distanceToHitPoint = marchRayBasic(
            rayOrigin, rayDir, 0., hitPointColor, hitPointIdOfSDF);
        vec3 hitPoint = rayOrigin + rayDir * distanceToHitPoint;

        vec3 hitPointNormal = FLOOR_NORMAL;
        bool floorHit = false;
        // We haven't hit any SDF, so maybe we hit floor?
        if (distanceToHitPoint == INVALID_DISTANCE) {
            distanceToHitPoint =
                calculateFloorColor(rayDir, rayOrigin, hitPointColor);
            floorHit = distanceToHitPoint != INVALID_DISTANCE;
            hitPoint = rayOrigin + rayDir * distanceToHitPoint;
        } else
            hitPointNormal = calculateNormal(hitPoint);

        // Values which blends between hit point color and background
        float backgroundBlendValue = 1.;
        // If we have hit some SDF or floor
        if (distanceToHitPoint != INVALID_DISTANCE) {
            resultColor =
                calculatePhong(rayDir, hitPoint, hitPointNormal, hitPointColor);
#if QUALITY >= 1
            resultColor *= calculateShadow(hitPoint, hitPointNormal);
            resultColor *= calculateAmbientOcclusion(hitPoint, hitPointNormal);
            // We want to have reflections only on floor
            if (floorHit)
                resultColor =
                    calculateReflections(hitPoint, hitPointNormal, resultColor,
                                         rayDir, backgroundColor);
#endif
            backgroundBlendValue =
                smoothstep(FLOOR_START_FADING_EDGE, FLOOR_STOP_FADING_EDGE,
                           distanceToHitPoint);
        }

        resultColor = mix(resultColor, backgroundColor, backgroundBlendValue);

#if QUALITY >= 2
        allResultColors += resultColor;
    }
    resultColor = allResultColors / float(ALL_MSAA_SAMPLE_POINTS.length());
#endif

    // Gamma correction
    fragColor = vec4(pow(resultColor, vec3(1. / 2.2)), 0.);
}