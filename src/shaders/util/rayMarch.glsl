/**
 * Dependencies:
 * - float distFromNearest(float a)
 * - vec3 calculateNormal(vec3 p)
 * - vec3 calculateColor(vec3 p, vec3 n, vec3 eye)
 */
float rayMarch(in vec3 ro, in vec3 rd) {
    float totalDistancetraveled = 0.0;
    
    for (int i = 0; i < NUM_STEPS; i++) {
        vec3 currentPosition = ro + totalDistancetraveled * rd;
        float dist = distFromNearest(currentPosition);

        if (dist < MINIMUM_HIT_DISTANCE) {
            return totalDistancetraveled;
        }

        if (totalDistancetraveled > MAXIMUM_TRACE_DISTANCE) {
            break;
        }

        totalDistancetraveled += dist;
    }

    return -1.0;
}
