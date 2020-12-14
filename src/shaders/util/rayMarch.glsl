vec3 rayMarch(in vec3 ro, in vec3 rd, in vec3 bg) {
    float totalDistancetraveled = 0.0;
    
    for (int i = 0; i < NUM_STEPS; i++) {
        vec3 currentPosition = ro + totalDistancetraveled * rd;
        float dist = distFromNearest(currentPosition);

        if (dist < MINIMUM_HIT_DISTANCE) {
            vec3 normal = calculateNormal(currentPosition);
            return calculateColor(currentPosition, normal, ro);
        }

        if (totalDistancetraveled > MAXIMUM_TRACE_DISTANCE) {
            break;
        }

        totalDistancetraveled += dist;
    }

    return bg;
}
