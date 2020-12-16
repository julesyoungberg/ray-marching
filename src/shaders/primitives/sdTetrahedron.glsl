float sdTetrahedron(const vec3 pointWS, float size, int iterations) {
    float s = size;
    vec3 vertices[4];
    vertices[0] = vec3(s, s, s);
    vertices[1] = vec3(-s, -s, s);
    vertices[2] = vec3(s, -s, -s);
    vertices[3] = vec3(-s, s, -s);

    vec3 pointInLoop = pointWS;
    float distanceToClosestVertex;
    int i;
    float scale = 2.0;
    for (i = 0; i < iterations; i++) {
        // We search for a closest vertex
        vec3 closestVertex = vertices[0];
        distanceToClosestVertex = length(pointInLoop - vertices[0]);
        for (int j = 1; j < 4; j++) {
            float currentDist = length(pointInLoop - vertices[j]);
            if (currentDist < distanceToClosestVertex) {
                distanceToClosestVertex = currentDist;
                closestVertex = vertices[j];
            }
        }

        pointInLoop = scale * pointInLoop - closestVertex;
    }

    return length(pointInLoop) * pow(scale, float(-i));
}
