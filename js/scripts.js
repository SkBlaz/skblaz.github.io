// Black hole merger background visualization
// ------------------------------------------

// ---- canvas setup ----
function cleanCanvas(canvas, ctx) {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function initializeCanvas() {
    const canvas = document.getElementById("myCanvas");
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    cleanCanvas(canvas, ctx);
    return { canvas, ctx };
}

const { canvas, ctx } = initializeCanvas();

// Global simulation state
let mergerState = null;

// Re-init on resize
window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    cleanCanvas(canvas, ctx);
    mergerState = null;
});

// ------------------------------------------
// Avatar distortion (gravitational lensing)
// ------------------------------------------

const AVATAR_SELECTORS = [
    "#profile-img",
    "#avatar",
    ".profile img",
    ".profile-picture img",
    ".profile-pic img",
    "img.avatar",
    'img[alt*="profile"]',
    'img[alt*="Profile"]'
];

let avatarEl = null;

function findAvatarElement() {
    if (avatarEl && document.body.contains(avatarEl)) return avatarEl;

    // explicit selectors first
    for (const sel of AVATAR_SELECTORS) {
        const el = document.querySelector(sel);
        if (el) {
            avatarEl = el;
            return avatarEl;
        }
    }

    // fallback: closest <img> to viewport center
    const imgs = Array.from(document.querySelectorAll("img"));
    if (!imgs.length) return null;

    const viewCx = window.innerWidth / 2;
    const viewCy = window.innerHeight / 2;
    let best = null;
    let bestDistSq = Infinity;

    for (const img of imgs) {
        const r = img.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;

        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const dx = cx - viewCx;
        const dy = cy - viewCy;
        const d2 = dx * dx + dy * dy;

        if (d2 < bestDistSq) {
            bestDistSq = d2;
            best = img;
        }
    }

    avatarEl = best || null;
    return avatarEl;
}

function resetAvatarDistortion() {
    const avatar = findAvatarElement();
    if (!avatar) return;
    avatar.style.transform = "";
    avatar.style.filter = "";
    avatar.style.transition = "";
}

function applyAvatarDistortion(state, amplitude, hP, hC) {
    const avatar = findAvatarElement();
    if (!avatar) return;

    const rect = avatar.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    const avatarCx = rect.left + rect.width / 2;
    const avatarCy = rect.top + rect.height / 2;

    const scaleXCanvas = canvasRect.width / state.width;
    const scaleYCanvas = canvasRect.height / state.height;

    const bhScreenX = canvasRect.left + state.centerX * scaleXCanvas;
    const bhScreenY = canvasRect.top + state.centerY * scaleYCanvas;

    const dx = avatarCx - bhScreenX;
    const dy = avatarCy - bhScreenY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const maxR = Math.min(canvasRect.width, canvasRect.height) * 0.7;
    let influence = 0;
    if (dist < maxR) influence = 1 - dist / maxR;

    if (influence <= 0.001 || amplitude <= 0.001) {
        avatar.style.transition = "transform 0.2s ease-out, filter 0.2s ease-out";
        avatar.style.transformOrigin = "50% 50%";
        avatar.style.transform = "translateZ(0)";
        avatar.style.filter = "none";
        return;
    }

    const gwStrength = Math.min(Math.sqrt(hP * hP + hC * hC) * 3.0, 1.0);
    const effect = gwStrength * influence;

    const scaleX = 1 + effect * 0.16;
    const scaleY = 1 - effect * 0.08;
    const rotateDeg = effect * 3.5 * (dx > 0 ? 1 : -1);
    const skewXdeg = hC * influence * 10;
    const skewYdeg = hP * influence * 6;

    const blur = effect * 1.2;
    const contrast = 100 + effect * 20;

    avatar.style.transition = "transform 0.08s ease-out, filter 0.08s ease-out";
    avatar.style.transformOrigin = "50% 50%";
    avatar.style.transform =
        `translateZ(0) scale(${scaleX},${scaleY}) rotate(${rotateDeg}deg) skew(${skewXdeg}deg,${skewYdeg}deg)`;
    avatar.style.filter = `blur(${blur.toFixed(2)}px) contrast(${contrast.toFixed(0)}%)`;
}

// ------------------------------------------
// Black hole merger simulation
// ------------------------------------------

