#version 330 core

const float PI = 3.14159265359;
const float EPSILON = 0.0001;
const float INFINITY = 1000000.0;

out vec4 fragColor;

uniform vec2 resolution; // viewport resolution in pixels
uniform float mouseX;
uniform float mouseY;

uniform float time; // time elapsed in seconds
uniform sampler2D galaxy;
uniform sampler2D colorMap;

uniform float frontView = 0.0;
uniform float topView = 0.0;
uniform float cameraRoll = 0.0;

uniform float gravatationalLensing = 1.0;
uniform float renderBlackHole = 1.0;
uniform float mouseControl = 0.0;
uniform float fovScale = 1.0;
uniform float camDistance = 15.0;
uniform float camHeight = 0.0;
uniform float camOrbitPhase = 0.0;
uniform float camOrbitMix = 0.0;

uniform float adiskEnabled = 1.0;
uniform float adiskParticle = 1.0;
uniform float adiskHeight = 0.2;
uniform float adiskLit = 0.5;
uniform float adiskDensityV = 1.0;
uniform float adiskDensityH = 1.0;
uniform float adiskNoiseScale = 1.0;
uniform float adiskNoiseLOD = 5.0;
uniform float adiskSpeed = 0.5;
uniform float jetStrength = 0.0;
uniform float jetRadius = 1.2;
uniform float jetLength = 18.0;
uniform float bhSpin = 0.0;
uniform float diskInnerRadius = 2.6;
uniform float diskOuterRadius = 12.0;
uniform float diskOpacity = 1.0;

struct Ring {
  vec3 center;
  vec3 normal;
  float innerRadius;
  float outerRadius;
  float rotateSpeed;
};

///----
/// Simplex 3D Noise
/// by Ian McEwan, Ashima Arts
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  // First corner
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  // Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  //  x0 = x0 - 0. + 0.0 * C
  vec3 x1 = x0 - i1 + 1.0 * C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1. + 3.0 * C.xxx;

  // Permutations
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y +
                           vec4(0.0, i1.y, i2.y, 1.0)) +
                   i.x + vec4(0.0, i1.x, i2.x, 1.0));

  // Gradients
  // ( N*N points uniformly over a square, mapped onto an octahedron.)
  float n_ = 1.0 / 7.0; // N=7
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z); //  mod(p,N*N)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_); // mod(j,N)

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  // Normalise gradients
  vec4 norm =
      taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  // Mix final noise value
  vec4 m =
      max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 *
         dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
///----

float ringDistance(vec3 rayOrigin, vec3 rayDir, Ring ring) {
  float denominator = dot(rayDir, ring.normal);
  float constant = -dot(ring.center, ring.normal);
  if (abs(denominator) < EPSILON) {
    return -1.0;
  } else {
    float t = -(dot(rayOrigin, ring.normal) + constant) / denominator;
    if (t < 0.0) {
      return -1.0;
    }

    vec3 intersection = rayOrigin + t * rayDir;

    // Compute distance to ring center
    float d = length(intersection - ring.center);
    if (d >= ring.innerRadius && d <= ring.outerRadius) {
      return t;
    }
    return -1.0;
  }
}

vec3 panoramaColor(sampler2D tex, vec3 dir) {
  vec3 n = normalize(dir);
  vec2 uv = vec2(atan(n.z, n.x) / (2.0 * PI) + 0.5,
                 0.5 - asin(clamp(n.y, -1.0, 1.0)) / PI);
  uv.x = fract(uv.x);
  uv.y = clamp(uv.y, 0.001, 0.999);
  return texture(tex, uv).rgb;
}

vec3 accel(float h2, vec3 pos) {
  float r2 = dot(pos, pos);
  float r5 = pow(r2, 2.5);
  vec3 acc = -1.5 * h2 * pos / r5 * 1.0;
  // Subtle frame-dragging-inspired perturbation around the spin axis.
  vec3 spinAxis = vec3(0.0, 1.0, 0.0);
  float r3 = max(pow(r2, 1.5), EPSILON);
  acc += 0.006 * bhSpin * cross(spinAxis, pos) / r3;
  return acc;
}

