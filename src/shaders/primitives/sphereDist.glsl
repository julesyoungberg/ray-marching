float sphereDist(in vec3 point, in vec3 center, float radius) {
	return length(point - center) - radius;
}
