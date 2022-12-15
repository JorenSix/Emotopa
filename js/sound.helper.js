

var audioContext = null;

function playFrequency(frequency,duration){
	const REAL_TIME_FREQUENCY = frequency;
	const ANGULAR_FREQUENCY = REAL_TIME_FREQUENCY * 2 * Math.PI;
	const AMPLITUDE = 0.8
	const SAMPLE_RATE = 44100;
	const DURATION_IN_SAMPLES = SAMPLE_RATE * duration;

	//avoids creating the audiocontext over and over again
	if(audioContext == null){
		audioContext = new AudioContext();
	}
	
	let myBuffer = audioContext.createBuffer(1, DURATION_IN_SAMPLES, SAMPLE_RATE);
	let myArray = myBuffer.getChannelData(0);
	for (let sampleNumber = 0 ; sampleNumber < DURATION_IN_SAMPLES ; sampleNumber++) {
	  myArray[sampleNumber] = generateSample(sampleNumber);
	}

	function generateSample(sampleNumber) {
	  let sampleTime = sampleNumber / SAMPLE_RATE;
	  let sampleAngle = sampleTime * ANGULAR_FREQUENCY;
	  return Math.sin(sampleAngle) * AMPLITUDE;
	}

	let src = audioContext.createBufferSource();
	src.buffer = myBuffer;
	src.connect(audioContext.destination);
	src.start();
}