vec4 quadFromAxisAngle(vec3 axis, float angle) {
  vec4 qr;
  float half_angle = (angle * 0.5) * 3.14159 / 180.0;
  qr.x = axis.x * sin(half_angle);
  qr.y = axis.y * sin(half_angle);
  qr.z = axis.z * sin(half_angle);
  qr.w = cos(half_angle);
  return qr;
}

vec4 quadConj(vec4 q) { return vec4(-q.x, -q.y, -q.z, q.w); }

vec4 quat_mult(vec4 q1, vec4 q2) {
  vec4 qr;
  qr.x = (q1.w * q2.x) + (q1.x * q2.w) + (q1.y * q2.z) - (q1.z * q2.y);
  qr.y = (q1.w * q2.y) - (q1.x * q2.z) + (q1.y * q2.w) + (q1.z * q2.x);
  qr.z = (q1.w * q2.z) + (q1.x * q2.y) - (q1.y * q2.x) + (q1.z * q2.w);
  qr.w = (q1.w * q2.w) - (q1.x * q2.x) - (q1.y * q2.y) - (q1.z * q2.z);
  return qr;
}

vec3 rotateVector(vec3 position, vec3 axis, float angle) {
  vec4 qr = quadFromAxisAngle(axis, angle);
  vec4 qr_conj = quadConj(qr);
  vec4 q_pos = vec4(position.x, position.y, position.z, 0);

  vec4 q_tmp = quat_mult(qr, q_pos);
  qr = quat_mult(q_tmp, qr_conj);

  return vec3(qr.x, qr.y, qr.z);
}

#define IN_RANGE(x, a, b) (((x) > (a)) && ((x) < (b)))

void cartesianToSpherical(in vec3 xyz, out float rho, out float phi,
                          out float theta) {
  rho = sqrt((xyz.x * xyz.x) + (xyz.y * xyz.y) + (xyz.z * xyz.z));
  phi = asin(xyz.y / rho);
  theta = atan(xyz.z, xyz.x);
}

// Convert from Cartesian to spherical coord (rho, phi, theta)
// https://en.wikipedia.org/wiki/Spherical_coordinate_system
vec3 toSpherical(vec3 p) {
  float rho = sqrt((p.x * p.x) + (p.y * p.y) + (p.z * p.z));
  float theta = atan(p.z, p.x);
  float phi = asin(p.y / rho);
  return vec3(rho, theta, phi);
}

vec3 toSpherical2(vec3 pos) {
  vec3 radialCoords;
  radialCoords.x = length(pos) * 1.5 + 0.55;
  radialCoords.y = atan(-pos.x, -pos.z) * 1.5;
  radialCoords.z = abs(pos.y);
  return radialCoords;
}

void ringColor(vec3 rayOrigin, vec3 rayDir, Ring ring, inout float minDistance,
               inout vec3 color) {
  float distance = ringDistance(rayOrigin, normalize(rayDir), ring);
  if (distance >= EPSILON && distance < minDistance &&
      distance <= length(rayDir) + EPSILON) {
    minDistance = distance;

    vec3 intersection = rayOrigin + normalize(rayDir) * minDistance;
    vec3 ringColor;

    {
      float dist = length(intersection);

      float v = clamp((dist - ring.innerRadius) /
                          (ring.outerRadius - ring.innerRadius),
                      0.0, 1.0);

      vec3 base = cross(ring.normal, vec3(0.0, 0.0, 1.0));
      float angle = acos(dot(normalize(base), normalize(intersection)));
      if (dot(cross(base, intersection), ring.normal) < 0.0)
        angle = -angle;

      float u = 0.5 - 0.5 * angle / PI;
      // HACK
      u += time * ring.rotateSpeed;

      vec3 color = vec3(0.0, 0.5, 0.0);
      // HACK
      float alpha = 0.5;
      ringColor = vec3(color);
    }

    color += ringColor;
  }
}

mat3 lookAt(vec3 origin, vec3 target, float roll) {
  vec3 rr = vec3(sin(roll), cos(roll), 0.0);
  vec3 ww = normalize(target - origin);
  vec3 uu = normalize(cross(ww, rr));
  vec3 vv = normalize(cross(uu, ww));

  return mat3(uu, vv, ww);
}

