// compute the near and far intersections of the cube (stored in the x and y
// components) using the slab method no intersection means vec.x > vec.y (really
// tNear > tFar)
vec2 cubeIntersect(vec3 rayOrigin, vec3 rayDir, vec3 boxMin, vec3 boxMax) {
    vec3 tMin = (boxMin - rayOrigin) / rayDir;
    vec3 tMax = (boxMax - rayOrigin) / rayDir;
    vec3 t1 = min(tMin, tMax);
    vec3 t2 = max(tMin, tMax);
    float tNear = max(max(t1.x, t1.y), t1.z);
    float tFar = min(min(t2.x, t2.y), t2.z);
    return vec2(tNear, tFar);
}

const vec3 CUBE_NORMALS_[3] =
    vec3[3](vec3(1, 0, 0), vec3(0, 1, 0), vec3(0, 0, 1));

vec3 cubeNormal(vec3 point, vec3 center) {
    vec3 interRelative = point - center;
    float xyCoef = interRelative.y / interRelative.x;
    float zyCoef = interRelative.y / interRelative.z;

    int coef = 0;
    if (-1.0 <= xyCoef && xyCoef <= 1.0) {
        coef = 1;
    } else if (-1.0 < zyCoef && zyCoef < 1.0) {
        coef = 2;
    }

    return CUBE_NORMALS_[coef] * sign(interRelative);
}
