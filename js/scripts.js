//Some custom background stuff BS2021

if (Math.random() > 0.5){
    var rcol = ["green","blue","red","yellow","white"]
}else {
    var rcol = ["green","white","orange"]
}

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

function drawRandomLine(ctx, x0, y0, max = 0){

    if (max == 0){
		var currentX = 0 + x0
		var currentY = 0 + y0
    }else{
		var currentX = $(document).width() -  x0 - Math.random()*50;
		var currentY = $(document).height()/2;
    }
    var dx = 2
    var dy = 2
    var r = 0
    if (max == 0){
		var rscale = 40
    }else{
		var rscale = 80
    }
    items = ["gray"]
    var mem = [];
    
    while (r < 60) {
		
		if (max == 0){
			var dxTmp = dx + getRandomArbitrary(-1,1)*rscale + currentX
			var dyTmp = dy + getRandomArbitrary(-1,1.4)*rscale + currentY
			
		}else{
			var dxTmp = currentX - dx - getRandomArbitrary(-1,1)*rscale
			var dyTmp = currentY - dy - getRandomArbitrary(-1,1.4)*rscale
		}
		
		mem.push(dxTmp);
		mem.push(dyTmp);

		ctx.moveTo(currentX, currentY);
		if (Math.random() > 0.2){
			ctx.bezierCurveTo(currentX, currentY+1, dxTmp, currentY-1, dxTmp, dyTmp);
		}else{
			ctx.lineTo(dxTmp, dyTmp);
		}
		ctx.lineWidth = 0.02;
		
		if (Math.random() > 0.3){
			var item = "gray";
			
		}else {
			var item = "gray";
			
		}

		
		ctx.strokeStyle = item;
		ctx.globalAlpha = 0.6;
		if (r % 20 == 0){
			ctx.stroke();
		}
		ctx.fillStyle = rcol.random();
		ctx.globalAlpha = 0.6;
		
		if (max == 0){
			var size = Math.floor(Math.random() * (Math.random())*6) + 4;
			
		}else{
			var size = Math.floor(Math.random() * (8)) + 8;
			
		}

		if (max == 0){
			ctx.fillRect(dxTmp-3,dyTmp-3, size, size);
		}else{
			ctx.fillRect(dxTmp-3,dyTmp-3, size, size);
		}
		
		currentX = dxTmp;
		currentY = dyTmp;
		r++;
    }
    
    var arrayLength = mem.length;
    
}

function drawAll(){
    var k = 3
    drawRandomLine(initialCanvas, k, k);
}

function drawAll2(){
    var k = 3
    drawRandomLine(initialCanvas, k, k, max = 2);
}


function drawAll3(){
	
	var height = $(document).height();
	var width = $(document).width();
	var rcol = ["orange", "yellow", "red", "white", "BurlyWood", "DarkOrange", "GolderRod", "blue", "DarkOliveGreen"];
	var rcol = ["BurlyWood", "DarkOliveGreen", "GoldenRod"];
	var ntriangle = 70;
	initialCanvas.globalAlpha = 0.1;
	var offset = 30 * Math.random();	
	for (let i = 0; i < ntriangle; i++){
		if (Math.random() > 0.5){
		}else{var offset = - offset}
		var randomInitX = width  * Math.random();
		var randomInitY = height * Math.random();
		initialCanvas.beginPath();
		initialCanvas.moveTo(randomInitX, randomInitY);
		initialCanvas.lineTo(randomInitX + offset * Math.random() * 2, randomInitY);
		initialCanvas.lineTo(randomInitX + offset, randomInitY-offset);
		var col = rcol.random()
		initialCanvas.fillStyle = col;
		initialCanvas.fill();
		initialCanvas.globalAlpha = 0.01;
	}
	
}

initialCanvas = initializeCanvas();

// init state.
var rnum = Math.random();

if (rnum > 0.70) {
	
	var core = setInterval(drawAll, 60);
	setTimeout(function( ) { clearInterval( core ); }, 8000);
	
}else if (rnum > 0.3 && rnum < 0.7) {

	var core = setInterval(	drawAll3, 50);
	setTimeout(function( ) { clearInterval( core ); }, 14000);
	
}else{
	
	var core = setInterval(drawAll2, 200);
	setTimeout(function( ) { clearInterval( core ); }, 8000);
	
}