float sqrLength(vec3 a) { return dot(a, a); }

vec3 boostColor(vec3 c, float saturation, float gain) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  vec3 sat = mix(vec3(l), c, saturation);
  return sat * gain;
}

float novikovThorneFlux(float r, float rin) {
  float x = max(r / max(rin, EPSILON), 1.0001);
  float term = max(1.0 - sqrt(1.0 / x), 0.0);
  return pow(x, -3.0) * term;
}

void adiskColor(vec3 pos, inout vec3 color, inout float alpha) {
  float innerRadius = max(2.6, diskInnerRadius);
  float outerRadius = max(innerRadius + 0.5, diskOuterRadius);

  // Density linearly decreases as the distance to the blackhole center
  // increases.
  float density = max(
      0.0, 1.0 - length(pos.xyz / vec3(outerRadius, adiskHeight, outerRadius)));
  if (density < 0.001) {
    return;
  }

  density *= pow(1.0 - abs(pos.y) / adiskHeight, adiskDensityV);

  // ISCO-like cutoff to keep the inner disk physically plausible.
  density *= smoothstep(innerRadius, innerRadius * 1.1, length(pos));
  // Soften the inner glow to avoid a solid blob.
  density *= smoothstep(innerRadius * 1.1, innerRadius * 2.2, length(pos));

  // Avoid the shader computation when density is very small.
  if (density < 0.001) {
    return;
  }

  vec3 sphericalCoord = toSpherical(pos);

  // Scale the rho and phi so that the particales appear to be at the correct
  // scale visually.
  sphericalCoord.y *= 2.0;
  sphericalCoord.z *= 4.0;

  density *= 1.0 / pow(sphericalCoord.x, adiskDensityH);
  density *= 6000.0;
  density = min(density, 1.0);

  if (adiskParticle < 0.5) {
    color += vec3(0.0, 1.0, 0.0) * density * 0.02;
    return;
  }

  float noise = 1.0;
  for (int i = 0; i < int(adiskNoiseLOD); i++) {
    noise *= 0.5 * snoise(sphericalCoord * pow(float(i), 2.0) * adiskNoiseScale) + 0.5;
    if (i % 2 == 0) {
      sphericalCoord.y += time * adiskSpeed;
    } else {
      sphericalCoord.y -= time * adiskSpeed;
    }
  }

  float r = max(length(pos), innerRadius);
  float radialT = clamp((r - innerRadius) / (outerRadius - innerRadius), 0.0, 1.0);
  vec3 dustColor = texture(colorMap, vec2(radialT, 0.5)).rgb;
  float swirlBand =
      0.5 + 0.5 * sin(sphericalCoord.y * 1.7 + sphericalCoord.z * 0.45 + time * 0.8);
  float coolMask = smoothstep(0.25, 0.85, radialT);
  float magentaMask =
      smoothstep(0.62, 0.98, swirlBand * (0.65 + 0.35 * abs(noise)));
  float greenBand =
      0.5 + 0.5 * sin(sphericalCoord.y * 1.35 - sphericalCoord.z * 0.60 + time * 0.90);
  float greenMask = smoothstep(0.38, 0.96, greenBand);
  vec3 warmTint = vec3(1.44, 0.88, 0.30);
  vec3 coolTint = vec3(0.34, 0.92, 1.34);
  vec3 magentaTint = vec3(1.34, 0.54, 1.20);
  vec3 emeraldTint = vec3(0.40, 1.36, 0.62);
  vec3 tint = mix(warmTint, coolTint, coolMask);
  tint = mix(tint, magentaTint, magentaMask * 0.62);
  tint = mix(tint, emeraldTint,
             greenMask * (0.22 + 0.28 * (1.0 - radialT)) * (0.55 + 0.45 * abs(noise)));
  dustColor *= mix(vec3(1.0), tint, 0.80);
  dustColor = boostColor(dustColor, 1.36, 1.09);
  float sparkle =
      smoothstep(0.78, 1.0, abs(noise)) * (0.11 + 0.14 * (1.0 - radialT));
  dustColor += tint * sparkle;

  // Novikov-Thorne-inspired thin-disk emissivity and color correction factor.
  float ntFlux = novikovThorneFlux(r, innerRadius);
  float tEff = pow(max(ntFlux, 0.0), 0.25);
  float colorCorr = 1.65;
  float tColor = clamp(tEff * colorCorr * 2.8, 0.0, 1.0);
  vec3 bbColor = texture(colorMap, vec2(tColor, 0.5)).rgb;
  float intensityCorr = ntFlux / pow(colorCorr, 4.0);
  float thermalGain = 18.0 * pow(max(intensityCorr, 1e-4), 0.55);
  dustColor = mix(dustColor, bbColor, 0.78);
  dustColor = mix(vec3(dot(dustColor, vec3(0.2126, 0.7152, 0.0722))), dustColor,
                  0.93);
  float cyanBand = exp(-pow((tColor - 0.45) / 0.16, 2.0));
  dustColor = mix(dustColor, dustColor * vec3(0.90, 1.08, 1.04), 0.16 * cyanBand);
  dustColor *= thermalGain;

  // Mild relativistic beaming and gravitational redshift approximation.
  float rxy = max(length(pos.xz), EPSILON);
  vec3 tangential = vec3(-pos.z / rxy, 0.0, pos.x / rxy);
  float betaBase = sqrt(clamp(0.5 / max(r, innerRadius + EPSILON), 0.0, 0.68));
  float beta = clamp(betaBase * (1.0 + 0.06 * bhSpin), 0.0, 0.68);
  float gamma = inversesqrt(max(1.0 - beta * beta, 0.1));
  vec3 toObserver = normalize(-pos);
  float doppler = 1.0 / max(gamma * (1.0 - dot(beta * tangential, toObserver)), 0.3);
  float gravShift = sqrt(max(1.0 - 1.0 / max(r, 1.001), 0.06));
  float shift = clamp(doppler * gravShift, 0.6, 1.4);
  float beaming = pow(shift, 2.2);

  color += density * adiskLit * dustColor * alpha * abs(noise) * beaming * diskOpacity;
}

