// 1. AUDIO SETUP (The Pedalboard)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.connect(audioCtx.destination);

// THE RADIO FILTER (Bandpass)
const radioFilter = audioCtx.createBiquadFilter();
radioFilter.type = "allpass"; // DEFAULT: OFF (Allpass does nothing)
radioFilter.frequency.value = 1000;
radioFilter.Q.value = 2;

// THE DELAY SYSTEM
const delayNode = audioCtx.createDelay();
const feedbackNode = audioCtx.createGain();
const dryGain = audioCtx.createGain();
const wetGain = audioCtx.createGain();

delayNode.delayTime.value = 0.5;
feedbackNode.gain.value = 0.5;

// DEFAULT: OFF (Dry at 1, Wet at 0)
dryGain.gain.value = 1;
wetGain.gain.value = 0;

// THE WIRING
radioFilter.connect(dryGain);
radioFilter.connect(delayNode);
delayNode.connect(feedbackNode);
feedbackNode.connect(delayNode);
delayNode.connect(wetGain);
dryGain.connect(masterGain);
wetGain.connect(masterGain);

// 2. CONNECT VIDEOS
window.addEventListener("load", () => {
  document.querySelectorAll("video").forEach((video) => {
    const source = audioCtx.createMediaElementSource(video);
    source.connect(radioFilter);
  });
});

// 3. PLAY FUNCTIONS
function playNote(freq, maxgain = 0.3) {
  if (audioCtx.state === "suspended") audioCtx.resume();

  const osc = audioCtx.createOscillator();
  const noteGain = audioCtx.createGain();

  osc.type = "sawtooth";
  osc.frequency.value = freq;

  // Envelope to prevent clicking and add a natural fade
  noteGain.gain.setValueAtTime(0, audioCtx.currentTime);
  noteGain.gain.linearRampToValueAtTime(maxgain, audioCtx.currentTime + 0.05);
  noteGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);

  // --- THE CONNECTION ---
  osc.connect(noteGain);

  // This is the "Magic Cable": It plugs the note into the Radio Filter
  // which then flows into the Delay and Master Gain automatically.
  noteGain.connect(radioFilter);

  osc.start();
  osc.stop(audioCtx.currentTime + 1.3);
}

// --- CHORD & ARPEGGIO LOGIC ---

function playChord(freqs) {
  // We reduce the gain slightly for chords (0.1) so they don't distort
  // when 4 notes play at once through the filter.
  freqs.forEach((f) => playNote(f, 0.1));
}

function playArpeggio(freqs) {
  freqs.forEach((f, i) => {
    // Each note in the array plays 300ms after the previous one
    setTimeout(() => playNote(f, 0.2), i * 300);
  });
}

// 4. UI CONTROLS (The Brain)
document.addEventListener("DOMContentLoaded", () => {
  let isFilterOn = false;
  let isDelayOn = false;

  // FILTER TOGGLE
  const filterBtn = document.getElementById("filterBtn");
  filterBtn.addEventListener("click", () => {
    isFilterOn = !isFilterOn;
    if (isFilterOn) {
      filterBtn.textContent = "Filter: ON";
      radioFilter.type = "bandpass";
    } else {
      filterBtn.textContent = "Filter: OFF";
      radioFilter.type = "allpass";
    }
  });

  // DELAY TOGGLE
  const delayBtn = document.getElementById("delayBtn");
  delayBtn.addEventListener("click", () => {
    isDelayOn = !isDelayOn;
    if (isDelayOn) {
      delayBtn.textContent = "Delay: ON";
      const mixVal = parseFloat(document.getElementById("delayMix").value);
      wetGain.gain.value = mixVal;
      dryGain.gain.value = 1 - mixVal;
    } else {
      delayBtn.textContent = "Delay: OFF";
      wetGain.gain.value = 0;
      dryGain.gain.value = 1;
    }
  });

  // SLIDERS
  document.getElementById("freq").addEventListener("input", (e) => {
    const val = e.target.value;
    document.getElementById("freq-value").textContent = val;
    if (isFilterOn) radioFilter.frequency.value = val;
  });

  document.getElementById("delayMix").addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    if (isDelayOn) {
      wetGain.gain.value = val;
      dryGain.gain.value = 1 - val;
    }
  });
});
