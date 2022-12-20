//spectrogram layer
var spectrogramCanvas = document.getElementById("spectrogram");
var spectrogramContext = spectrogramCanvas.getContext("2d");

//frequency labels layer
var labelsCanvas = document.getElementById("labels");
var labelsContext = labelsCanvas.getContext("2d");

var axisCanvas = document.getElementById("axis");
var axisContext = axisCanvas.getContext("2d");

//Histogram layer
var histCanvas = document.getElementById("hist");
var histContext = histCanvas.getContext("2d");


//The width and height of the canvas
var width = labelsCanvas.width;
var height = labelsCanvas.height;

var ageScale = chroma.scale(['#1E64C8','#f00']).mode('lrgb');

var resized = undefined;

window.onload = function() {
  initialize();  
};

window.addEventListener('resize', function(event){
  initialize();
});

var listening = true
window.ondblclick = function(){
  console.log("double click detected")
  if(!audio)
    if(listening){
      window.cancelAnimationFrame(animationFrameID);
      listening = false
      audioContext.suspend();
    }
    else{
      listening = true
      audioContext.resume();
      draw();
    }
  else if(listening){
      window.cancelAnimationFrame(animationFrameID);
      listening = false
      audioContext.suspend();
    }
    else{
      listening = true
      audioContext.resume();
    }
};

function initialize(){
  width = window.innerWidth;
  height = window.innerHeight;

  spectrogramCanvas.width = width;
  spectrogramCanvas.height = height;

  labelsCanvas.width = width;
  labelsCanvas.height = height;

  histCanvas.width = width;
  histCanvas.height = height;

  axisCanvas.width = width;
  axisCanvas.height = height;

  resized = true;

  //draw axis
  setTimeout(function(){ animationFrameID =  requestAnimationFrame(renderLabels) }, 150);
  
}

window.addEventListener('mousemove', drawMouseLabel, false);

function getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top
    };
}

//the audio context
var AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext;
audioContext = new AudioContext();

var audio = document.getElementById("audioFile");

var input = undefined;

if(audio){

  audio.onpause = function(){
    console.log("Pause audio");
    window.cancelAnimationFrame(animationFrameID);
  }

  audio.onplay = function(){
    console.log("Play audio");
    draw();
  }

  input = audioContext.createMediaElementSource(audio);

}else{
  //Use microphone
  if (navigator.mozGetUserMedia) {
    navigator.mozGetUserMedia({audio: true},
                              this.onStream.bind(this),
                              this.onStreamError.bind(this));
  } else if (navigator.webkitGetUserMedia) {
    navigator.webkitGetUserMedia({audio: true},
    function(stream) {
      input = audioContext.createMediaStreamSource(stream);
      console.log("Connected microphone to fft")
      // Connect graph.
      input.connect(analyser);
      //listening = false;
      //audioContext.suspend()
      //silence audio
      //gainNode.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.value = 0;
      analyser.connect(gainNode);
      gainNode.connect(audioContext.destination);

      ready = true;    
      //start
      listening = true
      //audioContext.resume();
      draw();
    },
    function(err) {
       console.log("The following error occurred: " + err.name);
    });                                
  }
}

var ready = false;
var animationFrameID = undefined;

var gainNode = audioContext.createGain();

var analyser = audioContext.createAnalyser();

analyser.smoothingTimeConstant = 0;
analyser.fftSize = 4096;
//analyser.minDecibels = -90;
//analyser.maxDecibels = 0;
    
// Setup a timer to visualize some stuff.
var bufferLength = analyser.frequencyBinCount;
var frequencyData = new Uint8Array(analyser.frequencyBinCount);
var audioBufferArray = new Float32Array(bufferLength);

//every quartertone
var kernelDensityEstimate = new Float32Array(midiKeyRange * 10);
var kernelDensityEstimateAge = new Float32Array(midiKeyRange * 10);
for(i = 0 ; i < kernelDensityEstimate.length ; i++){
  kernelDensityEstimate[i]=1.0;
  kernelDensityEstimateAge[i]=1.0;
}

if(audio){
  // Connect graph.
  input.connect(analyser);
  analyser.connect(audioContext.destination);
}

//animation loop
function draw() {
  //loop darwing (until canceled)
  animationFrameID = requestAnimationFrame(draw);

  renderFrequencyDomain();
  renderPitchEstimation();
  renderHistogram();
  
  if(resized){
   // renderLabels();
   // resized = false;
    //console.log("resized: drew labels")
  }
};