function createInitialState(width, height) {
    const maxSep = Math.min(width, height) * 0.28;
    const fps = 60;
    const inspiralDuration = fps * 12;
    const ringdownDuration = fps * 6;
    const totalDuration = inspiralDuration + ringdownDuration + fps * 2;
    const margin = Math.min(width, height) * 0.35;

    // starfield
    const nStars = 200;
    const stars = [];
    for (let i = 0; i < nStars; i++) {
        stars.push({
            baseX: Math.random() * width,
            baseY: Math.random() * height,
            size: Math.random() * 1.5 + 0.5,
            twinklePhase: Math.random() * Math.PI * 2
        });
    }

    // distant, subtle gas patches near edges
    const baseSize = Math.min(width, height);
    const gasClouds = [];
    const cloudCount = 5;

    for (let i = 0; i < cloudCount; i++) {
        const edge = i % 4;
        let cx, cy, angle;

        if (edge === 0) {           // left edge
            cx = -0.18 * width;
            cy = height * (0.15 + 0.6 * Math.random());
            angle = 0.1 + 0.5 * Math.random();
        } else if (edge === 1) {    // right edge
            cx = 1.18 * width;
            cy = height * (0.2 + 0.6 * Math.random());
            angle = Math.PI + (-0.5 + Math.random() * 0.6);
        } else if (edge === 2) {    // top edge
            cx = width * (0.2 + 0.6 * Math.random());
            cy = -0.22 * height;
            angle = 0.9 + 0.4 * (Math.random() - 0.5);
        } else {                    // bottom edge
            cx = width * (0.2 + 0.6 * Math.random());
            cy = 1.22 * height;
            angle = -0.9 + 0.4 * (Math.random() - 0.5);
        }

        gasClouds.push({
            cx,
            cy,
            angle,
            bandLength: baseSize * (0.35 + 0.25 * Math.random()),
            radius: baseSize * (0.04 + 0.03 * Math.random()),
            stretchY: 0.4 + 0.3 * Math.random(),
            jitterSeed: Math.random() * 1000 + i * 500,
            segments: 14 + Math.floor(Math.random() * 14),
            noiseScale: 0.15 + 0.2 * Math.random()
        });
    }

    const mass1 = 1.0;
    const mass2 = 3.0;
    const eccentricity = 0.15 + Math.random() * 0.35;
    const orbitTilt = Math.random() * Math.PI * 2;
    const precessionRate =
        (Math.random() * 0.02 + 0.005) *
        (Math.random() < 0.5 ? -1 : 1);
    const radialWobblePhase = Math.random() * Math.PI * 2;

    const waveform = {
        bufferPlus: [],
        bufferCross: [],
        maxPoints: 260
    };

    return {
        width,
        height,
        t: 0,
        inspiralDuration,
        ringdownDuration,
        totalDuration,
        maxSeparation: maxSep,
        separation: maxSep,
        phase: 0,
        omega0: 0.02,
        centerX: -margin,
        centerY: height * 0.5,
        margin,
        vx: Math.max(width * 0.0018, 0.7),
        stars,
        gasClouds,
        waveform,
        plasmaParticles: [],
        infallObjects: [],
        inclination: Math.PI / 3,
        strainScale: 0.35,
        waveOffset: 0,
        mass1,
        mass2,
        eccentricity,
        orbitTilt,
        precessionRate,
        radialWobblePhase,
        dynamicColor: [245, 232, 210],
        heavyColor: [235, 224, 205],
        phaseName: "active",
        fadeT: 0,
        fadeDuration: 90
    };
}

