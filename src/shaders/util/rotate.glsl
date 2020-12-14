mat4 rotateX(in float angle) {
	return mat4(1.0,    0,          0,              0,
			 	0,      cos(angle), -sin(angle),    0,
				0,      sin(angle), cos(angle),     0,
				0,      0,          0, 		        1);
}

mat4 rotateY(in float angle) {
	return mat4(cos(angle),     0,		sin(angle), 0,
			 	0,              1.0,    0,          0,
				-sin(angle),    0,		cos(angle),	0,
				0,              0,		0,          1);
}

mat4 rotateZ(in float angle) {
	return mat4(cos(angle), -sin(angle),    0,  0,
			 	sin(angle), cos(angle),     0,	0,
				0,          0,		        1,	0,
				0,          0,		        0,	1);
}

vec3 rotateVec(in vec3 v, in mat4 m) {
    vec4 rotated = m * vec4(v, 1);
    return rotated.xyz;
}
