
  var handleDragOver = function(e) {
      e.preventDefault()
      e.stopPropagation()
  }

  var ph = [];
  var pch = [];
  var scale = [0,100,200,300,400,500,600,700,800,900,1000,1100,1200];
  var annotations = [];
  var peak_pick_diff = 90;//cents
  var peak_pick_threshold = 0.1;//from 0.0-1.0
  var audio_sample_rate = 16000

  const pitchDetectionWorker = new Worker('js/pitch.detector.worker.js');


  var handlePCHClick = function(e) {
    var pitch_class_histogram = document.querySelector('#pitch_class_histogram');
    const rect = pitch_class_histogram.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    console.log("x: " + x + " y: " + y);
    const rel_cents = x / pitch_class_histogram.clientWidth * 1200;
    const cents_offset = 6000;
    playFrequency(absoluteCentsToHz(rel_cents+cents_offset),0.233);
  }

  var handlePitchEstimates = function(estimates){
  	var ph = emptyKernelDensityEstimate();
	  var kernel = gaussianKernel(7);

	  for(var i = 0; i < estimates.length ; i++){
	  	addToEstimate(ph,kernel,estimates[i]['pitch_in_cents']);
	  }
	  pch = collapsedKernelDensityEstimate(ph);
	  normalizePeak(pch);

	  scale = pickPeaks(pch,peak_pick_diff,peak_pick_threshold);
	  drawPCH("pitch_class_histogram",pch,scale);
	  //drawPitchEstimates("pitch_estimates",estimates);
  }

  var handleTranscodedAudioSamples = function(raw_audio_samples){
	  console.log(raw_audio_samples.length);

	  pitchDetectionWorker.onmessage= (event) => {
	  	if(event.data['progress']){
	  		onProgress(event.data['progress']);
	  	}
	  	if(event.data['pitch_estimates']){
	  		handlePitchEstimates(event.data['pitch_estimates'])
	  	}
	  }

	  pitchDetectionWorker.postMessage([raw_audio_samples,audio_sample_rate]);

	  var hidden_elements = document.getElementsByClassName('result');
		for (var i = 0; i < hidden_elements.length; ++i) {
	    	hidden_elements[i].style["display"]="grid";
		}
	}

  var handleFile = async function(file) {
  	  console.log(file)
      console.log("Dropped " + file.name);
      var reader  = new FileReader();

      var audioElement = document.getElementById("audioFile");
      annotations = []

      reader.addEventListener("load", function () {
        audioElement.src = reader.result;
        audioElement.load();
        console.log("Loaded dropped audio");

        var inputFile = new MediaFile(file.name,file.arrayBuffer());
        inputFile.transcode(audio_sample_rate,onProgress).then(handleTranscodedAudioSamples);

      }, false);

      if (file) {
        reader.readAsDataURL(file);
      }    
      
  }

function handleFileUploadButton(ev){
	console.log(ev);
    fileList = ev.target.files;
    for (var i = 0; i < fileList.length; i++) {
      handleFile(fileList[i]);
    }
}

function onResize(ev) {
	drawPCH("pitch_class_histogram",pch,scale);
}

window.onload = function() {
	document.getElementById('uploader').addEventListener('change', handleFileUploadButton);

	window.addEventListener("resize", onResize);

	window.addEventListener('dragenter', dragEnterHandler);

	document.getElementById("drop_zone").addEventListener('dragenter', dragEnterHandler);
	document.getElementById("drop_zone").addEventListener('dragleave', dragLeaveHandler);
	document.getElementById("drop_zone").addEventListener('drop', dropHandler);
	document.getElementById("drop_zone").addEventListener('dragover', dragOverHandler);

	document.getElementById("diffRange").addEventListener('input',diffRangeInput);
	document.getElementById("thresholdRange").addEventListener('input',thresholdRangeInput);
	document.getElementById("playbackSpeedRange").addEventListener('input',playbackSpeedRangeInput);

	document.getElementById('uploader_button').addEventListener('click', () => {document.getElementById('uploader').click();});

	document.querySelector('#pitch_class_histogram').addEventListener('click',handlePCHClick,false);

	onResize(null);
};

