mat4 createRotationMatrix(vec3 rotationEuler) {
    // Input is in degrees, but to calculate everything property we need radians
    vec3 rotationTheta = rotationEuler * (3.14 / 180.);

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