function drawMouseLabel(e) {
    var pos = getMousePos(labelsCanvas, e);
    posx = pos.x;
    posy = pos.y;

    labelsContext.clearRect(0, 0, width,height);
    labelsContext.beginPath();

    labelsContext.fillStyle = 'black';
    labelsContext.strokeStyle="black";

    labelsContext.lineWidth=3;
    labelsContext.setLineDash([5, 7]);
    labelsContext.moveTo(0,  posy);
    labelsContext.lineTo(width,  posy);
    labelsContext.stroke();

    var percent = posy / height;
    var currentMidiKey = midiKeyStart + (1-percent) * midiKeyRange;
    var currentFrequencyInHz = midiKeyToHz(currentMidiKey);

    labelsContext.font = '20px "UGent Panno Text"';
    // Draw the value.

    labelsContext.textAlign = 'right';
    labelsContext.fillText(Number(currentMidiKey).toFixed(2), 78 ,  25);
    labelsContext.fillText(Number(currentFrequencyInHz).toFixed(2), 78 ,  55);

    labelsContext.textAlign = 'left';
    labelsContext.fillText("Midicent", 83,25)
    labelsContext.fillText("Hz", 83 ,  55);

}

function renderPitchEstimation(){
  analyser.getFloatTimeDomainData(audioBufferArray);
  pitchEstimation = detectPitchYin(audioBufferArray,audioContext.sampleRate)
  
  pitchEstimationMidiKey = hzToMidiKey(pitchEstimation);

  if(pitchEstimationMidiKey > midiKeyStop){
     console.log("Fitered out pitch estimation: " + pitchEstimationMidiKey)
  }

  if(pitchEstimationMidiKey > midiKeyStartThreshold && pitchEstimationMidiKey < midiKeyStopThreshold){
    //console.log(pitchEstimation);
    speed = 3;
    size = 6;

    //var step = (endFreq - startFreq) / analyser.frequencyBinCount;
    
    addEpanechnikovKernel(pitchEstimationMidiKey)
    //console.log(audio.currentTime);

    y = (pitchEstimationMidiKey - midiKeyStart)/midiKeyRange * height;
    spectrogramContext.fillStyle = '#1E64C8';
    spectrogramContext.fillRect(width-speed, height - y , size, 10);
  }
}


tempCanvas = document.createElement('canvas')
var prevSecond = -1

function renderFrequencyDomain() {
    
    analyser.getByteFrequencyData(frequencyData);
    speed = 2;

    //age kernels
    for(i = 0 ; i < kernelDensityEstimate.length ; i++){
      kernelDensityEstimateAge[i] = Math.min(1.0,kernelDensityEstimateAge[i] - 0.028);
    }

    // Copy the current canvas onto the temp canvas.
    tempCanvas.width = width;
    tempCanvas.height = height;
    //console.log(this.$.canvas.height, this.tempCanvas.height);
    var tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(spectrogramCanvas, 0, 0, width, height);

    for(var i = 0 ; i < height ; i++){
      var percent = i / height;

      var y = i;

      var currentMidiKey = midiKeyStart + percent * midiKeyRange;
      var currentFrequencyInHz = midiKeyToHz(currentMidiKey);

      logIndex = Math.round(currentFrequencyInHz * analyser.fftSize / audioContext.sampleRate);

      value = frequencyData[logIndex];

      spectrogramContext.fillStyle = getGrayColor(value);
      spectrogramContext.fillRect(width - speed, height - y, speed, speed);
    }

    var drawSecondsLabel = false;
    
    if(Math.floor(audioContext.currentTime) != prevSecond){
      spectrogramContext.fillStyle = 'black';
      prevSecond = Math.floor(audioContext.currentTime);
      if(Math.abs(prevSecond - audioContext.currentTime) < 0.08){
        if(prevSecond % 5 ==0)
          spectrogramContext.fillRect(width - speed, height * 0.9 - speed * 6, speed * 6 , speed * 6);
        else
          spectrogramContext.fillRect(width - speed, height * 0.9 - speed * 4, speed * 6 , speed * 4);
        //console.log(audioContext.currentTime)

        drawSecondsLabel = true;
      }
      
    }

    //clear area from 90 - 100% at bottom
    spectrogramContext.clearRect(width-speed,height * 0.9,speed,height)

    //clear left 20% (for histogram)
    tempCtx.clearRect(0,0,width*0.2,height);
    tempCtx.clearRect(0,height*0.9,width,height);
    /*
    if(drawSecondsLabel){
      spectrogramContext.font = '12px "Open Sans"';
      spectrogramContext.fillStyle = 'black';
      // Draw the value.
      spectrogramContext.textAlign = 'center';
      spectrogramContext.fillText("" + prevSecond, width - 50, height * 0.9 + 15);
      console.log(audioContext.currentTime)
      spectrogramContext.stroke();
      drawSecondsLabel = false
    }
    */

    // Translate the canvas.
    spectrogramContext.translate(-speed, 0);

    // Draw the copied image.
    spectrogramContext.drawImage(tempCanvas, 0, 0, width, height, 0, 0, width, height);


    // Reset the transformation matrix.
    spectrogramContext.setTransform(1, 0, 0, 1, 0, 0);

    
    
  }

  function logScale(index, total, opt_base) {
    var base = opt_base || 2;
    var logmax = logBase(total + 1, base);
    var exp = logmax * index / total;
    return Math.round(Math.pow(base, exp) - 1);
  }

  function midiKeyToHz(midiKey){
    return 440.0 * Math.pow(2,(midiKey-69)/12)
  }

  function hzToMidiKey(frequencyInHz){
    return 69 + 12 * logBase(frequencyInHz/440.0,2);
  }

  function logBase(val, base) {
    return Math.log(val) / Math.log(base);
  }

 function getGrayColor(value) {
    return 'rgb(V, V, V)'.replace(/V/g, 255 - value);
  }