function diffRangeInput(ev){
	peak_pick_diff = ev.srcElement.value;
	//rerun peack picking with new values and draw pch:
	scale = pickPeaks(pch,peak_pick_diff,peak_pick_threshold);
	drawPCH("pitch_class_histogram",pch,scale);
}

function thresholdRangeInput(ev){
	peak_pick_threshold = ev.srcElement.value / 100.0;
	//rerun peack picking with new values and draw pch:
	scale = pickPeaks(pch,peak_pick_diff,peak_pick_threshold);
	drawPCH("pitch_class_histogram",pch,scale);
}

function playbackSpeedRangeInput(ev){
	var audioElement = document.getElementById("audioFile");
	playback_speed = ev.srcElement.value / 100.0;
	audioElement.playbackRate = playback_speed;
}

function dragOverHandler(ev) { ev.preventDefault();}
function dragEnterHandler(ev){ document.getElementById("drop_zone").style.display = "flex";}
function dragLeaveHandler(ev){ 	document.getElementById("drop_zone").style.display = "none";}

async function dropHandler(ev) {
	dragLeaveHandler();

	// Prevent default behavior (Prevent file from being opened)
	ev.preventDefault();

	if (ev.dataTransfer.items) {
	  // Use DataTransferItemList interface to access the file(s)
	  for (var i = 0; i < ev.dataTransfer.items.length; i++) {
	    // If dropped items aren't files, reject them
	    if (ev.dataTransfer.items[i].kind === 'file') {
	      var file = ev.dataTransfer.items[i].getAsFile();
	      handleFile(file);
	    }
	  }
	  
	} else {
	  // Use DataTransfer interface to access the file(s)
	  for (var i = 0; i < ev.dataTransfer.files.length; i++) {
	    handleFile(files[i]);
	  }
	}

}

function downloadBlob(blob, name = 'file.txt') {
  // Convert your blob into a Blob URL (a special url that points to an object in the browser's memory)
  const blobUrl = URL.createObjectURL(blob);

  // Create a link element
  const link = document.createElement("a");

  // Set link's href to point to the Blob URL
  link.href = blobUrl;
  link.download = name;

  // Append link to the body
  document.body.appendChild(link);

  // Dispatch click event on the link
  // This is necessary as link.click() does not work on the latest firefox
  link.dispatchEvent(
    new MouseEvent('click', { 
      bubbles: true, 
      cancelable: true, 
      view: window 
    })
  );

  // Remove link from body
  document.body.removeChild(link);
}


var prevProgress = null;
//progress of current task
function onProgress(progress){
	progress = Math.floor(progress);
	if(prevProgress == null || prevProgress != progress){
		const progress_bar = document.getElementById("progress_bar");
		const progress_container = document.getElementById("progress_container");
		if(progress == 100){
		  progress_container.style["visibility"] = "hidden";
		  progress_bar.style["width"] =  "0%";
		  progress_bar.textContent =  "0%";
		}else{
		  progress_container.style["visibility"] = "visible";
		  progress_bar.style["width"] = progress + "%";
		  progress_bar.textContent = progress + "%";
		}
		prevProgress = progress;
	}	
}

function downloadInfo(filename,kde){

	var data = "cents,value\n";
	for(var i = 0 ; i < kde.length ; i++){
		data = data + i + "," + kde[i] + "\n";
	}	

	var blob = new Blob([data], {type: "application/csv"});

	downloadBlob(blob, filename)
}


function downloadJSON(filename,jsonObject){
	var blob = new Blob([JSON.stringify(jsonObject)], {type: "application/json"});
	downloadBlob(blob, filename)
}


function downloadScala(filename,peak_list){

	var data = "! extracted with 0110.be \n";
	var data = data + "Extracted scale\n";
	var data = data + peak_list.length + "\n";
	var data = data + "!\n";
	for(var i = 0 ; i < peak_list.length ; i++){
		data = data +  peak_list[i] + "\n";
	}	

	var blob = new Blob([data], {type: "application/scala"});

	downloadBlob(blob, filename)
}
