//Some custom background stuff BS2021

var rcol = ["green","blue","red","yellow","white"]
var rcol = ["green","white"]
var giter = 0;

Array.prototype.random = function () {
    return this[Math.floor((Math.random()*this.length))];
}

function cleanCanvas(){

    var canvas = document.getElementById("myCanvas");
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
}

function initializeCanvas(){
    var canvas = document.getElementById("myCanvas");
    var ctx = canvas.getContext("2d");
    canvas.width = $(window).width();   // Add this to your code
    canvas.height = $(window).height(); // Add this to your code
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    return ctx
}

function getRandomArbitrary(min, max) {
    return Math.random() * (max - min) + min;
}

function drawRandomLine(ctx, x0, y0){
    // if (giter % 30 == 0){
    // 	cleanCanvas();
    // }
    var currentX = 0 + x0
    var currentY = 0 + y0    
    var dx = 2
    var dy = 2
    var r = 0
    var rscale = 40
    items = ["gray"]
    while (r < 50) {
	ctx.moveTo(currentX, currentY);
	var dxTmp = dx + getRandomArbitrary(-1,1)*rscale + currentX
	var dyTmp = dy + getRandomArbitrary(-1,1.4)*rscale + currentY
	ctx.lineTo(dxTmp, dyTmp);
	ctx.lineWidth = 0.02;
	if (Math.random() > 0.3){
	    var item = items[0];    
	}else {
	    var item = items[1];
	}

	ctx.strokeStyle = item;
	ctx.globalAlpha = 0.9;
	ctx.stroke();
	ctx.fillStyle = rcol.random();
	ctx.globalAlpha = 0.6;
	var size = Math.floor(Math.random() * 4) + 4;
	ctx.fillRect(dxTmp-3,dyTmp-3, size, size);
	currentX = dxTmp;
	currentY = dyTmp;
	r++;
    }
    giter++;
}
initialCanvas = initializeCanvas();
function drawAll(){
    var k = 3
    drawRandomLine(initialCanvas, k, k);
}

//setInterval(drawAll, 400);
//var iterations = 0;
var core = setInterval(drawAll, 100);
setTimeout(function( ) { clearInterval( core ); }, 15000);
