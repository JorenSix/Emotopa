
  var handleDragOver = function(e) {
      e.preventDefault()
      e.stopPropagation()
  }

  var ph = null;
  var pch = null;
  var scala = null;
  var annotations = null;

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

  var handleTranscodedAudioSamples = async function(raw_audio_samples){
	  console.log(raw_audio_samples.length);
	  var yin_buffer_size = 1024;
	  var yin_step_size = 1024;
	  var kde = emptyKernelDensityEstimate();
	  var kernel = gaussianKernel(7);

	  onProgress(0);

	  for(var sample_index = 0 ; sample_index < raw_audio_samples.length - yin_buffer_size; sample_index += yin_step_size){
	    var start_index = sample_index;
	    var stop_index = sample_index + yin_buffer_size;
	    var analysis_buffer = raw_audio_samples.slice(start_index,stop_index);
	    var buffer_start_time_in_s = sample_index / 16000.0;
	    var percentage_finished = sample_index/raw_audio_samples.length * 100.0
	    var detected_pitch_in_hz = detectPitchYin(analysis_buffer,16000);
	    if(detected_pitch_in_hz){
	      detected_pitch_in_cents = hzToAbsoluteCents(detected_pitch_in_hz);
	      //console.log(buffer_start_time_in_s,"s",detected_pitch_in_hz,"Hz",detected_pitch_in_cents,"abs cents",percentage_finished,"% done");
	      annotations.push({time_in_s: buffer_start_time_in_s, pitch_in_hz: detected_pitch_in_hz, pitch_in_cents: detected_pitch_in_cents});
	      addToEstimate(kde,kernel,detected_pitch_in_cents);
	    }
	    //console.log(percentage_finished,"% done");
	    onProgress(percentage_finished);

	    if(percentage_finished % 10 == 0){
	    	const collapsed_kde = collapsedKernelDensityEstimate(kde);
	  		normalizePeak(collapsed_kde);
	  		drawPCH("pitch_class_histogram",collapsed_kde);
	    }

	  }
	  
	  const collapsed_kde = collapsedKernelDensityEstimate(kde);

	  normalizePeak(collapsed_kde);

	  pch = collapsed_kde;
	  ph = kde;

	  drawPCH("pitch_class_histogram",collapsed_kde);

	  drawPitchEstimates("pitch_estimates",annotations);

	  onProgress(100);

	  var hidden_elements = document.getElementsByClassName('result');
		for (var i = 0; i < hidden_elements.length; ++i) {
	    	hidden_elements[i].style["display"]="grid";
		}
	}

  var handleFile = async function(file) {
  	  console.log(file)
      console.log("Dropped " + file.name);
      var reader  = new FileReader();

      var audioElement = document.getElementById("audioFile")
      annotations = []

      reader.addEventListener("load", function () {
        audioElement.src = reader.result;
        audioElement.load();
        console.log("Loaded dropped audio");

        var inputFile = new MediaFile(file.name,file.arrayBuffer());
        inputFile.transcode(16000,onProgress).then(handleTranscodedAudioSamples);

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


window.onload = function() {
	document.getElementById('uploader').addEventListener('change', handleFileUploadButton);

	window.addEventListener('dragenter', dragEnterHandler);

	document.getElementById("drop_zone").addEventListener('dragenter', dragEnterHandler);
	document.getElementById("drop_zone").addEventListener('dragleave', dragLeaveHandler);
	document.getElementById("drop_zone").addEventListener('drop', dropHandler);
	document.getElementById("drop_zone").addEventListener('dragover', dragOverHandler);

	document.getElementById('uploader_button').addEventListener('click', () => {document.getElementById('uploader').click();});

	document.querySelector('#pitch_class_histogram').addEventListener('click',handlePCHClick,false);
};

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
		console.log("Handle progress",progress);
		prevProgress = progress;
	}else{
		console.log("Ignored progress",progress)
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
