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

// --- 4. UI & LOGIC ---
document.addEventListener("DOMContentLoaded", () => {
  // Video FX Gains
  const videoFxGain = audioCtx.createGain();
  videoFxGain.gain.value = 0;
  const videoDryGain = audioCtx.createGain();
  videoDryGain.gain.value = 1;

  // Global Video Connection helper
  function connectVideo(v) {
    try {
      const source = audioCtx.createMediaElementSource(v);
      source.connect(videoFxGain);
      source.connect(videoDryGain);
    } catch (e) {
      /* Already connected */
    }
  }

  document.querySelectorAll("video").forEach((v) => connectVideo(v));

  videoFxGain.connect(inputNode);
  videoDryGain.connect(masterGain);

  // --- RECORDING LOGIC ---
  const dest = audioCtx.createMediaStreamDestination();
  const mediaRecorder = new MediaRecorder(dest.stream);
  const chunks = [];
  masterGain.connect(dest);

  const recordBtn = document.getElementById("recordBtn");
  const recordingStatus = document.getElementById("recording-status");
  const downloadLink = document.getElementById("downloadLink");

  if (recordBtn) {
    recordBtn.addEventListener("click", () => {
      if (mediaRecorder.state === "inactive") {
        chunks.length = 0;
        mediaRecorder.start();
        recordBtn.textContent = "Stop Recording";
        recordBtn.classList.add("active");
        if (recordingStatus) recordingStatus.style.display = "flex";
        if (downloadLink) downloadLink.style.display = "none";
      } else {
        mediaRecorder.stop();
        recordBtn.textContent = "Record Session";
        recordBtn.classList.remove("active");
        if (recordingStatus) recordingStatus.style.display = "none";
      }
    });
  }

  mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: "audio/ogg; codecs=opus" });
    const url = URL.createObjectURL(blob);
    downloadLink.href = url;
    downloadLink.download = "my-chord-session.ogg";
    downloadLink.textContent = "Download My Jam";
    downloadLink.style.display = "block";
  };

  // --- MATH ROCK TAKEOVER LOGIC ---
  const mathBtn = document.getElementById("mathBtn");
  const mathOverlay = document.getElementById("math-takeover");
  const mathVideo = document.getElementById("mathVideo");
  const closeMath = document.getElementById("close-math");
  const pedalboard = document.getElementById("pedalboard");
  const mainContent = document.getElementById("main-content");
  const chromaticScale = document.querySelector(".chromatic-wrapper");

  if (mathBtn && mathOverlay && mathVideo) {
    mathBtn.onclick = () => {
      if (audioCtx.state === "suspended") audioCtx.resume();

      // 1. Show overlay (Force visibility in case of CSS inheritance)
      mathOverlay.style.display = "flex";
      mathOverlay.style.visibility = "visible";

      // 2. Hide background elements
      if (mainContent) mainContent.style.visibility = "hidden";
      if (chromaticScale) chromaticScale.style.visibility = "hidden";

      // 3. Ensure pedalboard is Supreme
      if (pedalboard) {
        pedalboard.style.zIndex = "200000";
        pedalboard.style.display = "block";
      }

      // 4. Play video
      mathVideo.muted = false;
      mathVideo.play().catch((e) => console.log("Playback error:", e));
    };
    closeMath.onclick = (e) => {
      e.preventDefault();

      // 1. Stop video and kill audio leak
      mathVideo.pause();
      mathVideo.muted = true;
      mathVideo.currentTime = 0;

      // 2. Restore UI
      mathOverlay.style.display = "none";
      if (mainContent) mainContent.style.visibility = "visible";
      if (chromaticScale) chromaticScale.style.visibility = "visible";
      document.body.style.overflow = "auto";
    };
  }

  // Visualizer
  const analyzer = audioCtx.createAnalyser();
  masterGain.connect(analyzer);
  const canvas = document.getElementById("oscillator-view");
  const canvasCtx = canvas ? canvas.getContext("2d") : null;

  // Wah
  let wahActive = false;
  const wahBtn = document.getElementById("wahBtn");
  if (wahBtn) {
    wahBtn.addEventListener("click", (e) => {
      wahActive = e.target.classList.toggle("active");
      e.target.textContent = wahActive ? "Wah-Wah: ON" : "Wah-Wah: OFF";
      wahFilter.type = wahActive ? "bandpass" : "allpass";
    });
  }

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

  // Keyboard
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
      playNote(freq * octaveMultiplier);
    }
  });

  // 1. Initialize the multiplier (Top of script)
  let octaveMultiplier = 1;

  // 2. The Octave Button Logic
  const octaveBtn = document.getElementById("octaveShiftBtn");
  if (octaveBtn) {
    octaveBtn.addEventListener("click", (e) => {
      const isActive = e.target.classList.toggle("active");
      octaveMultiplier = isActive ? 2 : 1; // 2 doubles frequency = +1 octave
      e.target.textContent = isActive ? "OCTAVE: +1" : "OCTAVE: OFF";
    });
  }
  window.addEventListener("keydown", (e) => {
    // 1. Handle Octave Shift (The '8' Key)
    if (e.key === "8") {
      e.preventDefault();
      const octaveBtn = document.getElementById("octaveShiftBtn");
      if (octaveBtn) {
        // This manually triggers the click logic you already wrote
        octaveBtn.click();
      }
      return; // Exit so it doesn't try to play a note
    }

    // 2. Handle Note Playing
    const freq = keyboardMap[e.key.toLowerCase()];
    if (freq) {
      e.preventDefault();
      // Use the multiplier here so the keyboard respects the shift!
      playNote(freq * octaveMultiplier);
    }
  });
  // 3. Update the Note Button Clicker to use the multiplier
  document.querySelectorAll(".note-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const baseFreq = parseFloat(btn.dataset.freq);
      playNote(baseFreq * octaveMultiplier);
    }),
  );

  // 4. Update Chord and Arpeggio listeners similarly
  document
    .querySelectorAll(".chord-btn")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        JSON.parse(btn.dataset.notes).forEach((f) =>
          playNote(f * octaveMultiplier, 0.1),
        ),
      ),
    );

  document
    .querySelectorAll(".arp-btn")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        JSON.parse(btn.dataset.notes).forEach((f, i) =>
          setTimeout(() => playNote(f * octaveMultiplier, 0.15), i * 250),
        ),
      ),
    );

  // Notes/Chords/Arps
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

  // FX Listeners
  const setupToggle = (id, wet, dry, labelOn, labelOff) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener("click", (e) => {
        const active = e.target.classList.toggle("active");
        if (wet) wet.gain.value = active ? 1 : 0;
        if (dry) dry.gain.value = active ? 0 : 1;
        if (labelOn) e.target.textContent = active ? labelOn : labelOff;
      });
    }
  };

  setupToggle(
    "videoFxBtn",
    videoFxGain,
    videoDryGain,
    "Video FX: ON",
    "Video FX: OFF",
  );
  setupToggle("satBtn", satWet, satDry);
  setupToggle("fuzzBtn", fuzzWet, fuzzDry);

  const tremBtn = document.getElementById("tremoloBtn");
  if (tremBtn) {
    tremBtn.addEventListener("click", (e) => {
      const active = e.target.classList.toggle("active");
      lfoDepth.gain.value = active
        ? parseFloat(document.getElementById("tremoloDepth").value)
        : 0;
    });
  }

  const delBtn = document.getElementById("delayBtn");
  if (delBtn) {
    delBtn.addEventListener("click", (e) => {
      const active = e.target.classList.toggle("active");
      const mix = parseFloat(document.getElementById("delayMix").value);
      delayWet.gain.value = active ? mix : 0;
      delayDry.gain.value = active ? 1 - mix : 1;
    });
  }

  const filtBtn = document.getElementById("filterBtn");
  if (filtBtn) {
    filtBtn.addEventListener("click", (e) => {
      const active = e.target.classList.toggle("active");
      radioFilter.type = active ? "bandpass" : "allpass";
    });
  }

  const revBtn = document.getElementById("reverbBtn");
  if (revBtn) {
    revBtn.addEventListener("click", (e) => {
      const active = e.target.classList.toggle("active");
      const mix = parseFloat(document.getElementById("revMix").value);
      reverbWet.gain.value = active ? mix : 0;
      reverbDry.gain.value = active ? 1 - mix : 1;
    });
  }

  // Spinal Tap 11
  const elevenBtn = document.getElementById("elevenBtn");
  let humOsc = null;
  let humGain = null;
  if (elevenBtn) {
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
  }

  // Sliders
  const bindSlider = (id, callback) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", (e) => callback(e.target.value));
  };

  bindSlider(
    "satDrive",
    (v) => (satNode.curve = makeDistortionCurve(parseInt(v))),
  );
  bindSlider(
    "fuzzRange",
    (v) => (fuzzNode.curve = makeDistortionCurve(parseInt(v))),
  );
  bindSlider("tremoloSpeed", (v) => (lfo.frequency.value = v));
  bindSlider("delayTime", (v) => (delayNode.delayTime.value = v));
  bindSlider("delayFeedback", (v) => (delayFeedback.gain.value = v));
  bindSlider("freq", (v) => (radioFilter.frequency.value = v));
  bindSlider("masterVol", (v) => (masterGain.gain.value = v));

  function draw() {
    requestAnimationFrame(draw);
    if (!canvasCtx) return;
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
