

function centsToX(canvas,cents){
	var width = canvas.width;
	var x_in_pixels = cents / 1200 * width;
	return x_in_pixels;
}

function rangeToY(canvas,range){
	var height = canvas.height;
	range = 1.0 - range;
	var y_in_pixels = Math.floor(range * height * 0.9) + 2;
	return y_in_pixels;
}

function drawLine(canvas,ctx,x1,y1,x2,y2){
	ctx.lineWidth = 1;
	ctx.strokeStyle = "#C0C0C0";
	ctx.beginPath();
    ctx.moveTo(centsToX(canvas,x1),rangeToY(canvas,y1));
    ctx.lineTo(centsToX(canvas,x2),rangeToY(canvas,y2));
    ctx.stroke();
}

function drawPCH(identifier,kde){
	var canvas = document.getElementById(identifier);
	var ctx = canvas.getContext('2d');

	canvas.width = canvas.clientWidth;
	canvas.height = canvas.clientHeight;

	for(var i = 100 ; i <= 1200 ; i+=100){
		drawLine(canvas,ctx,i,0,i,1.0);
	}

	ctx.lineWidth = 1;
	ctx.strokeStyle = "blue";
	ctx.beginPath();
    ctx.moveTo(centsToX(canvas,0),rangeToY(canvas,kde[0]));
	for(var i = 1 ; i <= kde.length ; i+=1){
    	ctx.lineTo(centsToX(canvas,i),rangeToY(canvas,kde[i]));
	}
    ctx.stroke();
}

function drawPitchEstimates(identifier,annotations){
	var canvas = document.getElementById(identifier);
	var ctx = canvas.getContext('2d');

	canvas.width = canvas.clientWidth;
	canvas.height = canvas.clientHeight;

	var min_pitch_in_cents = 20000;
	var max_pitch_in_cents = 0;
	var duration_in_s = 0;
	for(var i = 0 ; i < annotations.length ; i++){
		var pitch_in_cents = annotations[i]['pitch_in_cents'];
		var time_in_s = annotations[i]['time_in_s'];
		max_pitch_in_cents = Math.max(max_pitch_in_cents,pitch_in_cents);
		min_pitch_in_cents = Math.min(min_pitch_in_cents,pitch_in_cents);
		duration_in_s = Math.max(time_in_s,duration_in_s);
	}

	var pitch_range_in_cents = max_pitch_in_cents - min_pitch_in_cents;

	console.log("draw estimates",pitch_range_in_cents,annotations.length)



	for(var i = 0 ; i < annotations.length ; i++){
		
		var time_in_s = annotations[i]['time_in_s'];
		var pitch_in_cents = annotations[i]['pitch_in_cents'];


		var x = time_in_s/duration_in_s * canvas.width;
		var y = (pitch_in_cents - min_pitch_in_cents) / pitch_range_in_cents * canvas.height;
		console.log(x,y,time_in_s,pitch_in_cents)
	
	    ctx.fillRect(x,y,2,2);
	}

}