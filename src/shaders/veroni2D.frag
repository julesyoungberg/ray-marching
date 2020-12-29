#version 300 es
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform vec2 resolution;
uniform float time;

@import ./util/rand;

struct Plane {
    vec2 point;
    vec2 normal;
};

vec2 getPoint(vec2 c) {
    vec2 point = rand2(c);
    point = 0.5 + 0.5 * sin(time + 6.2831 * point);
    return point;
}

void main() {
    vec2 st = gl_FragCoord.xy / resolution;

    // tile the space
    st *= 10.0;
    vec2 i_st = floor(st);
    vec2 f_st = fract(st);

    float pointDist = 0.0;
    vec2 nearestPoint;

    // find the nearest point
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 neighbor = vec2(x, y);
            vec2 q = neighbor + getPoint(i_st + neighbor);

            vec2 diff = q - f_st;
            float dist = 1.0 - length(diff);

            if (dist > pointDist) {
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

    // compute planes
    Plane planes[9];
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            if (x == 0 && y == 0) {
                continue;
            }

            vec2 neighbor = vec2(x, y);
            vec2 q = neighbor + getPoint(i_st + neighbor);

            Plane p;
            p.point = (centerPoint + q) / 2.0;
            p.normal = normalize(centerPoint - q);
            int index = (y + 1) * 3 + x + 1;
            planes[index] = p;
        }
    }

    float planeDist = 1.0;

    // find distance to nearest planes
    for (int i = 0; i < 9; i++) {
        if (i == 4) {
            continue;
        }

        Plane p = planes[i];
        vec2 diff = f_st - p.point;
        float dist = length(dot(diff, p.normal));
        planeDist = min(planeDist, dist);
    }

    vec3 color;
    // color += sqrt(pointDist);
    color += sqrt(planeDist);
    color.rg = nearestPoint - relativeBin;

    // color += 1.0 - step(0.02, pointDist);
    // color.r += step(.98, f_st.x) + step(.98, f_st.y);

    fragColor = vec4(color, 1);
}