function renderHistogram(){
   histContext.clearRect(0, 0, width,height);
   histContext.beginPath();

   maxHeightThreshold = 0.15 * width;
   maxPeakHeight = -1;
   //find max peak height
   for(i = 0 ; i < kernelDensityEstimate.length ; i++){
      maxPeakHeight = Math.max(maxPeakHeight,kernelDensityEstimate[i]);
   }
   factor = 1.0;
   if(maxPeakHeight > maxHeightThreshold){
    factor = maxHeightThreshold/maxPeakHeight;
   }

   offset = 4

   histContext.beginPath();
   histContext.moveTo(offset,Math.round(0.9 * height));
   histContext.strokeStyle="blue";
   histContext.lineWidth=4;

   for(var i = Math.round(0.1 * height) ; i < height ; i++){
      var percent = i / height;
      var prevPercent = i-1 / height;

      var y = i; 

      var currentMidiKey = midiKeyStart + percent * midiKeyRange;
      midiKey = Math.round((currentMidiKey - midiKeyStart ) * 10)
      value = kernelDensityEstimate[midiKey] * factor
      age = kernelDensityEstimateAge[midiKey]

      
      histContext.strokeStyle = ageScale(age).hex();
      histContext.lineTo(offset + value,height -  y);      
      histContext.stroke();
      histContext.beginPath();
      
      histContext.moveTo(offset + value,height -  y);
    }

}

