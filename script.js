const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.connect(audioCtx.destination);

// --- 1. THE NODES ---
const inputNode = audioCtx.createGain();

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
lfoDepth.gain.value = 0; // Starts at 0
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

// Radio Filter
const radioFilter = audioCtx.createBiquadFilter();
radioFilter.type = "allpass";

// Reverb (Convolver)
const reverbNode = audioCtx.createConvolver();
const reverbWet = audioCtx.createGain();
reverbWet.gain.value = 0;
const reverbDry = audioCtx.createGain();
reverbDry.gain.value = 1;

// --- 2. SERIAL BYPASS WIRING ---

// Input -> Saturation Stage
inputNode.connect(satNode);
satNode.connect(satWet);
inputNode.connect(satDry);

// Saturation -> Fuzz Stage
const fuzzInput = audioCtx.createGain();
satWet.connect(fuzzInput);
satDry.connect(fuzzInput);

fuzzInput.connect(fuzzNode);
fuzzNode.connect(fuzzWet);
fuzzInput.connect(fuzzDry);

// Fuzz -> Tremolo Stage
const tremInput = audioCtx.createGain();
fuzzWet.connect(tremInput);
fuzzDry.connect(tremInput);
tremInput.connect(tremoloGain);

// Tremolo -> Delay Stage
const delayInput = audioCtx.createGain();
tremoloGain.connect(delayInput);
delayInput.connect(delayNode);
delayNode.connect(delayFeedback);
delayFeedback.connect(delayNode);
delayNode.connect(delayWet);
delayInput.connect(delayDry);

// Delay -> Radio Stage
const radioInput = audioCtx.createGain();
delayWet.connect(radioInput);
delayDry.connect(radioInput);
radioInput.connect(radioFilter);

// Radio -> Reverb Stage
const reverbInput = audioCtx.createGain();
radioFilter.connect(reverbInput);
reverbInput.connect(reverbNode);
reverbNode.connect(reverbWet);
reverbInput.connect(reverbDry);

// Final Output
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
  const k = typeof amount === "number" ? amount : 50,
    n_samples = 44100,
    curve = new Float32Array(n_samples);
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] =
      ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}
fuzzNode.curve = makeDistortionCurve(0);
satNode.curve = makeDistortionCurve(0);

function playNote(freq, maxgain = 0.2) {
  if (audioCtx.state === "suspended") audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const noteGain = audioCtx.createGain();
  osc.type = "sawtooth";
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
  // Note Button Listeners
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

  // Video Setup
  const videoFxGain = audioCtx.createGain();
  videoFxGain.gain.value = 0;
  const videoDryGain = audioCtx.createGain();
  videoDryGain.gain.value = 1;
  document.querySelectorAll("video").forEach((v) => {
    const source = audioCtx.createMediaElementSource(v);
    source.connect(videoFxGain);
    source.connect(videoDryGain);
  });
  videoFxGain.connect(inputNode);
  videoDryGain.connect(masterGain);

  // Toggle Buttons
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
    e.target.textContent = active ? "Saturation: ON" : "Saturation: OFF";
  });

  document.getElementById("fuzzBtn").addEventListener("click", (e) => {
    const active = e.target.classList.toggle("active");
    fuzzWet.gain.value = active ? 1 : 0;
    fuzzDry.gain.value = active ? 0 : 1;
    e.target.textContent = active ? "Fuzz: ON" : "Fuzz: OFF";
  });

  document.getElementById("tremoloBtn").addEventListener("click", (e) => {
    const active = e.target.classList.toggle("active");
    lfoDepth.gain.value = active
      ? parseFloat(document.getElementById("tremoloDepth").value)
      : 0;
    e.target.textContent = active ? "Tremolo: ON" : "Tremolo: OFF";
  });

  // Sliders
  document
    .getElementById("satDrive")
    .addEventListener(
      "input",
      (e) => (satNode.curve = makeDistortionCurve(e.target.value)),
    );
  document
    .getElementById("fuzzRange")
    .addEventListener(
      "input",
      (e) => (fuzzNode.curve = makeDistortionCurve(e.target.value)),
    );
  document
    .getElementById("tremoloSpeed")
    .addEventListener("input", (e) => (lfo.frequency.value = e.target.value));
  document.getElementById("tremoloDepth").addEventListener("input", (e) => {
    if (document.getElementById("tremoloBtn").classList.contains("active"))
      lfoDepth.gain.value = e.target.value;
  });

  document.getElementById("delayBtn").addEventListener("click", (e) => {
    const active = e.target.classList.toggle("active");
    const mix = parseFloat(document.getElementById("delayMix").value);
    delayWet.gain.value = active ? mix : 0;
    delayDry.gain.value = active ? 1 - mix : 1;
    e.target.textContent = active ? "Delay: ON" : "Delay: OFF";
  });

  document.getElementById("delayMix").addEventListener("input", (e) => {
    if (document.getElementById("delayBtn").classList.contains("active")) {
      delayWet.gain.value = e.target.value;
      delayDry.gain.value = 1 - e.target.value;
    }
  });

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

  document.getElementById("filterBtn").addEventListener("click", (e) => {
    const active = e.target.classList.toggle("active");
    radioFilter.type = active ? "bandpass" : "allpass";
    e.target.textContent = active ? "AM Radioizer: ON" : "AM Radioizer: OFF";
  });
  document
    .getElementById("freq")
    .addEventListener(
      "input",
      (e) => (radioFilter.frequency.value = e.target.value),
    );

  document.getElementById("reverbBtn").addEventListener("click", (e) => {
    const active = e.target.classList.toggle("active");
    const mix = parseFloat(document.getElementById("revMix").value);
    reverbWet.gain.value = active ? mix : 0;
    reverbDry.gain.value = active ? 1 - mix : 1;
    e.target.textContent = active ? "Reverb: ON" : "Reverb: OFF";
  });

  document.getElementById("revMix").addEventListener("input", (e) => {
    if (document.getElementById("reverbBtn").classList.contains("active")) {
      reverbWet.gain.value = e.target.value;
      reverbDry.gain.value = 1 - e.target.value;
    }
  });

  document
    .getElementById("masterVol")
    .addEventListener("input", (e) => (masterGain.gain.value = e.target.value));

  // Visualizer Logic
  const analyzer = audioCtx.createAnalyser();
  masterGain.connect(analyzer);
  const canvas = document.getElementById("oscillator-view");
  const canvasCtx = canvas.getContext("2d");

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
