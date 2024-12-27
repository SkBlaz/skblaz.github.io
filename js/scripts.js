// Custom Background Visualizations

// Random color sets
const rcol = Math.random() > 0.5
    ? ["green", "blue", "red", "yellow", "white"]
    : ["green", "white", "orange"];

// Add random selector to Array prototype
Array.prototype.random = function () {
    return this[Math.floor(Math.random() * this.length)];
};

// Clear the canvas with black background
function cleanCanvas(canvas, ctx) {
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Initialize canvas dimensions
function initializeCanvas() {
    const canvas = document.getElementById("myCanvas");
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    cleanCanvas(canvas, ctx);
    return { canvas, ctx };
}

// Generate a random number between a range
function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

// Draw random lines with bezier curves
function drawRandomLine(ctx, x0, y0, max = 0) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    let currentX = max === 0 ? x0 : width - x0 - Math.random() * 50;
    let currentY = max === 0 ? y0 : height / 2;

    const rscale = max === 0 ? 40 : 80;

    for (let r = 0; r < 60; r++) {
        const dxTmp = currentX + getRandomArbitrary(-1, 1) * rscale;
        const dyTmp = currentY + getRandomArbitrary(-1, 1.4) * rscale;

        ctx.moveTo(currentX, currentY);
        if (Math.random() > 0.2) {
            ctx.bezierCurveTo(currentX, currentY + 1, dxTmp, currentY - 1, dxTmp, dyTmp);
        } else {
            ctx.lineTo(dxTmp, dyTmp);
        }

        ctx.lineWidth = 0.02;
        ctx.strokeStyle = "gray";
        ctx.globalAlpha = 0.6;
        if (r % 20 === 0) ctx.stroke();

        ctx.fillStyle = rcol.random();
        ctx.globalAlpha = 0.6;
        const size = max === 0 ? Math.floor(Math.random() * 6 + 4) : Math.floor(Math.random() * 8 + 8);
        ctx.fillRect(dxTmp - 3, dyTmp - 3, size, size);

        currentX = dxTmp;
        currentY = dyTmp;
    }
}

// Draw random triangles
function drawTriangles(ctx) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const rcol = ["BurlyWood", "DarkOliveGreen", "GoldenRod"];
    const nTriangles = 70;

    for (let i = 0; i < nTriangles; i++) {
        const offset = 30 * (Math.random() * (Math.random() > 0.5 ? 1 : -1));
        const randomX = width * Math.random();
        const randomY = height * Math.random();

        ctx.beginPath();
        ctx.moveTo(randomX, randomY);
        ctx.lineTo(randomX + offset * Math.random() * 2, randomY);
        ctx.lineTo(randomX + offset, randomY - offset);

        ctx.fillStyle = rcol.random();
        ctx.globalAlpha = 0.1;
        ctx.fill();
    }
}

// Draw Julia set
function drawJuliaSet(ctx) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const RE_START = -2, RE_END = 2, IM_START = -1, IM_END = 1;

    for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {
            if (Math.random() > 0.999) {
                const x = RE_START + (i / width) * (RE_END - RE_START);
                const y = IM_START + (j / height) * (IM_END - IM_START);
                const cnum = math.complex(x, y);
                const juliaNum = juliaAux(cnum);

                if (juliaNum < 60) {
                    const color = `rgba(${juliaNum * Math.floor(Math.random() * 5)},
                        ${juliaNum * Math.floor(Math.random() * 15)},
                        ${juliaNum * Math.floor(Math.random() * 12)}, 0.7)`;
                    drawCircle(ctx, i, j, 4 * Math.random(), color);
                }
            }
        }
    }
}

// Julia set auxiliary calculations
function juliaAux(number, boundary = 3) {
    let z = math.complex(0.0, 0.0);
    let n = 0;
    while (math.abs(z) <= boundary && n < 60) {
        z = math.add(math.multiply(z, z, z, z), number);
        n++;
    }
    return n === 100 ? 100 : n + 1 - Math.log(Math.log2(math.abs(z)));
}

// Draw a circle with specified properties
function drawCircle(ctx, x, y, radius, fill) {
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
}

// Main canvas setup
const { canvas, ctx } = initializeCanvas();
const functions = [() => drawRandomLine(ctx, 3, 3), () => drawTriangles(ctx), () => drawJuliaSet(ctx)];
const randomFunc = functions[Math.floor(Math.random() * functions.length)];
setInterval(randomFunc, 100);
