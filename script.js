const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.connect(audioCtx.destination);

// --- 1. THE NODES (The Pedals) ---

// FUZZ
const fuzzNode = audioCtx.createWaveShaper();
const fuzzWet = audioCtx.createGain();
fuzzWet.gain.value = 0;
const fuzzDry = audioCtx.createGain();
fuzzDry.gain.value = 1;

// DELAY
const delayNode = audioCtx.createDelay(2.0);
const delayFeedback = audioCtx.createGain();
const delayWet = audioCtx.createGain();
delayWet.gain.value = 0;
const delayDry = audioCtx.createGain();
delayDry.gain.value = 1;
delayFeedback.gain.value = 0;
delayNode.delayTime.value = 0; // Default feedback

// AM RADIOIZER
const radioFilter = audioCtx.createBiquadFilter();
radioFilter.type = "allpass"; // Clean by default

// REVERB
const reverbNode = audioCtx.createConvolver();
const reverbWet = audioCtx.createGain();
reverbWet.gain.value = 0;
const reverbDry = audioCtx.createGain();
reverbDry.gain.value = 1;

// --- 2. THE WIRING (Serial Patching) ---

// SOURCE -> [FUZZ] -> [DELAY] -> [RADIO] -> [REVERB] -> MASTER

// Input into Fuzz Stage
const inputNode = audioCtx.createGain();

// Fuzz Connections
inputNode.connect(fuzzNode);
fuzzNode.connect(fuzzWet);
inputNode.connect(fuzzDry);

// Fuzz Out -> Delay In
const delayInput = audioCtx.createGain();
fuzzWet.connect(delayInput);
fuzzDry.connect(delayInput);

// Delay Connections
delayInput.connect(delayNode);
delayNode.connect(delayFeedback);
delayFeedback.connect(delayNode); // Internal feedback only
delayNode.connect(delayWet);
delayInput.connect(delayDry);

// Delay Out -> Radio In
const radioInput = audioCtx.createGain();
delayWet.connect(radioInput);
delayDry.connect(radioInput);

// Radio Out -> Reverb In
const reverbInput = audioCtx.createGain();
radioInput.connect(radioFilter);
radioFilter.connect(reverbInput);

// Reverb Connections
reverbInput.connect(reverbNode);
reverbNode.connect(reverbWet);
reverbInput.connect(reverbDry);

// Reverb Out -> Master
reverbWet.connect(masterGain);
reverbDry.connect(masterGain);

// --- 3. THE "GHOST" REVERB IMPULSE ---
// This creates a "Spring Tank" sound without needing an external file
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

// --- 4. AUDIO HELPERS ---
function makeDistortionCurve(amount = 400) {
  const k = amount,
    n_samples = 44100,
    curve = new Float32Array(n_samples);
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] =
      ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}
fuzzNode.curve = makeDistortionCurve();

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
  noteGain.connect(inputNode); // Plugs into start of chain
  osc.start();
  osc.stop(audioCtx.currentTime + 1.2);
}

function updateDelayMix() {
  const isON = document.getElementById("delayBtn").classList.contains("active");
  const val = parseFloat(document.getElementById("delayMix").value);
  delayWet.gain.value = isON ? val : 0;
  delayDry.gain.value = isON ? 1 - val : 1;
}

document.getElementById("delayMix").addEventListener("input", updateDelayMix);

function updateReverbMix() {
  const isON = document
    .getElementById("reverbBtn")
    .classList.contains("active");
  const val = parseFloat(document.getElementById("revMix").value);
  reverbWet.gain.value = isON ? val : 0;
  reverbDry.gain.value = isON ? 1 - val : 1;
}

document.getElementById("revMix").addEventListener("input", updateReverbMix);

// --- 5. UI CONTROLS ---
document.addEventListener("DOMContentLoaded", () => {
  // --- NOTE BUTTONS ---
  document.querySelectorAll(".note-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const freq = parseFloat(btn.dataset.freq);
      playNote(freq);
    });
  });

  // --- CHORD BUTTONS ---
  document.querySelectorAll(".chord-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      // JSON.parse turns the "[1, 2, 3]" string back into a real list of numbers
      const freqs = JSON.parse(btn.dataset.notes);
      freqs.forEach((f) => playNote(f, 0.1)); // Lower gain so 4 notes don't distort
    });
  });

  // --- ARPEGGIO BUTTONS ---
  document.querySelectorAll(".arp-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const freqs = JSON.parse(btn.dataset.notes);
      freqs.forEach((f, i) => {
        // Plays each note 250ms after the previous one
        setTimeout(() => playNote(f, 0.15), i * 250);
      });
    });
  });

  // --- MIX SLIDER LOGIC ---
  // We define these inside so they can see the HTML elements
  function updateDelayMix() {
    const isON = document
      .getElementById("delayBtn")
      .classList.contains("active");
    const val = parseFloat(document.getElementById("delayMix").value);
    delayWet.gain.value = isON ? val : 0;
    delayDry.gain.value = isON ? 1 - val : 1;
  }

  function updateReverbMix() {
    const isON = document
      .getElementById("reverbBtn")
      .classList.contains("active");
    const val = parseFloat(document.getElementById("revMix").value);
    reverbWet.gain.value = isON ? val : 0;
    reverbDry.gain.value = isON ? 1 - val : 1;
  }

  // Attach the listeners to the sliders
  document.getElementById("delayMix").addEventListener("input", updateDelayMix);
  document.getElementById("revMix").addEventListener("input", updateReverbMix);

  // Video Routing
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

  // Video Toggle
  document.getElementById("videoFxBtn").addEventListener("click", (e) => {
    const active = e.target.classList.toggle("active");
    videoFxGain.gain.value = active ? 1 : 0;
    videoDryGain.gain.value = active ? 0 : 1;
    e.target.textContent = active ? "Video FX: ON" : "Video FX: OFF";
  });

  // Fuzz Toggle & Slider
  document.getElementById("fuzzBtn").addEventListener("click", (e) => {
    const active = e.target.classList.toggle("active");
    fuzzWet.gain.value = active ? 1 : 0;
    fuzzDry.gain.value = active ? 0 : 1;
    e.target.textContent = active ? "Fuzz: ON" : "Fuzz: OFF";
  });
  document.getElementById("fuzzRange").addEventListener("input", (e) => {
    fuzzNode.curve = makeDistortionCurve(e.target.value);
  });

  // Delay Toggle & Sliders
  document.getElementById("delayBtn").addEventListener("click", (e) => {
    const active = e.target.classList.toggle("active");
    const mix = parseFloat(document.getElementById("delayMix").value);
    delayWet.gain.value = active ? mix : 0;
    delayDry.gain.value = active ? 1 - mix : 1;
    e.target.textContent = active ? "Delay: ON" : "Delay: OFF";
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

  // Radioizer Toggle & Slider
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

  // Reverb Toggle & Slider
  document.getElementById("reverbBtn").addEventListener("click", (e) => {
    const active = e.target.classList.toggle("active");
    const mix = parseFloat(document.getElementById("revMix").value);
    reverbWet.gain.value = active ? mix : 0;
    reverbDry.gain.value = active ? 1 - mix : 1;
    e.target.textContent = active ? "Reverb: ON" : "Reverb: OFF";
  });

  // Master Volume
  document
    .getElementById("masterVol")
    .addEventListener("input", (e) => (masterGain.gain.value = e.target.value));

  // Note/Chord listeners... (Keep your existing button listeners here)
});