function renderLabels(){
  x = width / 2.0;
  y = height / 2.0;
/*
  labelsContext.font = '12px "Open Sans"';
  labelsContext.fillStyle = 'black';
  // Draw the value.
  labelsContext.textAlign = 'right';
  labelsContext.fillText("500", x, y );
  // Draw the units.
  labelsContext.textAlign = 'left';
  labelsContext.fillText("Hz", x + 10, y );
*/
  
    axisContext.font = '20px "UGent Panno Text"';
    axisContext.fillStyle = 'black';
    axisContext.strokeStyle="black";
    axisContext.lineWidth=4;
    axisContext.moveTo(3,height*0.9)

    axisContext.lineTo(width *0.18,  height*0.9);
    axisContext.moveTo(width *0.18,  height*0.9)
    axisContext.lineWidth=3;
    axisContext.lineTo(width * 0.18 - 10,  height*0.9 + 7);
    axisContext.moveTo(width *0.18,height*0.9)
    axisContext.lineTo(width *0.18  - 10,  height*0.9 - 7);

    axisContext.textAlign = 'center';
    axisContext.fillText("Occurences (%)", width * 0.09, height * 0.9 + 18 );
    
    
    axisContext.moveTo(width * 0.20,  height*0.9)
    axisContext.lineTo(width ,  height*0.9);
    axisContext.lineWidth=3;
    axisContext.lineTo(width - 10,  height*0.9 + 7);
    axisContext.moveTo(width ,height*0.9)
    axisContext.lineTo(width - 10,  height*0.9 - 7);

    axisContext.textAlign = 'center';
    axisContext.fillText("Time (s)", width * 0.60, height * 0.9 + 20 );
  

    axisContext.moveTo(width * 0.20,  height*0.9)
    axisContext.lineTo(width * 0.20 , 0);
    axisContext.lineWidth=3;
    axisContext.lineTo(width * 0.20 - 7, 8);
    axisContext.moveTo(width * 0.20 , 0)
    axisContext.lineTo(width * 0.20 + 7, 8);

    axisContext.stroke();

    axisContext.save();
    axisContext.translate(width * 0.20 - 16, height * 0.45);
    axisContext.rotate(-Math.PI/2);
    axisContext.textAlign = "center";
    axisContext.fillText("Frequency (Hz)", 0, 0);
    axisContext.restore();

    for(i = midiKeyStart  ; i< midiKeyStop ; i++){
      percent = (i  - midiKeyStart)/midiKeyRange
      percent = 1 - percent;
      if( 0.05 < percent && percent < 0.90){
        if(i == 69 || i == 69 + 12 || i == 69 - 12){
          axisContext.moveTo(width * 0.20, height *  percent)
          axisContext.lineTo(width * 0.20 + 8,height * percent )
        }else{
          axisContext.moveTo(width * 0.20, height *  percent)
          axisContext.lineTo(width * 0.20 + 4,height * percent )  
        }  
      }
    }

    axisContext.moveTo(4, height*0.9)
    axisContext.lineTo(4, 0);
    axisContext.lineWidth=3;
    axisContext.lineTo(4 - 7, 8);
    axisContext.moveTo(4 , 0)
    axisContext.lineTo(4 + 7, 8);

    for(i = midiKeyStart  ; i< midiKeyStop ; i++){
      percent = (i  - midiKeyStart)/midiKeyRange
      percent = 1 - percent;
      if( 0.05 < percent && percent < 0.90){
        if(i == 69 || i == 69 + 12 || i == 69 - 12){
          axisContext.moveTo(4, height *  percent)
          axisContext.lineTo(4 + 8,height * percent )
        }else{
          axisContext.moveTo(4, height *  percent)
          axisContext.lineTo(4 + 4,height * percent )  
        }  
      }
    }

    axisContext.stroke();

   
   

  
  // Draw a tick mark.
  //labelsContext.fillRect(x + 40, y, 30, 2);
  /*
    var canvas = this.labels;
    canvas.width = this.width;
    canvas.height = this.height;
    var ctx = canvas.getContext('2d');
    var startFreq = 440;
    var nyquist = context.sampleRate/2;
    var endFreq = nyquist - startFreq;
    var step = (endFreq - startFreq) / this.ticks;
    var yLabelOffset = 5;
    // Render the vertical frequency axis.
    for (var i = 0; i <= this.ticks; i++) {
      var freq = startFreq + (step * i);
      // Get the y coordinate from the current label.
      var index = this.freqToIndex(freq);
      var percent = index / this.getFFTBinCount();
      var y = (1-percent) * this.height;
      var x = this.width - 60;
      // Get the value for the current y coordinate.
      var label;
      if (this.log) {
        // Handle a logarithmic scale.
        var logIndex = this.logScale(index, this.getFFTBinCount());
        // Never show 0 Hz.
        freq = Math.max(1, this.indexToFreq(logIndex));
      }
      var label = this.formatFreq(freq);
      var units = this.formatUnits(freq);
      ctx.font = '16px "Open Sans"';
      ctx.fillStyle = 'white';
      // Draw the value.
      ctx.textAlign = 'right';
      ctx.fillText(label, x, y + yLabelOffset);
      // Draw the units.
      ctx.textAlign = 'left';
      ctx.fillText(units, x + 10, y + yLabelOffset);
      // Draw a tick mark.
      ctx.fillRect(x + 40, y, 30, 2);
    }
  }
  */
}


function addEpanechnikovKernel(pitchToAdd) {
  shiftedPitchToAdd = pitchToAdd - midiKeyStart;
  roundedPitchToAdd = Math.round(shiftedPitchToAdd * 10)

  for(currentPitch =  roundedPitchToAdd - 4 ; currentPitch <  roundedPitchToAdd + 4 ; currentPitch++){
    if(currentPitch > 0 && currentPitch < midiKeyRange * 10 ){
      diff = (currentPitch - roundedPitchToAdd)/8.0;
      val = 0.75 * (1 - diff * diff);
      kernelDensityEstimate[currentPitch] = kernelDensityEstimate[currentPitch] + val * 2;
      kernelDensityEstimateAge[currentPitch] = Math.min(1.0,val*2);
    }
  }
}