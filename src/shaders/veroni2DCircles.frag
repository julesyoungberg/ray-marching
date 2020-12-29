#version 300 es
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform vec2 resolution;
uniform float time;
uniform bool vAnimateCells;

@import ./util/rand;

vec2 getPoint(vec2 c) {
    vec2 point = rand2(c);
    if (vAnimateCells) {
        point = 0.5 + 0.5 * sin(time + 6.2831 * point);
    }
    return point;
}

void main() {
    vec2 st = gl_FragCoord.xy / resolution;

    // tile the space
    st *= 10.0;
    vec2 i_st = floor(st);
    vec2 f_st = fract(st);

    float pointDist = 10.0;
    vec2 nearestPoint;

    // find the nearest point
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(x, y);
            vec2 q = neighbor + getPoint(i_st + neighbor);

            float dist = length(q - f_st);
            if (dist < pointDist) {
                pointDist = dist;
                nearestPoint = q;
            }
        }
    }

    // shift the space so that the nearest point's cell is (0, 0)
    vec2 relativeBin = floor(nearestPoint);
    i_st += relativeBin;
    f_st -= relativeBin;

    vec2 centerPoint = getPoint(i_st);
    float planeDist = 1.0;

    // find distance to nearest plane
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            if (x == 0 && y == 0) {
                continue;
            }

            vec2 neighbor = vec2(x, y);
            vec2 q = neighbor + getPoint(i_st + neighbor);

            vec2 point = (centerPoint + q) / 2.0;
            vec2 normal = normalize(centerPoint - q);
            
            vec2 diff = centerPoint - point;
            float dist = length(dot(diff, normal));
            planeDist = min(planeDist, dist);
        }
    }

    float radius = planeDist * 2.0;

    vec3 color = vec3(0);
    color += pointDist;
    color.rg = fract(nearestPoint);
    color *= 1.0 - step(radius / 2.0, pointDist);

    fragColor = vec4(color, 1);
}