function drawBlackHoleMerger(ctx) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    if (!mergerState || mergerState.width !== width || mergerState.height !== height) {
        mergerState = createInitialState(width, height);
        resetAvatarDistortion();
    }

    const state = mergerState;

    // trail fade
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    ctx.fillRect(0, 0, width, height);

    // very subtle, distant gas clouds (behind everything)
    drawGasClouds(ctx, state);

    // fade-out phase
    if (state.phaseName === "fadeout") {
        state.fadeT++;
        if (state.fadeT === 1) resetAvatarDistortion();
        if (state.fadeT > state.fadeDuration) mergerState = null;
        return;
    }

    // advance time & drift
    state.t += 1;
    state.centerX += state.vx;

    const t = state.t;
    state.centerY = state.height * 0.5 + Math.sin(t * 0.01) * state.height * 0.08;
    state.orbitTilt = (state.orbitTilt + state.precessionRate) % (Math.PI * 2);

    const centerX = state.centerX;
    const centerY = state.centerY;

    // inspiral / ringdown progress
    const inspiralProgress = Math.min(state.t / state.inspiralDuration, 1);
    const ringdownProgress =
        state.t > state.inspiralDuration
            ? Math.min((state.t - state.inspiralDuration) / state.ringdownDuration, 1)
            : 0;

    const minSepFactor = 0.18;
    const sepFactor =
        minSepFactor + (1 - minSepFactor) * Math.pow(1 - inspiralProgress, 2);
    state.separation = state.maxSeparation * sepFactor;

    const rNorm = state.separation / state.maxSeparation;
    const omega = state.omega0 * Math.pow(Math.max(rNorm, 0.05), -1.5);
    state.phase += omega;

    // GW strain
    let amplitude;
    if (state.t <= state.inspiralDuration) {
        amplitude = 0.1 + 0.9 * Math.pow(inspiralProgress, 3);
    } else {
        amplitude = 0.2 * Math.exp(-3 * ringdownProgress);
    }
    amplitude = Math.min(amplitude, 1);

    const iota = state.inclination;
    const cosi = Math.cos(iota);
    const factorPlus = 1 + cosi * cosi;
    const factorCross = 2 * cosi;
    const twoPhase = 2 * state.phase;

    const hPlus = amplitude * factorPlus * Math.cos(twoPhase);
    const hCross = amplitude * factorCross * Math.sin(twoPhase);

    const hP = hPlus * state.strainScale;
    const hC = hCross * state.strainScale;

    applyAvatarDistortion(state, amplitude, hP, hC);
    updateWaveform(state, hPlus, hCross);

    drawStarsWithGW(ctx, state, centerX, centerY, amplitude, hP, hC);
    drawGravitationalRings(ctx, state, centerX, centerY, amplitude, inspiralProgress);

    // EM bursts
    const dToMerger = Math.abs(state.t - state.inspiralDuration);
    const mergerFlash = dToMerger < 20 ? (20 - dToMerger) / 20 : 0;

    const baseBHRadius = (8 + 0.04 * state.separation) * 1.8;

    if (mergerFlash > 0.01) {
        ctx.save();
        ctx.translate(centerX, centerY);

        const radialBurstCount = 8;
        for (let j = 0; j < radialBurstCount; j++) {
            const ang = (j / radialBurstCount) * Math.PI * 2 + t * 0.02;
            const inner = baseBHRadius * 1.4;
            const len = (35 + 70 * mergerFlash) * (0.6 + Math.random() * 0.4);

            const x0 = Math.cos(ang) * inner;
            const y0 = Math.sin(ang) * inner;
            const x1 = Math.cos(ang) * (inner + len);
            const y1 = Math.sin(ang) * (inner + len);

            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.lineTo(x1, y1);
            ctx.strokeStyle = `rgba(255, 240, 225, ${0.14 + 0.45 * mergerFlash})`;
            ctx.lineWidth = 0.6 + 1.2 * mergerFlash;
            ctx.stroke();
        }

        const jetLen = 70 + 180 * mergerFlash;
        ctx.strokeStyle = "rgba(255, 252, 246, 0.8)";
        ctx.lineWidth = 0.9 + 1.6 * mergerFlash;
        ctx.globalAlpha = 0.25 + 0.3 * mergerFlash;

        ctx.beginPath();
        ctx.moveTo(0, -baseBHRadius * 1.3);
        ctx.lineTo(0, -jetLen);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, baseBHRadius * 1.3);
        ctx.lineTo(0, jetLen);
        ctx.stroke();

        ctx.restore();
    }

    const preMerger = state.t < state.inspiralDuration;
    const dynamicColor = state.dynamicColor;
    const heavyColor = state.heavyColor;

    if (preMerger) {
        const { mass1: m1, mass2: m2 } = state;
        const totalMass = m1 + m2;
        const d = state.separation;

        const r1 = d * (m2 / totalMass);
        const r2 = d * (m1 / totalMass);

        const ell = orbitalOffset(state, state.phase);

        const radialWobble =
            1 + 0.12 * Math.sin(3 * state.phase + state.radialWobblePhase + t * 0.03);

        const x1 = centerX + ell.x * r1 * radialWobble;
        const y1 = centerY + ell.y * r1 * radialWobble;
        const x2 = centerX - ell.x * r2 / radialWobble;
        const y2 = centerY - ell.y * r2 / radialWobble;

        const radiusDynamic = baseBHRadius * 0.9;
        const radiusHeavy = baseBHRadius * 1.2;

        const bhList = [
            { x: x1, y: y1, radius: radiusDynamic, color: dynamicColor, isDynamic: true },
            { x: x2, y: y2, radius: radiusHeavy,  color: heavyColor,  isDynamic: false }
        ];

        updateAndDrawInfallingObjects(ctx, state, amplitude, bhList);
        updateAndDrawPlasma(ctx, state, amplitude, bhList);

        drawBlackHole(
            ctx,
            state,
            x1,
            y1,
            radiusDynamic,
            dynamicColor,
            amplitude + mergerFlash * 1.0,
            0.7 + 0.4 * amplitude,
            true
        );
        drawBlackHole(
            ctx,
            state,
            x2,
            y2,
            radiusHeavy,
            heavyColor,
            amplitude + mergerFlash * 0.4,
            0.4 + 0.3 * amplitude,
            false
        );
    } else {
        const remnantRadius = baseBHRadius * 1.6 + 10 * (1 - ringdownProgress);

        const bhList = [
            { x: centerX, y: centerY, radius: remnantRadius, color: [245, 238, 225], isDynamic: false }
        ];

        updateAndDrawInfallingObjects(ctx, state, amplitude, bhList);
        updateAndDrawPlasma(ctx, state, amplitude, bhList);

        drawBlackHole(
            ctx,
            state,
            centerX,
            centerY,
            remnantRadius,
            [245, 238, 225],
            amplitude + mergerFlash,
            0.6 * (1 - ringdownProgress),
            false
        );
    }

    drawWaveformOverlay(ctx, state);
    drawVignette(ctx, state);

    if (
        (state.centerX > width + state.margin || state.t > state.totalDuration) &&
        state.phaseName === "active"
    ) {
        state.phaseName = "fadeout";
        state.fadeT = 0;
    }
}

