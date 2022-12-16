
self.onmessage = (e) => {
  const raw_audio_samples = e.data[0];
  const sampleRate = e.data[1];
  handleTranscodedAudioSamples(raw_audio_samples,sampleRate);
}

function hzToAbsoluteCents(frequencyInHz){
    //always returns the closest integer, no fractional cents are used
    return Math.round(6900 + 1200 * Math.log(frequencyInHz/440.0)/Math.log(2));
}

function handleTranscodedAudioSamples(raw_audio_samples,sampleRate){
    var pitch_estimates = [];
    var yin_buffer_size = 1024;
    var yin_step_size = 1024;

    postMessage({progress: 0});

    var startTime = new Date(); 

    for(var sample_index = 0 ; sample_index < raw_audio_samples.length - yin_buffer_size; sample_index += yin_step_size){
      var start_index = sample_index;
      var stop_index = sample_index + yin_buffer_size;
      var analysis_buffer = raw_audio_samples.slice(start_index,stop_index);
      var buffer_start_time_in_s = sample_index / sampleRate;
      var percentage_finished = sample_index/raw_audio_samples.length * 100.0
      var detected_pitch_in_hz = detectPitchYin(analysis_buffer,sampleRate);
      if(detected_pitch_in_hz){
        detected_pitch_in_cents = hzToAbsoluteCents(detected_pitch_in_hz);
        //console.log(buffer_start_time_in_s,"s",detected_pitch_in_hz,"Hz",detected_pitch_in_cents,"abs cents",percentage_finished,"% done");
        pitch_estimates.push({time_in_s: buffer_start_time_in_s, pitch_in_hz: detected_pitch_in_hz, pitch_in_cents: detected_pitch_in_cents});
      }

      endTime = new Date();
      var timeDiff = endTime - startTime; //in ms
      if(timeDiff >= 40){
        startTime = new Date();
        postMessage({pitch_estimates: pitch_estimates});
      }

      //console.log(percentage_finished,"% done");
      postMessage({progress: percentage_finished});
    }
    
   
    postMessage({progress: 100});

    postMessage({pitch_estimates: pitch_estimates});
}

function detectPitchYin(float32Buffer,sampleRate) {

    const threshold =  0.2;
    
    // Set buffer size to the highest power of two below the provided buffer's length.
   
    // Set up the yinBuffer as described in step one of the YIN paper.
    const yinBufferLength = float32Buffer.length / 2;
    const yinBuffer = new Float32Array(yinBufferLength);

    let probability, tau;

    // Compute the difference function as described in step 2 of the YIN paper.
    for (let t = 0; t < yinBufferLength; t++) {
      yinBuffer[t] = 0;
    }
    for (let t = 1; t < yinBufferLength; t++) {
      for (let i = 0; i < yinBufferLength; i++) {
        const delta = float32Buffer[i] - float32Buffer[i + t];
        yinBuffer[t] += delta * delta;
      }
    }

    // Compute the cumulative mean normalized difference as described in step 3 of the paper.
    yinBuffer[0] = 1;
    let runningSum = 0;
    for (let t = 1; t < yinBufferLength; t++) {
      runningSum += yinBuffer[t];
      yinBuffer[t] *= t / runningSum;
    }

    // Compute the absolute threshold as described in step 4 of the paper.
    // Since the first two positions in the array are 1,
    // we can start at the third position.
    for (tau = 2; tau < yinBufferLength; tau++) {
      if (yinBuffer[tau] < threshold) {
        while (tau + 1 < yinBufferLength && yinBuffer[tau + 1] < yinBuffer[tau]) {
          tau++;
        }
        // found tau, exit loop and return
        // store the probability
        // From the YIN paper: The threshold determines the list of
        // candidates admitted to the set, and can be interpreted as the
        // proportion of aperiodic power tolerated
        // within a periodic signal.
        //
        // Since we want the periodicity and and not aperiodicity:
        // periodicity = 1 - aperiodicity
        probability = 1 - yinBuffer[tau];
        break;
      }
    }

    // if no pitch found, return null.
    if (tau == yinBufferLength || yinBuffer[tau] >= threshold) {
      return null;
    }

    // If probability too low, return -1.
    if (probability < threshold) {
      return null;
    }


    /**
     * Implements step 5 of the AUBIO_YIN paper. It refines the estimated tau
     * value using parabolic interpolation. This is needed to detect higher
     * frequencies more precisely. See http://fizyka.umk.pl/nrbook/c10-2.pdf and
     * for more background
     * http://fedc.wiwi.hu-berlin.de/xplore/tutorials/xegbohtmlnode62.html
     */
    let betterTau, x0, x2;
    if (tau < 1) {
      x0 = tau;
    } else {
      x0 = tau - 1;
    }
    if (tau + 1 < yinBufferLength) {
      x2 = tau + 1;
    } else {
      x2 = tau;
    }
    if (x0 === tau) {
      if (yinBuffer[tau] <= yinBuffer[x2]) {
        betterTau = tau;
      } else {
        betterTau = x2;
      }
    } else if (x2 === tau) {
      if (yinBuffer[tau] <= yinBuffer[x0]) {
        betterTau = tau;
      } else {
        betterTau = x0;
      }
    } else {
      const s0 = yinBuffer[x0];
      const s1 = yinBuffer[tau];
      const s2 = yinBuffer[x2];
      // fixed AUBIO implementation, thanks to Karl Helgason:
      // (2.0f * s1 - s2 - s0) was incorrectly multiplied with -1
      betterTau = tau + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
    }

    return sampleRate / betterTau;
  };
