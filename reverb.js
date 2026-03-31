// Create the AudioContext, which is the main Web Audio environment
const audioContext = new AudioContext();

// Create a GainNode to control the final output volume
const dryGain = new GainNode(audioContext);
dryGain.gain.value = 0.5; // Set output volume to 50% -6dBFS

// Create a GainNode to control the final output volume
const wetGain = new GainNode(audioContext);
wetGain.gain.value = 0.5; // Set output volume to 50% -6dBFS

// Create a GainNode to control the final output volume
const outputGain = new GainNode(audioContext);
outputGain.gain.value = 0.125; // Set output volume to 12.5% -18dBFS

// Connect the delayed signal to the output gain (and then to the speakers)
dryGain.connect(outputGain);
wetGain.connect(outputGain);
outputGain.connect(audioContext.destination);

// Variable to hold the microphone input node
let mic;
// Variable to hold the reverb node
let reverb;

//CREATE CONVOLVER NODE HERE!!!!!!!!!!!!!!!!!!!!

/**
 * return a ConvolverNode
 */

const createReverb = async function () {
  // load impulse reponse
  let response = await fetch("ir/TPAC-Chapel.wav");
  let arrayBuffer = await response.arrayBuffer();
  let ir = await audioContext.decodeAudioData(arrayBuffer);

  return new ConvolverNode(audioContext, { buffer: ir });
};

reverb = await createReverb();
reverb.connect(wetGain);

// Function to start the microphone and connect it to the delay line
const startMic = async function () {
  // Resume the AudioContext (required by most browsers on user interaction)
  await audioContext.resume();

  // Request access to the user's microphone
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    autoGainControl: false,
    echoCancellation: false,
    noiseSuppression: false,
  });

  // Create a MediaStreamAudioSourceNode from the microphone stream
  mic = new MediaStreamAudioSourceNode(audioContext, { mediaStream: stream });

  // Connect the microphone to the delay line (which is already connected to output)
  mic.connect(dryGain);
  mic.connect(reverb);
};

// Function to stop the microphone processing
const stopMic = function () {
  // Disconnect the microphone input from the audio graph
  if (mic) mic.disconnect();
};

const wetDryUpdate = function (event) {
  let mixValue = Number(event.target.value);
  let now = audioContext.currentTime;
  document.getElementById("wdLabel").innerText = `${mixValue}%`;
  mixValue = mixValue / 100; //turn % into 0-1.

  dryGain.gain.linearRampToValueAtTime(1 - mixValue, now + 0.01);
  wetGain.gain.linearRampToValueAtTime(mixValue, now + 0.01);
};

// Set up event listeners for the Start and Stop buttons
document.getElementById("start").addEventListener("click", startMic);
document.getElementById("stop").addEventListener("click", stopMic);
document.getElementById("mix").addEventListener("input", wetDryUpdate);
