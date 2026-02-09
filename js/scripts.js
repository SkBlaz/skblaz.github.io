// Black hole background (WebGL2) using trimmed Blackhole shaders/assets
// --------------------------------------------------------------------

(() => {
    const canvas = document.getElementById("myCanvas");
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
        antialias: false,
        alpha: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        powerPreference: "high-performance"
    });

    if (!gl) {
        canvas.style.background = "black";
        return;
    }

    const MAX_DPR = 1.0;
    const lowEndDevice = ((navigator.hardwareConcurrency || 8) <= 4) || ((navigator.deviceMemory || 8) <= 4);
    const detailSlider = document.getElementById("detailSlider");
    const detailValue = document.getElementById("detailValue");
    const DETAIL_STEP = 0.01;
    const DETAIL_LEVELS = Array.from({ length: 101 }, (_, i) => i / 100);
    const DETAIL_APPLY_DEBOUNCE_MS = 120;
    const LOW_DETAIL_PROFILE = {
        baseRenderScale: lowEndDevice ? 0.62 : 0.72,
        minRenderScale: lowEndDevice ? 0.45 : 0.5,
        maxRenderScale: lowEndDevice ? 0.72 : 0.8,
        frameCheckMs: 700,
        perfDropThreshold: 1.08,
        perfRiseThreshold: 0.78,
        adiskNoiseLod: 1.0,
        shaderStepSize: 0.12,
        shaderTraceIterations: 168,
        shaderDiskSampleStride: 3
    };
    const HIGH_DETAIL_PROFILE = {
        baseRenderScale: 1.0,
        minRenderScale: 1.0,
        maxRenderScale: 1.0,
        frameCheckMs: 1400,
        perfDropThreshold: 1.25,
        perfRiseThreshold: 0.75,
        adiskNoiseLod: 2.0,
        shaderStepSize: 0.1,
        shaderTraceIterations: 220,
        shaderDiskSampleStride: 1
    };
    const TARGET_FPS = 30;
    const SCALE_STEP = 0.05;

    const lerp = (a, b, t) => a + (b - a) * t;
    const lerpInt = (a, b, t) => Math.round(lerp(a, b, t));
    function createDetailProfile(level) {
        return {
            baseRenderScale: lerp(LOW_DETAIL_PROFILE.baseRenderScale, HIGH_DETAIL_PROFILE.baseRenderScale, level),
            minRenderScale: lerp(LOW_DETAIL_PROFILE.minRenderScale, HIGH_DETAIL_PROFILE.minRenderScale, level),
            maxRenderScale: lerp(LOW_DETAIL_PROFILE.maxRenderScale, HIGH_DETAIL_PROFILE.maxRenderScale, level),
            frameCheckMs: lerpInt(LOW_DETAIL_PROFILE.frameCheckMs, HIGH_DETAIL_PROFILE.frameCheckMs, level),
            perfDropThreshold: lerp(LOW_DETAIL_PROFILE.perfDropThreshold, HIGH_DETAIL_PROFILE.perfDropThreshold, level),
            perfRiseThreshold: lerp(LOW_DETAIL_PROFILE.perfRiseThreshold, HIGH_DETAIL_PROFILE.perfRiseThreshold, level),
            adiskNoiseLod: lerp(LOW_DETAIL_PROFILE.adiskNoiseLod, HIGH_DETAIL_PROFILE.adiskNoiseLod, level),
            shaderStepSize: lerp(LOW_DETAIL_PROFILE.shaderStepSize, HIGH_DETAIL_PROFILE.shaderStepSize, level),
            shaderTraceIterations: lerpInt(LOW_DETAIL_PROFILE.shaderTraceIterations, HIGH_DETAIL_PROFILE.shaderTraceIterations, level),
            shaderDiskSampleStride: lerpInt(LOW_DETAIL_PROFILE.shaderDiskSampleStride, HIGH_DETAIL_PROFILE.shaderDiskSampleStride, level)
        };
    }
    const DETAIL_PROFILES = DETAIL_LEVELS.map((level) => createDetailProfile(level));

    let detailLevel = DETAIL_LEVELS[0];
    let baseRenderScale = DETAIL_PROFILES[0].baseRenderScale;
    let minRenderScale = DETAIL_PROFILES[0].minRenderScale;
    let maxRenderScale = DETAIL_PROFILES[0].maxRenderScale;
    let frameCheckMs = DETAIL_PROFILES[0].frameCheckMs;
    let perfDropThreshold = DETAIL_PROFILES[0].perfDropThreshold;
    let perfRiseThreshold = DETAIL_PROFILES[0].perfRiseThreshold;
    let adiskNoiseLod = DETAIL_PROFILES[0].adiskNoiseLod;
    let shaderStepSize = DETAIL_PROFILES[0].shaderStepSize;
    let shaderTraceIterations = DETAIL_PROFILES[0].shaderTraceIterations;
    let shaderDiskSampleStride = DETAIL_PROFILES[0].shaderDiskSampleStride;

    let width = 0;
    let height = 0;
    let renderW = 0;
    let renderH = 0;
    let renderScale = baseRenderScale;

    let mainProgram = null;
    let toneProgram = null;
    let quad = null;
    let rafId = 0;
    let contextLost = false;

    let texMain = null;
    let fboMain = null;

    let galaxyTex = null;
    let colorTex = null;

    let errorOverlay = null;
    const uniformCache = new WeakMap();
    const uniformValueCache = new WeakMap();
    let onDetailProfileChanged = null;
    let detailApplyTimer = 0;

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    function normalizeDetailLevel(rawValue) {
        const numeric = Number(rawValue);
        if (!Number.isFinite(numeric)) return 0;
        const clamped = clamp(numeric, 0, 1);
        return Number((Math.round(clamped / DETAIL_STEP) * DETAIL_STEP).toFixed(2));
    }

    function formatDetailLevel(level) {
        if (Math.abs(level) < 1e-6 || Math.abs(level - 1) < 1e-6) {
            return String(Math.round(level));
        }
        return level.toFixed(2);
    }

    function getDetailProfile(level) {
        const index = Math.max(0, Math.min(DETAIL_PROFILES.length - 1, Math.round(level / DETAIL_STEP)));
        return DETAIL_PROFILES[index];
    }

    function syncDetailControlUI() {
        if (detailSlider) {
            const formatted = formatDetailLevel(detailLevel);
            detailSlider.value = String(detailLevel);
            detailSlider.setAttribute("aria-valuenow", formatted);
        }
        if (detailValue) {
            detailValue.textContent = formatDetailLevel(detailLevel);
        }
    }

    function applyDetailLevel(rawValue, resetRenderScale = false) {
        const nextLevel = normalizeDetailLevel(rawValue);
        const profileChanged = nextLevel !== detailLevel;
        detailLevel = nextLevel;
        const profile = getDetailProfile(detailLevel);

        baseRenderScale = profile.baseRenderScale;
        minRenderScale = profile.minRenderScale;
        maxRenderScale = profile.maxRenderScale;
        frameCheckMs = profile.frameCheckMs;
        perfDropThreshold = profile.perfDropThreshold;
        perfRiseThreshold = profile.perfRiseThreshold;
        adiskNoiseLod = profile.adiskNoiseLod;
        shaderStepSize = profile.shaderStepSize;
        shaderTraceIterations = profile.shaderTraceIterations;
        shaderDiskSampleStride = profile.shaderDiskSampleStride;

        if (resetRenderScale || profileChanged) {
            renderScale = baseRenderScale;
        } else {
            renderScale = clamp(renderScale, minRenderScale, maxRenderScale);
        }

        syncDetailControlUI();
        if (typeof onDetailProfileChanged === "function") {
            onDetailProfileChanged(profileChanged);
        }

        if (!contextLost && width > 0 && height > 0) {
            resize();
        }
    }

    function showError(message) {
        if (!errorOverlay) {
            errorOverlay = document.createElement("pre");
            errorOverlay.style.position = "fixed";
            errorOverlay.style.left = "12px";
            errorOverlay.style.top = "12px";
            errorOverlay.style.right = "12px";
            errorOverlay.style.maxHeight = "45vh";
            errorOverlay.style.overflow = "auto";
            errorOverlay.style.background = "rgba(0,0,0,0.75)";
            errorOverlay.style.color = "#ffccaa";
            errorOverlay.style.padding = "10px 12px";
            errorOverlay.style.fontSize = "12px";
            errorOverlay.style.zIndex = "9999";
            errorOverlay.style.border = "1px solid rgba(255,204,170,0.35)";
            document.body.appendChild(errorOverlay);
        }
        errorOverlay.textContent = message;
    }

    function loadText(url) {
        return fetch(url, { cache: "force-cache" }).then((res) => {
            if (!res.ok) throw new Error(`Failed to load shader: ${url}`);
            return res.text();
        });
    }

    async function loadImageBitmap(url) {
        const res = await fetch(url, { cache: "force-cache" });
        if (!res.ok) throw new Error(`Failed to load image: ${url}`);
        const blob = await res.blob();
        if (self.createImageBitmap) {
            return await createImageBitmap(blob);
        }
        return await new Promise((resolve, reject) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(blob);
            img.crossOrigin = "anonymous";
            img.onload = () => {
                URL.revokeObjectURL(objectUrl);
                resolve(img);
            };
            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error(`Failed to decode image: ${url}`));
            };
            img.src = objectUrl;
        });
    }

    function toGLSL300(src, isFragment) {
        let s = src.replace(/^#version\s+330\s+core/m, "#version 300 es");
        if (isFragment) {
            if (!/precision\s+highp\s+float/.test(s)) {
                s = s.replace("#version 300 es\n", "#version 300 es\nprecision highp float;\n");
            }
            if (!/out\s+vec4\s+fragColor/.test(s)) {
                s = s.replace(/precision highp float;\n/, "precision highp float;\nlayout(location = 0) out vec4 fragColor;\n");
            }
        } else {
            if (!/precision\s+highp\s+float/.test(s)) {
                s = s.replace("#version 300 es\n", "#version 300 es\nprecision highp float;\n");
            }
        }

        // Strip default uniform initializers for GLSL ES compatibility.
        s = s.replace(/uniform\s+(float|int|bool|vec[234])\s+([A-Za-z0-9_]+)\s*=\s*[^;]+;/g, "uniform $1 $2;");
        return s;
    }

    function compileShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const msg = gl.getShaderInfoLog(shader) || "unknown";
            gl.deleteShader(shader);
            throw new Error(`Shader compile failed: ${msg}`);
        }
        return shader;
    }

    function createProgram(vsSrc, fsSrc) {
        const vs = compileShader(gl.VERTEX_SHADER, vsSrc);
        const fs = compileShader(gl.FRAGMENT_SHADER, fsSrc);
        const program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.bindAttribLocation(program, 0, "position");
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const msg = gl.getProgramInfoLog(program) || "unknown";
            gl.deleteProgram(program);
            throw new Error(`Program link failed: ${msg}`);
        }
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        return program;
    }

    function createTexture(widthPx, heightPx) {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            widthPx,
            heightPx,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null
        );
        gl.bindTexture(gl.TEXTURE_2D, null);
        return tex;
    }

    function createFBO(tex) {
        const fbo = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return fbo;
    }

    function createGalaxyTexturePlaceholder() {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const black = new Uint8Array([0, 0, 0, 255]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, black);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return tex;
    }

    function updateGalaxyTexture(tex, image) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    function createColorTexturePlaceholder() {
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const black = new Uint8Array([0, 0, 0, 255]);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, black);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return tex;
    }

    function setupQuad() {
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([
                -1, -1, 0,
                 1, -1, 0,
                -1,  1, 0,
                -1,  1, 0,
                 1, -1, 0,
                 1,  1, 0
            ]),
            gl.STATIC_DRAW
        );

        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
        gl.bindVertexArray(null);

        return vao;
    }

    function bindTextureUnit(unit, target, tex) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(target, tex);
    }

    function setTextureUnit(program, uniformName, unit) {
        const loc = getUniformLocation(program, uniformName);
        if (loc !== null) gl.uniform1i(loc, unit);
    }

    function getUniformLocation(program, name) {
        let programCache = uniformCache.get(program);
        if (!programCache) {
            programCache = new Map();
            uniformCache.set(program, programCache);
        }
        if (programCache.has(name)) {
            return programCache.get(name);
        }
        const loc = gl.getUniformLocation(program, name);
        programCache.set(name, loc);
        return loc;
    }

    function areUniformValuesEqual(a, b) {
        if (typeof a === "number" || typeof b === "number") {
            return a === b;
        }
        if (!a || !b || a.length !== b.length) {
            return false;
        }
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    function cloneUniformValue(value) {
        if (typeof value === "number") return value;
        if (value && typeof value.length === "number") return Array.from(value);
        return value;
    }

    function setUniforms(program, uniforms, force = false) {
        let valueCache = uniformValueCache.get(program);
        if (!valueCache) {
            valueCache = new Map();
            uniformValueCache.set(program, valueCache);
        }
        for (const [name, value] of Object.entries(uniforms)) {
            if (!force && valueCache.has(name) && areUniformValuesEqual(valueCache.get(name), value)) {
                continue;
            }
            const loc = getUniformLocation(program, name);
            if (loc === null) continue;
            if (typeof value === "number") {
                gl.uniform1f(loc, value);
            } else if (value.length === 2) {
                gl.uniform2f(loc, value[0], value[1]);
            } else if (value.length === 3) {
                gl.uniform3f(loc, value[0], value[1], value[2]);
            } else if (value.length === 4) {
                gl.uniform4f(loc, value[0], value[1], value[2], value[3]);
            }
            valueCache.set(name, cloneUniformValue(value));
        }
    }

    function resize() {
        if (contextLost) return;
        const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        width = Math.max(1, Math.floor(window.innerWidth * dpr));
        height = Math.max(1, Math.floor(window.innerHeight * dpr));

        canvas.width = width;
        canvas.height = height;

        renderW = Math.max(2, Math.floor(width * renderScale));
        renderH = Math.max(2, Math.floor(height * renderScale));

        if (texMain) gl.deleteTexture(texMain);
        if (fboMain) gl.deleteFramebuffer(fboMain);

        texMain = createTexture(renderW, renderH);
        fboMain = createFBO(texMain);
    }

    async function init() {
            const ASSET_VER = "20260209-84";

        const CAMERA_TUNING = {
            approachStart: 1.0,
            approachDuration: 18.0,
            orbitStart: 10.0,
            orbitDuration: 8.0,
            postOrbitStart: 18.0,
            baseDistance: 36.0,
            approachDistanceDelta: 20.0,
            baseHeight: 1.2,
            heightWobbleAmp: 1.0,
            heightWobbleFreq: 0.08,
            orbitHeightBase: 2.0,
            orbitHeightAmp: 4.0,
            orbitHeightFreq: 0.22,
            orbitPhaseBase: 0.18,
            orbitPhaseExtra: 0.12
        };

        const JET_TUNING = {
            base: 0.0,
            flickerBase: 0.55,
            flickerAmp: 0.35,
            flickerFreq: 0.9,
            noiseBase: 0.75,
            noiseAmp: 0.25,
            noiseFreqA: 2.3,
            noiseFreqB: 0.4,
            noisePhase: 2.1,
            introFadeStart: 11.0,
            introFadeEnd: 18.0,
            radius: 1.35,
            length: 20.0
        };

        const BH_PHYSICS_TUNING = {
            spin: 0.52,
            diskInnerRadius: 2.95,
            diskOuterRadius: 12.0,
            diskOpacity: 0.86
        };
        const JETS_ENABLED = JET_TUNING.base > 0.0001;

        const MAIN_STATIC_UNIFORMS = {
            mouseX: 0.0,
            mouseY: 0.0,
            frontView: 0.0,
            topView: 0.0,
            cameraRoll: 0.0,
            gravatationalLensing: 1.0,
            renderBlackHole: 1.0,
            mouseControl: 0.0,
            fovScale: 1.0,
            adiskEnabled: 1.0,
            adiskParticle: 1.0,
            adiskHeight: 0.30,
            adiskLit: 0.078,
            adiskDensityV: 0.95,
            adiskDensityH: 2.15,
            adiskNoiseScale: 1.0,
            adiskNoiseLOD: adiskNoiseLod,
            adiskSpeed: 0.30,
            jetRadius: JET_TUNING.radius,
            jetLength: JET_TUNING.length,
            bhSpin: BH_PHYSICS_TUNING.spin,
            diskInnerRadius: BH_PHYSICS_TUNING.diskInnerRadius,
            diskOuterRadius: BH_PHYSICS_TUNING.diskOuterRadius,
            diskOpacity: BH_PHYSICS_TUNING.diskOpacity
        };
        const TONE_STATIC_UNIFORMS = { gamma: 2.4, tonemappingEnabled: 1.0 };
        const mainFrameUniforms = {
            resolution: [0, 0],
            time: 0.0,
            camDistance: 0.0,
            camHeight: 0.0,
            camOrbitPhase: 0.0,
            camOrbitMix: 0.0,
            jetStrength: 0.0
        };
        const toneFrameUniforms = { resolution: [0, 0] };
        const quickFrameUniforms = { resolution: [0, 0], time: 0.0 };

        const QUICK_VERT = `#version 300 es
        precision highp float;
        layout(location = 0) in vec3 position;
        out vec2 uv;
        void main() {
            uv = (position.xy + 1.0) * 0.5;
            gl_Position = vec4(position, 1.0);
        }`;

        const QUICK_FRAG = `#version 300 es
        precision highp float;
        in vec2 uv;
        layout(location = 0) out vec4 fragColor;
        uniform float time;
        uniform vec2 resolution;
        void main() {
            vec2 p = uv - 0.5;
            p.x *= resolution.x / max(resolution.y, 1.0);
            float r = length(p);
            float ring = smoothstep(0.32, 0.28, r) - smoothstep(0.42, 0.38, r);
            float core = smoothstep(0.18, 0.04, r);
            float flicker = 0.85 + 0.15 * sin(time * 0.9);
            vec3 base = vec3(0.01, 0.01, 0.01);
            vec3 warm = vec3(0.35, 0.22, 0.1);
            vec3 col = base + warm * (core * 0.9 + ring * 0.7) * flicker;
            fragColor = vec4(col, 1.0);
        }`;

        const quickProgram = createProgram(QUICK_VERT, QUICK_FRAG);
        const modal = document.getElementById("blazModal");
        let isPaused = false;
        if (modal) {
            const syncPauseState = () => {
                isPaused = modal.classList.contains("is-open");
            };
            syncPauseState();
            const observer = new MutationObserver(syncPauseState);
            observer.observe(modal, { attributes: true, attributeFilter: ["class"] });
        }

        quad = setupQuad();
        resize();
        window.addEventListener("resize", resize);

        let lastFrameTime = 0;
        let lastPerfCheck = 0;
        let smoothedFrameMs = 1000 / TARGET_FPS;
        const frameBudget = 1000 / TARGET_FPS;
        const minFrameMs = 1000 / TARGET_FPS;
        function render(time) {
            if (contextLost) {
                return;
            }
            if (isPaused) {
                rafId = requestAnimationFrame(render);
                return;
            }
            if (time - lastFrameTime < minFrameMs) {
                rafId = requestAnimationFrame(render);
                return;
            }
            const frameDelta = time - lastFrameTime || frameBudget;
            lastFrameTime = time;
            smoothedFrameMs = smoothedFrameMs * 0.9 + frameDelta * 0.1;
            if (time - lastPerfCheck > frameCheckMs) {
                lastPerfCheck = time;
                if (smoothedFrameMs > frameBudget * perfDropThreshold && renderScale > minRenderScale) {
                    renderScale = Math.max(minRenderScale, renderScale - SCALE_STEP);
                    resize();
                } else if (smoothedFrameMs < frameBudget * perfRiseThreshold && renderScale < maxRenderScale) {
                    renderScale = Math.min(maxRenderScale, renderScale + SCALE_STEP);
                    resize();
                }
            }
            const t = time * 0.001;
            gl.disable(gl.DEPTH_TEST);
            gl.bindVertexArray(quad);

            if (!mainProgram || !toneProgram) {
                gl.useProgram(quickProgram);
                gl.bindFramebuffer(gl.FRAMEBUFFER, null);
                gl.viewport(0, 0, width, height);
                quickFrameUniforms.resolution[0] = width;
                quickFrameUniforms.resolution[1] = height;
                quickFrameUniforms.time = t;
                setUniforms(quickProgram, quickFrameUniforms);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
                rafId = requestAnimationFrame(render);
                return;
            }

            // 1) Main black hole render to lower-res target
            gl.useProgram(mainProgram);
            gl.bindFramebuffer(gl.FRAMEBUFFER, fboMain);
            gl.viewport(0, 0, renderW, renderH);
            const approach = clamp((t - CAMERA_TUNING.approachStart) / CAMERA_TUNING.approachDuration, 0.0, 1.0);
            const approachEase = approach * approach * (3.0 - 2.0 * approach);
            const orbitMix = clamp((t - CAMERA_TUNING.orbitStart) / CAMERA_TUNING.orbitDuration, 0.0, 1.0);
            const orbitEase = orbitMix * orbitMix * (3.0 - 2.0 * orbitMix);

            const camDistance = CAMERA_TUNING.baseDistance - CAMERA_TUNING.approachDistanceDelta * approachEase;
            const postOrbit = Math.max(t - CAMERA_TUNING.postOrbitStart, 0.0);
            const camHeight = orbitEase > 0.0
                ? CAMERA_TUNING.orbitHeightBase + CAMERA_TUNING.orbitHeightAmp * Math.sin(postOrbit * CAMERA_TUNING.orbitHeightFreq)
                : CAMERA_TUNING.baseHeight + CAMERA_TUNING.heightWobbleAmp * Math.sin(t * CAMERA_TUNING.heightWobbleFreq);
            const camOrbitPhase = t * CAMERA_TUNING.orbitPhaseBase + postOrbit * CAMERA_TUNING.orbitPhaseExtra;
            let jetStrength = 0.0;
            if (JETS_ENABLED) {
                const jetFlicker = JET_TUNING.flickerBase + JET_TUNING.flickerAmp * Math.sin(t * JET_TUNING.flickerFreq);
                const jetNoise = JET_TUNING.noiseBase + JET_TUNING.noiseAmp * Math.sin(t * JET_TUNING.noiseFreqA + Math.sin(t * JET_TUNING.noiseFreqB) * JET_TUNING.noisePhase);
                const jetIntroRaw = clamp(
                    (t - JET_TUNING.introFadeStart) / Math.max(JET_TUNING.introFadeEnd - JET_TUNING.introFadeStart, 0.001),
                    0.0,
                    1.0
                );
                const jetIntro = jetIntroRaw * jetIntroRaw * (3.0 - 2.0 * jetIntroRaw);
                jetStrength = JET_TUNING.base * jetFlicker * jetNoise * jetIntro;
            }

            mainFrameUniforms.resolution[0] = renderW;
            mainFrameUniforms.resolution[1] = renderH;
            mainFrameUniforms.time = t;
            mainFrameUniforms.camDistance = camDistance;
            mainFrameUniforms.camHeight = camHeight;
            mainFrameUniforms.camOrbitPhase = camOrbitPhase;
            mainFrameUniforms.camOrbitMix = orbitEase;
            mainFrameUniforms.jetStrength = jetStrength;
            setUniforms(mainProgram, mainFrameUniforms);
            bindTextureUnit(0, gl.TEXTURE_2D, galaxyTex);
            bindTextureUnit(1, gl.TEXTURE_2D, colorTex);
            gl.drawArrays(gl.TRIANGLES, 0, 6);

            // 2) Tonemap + present
            gl.useProgram(toneProgram);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, width, height);
            toneFrameUniforms.resolution[0] = width;
            toneFrameUniforms.resolution[1] = height;
            setUniforms(toneProgram, toneFrameUniforms);
            bindTextureUnit(0, gl.TEXTURE_2D, texMain);
            gl.drawArrays(gl.TRIANGLES, 0, 6);

            rafId = requestAnimationFrame(render);
        }

        rafId = requestAnimationFrame(render);

        const TONE_PATCH = [
            "fragColor.rgb = pow(fragColor.rgb, vec3(1.0 / gamma));"
        ].join("\n");
        const DISK_SAMPLE_BLOCK_RE = /if\s*\(\s*adiskEnabled\s*>\s*0\.5\s*\)\s*\{\s*adiskColor\(\s*pos\s*,\s*color\s*,\s*alpha\s*\)\s*;\s*jetColor\(\s*pos\s*,\s*color\s*,\s*alpha\s*\)\s*;\s*\}/;
        let shaderSources = null;
        let texturesLoadStarted = false;

        function buildMainShaderSource(mainSrcRaw) {
            let mainSrc = toGLSL300(mainSrcRaw, true);
            mainSrc = mainSrc.replace(/texture2D\s*\(/g, "texture(");
            mainSrc = mainSrc.replace(/pow\s*\(\s*i\s*,/g, "pow(float(i),");
            if (adiskNoiseLod <= 1.0) {
                mainSrc = mainSrc.replace(/pow\s*\(\s*float\(i\)\s*,\s*2\.0\s*\)/g, "pow(float(i + 1), 2.0)");
            }
            if (Math.abs(shaderStepSize - 0.1) > 1e-6) {
                mainSrc = mainSrc.replace(/float\s+STEP_SIZE\s*=\s*0\.1\s*;/, `float STEP_SIZE = ${shaderStepSize.toFixed(2)};`);
            }
            if (shaderTraceIterations !== 220) {
                mainSrc = mainSrc.replace(
                    /for\s*\(\s*int\s+i\s*=\s*0\s*;\s*i\s*<\s*220\s*;\s*i\+\+\s*\)\s*\{/,
                    `for (int i = 0; i < ${shaderTraceIterations}; i++) {`
                );
            }
            if (shaderDiskSampleStride > 1) {
                mainSrc = mainSrc.replace(
                    DISK_SAMPLE_BLOCK_RE,
                    [
                        "if (adiskEnabled > 0.5) {",
                        `          if ((i % ${shaderDiskSampleStride}) == 0) {`,
                        "            adiskColor(pos, color, alpha);",
                        "          }",
                        "          jetColor(pos, color, alpha);",
                        "        }"
                    ].join("\n")
                );
            }
            return mainSrc;
        }

        function buildToneShaderSource(toneSrcRaw) {
            let toneSrc = toGLSL300(toneSrcRaw, true);
            toneSrc = toneSrc.replace(
                "fragColor.rgb = pow(fragColor.rgb, vec3(1.0 / gamma));",
                TONE_PATCH
            );
            return toneSrc;
        }

        function rebuildCompiledPrograms() {
            if (!shaderSources) return;

            const mainSrc = buildMainShaderSource(shaderSources.mainSrcRaw);
            const toneSrc = buildToneShaderSource(shaderSources.toneSrcRaw);
            const vertSrc = toGLSL300(shaderSources.vertSrcRaw, false);
            const nextMainProgram = createProgram(vertSrc, mainSrc);
            const nextToneProgram = createProgram(vertSrc, toneSrc);

            if (mainProgram) gl.deleteProgram(mainProgram);
            if (toneProgram) gl.deleteProgram(toneProgram);
            mainProgram = nextMainProgram;
            toneProgram = nextToneProgram;

            MAIN_STATIC_UNIFORMS.adiskNoiseLOD = adiskNoiseLod;
            gl.useProgram(mainProgram);
            setUniforms(mainProgram, MAIN_STATIC_UNIFORMS, true);
            setTextureUnit(mainProgram, "galaxy", 0);
            setTextureUnit(mainProgram, "colorMap", 1);
            gl.useProgram(toneProgram);
            setUniforms(toneProgram, TONE_STATIC_UNIFORMS, true);
            setTextureUnit(toneProgram, "texture0", 0);

            if (!galaxyTex) galaxyTex = createGalaxyTexturePlaceholder();
            if (!colorTex) colorTex = createColorTexturePlaceholder();
        }

        onDetailProfileChanged = (profileChanged) => {
            MAIN_STATIC_UNIFORMS.adiskNoiseLOD = adiskNoiseLod;
            if (profileChanged && shaderSources) {
                try {
                    rebuildCompiledPrograms();
                } catch (err) {
                    console.error("Blackhole detail switch failed:", err);
                }
            } else if (mainProgram) {
                gl.useProgram(mainProgram);
                setUniforms(mainProgram, { adiskNoiseLOD: MAIN_STATIC_UNIFORMS.adiskNoiseLOD }, true);
            }
        };

        // Load and compile the full shaders in the background (defer to avoid blocking startup).
        const loadFullShaders = async () => {
            const [mainSrcRaw, toneSrcRaw, vertSrcRaw] = await Promise.all([
                loadText(`bhsim/shader/blackhole_main.frag?v=${ASSET_VER}`),
                loadText(`bhsim/shader/tonemapping.frag?v=${ASSET_VER}`),
                loadText(`bhsim/shader/simple.vert?v=${ASSET_VER}`)
            ]);
            shaderSources = { mainSrcRaw, toneSrcRaw, vertSrcRaw };
            rebuildCompiledPrograms();

            if (texturesLoadStarted) return;
            texturesLoadStarted = true;

            // Load actual textures in the background and swap them in.
            (async () => {
                const [galaxyEquirect, colorMap] = await Promise.all([
                    loadImageBitmap(`bhsim/assets/skybox_nebula_dark/equirect.png?v=${ASSET_VER}`),
                    loadImageBitmap(`bhsim/assets/color_map.png?v=${ASSET_VER}`)
                ]);

                updateGalaxyTexture(galaxyTex, galaxyEquirect);
                gl.bindTexture(gl.TEXTURE_2D, colorTex);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, colorMap);
                gl.bindTexture(gl.TEXTURE_2D, null);
            })().catch((err) => {
                console.error("Blackhole texture load failed:", err);
            });
        };

        const deferLoad = () => loadFullShaders().catch((err) => {
            console.error("Blackhole shader load failed:", err);
            showError(`Blackhole init failed:\n${err}`);
        });

        if (typeof requestIdleCallback === "function") {
            requestIdleCallback(deferLoad, { timeout: 2000 });
        } else {
            setTimeout(deferLoad, 800);
        }
    }

    syncDetailControlUI();
    if (detailSlider) {
        const queueDetailApply = (rawValue) => {
            const previewLevel = normalizeDetailLevel(rawValue);
            const formatted = formatDetailLevel(previewLevel);
            detailSlider.setAttribute("aria-valuenow", formatted);
            if (detailValue) detailValue.textContent = formatted;
            if (detailApplyTimer) clearTimeout(detailApplyTimer);
            detailApplyTimer = window.setTimeout(() => {
                detailApplyTimer = 0;
                applyDetailLevel(previewLevel, true);
            }, DETAIL_APPLY_DEBOUNCE_MS);
        };
        detailSlider.addEventListener("input", (event) => {
            queueDetailApply(event.target.value);
        });
        detailSlider.addEventListener("change", (event) => {
            if (detailApplyTimer) clearTimeout(detailApplyTimer);
            detailApplyTimer = 0;
            applyDetailLevel(event.target.value, true);
        });
    }
    applyDetailLevel(0, true);

    init().catch((err) => {
        console.error("Blackhole init failed:", err);
        if (err && String(err).includes("cross-origin")) {
            const protocolHint = location.protocol === "file:"
                ? " (Tip: open via a local server or GitHub Pages, not file://)"
                : "";
            showError(`Blackhole init failed:\n${err}${protocolHint}`);
        } else {
            showError(`Blackhole init failed:\n${err}`);
        }
        canvas.style.background = "black";
    });

    canvas.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        contextLost = true;
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = 0;
        }
    }, false);

    // Rebuild all resources via full page state reload.
    canvas.addEventListener("webglcontextrestored", () => {
        location.reload();
    }, false);
})();
