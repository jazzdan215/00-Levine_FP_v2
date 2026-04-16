const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.connect(audioCtx.destination);

// --- 1. THE NODES ---
const inputNode = audioCtx.createGain();

// Wah
const wahFilter = audioCtx.createBiquadFilter();
wahFilter.type = "allpass";
wahFilter.Q.value = 5;
wahFilter.frequency.value = 400;

// Saturation
const satNode = audioCtx.createWaveShaper();
const satWet = audioCtx.createGain();
satWet.gain.value = 0;
const satDry = audioCtx.createGain();
satDry.gain.value = 1;

// Fuzz
const fuzzNode = audioCtx.createWaveShaper();
const fuzzWet = audioCtx.createGain();
fuzzWet.gain.value = 0;
const fuzzDry = audioCtx.createGain();
fuzzDry.gain.value = 1;

// Tremolo
const tremoloGain = audioCtx.createGain();
const lfo = audioCtx.createOscillator();
const lfoDepth = audioCtx.createGain();
lfo.type = "sine";
lfo.frequency.value = 5;
lfoDepth.gain.value = 0;
lfo.connect(lfoDepth);
lfoDepth.connect(tremoloGain.gain);
lfo.start();

// Delay
const delayNode = audioCtx.createDelay(2.0);
const delayFeedback = audioCtx.createGain();
const delayWet = audioCtx.createGain();
delayWet.gain.value = 0;
const delayDry = audioCtx.createGain();
delayDry.gain.value = 1;

// Radio & Reverb
const radioFilter = audioCtx.createBiquadFilter();
radioFilter.type = "allpass";
const reverbNode = audioCtx.createConvolver();
const reverbWet = audioCtx.createGain();
reverbWet.gain.value = 0;
const reverbDry = audioCtx.createGain();
reverbDry.gain.value = 1;

// --- 2. SERIAL WIRING ---
inputNode.connect(wahFilter);
wahFilter.connect(satNode);
satNode.connect(satWet);
wahFilter.connect(satDry);

const satOut = audioCtx.createGain();
satWet.connect(satOut);
satDry.connect(satOut);

const fuzzInput = audioCtx.createGain();
satOut.connect(fuzzInput);
fuzzInput.connect(fuzzNode);
fuzzNode.connect(fuzzWet);
fuzzInput.connect(fuzzDry);

const fuzzOut = audioCtx.createGain();
fuzzWet.connect(fuzzOut);
fuzzDry.connect(fuzzOut);

fuzzOut.connect(tremoloGain);

const delayInput = audioCtx.createGain();
tremoloGain.connect(delayInput);
delayInput.connect(delayNode);
delayNode.connect(delayFeedback);
delayFeedback.connect(delayNode);
delayNode.connect(delayWet);
delayInput.connect(delayDry);

const delayOut = audioCtx.createGain();
delayWet.connect(delayOut);
delayDry.connect(delayOut);

delayOut.connect(radioFilter);

const reverbInput = audioCtx.createGain();
radioFilter.connect(reverbInput);
reverbInput.connect(reverbNode);
reverbNode.connect(reverbWet);
reverbInput.connect(reverbDry);

reverbWet.connect(masterGain);
reverbDry.connect(masterGain);

// --- 3. HELPERS ---
function createSpringImpulse() {
  const length = audioCtx.sampleRate * 2;
  const impulse = audioCtx.createBuffer(2, length, audioCtx.sampleRate);
  for (let i = 0; i < 2; i++) {
    const channel = impulse.getChannelData(i);
    for (let j = 0; j < length; j++) {
      channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, 4);
    }
  }
  reverbNode.buffer = impulse;
}
createSpringImpulse();

function makeDistortionCurve(amount) {
  const k = typeof amount === "number" ? amount : 50;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] =
      ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

function playNote(freq, maxgain = 0.2) {
  if (audioCtx.state === "suspended") audioCtx.resume();
  const toneDropdown = document.getElementById("toneSelect");
  const selectedTone = toneDropdown ? toneDropdown.value : "sine";

  const osc = audioCtx.createOscillator();
  const noteGain = audioCtx.createGain();

  osc.type = selectedTone;
  osc.frequency.value = freq;

  noteGain.gain.setValueAtTime(0, audioCtx.currentTime);
  noteGain.gain.linearRampToValueAtTime(maxgain, audioCtx.currentTime + 0.05);
  noteGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1);

  osc.connect(noteGain);
  noteGain.connect(inputNode);

  osc.start();
  osc.stop(audioCtx.currentTime + 1.2);
}