void jetColor(vec3 pos, inout vec3 color, inout float alpha) {
  if (jetStrength <= 0.0) return;
  float r = length(pos.xz);
  float y = abs(pos.y);
  if (y <= 0.6) return;

  float core = smoothstep(jetRadius, 0.0, r);
  float along = smoothstep(0.6, jetLength, y);
  float fade = smoothstep(jetLength, jetLength * 1.4, y);
  float jet = core * along * (1.0 - fade);
  if (jet <= 0.0001) return;

  vec3 jetCol = vec3(0.85, 0.6, 0.35);
  color += jetCol * jetStrength * jet * alpha;
}

const float SKYBOX_ROTATION_OFFSET = 2.35619449; // 135 deg, moves cube seam away from startup view
const float SKYBOX_ROTATION_SPEED = 0.0;         // keep skybox static to avoid seam drift on startup
const float BASE_CAMERA_YAW = 0.39269908;        // 22.5 deg startup yaw offset

vec3 sampleGalaxySeamless(vec3 dir) {
  // Equirectangular sky sampling with isotropic blur.
  // Avoid direction-axis seam blending to prevent moving vertical bands.
  vec3 n = normalize(dir);
  vec2 uv = vec2(atan(n.z, n.x) / (2.0 * PI) + 0.5,
                 0.5 - asin(clamp(n.y, -1.0, 1.0)) / PI);
  uv.x = fract(uv.x);
  uv.y = clamp(uv.y, 0.001, 0.999);

  vec2 texel = 1.0 / vec2(textureSize(galaxy, 0));
  vec3 c0 = texture(galaxy, uv).rgb;
  vec3 c1 = texture(galaxy, vec2(fract(uv.x + texel.x), uv.y)).rgb;
  vec3 c2 = texture(galaxy, vec2(fract(uv.x - texel.x), uv.y)).rgb;
  vec3 c3 = texture(galaxy, vec2(uv.x, clamp(uv.y + texel.y, 0.001, 0.999))).rgb;
  vec3 c4 = texture(galaxy, vec2(uv.x, clamp(uv.y - texel.y, 0.001, 0.999))).rgb;
  vec3 blur = c0 * 0.40 + (c1 + c2 + c3 + c4) * 0.15;

  float lum = dot(c0, vec3(0.2126, 0.7152, 0.0722));
  float maxCh = max(max(c0.r, c0.g), c0.b);
  float minCh = min(min(c0.r, c0.g), c0.b);
  float sat = maxCh - minCh;
  float starMask = smoothstep(0.42, 1.0, lum) * (1.0 - smoothstep(0.05, 0.24, sat));

  vec3 nebula = mix(c0, blur, 0.10 + 0.62 * starMask);
  nebula = boostColor(nebula, 1.22, 1.04);
  nebula.g *= 1.05;
  return clamp(nebula, vec3(0.0), vec3(5.0));
}

