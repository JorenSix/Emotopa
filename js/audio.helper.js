
class MediaFile {

  buffer = null;
  duration = 0;
  file_name = null;

  //The name of the input file with a buffer of bytes
  constructor(file_name,buffer) {
    this.file_name = file_name;
    this.buffer = buffer;
  }

  asBlob(){
    return new Blob([this.buffer], { type: 'audio/' + this.extension() })
  }

  extension(){
    return this.file_name.split('.').pop();
  }

  //transcode the file to raw audio samples with a certain sample rate
  async transcode(target_sample_rate,progressHandler){
    
    var helper = new FFmpegHelper();
    await helper.initialzeFFmpeg();

    var outputFileName = "part.raw";
    var inputFileName = this.file_name;

    var args = ['-y','-i', inputFileName, '-vn' ,'-codec:a', 'pcm_f32le' ,'-ac','1','-f','f32le','-ar',target_sample_rate.toFixed() , outputFileName];

    if(typeof window === `undefined`)
      helper.FS().writeFile(inputFileName, new Uint8Array(this.buffer)) ;
    else
      helper.FS().writeFile(inputFileName, new Uint8Array(await this.buffer)) ;

  	helper.ffmpegProgressHandler = (progress) => {console.log("handled progress", progress);if(progressHandler != null) progressHandler(progress);};

    await helper.run(args);

    console.log("Ran ffmpeg");

    var outBuffer = helper.FS().readFile(outputFileName);
    return await new Float32Array(outBuffer.buffer);
  }

}