// ------------------------------------------
// Helper functions
// ------------------------------------------

function orbitalOffset(state, phase) {
    const e = state.eccentricity;
    const tilt = state.orbitTilt;

    let x = Math.cos(phase);
    let y = Math.sin(phase);

    y *= 1 - e;

    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    const rx = x * ct - y * st;
    const ry = x * st + y * ct;

    const len = Math.hypot(rx, ry) || 1;
    return { x: rx / len, y: ry / len };
}

function updateWaveform(state, hPlus, hCross) {
    const wf = state.waveform;
    if (!wf) return;

    const scale = 1.3;
    const vP = hPlus * scale;
    const vC = hCross * scale;

    wf.bufferPlus.push(vP);
    wf.bufferCross.push(vC);

    if (wf.bufferPlus.length > wf.maxPoints) {
        wf.bufferPlus.shift();
        wf.bufferCross.shift();
    }
}

function drawWaveformOverlay(ctx, state) {
    const wf = state.waveform;
    if (!wf || wf.bufferPlus.length < 2) return;

    const n = wf.bufferPlus.length;
    const width = state.width;
    const height = state.height;

    const marginX = 0;
    const plotWidth = width;
    const plotHeight = height * 0.07;
    const baseY = height;
    const topY = baseY - plotHeight;
    const midY = topY + plotHeight / 2;

    ctx.save();

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "rgba(0, 0, 0, 0.9)";
    ctx.fillRect(marginX, topY, plotWidth, plotHeight);

    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marginX, midY);
    ctx.lineTo(marginX + plotWidth, midY);
    ctx.stroke();

    let maxAbs = 0.2;
    for (let i = 0; i < n; i++) {
        const a = Math.abs(wf.bufferPlus[i]);
        const b = Math.abs(wf.bufferCross[i]);
        if (a > maxAbs) maxAbs = a;
        if (b > maxAbs) maxAbs = b;
    }
    const amplitudeScale = (plotHeight * 0.45) / maxAbs;
    const dx = plotWidth / (n - 1);

    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
        const x = marginX + i * dx;
        const y = midY - wf.bufferPlus[i] * amplitudeScale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
        const x = marginX + i * dx;
        const y = midY - wf.bufferCross[i] * amplitudeScale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.restore();
}