vec3 traceColor(vec3 pos, vec3 dir) {
  vec3 color = vec3(0.0);
  float alpha = 1.0;

  float STEP_SIZE = 0.1;
  dir *= STEP_SIZE;

  // Initial values
  vec3 h = cross(pos, dir);
  float h2 = dot(h, h);

  for (int i = 0; i < 220; i++) {
    if (renderBlackHole > 0.5) {
      // If gravatational lensing is applied
      if (gravatationalLensing > 0.5) {
        vec3 acc = accel(h2, pos);
        dir += acc;
      }

      // Reach event horizon
      if (dot(pos, pos) < 1.0) {
        return color;
      }

      float minDistance = INFINITY;

      if (false) {
        Ring ring;
        ring.center = vec3(0.0, 0.05, 0.0);
        ring.normal = vec3(0.0, 1.0, 0.0);
        ring.innerRadius = 2.0;
        ring.outerRadius = 6.0;
        ring.rotateSpeed = 0.08;
        ringColor(pos, dir, ring, minDistance, color);
      } else {
        if (adiskEnabled > 0.5) {
          adiskColor(pos, color, alpha);
          jetColor(pos, color, alpha);
        }
      }
    }

    pos += dir;
  }

  // Sample skybox color
  dir = rotateVector(dir, vec3(0.0, 1.0, 0.0),
                     time * SKYBOX_ROTATION_SPEED + SKYBOX_ROTATION_OFFSET);
  color += sampleGalaxySeamless(dir) * alpha;
  return color;
}

void main() {
  mat3 view;

  vec3 cameraPos;
  if (mouseControl > 0.5) {
    vec2 mouse = clamp(vec2(mouseX, mouseY) / resolution.xy, 0.0, 1.0) - 0.5;
    cameraPos = vec3(-cos(mouse.x * 10.0) * 15.0, mouse.y * 30.0,
                     sin(mouse.x * 10.0) * 15.0);

  } else if (frontView > 0.5) {
    cameraPos = vec3(10.0, 1.0, 10.0);
  } else if (topView > 0.5) {
    cameraPos = vec3(15.0, 15.0, 0.0);
  } else {
    vec3 basePos =
        vec3(cos(BASE_CAMERA_YAW) * camDistance, camHeight,
             sin(BASE_CAMERA_YAW) * camDistance);
    vec3 orbitPos =
        vec3(cos(camOrbitPhase + BASE_CAMERA_YAW) * camDistance, camHeight,
             sin(camOrbitPhase + BASE_CAMERA_YAW) * camDistance);
    cameraPos = mix(basePos, orbitPos, camOrbitMix);
  }

  vec3 target = vec3(0.0, 0.0, 0.0);
  view = lookAt(cameraPos, target, radians(cameraRoll));

  vec2 uv = gl_FragCoord.xy / resolution.xy - vec2(0.5);
  uv.x *= resolution.x / resolution.y;

  vec3 dir = normalize(vec3(-uv.x * fovScale, uv.y * fovScale, 1.0));
  vec3 pos = cameraPos;
  dir = view * dir;

  fragColor.rgb = traceColor(pos, dir);
}
