// --- NEW: Map your GIFs to specific notes/frequencies ---
const gifMap = {
  // 'Frequency' : 'path/to/gif'
  329.63: "assets/gifs/hendrix-eyes.gif", // E Note
  246.94: "assets/gifs/hetfield-laugh.gif", // B Note
  "196.00": "assets/gifs/clapton-solo.gif", // G Note
  // ... add as many as you want ...
  default: "assets/gifs/spinal-tap-cheer.gif", // For chords/arps
};

// --- Updated Helper Functions ---
function showReactionGif(freq) {
  const overlay = document.getElementById("reaction-overlay");
  const gifImg = document.getElementById("reaction-gif");

  // Choose the GIF based on the frequency, or use default
  const gifUrl = gifMap[freq.toFixed(2)] || gifMap["default"];

  gifImg.src = gifUrl;
  overlay.classList.add("active");

  // Hide the GIF automatically after 1.5 seconds (slightly longer than the note decay)
  setTimeout(() => {
    overlay.classList.remove("active");
  }, 1500);
}

function playNote(freq, maxgain = 0.2) {
  if (audioCtx.state === "suspended") audioCtx.resume();

  // --- NEW: Trigger the visual reaction ---
  showReactionGif(freq);

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