// distant, subtle gas patches
function drawGasClouds(ctx, state) {
    const clouds = state.gasClouds;
    if (!clouds || !clouds.length) return;

    const t = state.t;
    const warm = [240, 220, 205];
    const cool = [205, 215, 235];

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.8; // upper bound, actual puffs are lower

    for (const c of clouds) {
        ctx.save();
        ctx.translate(c.cx, c.cy);
        ctx.rotate(c.angle);

        for (let i = 0; i < c.segments; i++) {
            const u = i / (c.segments - 1) - 0.5; // -0.5..0.5
            const falloff = Math.max(0, 1 - Math.abs(u) * 1.7);
            if (falloff <= 0) continue;

            const baseX = u * c.bandLength;
            const noisePhase = c.jitterSeed + u * 7.0;
            const waviness = Math.sin(noisePhase * 0.23 + t * 0.004);
            const y = waviness * c.radius * c.noiseScale;

            const pulse = 0.9 + 0.2 * Math.sin(t * 0.003 + noisePhase * 0.11);

            const rx = c.radius * (0.6 + 0.5 * falloff) * (0.9 + 0.2 * pulse);
            const ry = c.radius * c.stretchY * (0.5 + 0.5 * falloff);

            const mix = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(noisePhase * 0.17));
            const rCol = Math.round(warm[0] * mix + cool[0] * (1 - mix));
            const gCol = Math.round(warm[1] * mix + cool[1] * (1 - mix));
            const bCol = Math.round(warm[2] * mix + cool[2] * (1 - mix));

            const alpha = 0.005 * falloff * (0.6 + 0.4 * pulse); // very faint

            ctx.beginPath();
            ctx.ellipse(baseX, y, rx, ry, 0, 0, 2 * Math.PI);
            ctx.fillStyle = `rgba(${rCol},${gCol},${bCol},${alpha})`;
            ctx.fill();
        }

        ctx.restore();
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
}