// --- 4. UI CONTROLS ---
document.addEventListener("DOMContentLoaded", () => {
  // --- RECORDING LOGIC ---
  const dest = audioCtx.createMediaStreamDestination();
  const mediaRecorder = new MediaRecorder(dest.stream);
  const chunks = [];

  // Connect your masterGain to the recorder destination
  // This ensures everything going to your speakers also goes to the "tape"
  masterGain.connect(dest);

  const recordBtn = document.getElementById("recordBtn");
  const recordingStatus = document.getElementById("recording-status");
  const downloadLink = document.getElementById("downloadLink");

  recordBtn.addEventListener("click", () => {
    if (mediaRecorder.state === "inactive") {
      chunks.length = 0;
      mediaRecorder.start();

      // UI Updates
      recordBtn.textContent = "Stop Recording";
      recordBtn.classList.add("active");
      recordingStatus.style.display = "flex"; // Show the light/image
      downloadLink.style.display = "none";
    } else {
      mediaRecorder.stop();

      // UI Updates
      recordBtn.textContent = "Record Session";
      recordBtn.classList.remove("active");
      recordingStatus.style.display = "none"; // Hide the light/image
    }
  });

  // When the recorder has data, push it to our array
  mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

  // When recording stops, create a file and show the download link
  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: "audio/ogg; codecs=opus" });
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = "my-chord-session.ogg";
    downloadLink.textContent = "Download My Jam";
    downloadLink.style.display = "block";
  };

  // Visualizer Setup
  const analyzer = audioCtx.createAnalyser();
  masterGain.connect(analyzer);
  const canvas = document.getElementById("oscillator-view");
  const canvasCtx = canvas.getContext("2d");

  // Wah
  let wahActive = false;
  document.getElementById("wahBtn").addEventListener("click", (e) => {
    wahActive = e.target.classList.toggle("active");
    e.target.textContent = wahActive ? "Wah-Wah: ON" : "Wah-Wah: OFF";
    wahFilter.type = wahActive ? "bandpass" : "allpass";
  });

  window.addEventListener("mousemove", (e) => {
    if (wahActive) {
      const frequency = 400 + (e.clientY / window.innerHeight) * 2600;
      wahFilter.frequency.setTargetAtTime(
        frequency,
        audioCtx.currentTime,
        0.05,
      );
    }
  });

  // Keyboard Mapping
  const keyboardMap = {
    a: 261.63,
    w: 277.18,
    s: 293.66,
    e: 311.13,
    d: 329.63,
    f: 349.23,
    t: 369.99,
    g: 392.0,
    y: 415.3,
    h: 440.0,
    u: 466.16,
    j: 493.88,
    k: 523.25,
  };
  window.addEventListener("keydown", (e) => {
    const freq = keyboardMap[e.key.toLowerCase()];
    if (freq) {
      e.preventDefault();
      playNote(freq);
    }
  });

  // Button Listeners
  document
    .querySelectorAll(".note-btn")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        playNote(parseFloat(btn.dataset.freq)),
      ),
    );
  document
    .querySelectorAll(".chord-btn")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        JSON.parse(btn.dataset.notes).forEach((f) => playNote(f, 0.1)),
      ),
    );
  document
    .querySelectorAll(".arp-btn")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        JSON.parse(btn.dataset.notes).forEach((f, i) =>
          setTimeout(() => playNote(f, 0.15), i * 250),
        ),
      ),
    );

  // Video Routing
  const videoFxGain = audioCtx.createGain();
  videoFxGain.gain.value = 0;
  const videoDryGain = audioCtx.createGain();
  videoDryGain.gain.value = 1;
  document.querySelectorAll("video").forEach((v) => {
    try {
      const source = audioCtx.createMediaElementSource(v);
      source.connect(videoFxGain);
      source.connect(videoDryGain);
    } catch (err) {}
  });
  videoFxGain.connect(inputNode);
  videoDryGain.connect(masterGain);

  // FX Toggles
  document.getElementById("videoFxBtn").addEventListener("click", (e) => {
    const active = e.target.classList.toggle("active");
    videoFxGain.gain.value = active ? 1 : 0;
    videoDryGain.gain.value = active ? 0 : 1;
    e.target.textContent = active ? "Video FX: ON" : "Video FX: OFF";
  });

  document.getElementById("satBtn").addEventListener("click", (e) => {
    const active = e.target.classList.toggle("active");
    satWet.gain.value = active ? 1 : 0;
    satDry.gain.value = active ? 0 : 1;
  });

  document.getElementById("fuzzBtn").addEventListener("click", (e) => {
    const active = e.target.classList.toggle("active");
    fuzzWet.gain.value = active ? 1 : 0;
    fuzzDry.gain.value = active ? 0 : 1;
  });

  document.getElementById("tremoloBtn").addEventListener("click", (e) => {
    const active = e.target.classList.toggle("active");
    lfoDepth.gain.value = active
      ? parseFloat(document.getElementById("tremoloDepth").value)
      : 0;
  });

  document.getElementById("delayBtn").addEventListener("click", (e) => {
    const active = e.target.classList.toggle("active");
    const mix = parseFloat(document.getElementById("delayMix").value);
    delayWet.gain.value = active ? mix : 0;
    delayDry.gain.value = active ? 1 - mix : 1;
  });

  document.getElementById("filterBtn").addEventListener("click", (e) => {
    const active = e.target.classList.toggle("active");
    radioFilter.type = active ? "bandpass" : "allpass";
  });

  document.getElementById("reverbBtn").addEventListener("click", (e) => {
    const active = e.target.classList.toggle("active");
    const mix = parseFloat(document.getElementById("revMix").value);
    reverbWet.gain.value = active ? mix : 0;
    reverbDry.gain.value = active ? 1 - mix : 1;
  });

  // --- SPINAL TAP "11" ---
  const elevenBtn = document.getElementById("elevenBtn");
  let humOsc = null;
  let humGain = null;

  elevenBtn.addEventListener("click", async (e) => {
    if (audioCtx.state === "suspended") await audioCtx.resume();
    const isActive = e.target.classList.toggle("active");
    e.target.textContent = isActive ? "11!" : "11";
    document.body.classList.toggle("maxed-out", isActive);

    if (isActive) {
      humOsc = audioCtx.createOscillator();
      humGain = audioCtx.createGain();
      humOsc.type = "sine";
      humOsc.frequency.setValueAtTime(55, audioCtx.currentTime);
      humGain.gain.setValueAtTime(0, audioCtx.currentTime);
      humOsc.connect(humGain);
      humGain.connect(analyzer);
      humGain.connect(masterGain);
      humOsc.start();
      humGain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.2);
    } else if (humOsc) {
      humGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
      humOsc.stop(audioCtx.currentTime + 0.5);
      humOsc = null;
    }
  });

  // Slider Listeners
  document
    .getElementById("satDrive")
    .addEventListener(
      "input",
      (e) => (satNode.curve = makeDistortionCurve(parseInt(e.target.value))),
    );
  document
    .getElementById("fuzzRange")
    .addEventListener(
      "input",
      (e) => (fuzzNode.curve = makeDistortionCurve(parseInt(e.target.value))),
    );
  document
    .getElementById("tremoloSpeed")
    .addEventListener("input", (e) => (lfo.frequency.value = e.target.value));
  document
    .getElementById("delayTime")
    .addEventListener(
      "input",
      (e) => (delayNode.delayTime.value = e.target.value),
    );
  document
    .getElementById("delayFeedback")
    .addEventListener(
      "input",
      (e) => (delayFeedback.gain.value = e.target.value),
    );
  document
    .getElementById("freq")
    .addEventListener(
      "input",
      (e) => (radioFilter.frequency.value = e.target.value),
    );
  document
    .getElementById("masterVol")
    .addEventListener("input", (e) => (masterGain.gain.value = e.target.value));

  function draw() {
    requestAnimationFrame(draw);
    const bufferLength = analyzer.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyzer.getByteTimeDomainData(dataArray);
    canvasCtx.fillStyle = "#1a1a1a";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
    canvasCtx.lineWidth = 2;
    canvasCtx.strokeStyle = "#00f2ff";
    canvasCtx.beginPath();
    let sliceWidth = canvas.width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      let v = dataArray[i] / 128.0;
      let y = (v * canvas.height) / 2;
      if (i === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);
      x += sliceWidth;
    }
    canvasCtx.stroke();
  }
  draw();
});
