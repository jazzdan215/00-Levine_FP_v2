// VIDEO CONTROLS
function playVideo(id) {
  document.getElementById(id).play();
}

function pauseVideo(id) {
  document.getElementById(id).pause();
}

function setVolume(id, value) {
  document.getElementById(id).volume = value;
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.gain.value = 1;
masterGain.connect(audioCtx.destination);

document.body.addEventListener(
  "click",
  () => {
    audioCtx.resume();
  },
  { once: true },
);

// PLAY SINGLE NOTE
function playNote(freq, maxgain = 1) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  gain.gain.value = 0;

  osc.type = "sine";
  osc.type2 = "square";
  osc.type3 = "sawtooth";
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(maxgain, audioCtx.currentTime + 0.4);
  gain.gain.linearRampToValueAtTime(0.5 * maxgain, audioCtx.currentTime + 0.8);
  gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 5);

  osc.connect(gain);

  // ALWAYS go through master
  gain.connect(masterGain);

  // optional delay
  if (delayOn) {
    gain.connect(delayNode);
  }

  osc.start();
  osc.stop(audioCtx.currentTime + 5.01);
}

// PLAY CHORD (all notes at once)
function playChord(freqs, maxgain = 1) {
  freqs.forEach((freq) => playNote(freq, maxgain));
}

// PLAY ARPEGGIO (notes one after another)
function playArpeggio(freqs, maxgain = 1) {
  freqs.forEach((freq, i) => {
    setTimeout(() => {
      playNote(freq, maxgain);
    }, i * 400);
  });
}

// PLAY EFFECT
const delayNode = audioCtx.createDelay();
const feedbackNode = audioCtx.createGain();

delayNode.delayTime.value = 0.5; // 500ms delay
feedbackNode.gain.value = 0.5; // Feedback level

delayNode.connect(feedbackNode); // Feedback loop
feedbackNode.connect(delayNode);

delayNode.connect(masterGain);
feedbackNode.connect(masterGain);

// Controls for delay effect

let delayOn = false; // Initial state of delay effect;

const delayBtn = document.getElementById("delayBtn");
const delayTimeSlider = document.getElementById("delayTime");
const feedbackSlider = document.getElementById("feedback");

document.addEventListener("DOMContentLoaded", () => {
  const volumeSlider = document.getElementById("setVolume");
  if (volumeSlider) {
    volumeSlider.addEventListener("input", (event) => {
      masterGain.gain.value = event.target.value / 100;
    });
  }

  const delayBtn = document.getElementById("delayBtn");
  if (delayBtn) {
    delayBtn.addEventListener("click", () => {
      delayOn = !delayOn;
      delayBtn.textContent = delayOn ? "Delay: ON" : "Delay: OFF";
    });
  }

  const delayTimeSlider = document.getElementById("delayTime");
  if (delayTimeSlider) {
    delayTimeSlider.addEventListener("input", () => {
      delayNode.delayTime.value = delayTimeSlider.value;
    });
  }

  const feedbackSlider = document.getElementById("feedback");
  if (feedbackSlider) {
    feedbackSlider.addEventListener("input", () => {
      feedbackNode.gain.value = feedbackSlider.value;
    });
  }

  // FILTER CONTROLS //

  const freqSlider = document.getElementById("freq");
  const freqValue = document.getElementById("freq-value");

  const context = new AudioContext();
  const audioSource = context.createMediaElementSource(
    document.getElementById("E7.mov"),
    document.getElementById("B7.mov"),
  );
  const filter = context.createBiquadFilter();
  audioSource.connect(filter);
  filter.connect(context.destination);

  // Configure filter
  filter.type = "lowshelf";
  filter.frequency.value = 1000;
  filter.gain.value = 20;

  freqSlider.addEventListener("input", () => {
    filter.frequency.value = freqSlider.value;
    freqValue.textContent = parseFloat(freqSlider.value);
  });

  // optional Filter
  if (filterFreqOn) {
    gain.connect(filter);
  }
});
