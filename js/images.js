$(document).ready(function(){
	var dir = "random_art/"; // folder location
	var fileextension = ".png"; // image format
	var i = "1";

	for (let i = 0; i < 9; i++) {
		var initial = "<img src=random_art/"+i+".png></img>"
		var pre = "<div class='text-center'>"
		var post = "</div>"
		$( ".imageGrid" ).append( initial );
	}
	// $(function imageloop(){
	// 	$("<img />").attr('src', dir + i + fileextension ).appendTo(".imageGrid");
	// 	if (i==9){
	// 		console.log('loaded');
	// 	}
	// 	else{
	// 		i++;
	// 		imageloop();
	// 	};
	// });   
});
