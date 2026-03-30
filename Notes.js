export class Note {
  constructor(myAudioContext, dest, freq) {
    this.ctx = myAudioContext;
    this.osc = new OscillatorNode(this.ctx);
    this.adsr = new GainNode(this.ctx);
    this.adsr.gain.value = 0;
    this.frequency = freq;
    this.osc.frequency.value = freq;

    this.osc.connect(this.adsr);
    this.adsr.connect(dest);
    this.attack = 0.4;
    this.decay = 0.25;
    this.sustain = 0.5;
    this.release = 5;
  }
  play() {
    let now = this.ctx.currentTime;

    this.adsr.gain.cancelAndHoldAtTime;
    this.adsr.gain.setValueAtTime(this.adsr.gain.value, now);

    this.adsr.gain.linearRampToValueAtTime(1, now + this.attack);
    this.adsr.gain.linearRampToValueAtTime(
      this.sustain,
      now + this.attack + this.decay,
    );

    this.osc.start();
  }
  end() {
    let now = this.ctx.currentTime;

    this.adsr.gain.cancelAndHoldAtTime(now);
    this.adsr.gain.setValueAtTime(this.adsr.gain.value, now);
    this.adsr.gain.linearRampToValueAtTime(0, now + this.release);

    this.osc.stop(now + this.release + 0.01);
  }
}
