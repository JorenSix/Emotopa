

function absoluteCentsToHz(absoluteCents){
    return 440.0 * Math.pow(2,(absoluteCents-6900)/1200)
}

function hzToAbsoluteCents(frequencyInHz){
		//always returns the closest integer, no fractional cents are used
    return Math.round(6900 + 1200 * Math.log(frequencyInHz/440.0)/Math.log(2));
}


//A kernel density is an array of numbers representing 'absolute cents'
//The absolute cents correspond to midi keys: miki key 69 (A4) is represented by 6900
//the range is 0 to 128 00 of which the first and last part are expected to be relatively empty.
function emptyKernelDensityEstimate(){
	return new Float32Array(12800);
}

//returns a kernel density collapsed to 1200 cents
//start in absoulte cents
function collapsedKernelDensityEstimate(kde,reference_frequency=6900,start_frequency=0,stop_frequency=12800){
	collapsed = new Float32Array(1200);
	//reduce the start to an octave
	var startInOctave = start_frequency % 1200;
	var remainderInOctave = 1200 - startInOctave;

	for (var i = 0; i < stop_frequency; i++) {
		var collapsedIndex = (i + remainderInOctave) % 1200;
		collapsed[collapsedIndex] += kde[i]; 
	}
	return collapsed;
}

//make the area under the curve 1 (a probability function)
function normalizeArea(kde){
	var area = 0;
	for (var i = 0; i < kde.length; i++) {
		area += kde[i];
	}
	var factor = 1.0/area;

	for (var i = 0; i < kde.length; i++) {
		kde[i] = kde[i] * factor;
	}
}

//Make the maximum, highest value 1.0
function normalizePeak(kde){
	var maxValue = 0;
	for (var i = 0; i < kde.length; i++) {
		maxValue = Math.max(kde[i],maxValue)
	}
	for (var i = 0; i < kde.length; i++) {
		kde[i] = kde[i]/maxValue;
	}
}

function findMax(array){
	var max = 0;
	for(var i = 0 ; i < array.length ; i++){
		max = Math.max(max,array[i]);
	}
	return max;
}

function pickPeaks(kde,min_diff,threshold){

	var half_diff = Math.floor(min_diff/2);
	var max_filtered = [];

	for(var i = 0; i < 1200 ; i++){
		var start = i - half_diff;
		var stop = i + half_diff;
		var max = 0;
		if(start < 0){
			first = findMax(kde.slice(1200-start,1200))
			second = findMax(kde.slice(0,stop))
			max = Math.max(first,second);
		} else if (stop >= 1200){
			first = findMax(kde.slice(start,1200))
			second = findMax(kde.slice(0,stop-1200))
			max = Math.max(first,second);
		} else {
			max = findMax(kde.slice(start,stop))
		}
		max_filtered.push(max);
	}

	var peaks = [];

	for(var i = 0; i < 1200 ; i++){
		if(max_filtered[i] == kde[i] && kde[i] > threshold){
			peaks.push(i);
		}
	}
	return peaks;

}

function gaussianKernel(kernelWidth){
	var calculationArea = 5 * kernelWidth;
	var halfWidth = kernelWidth / 2.0
	var kernelSize = parseInt(calculationArea * 2 + 1)
	// Compute a kernel: a lookup table with e.g. a Gaussian curve
	var kernel = new Float32Array(kernelSize);
	var difference = -calculationArea;
	for (var i = 0; i < kernelSize; i++) {
		var power = Math.pow(difference / halfWidth, 2.0);
		kernel[i] = Math.pow(Math.E, -0.5 * power);
		difference++;
	}
	return kernel;
}


//the frequency to add is expressed in cents
//the kernel is a Float32Array
//the kde is a Float32Array,
//The frequency to add is in cents
function addToEstimate(kde,kernel,frequency_to_add) {
  var kernelSize = kernel.length;
  var halfSize = Math.floor(kernelSize/2)

  var kernelIndex  = 0;
  for(var kdeIndex = frequency_to_add - halfSize ; kdeIndex <  frequency_to_add + halfSize; kdeIndex++){
    if(kdeIndex > 0 && kdeIndex < kde.length){
      kde[kdeIndex] = kde[kdeIndex] + kernel[kernelIndex];
    }
    kernelIndex = kernelIndex + 1
  }
  return kde
}
