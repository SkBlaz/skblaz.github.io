// // $(document).ready(function(){
// // 	var dir = "random_art/"; // folder location
// // 	var fileextension = ".png"; // image format
// // 	var i = "1";

// // 	for (let i = 0; i < 9; i++) {
// // 		var initial = "<img src=random_art/"+i+".png></img>"
// // 		var pre = "<div class='text-center'>"
// // 		var post = "</div>"
// // 		$( ".imageGrid" ).append( initial );
// // 	}
// // 	// $(function imageloop(){
// // 	// 	$("<img />").attr('src', dir + i + fileextension ).appendTo(".imageGrid");
// // 	// 	if (i==9){
// // 	// 		console.log('loaded');
// // 	// 	}
// // 	// 	else{
// // 	// 		i++;
// // 	// 		imageloop();
// // 	// 	};
// // 	// });   
// // });

// function loadDoc() {
//     var xhttp = new XMLHttpRequest();
//     xhttp.onreadystatechange = function () {
// 		if (this.readyState == 4 && this.status == 200) {
// 			myFunction(this);
// 		}
//     };
//     xhttp.open("GET", "skblaz.github.io/random_art/", true);
//     xhttp.send();
// }

// function myFunction(xml) {
//     // console.log(xml.responseText)
//     var parser = new DOMParser();
//     var htmlDoc = parser.parseFromString(xml.responseText, 'text/html');
//     var preList = htmlDoc.getElementsByTagName("pre")[0].getElementsByTagName("a")
//     for (i = 1; i < preList.length; i++) {
// 		console.log(preList[i].innerHTML)
//     }
// }

// myFunction();
