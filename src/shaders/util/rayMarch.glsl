/**
 * Dependencies:
 * - float distFromNearest(float a)
 * - vec3 calculateNormal(vec3 p)
 * - vec3 calculateColor(vec3 p, vec3 n, vec3 eye)
 */
float rayMarch(in vec3 ro, in vec3 rd, in float maxDist) {
    float totalDistancetraveled = 0.0;
    
    for (int i = 0; i < NUM_STEPS; i++) {
        vec3 currentPosition = ro + totalDistancetraveled * rd;
        float dist = distFromNearest(currentPosition);

        if (totalDistancetraveled > maxDist) {
            break;
        }

        if (dist < MIN_HIT_DISTANCE) {
            return totalDistancetraveled;
        }

        totalDistancetraveled += dist;
    }

    return -1.0;
}

float rayMarch(in vec3 ro, in vec3 rd) {
    return rayMarch(ro, rd, MAX_TRACE_DISTANCE);
}
