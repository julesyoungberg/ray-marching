float distFromNearest(in vec3 p);

float rayMarch(in vec3 ro, in vec3 rd, in float maxDist, in bool internal) {
    float totalDistancetraveled = 0.0;

    for (int i = 0; i < NUM_STEPS; i++) {
        vec3 currentPosition = ro + totalDistancetraveled * rd;
        float dist = distFromNearest(currentPosition);
        if (internal) {
            dist *= -1.0;
        }

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

float rayMarch(in vec3 ro, in vec3 rd, in float maxDist) {
    return rayMarch(ro, rd, maxDist, false);
}

float rayMarch(in vec3 ro, in vec3 rd) {
    return rayMarch(ro, rd, MAX_TRACE_DISTANCE);
}

float rayMarchInternal(in vec3 ro, in vec3 rd, in float maxDist) {
    return rayMarch(ro, rd, maxDist, true);
}

float rayMarchInternal(in vec3 ro, in vec3 rd) {
    return rayMarchInternal(ro, rd, MAX_TRACE_DISTANCE);
}