function drawStarsWithGW(ctx, state, centerX, centerY, amplitude, hP, hC) {
    const stars = state.stars;
    const t = state.t;

    ctx.save();
    ctx.fillStyle = "white";

    for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        const dx = star.baseX - centerX;
        const dy = star.baseY - centerY;

        let dxp = dx * (1 + hP);
        let dyp = dy * (1 - hP);

        const dxpp = dxp + hC * dyp;
        const dypp = dyp + hC * dxp;

        const sx = centerX + dxpp;
        const sy = centerY + dypp;

        const twinkle = 0.6 + 0.4 * Math.sin(star.twinklePhase + t * 0.05);
        const size = star.size * twinkle;

        if (sx >= -10 && sx <= state.width + 10 && sy >= -10 && sy <= state.height + 10) {
            ctx.globalAlpha = 0.18 + 0.45 * amplitude;
            ctx.beginPath();
            ctx.arc(sx, sy, size, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

    ctx.restore();
}

function drawGravitationalRings(ctx, state, centerX, centerY, amplitude, inspiralProgress) {
    const width = state.width;
    const height = state.height;
    const maxRadius = Math.min(width, height) / 1.2;
    const maxWaves = 8;

    const baseWaveSpeed = 2;
    const waveSpeed = baseWaveSpeed + 7 * inspiralProgress;
    state.waveOffset = (state.waveOffset || 0) + waveSpeed;

    const baseSpacing = 90;
    const minSpacing = 32;
    const spacing = baseSpacing - (baseSpacing - minSpacing) * inspiralProgress;

    for (let i = 0; i < maxWaves; i++) {
        const radius = state.waveOffset - i * spacing;
        if (radius < 0 || radius > maxRadius) continue;

        const radialFactor = 1 - radius / maxRadius;
        let alpha = radialFactor * (0.12 + 0.55 * amplitude);
        if (alpha <= 0.015) continue;

        const phaseMod = Math.sin(state.t * 0.09 + i * 0.6);
        alpha *= 0.7 + 0.3 * phaseMod;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.lineWidth = 0.5 + 1.8 * amplitude * (1 - i / maxWaves);
        ctx.strokeStyle = `rgba(230, 238, 255, ${alpha})`;
        ctx.stroke();
    }
}

function updateAndDrawPlasma(ctx, state, amplitude, bhList) {
    const particles = state.plasmaParticles;
    const maxParticles = 180;

    for (let i = 0; i < bhList.length; i++) {
        const bh = bhList[i];
        const spawnProb = 0.03 + amplitude * 0.1 + (bh.isDynamic ? 0.04 : 0);
        if (particles.length < maxParticles && Math.random() < spawnProb) {
            particles.push({
                bhIndex: i,
                angle: Math.random() * Math.PI * 2,
                radius: bh.radius * 1.2 + Math.random() * bh.radius * 1.4,
                vAngle: (0.03 + Math.random() * 0.03) * (bh.isDynamic ? 1.4 : 1.0),
                vRadius: 0.1 + Math.random() * 0.3,
                life: 0,
                maxLife: 32 + Math.floor(Math.random() * 40),
                color: bh.color
            });
        }
    }

    ctx.save();
    for (let pIndex = particles.length - 1; pIndex >= 0; pIndex--) {
        const p = particles[pIndex];
        p.life++;

        const bh = bhList[p.bhIndex];
        if (!bh) {
            particles.splice(pIndex, 1);
            continue;
        }

        p.angle += p.vAngle * (0.7 + amplitude * 1.1);
        p.radius += p.vRadius;

        const cosA = Math.cos(p.angle);
        const sinA = Math.sin(p.angle);

        const lx = cosA * p.radius;
        const ly = sinA * p.radius * 0.4;

        const x = bh.x + lx;
        const y = bh.y + ly;

        const trailScale = 8;
        const tx = bh.x + cosA * (p.radius - trailScale);
        const ty = bh.y + sinA * (p.radius - trailScale) * 0.4;

        const lifeFrac = p.life / p.maxLife;
        const alpha = (0.12 + 0.3 * amplitude) * (1 - lifeFrac);
        const size = bh.radius * 0.1 + 1.1;

        ctx.beginPath();
        ctx.strokeStyle = `rgba(${p.color[0]},${p.color[1]},${p.color[2]},${alpha})`;
        ctx.lineWidth = 0.7 + bh.radius * 0.04 * (1 - lifeFrac);
        ctx.moveTo(tx, ty);
        ctx.lineTo(x, y);
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = `rgba(${Math.min(p.color[0] + 18, 255)},${Math.min(
            p.color[1] + 18,
            255
        )},255,${alpha * 1.3})`;
        ctx.arc(x, y, size, 0, 2 * Math.PI);
        ctx.fill();
    }
    ctx.restore();
}

// infalling objects spiralling into BHs
function updateAndDrawInfallingObjects(ctx, state, amplitude, bhList) {
    const objs = state.infallObjects;
    const maxObjs = 40;

    for (let i = 0; i < bhList.length; i++) {
        const bh = bhList[i];
        const spawnProb = 0.012 + amplitude * 0.025 + (bh.isDynamic ? 0.01 : 0);
        if (objs.length < maxObjs && Math.random() < spawnProb) {
            const startRadius = bh.radius * (3 + Math.random() * 2);
            objs.push({
                bhIndex: i,
                angle: Math.random() * Math.PI * 2,
                radius: startRadius,
                startRadius,
                speedRad: 0.5 + Math.random() * 0.7,
                speedAng: (0.015 + Math.random() * 0.02) * (Math.random() < 0.5 ? -1 : 1),
                life: 0,
                maxLife: 260,
                length: bh.radius * (0.5 + Math.random() * 0.8),
                color: bh.color
            });
        }
    }

    ctx.save();
    for (let i = objs.length - 1; i >= 0; i--) {
        const o = objs[i];
        o.life++;

        const bh = bhList[o.bhIndex];
        if (!bh) {
            objs.splice(i, 1);
            continue;
        }

        o.angle += o.speedAng * (0.7 + 0.8 * amplitude);
        o.radius -= o.speedRad * (0.6 + 0.8 * amplitude);

        const fracInfall = 1 - o.radius / o.startRadius;
        const stretch = 1 + fracInfall * 2.0;

        const currentR = Math.max(o.radius, bh.radius * 1.05);
        const cosA = Math.cos(o.angle);
        const sinA = Math.sin(o.angle);

        const headXLocal = cosA * currentR;
        const headYLocal = sinA * currentR * 0.4;

        const tailR = currentR + o.length * (1 - fracInfall * 0.5);
        const tailXLocal = cosA * tailR;
        const tailYLocal = sinA * tailR * 0.4;

        const xHead = bh.x + headXLocal;
        const yHead = bh.y + headYLocal;
        const xTail = bh.x + tailXLocal;
        const yTail = bh.y + tailYLocal;

        const lifeFrac = o.life / o.maxLife;
        const alpha = (0.18 + 0.35 * amplitude) * (1 - lifeFrac);
        const width = 0.8 + 0.5 * stretch;

        ctx.beginPath();
        ctx.strokeStyle = `rgba(${o.color[0]},${o.color[1]},${o.color[2]},${alpha})`;
        ctx.lineWidth = width;
        ctx.moveTo(xTail, yTail);
        ctx.lineTo(xHead, yHead);
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 250, 245,${alpha * 1.3})`;
        const headSize = 1.4 + 0.9 * stretch;
        ctx.arc(xHead, yHead, headSize, 0, 2 * Math.PI);
        ctx.fill();

        if (currentR <= bh.radius * 1.06 || o.life > o.maxLife) {
            objs.splice(i, 1);
        }
    }
    ctx.restore();
}

// smooth accretion disks
function drawBlackHole(ctx, state, x, y, r, colorRGB, glowBoost, activity, isDynamic) {
    const [cr, cg, cb] = colorRGB;
    const t = state.t;

    ctx.save();
    ctx.globalAlpha = 1;

    const innerR = r * 1.1;
    const outerR = r * 2.4;
    const diskAngle = state.phase * 0.85 + (isDynamic ? 0.25 : -0.25);

    const flicker = 0.8 + 0.2 * Math.sin(t * 0.3 + (isDynamic ? 1.5 : 0));
    const alphaBase = (0.32 + 0.3 * activity) * flicker;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(diskAngle);
    ctx.scale(2.1, 0.6);

    const grad = ctx.createRadialGradient(0, 0, innerR * 0.4, 0, 0, outerR);
    grad.addColorStop(0.0, `rgba(${cr + 10},${cg + 8},${cb},${alphaBase * 0.95})`);
    grad.addColorStop(0.45, `rgba(${cr + 25},${cg + 18},${cb + 5},${alphaBase * 0.8})`);
    grad.addColorStop(0.85, `rgba(${cr},${cg},${cb},${alphaBase * 0.45})`);
    grad.addColorStop(1.0, "rgba(0,0,0,0)");

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, outerR, 0, 2 * Math.PI);
    ctx.arc(0, 0, innerR, 0, 2 * Math.PI, true);
    ctx.closePath();
    ctx.fill();

    const beamRadius = (innerR + outerR) * 0.55;
    ctx.lineWidth = r * 0.32;
    ctx.strokeStyle = `rgba(255, 246, 232, ${alphaBase * 1.05})`;
    ctx.beginPath();
    ctx.arc(0, 0, beamRadius, -Math.PI * 0.3, Math.PI * 0.3);
    ctx.stroke();

    if (isDynamic && activity > 0.2) {
        const hotspotAngle = state.phase * 1.3;
        const hotR = beamRadius * 0.9;
        const hx = Math.cos(hotspotAngle) * hotR;
        const hy = Math.sin(hotspotAngle) * hotR * 0.4;
        const hotspotAlpha = 0.75 + 0.25 * flicker;

        ctx.globalAlpha = hotspotAlpha;
        ctx.beginPath();
        ctx.fillStyle = "rgba(255, 252, 244, 0.98)";
        ctx.arc(hx, hy, r * 0.4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    ctx.restore();

    const haloR = r * (2.0 + glowBoost * 0.4);
    const halo = ctx.createRadialGradient(x, y, r * 0.3, x, y, haloR);
    halo.addColorStop(0, "rgba(0,0,0,1)");
    halo.addColorStop(0.45, `rgba(${cr},${cg},${cb},${0.55 + 0.25 * activity})`);
    halo.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, haloR, 0, 2 * Math.PI);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = "black";
    ctx.fill();

    ctx.restore();
}

function drawVignette(ctx, state) {
    const width = state.width;
    const height = state.height;
    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.max(width, height) / 1.1;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.6, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.8)");

    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
}

// ------------------------------------------
// Run simulation
// ------------------------------------------

setInterval(() => drawBlackHoleMerger(ctx), 100);
