
export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  
  // Track active nodes to stop music cleanly
  private musicNodes: AudioNode[] = []; 
  private noiseBuffer: AudioBuffer | null = null;

  private currentMusicKey: string | null = null;
  private volume: number = 0.5;
  private initialized: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // 1. Setup Audio Context (starts suspended)
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      this.ctx = new AudioContextClass();
      
      if (this.ctx) {
          this.masterGain = this.ctx.createGain();
          this.masterGain.connect(this.ctx.destination);
          this.setVolume(50);
          
          // Generate White Noise Buffer for Gunshots
          const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
          this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
          const data = this.noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) {
              data[i] = Math.random() * 2 - 1;
          }
      }

      // 3. Global Unlock Listener (Fixes "Interaction Required")
      const unlockHandler = () => {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        // If music was requested but blocked, restart it now
        if (this.currentMusicKey && this.musicNodes.length === 0) {
            this.playMusic(this.currentMusicKey);
        }
        this.initialized = true;
        // Remove listeners once unlocked
        window.removeEventListener('click', unlockHandler);
        window.removeEventListener('keydown', unlockHandler);
        window.removeEventListener('touchstart', unlockHandler);
      };

      window.addEventListener('click', unlockHandler);
      window.addEventListener('keydown', unlockHandler);
      window.addEventListener('touchstart', unlockHandler);
    }
  }

  setVolume(vol: number) {
    this.volume = vol / 100;
    if (this.masterGain) this.masterGain.gain.value = this.volume;
  }

  // --- PROCEDURAL MUSIC ENGINE ---
  playMusic(key: string) {
    if (this.currentMusicKey === key && this.musicNodes.length > 0) return;
    
    this.stopMusic();
    this.currentMusicKey = key;
    
    if (!this.ctx || this.ctx.state === 'suspended') return;

    const t = this.ctx.currentTime;
    
    if (key === 'MENU') {
        // TACTICAL DRONE (Dark Sawtooth + Lowpass)
        this.createDrone(55, 'sawtooth', 0.15, 0.2); // A1
        this.createDrone(110, 'sine', 0.1, 0.1);     // A2
        // Rhythm blip
        this.createRhythmPulse(220, 0.5); 
    } else if (key === 'VICTORY') {
        // TRIUMPHANT CHORD (C Major: C, E, G)
        this.createDrone(261.63, 'triangle', 0.1, 0); // C4
        this.createDrone(329.63, 'triangle', 0.1, 0); // E4
        this.createDrone(392.00, 'triangle', 0.1, 0); // G4
        this.createDrone(523.25, 'sine', 0.05, 0);    // C5
    } else if (key === 'DEFEAT') {
        // DISSONANT DRONE (Diminished/Tritone)
        this.createDrone(73.42, 'sawtooth', 0.2, 0.1); // D2
        this.createDrone(103.83, 'sawtooth', 0.15, 0.1); // G#2 (The Tritone)
        this.createDrone(110.00, 'sine', 0.2, 0.05);   // A2
    }
  }

  stopMusic() {
    this.musicNodes.forEach(node => {
        try { 
            if (node instanceof OscillatorNode) node.stop(); 
        } catch(e) {}
        node.disconnect();
    });
    this.musicNodes = [];
    // Don't nullify currentMusicKey immediately so we know what to resume on unlock
  }

  private createDrone(freq: number, type: OscillatorType, maxVol: number, lfoRate: number) {
     if (!this.ctx || !this.masterGain) return;
     
     const osc = this.ctx.createOscillator();
     const gain = this.ctx.createGain();
     const filter = this.ctx.createBiquadFilter();
     
     osc.type = type;
     osc.frequency.value = freq;
     
     filter.type = 'lowpass';
     filter.frequency.value = 800;

     // Envelope
     gain.gain.value = 0;
     gain.gain.linearRampToValueAtTime(maxVol, this.ctx.currentTime + 2); // Slow fade in

     osc.connect(filter);
     filter.connect(gain);
     gain.connect(this.masterGain);
     
     osc.start();
     this.musicNodes.push(osc, gain, filter);

     if (lfoRate > 0) {
         const lfo = this.ctx.createOscillator();
         const lfoGain = this.ctx.createGain();
         lfo.frequency.value = lfoRate;
         lfoGain.gain.value = 300; // Filter cutoff modulation
         lfo.connect(lfoGain);
         lfoGain.connect(filter.frequency);
         lfo.start();
         this.musicNodes.push(lfo, lfoGain);
     }
  }

  private createRhythmPulse(freq: number, interval: number) {
      if (!this.ctx || !this.masterGain) return;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      
      const lfo = this.ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 2; // 120 BPM-ish
      
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 1;
      
      // Make it beep
      gain.gain.value = 0;
      
      lfo.connect(gain.gain);
      
      osc.connect(gain);
      gain.connect(this.masterGain);
      
      osc.start();
      lfo.start();
      
      // Keep quiet mostly
      const compressor = this.ctx.createGain();
      compressor.gain.value = 0.05;
      gain.disconnect();
      gain.connect(compressor);
      compressor.connect(this.masterGain);

      this.musicNodes.push(osc, gain, lfo, compressor);
  }

  // --- PROCEDURAL SFX GENERATION ---
  play(key: string) {
    if (!this.ctx || !this.masterGain) return;
    
    // Ensure context is running (sometimes needed on repeated interactions)
    if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
    }

    const t = this.ctx.currentTime;
    const gainNode = this.ctx.createGain();
    gainNode.connect(this.masterGain);

    if (key === 'UI_HOVER') {
        // High tech blip
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2000, t);
        osc.frequency.exponentialRampToValueAtTime(1000, t + 0.05);
        gainNode.gain.setValueAtTime(0.05, t); // Quiet
        gainNode.gain.linearRampToValueAtTime(0, t + 0.05);
        osc.connect(gainNode);
        osc.start(t);
        osc.stop(t + 0.05);

    } else if (key === 'UI_CLICK') {
        // Mechanical click
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(400, t + 0.05);
        gainNode.gain.setValueAtTime(0.1, t);
        gainNode.gain.linearRampToValueAtTime(0, t + 0.05);
        osc.connect(gainNode);
        osc.start(t);
        osc.stop(t + 0.05);

    } else if (key.startsWith('SHOOT')) {
        // --- GUNSHOT SYNTHESIS ---
        if (!this.noiseBuffer) return;
        const source = this.ctx.createBufferSource();
        source.buffer = this.noiseBuffer;
        
        // Filters for tone
        const filter = this.ctx.createBiquadFilter();
        let duration = 0.6;
        
        // Default (Rifle) params
        let freq = 1200;
        let type: BiquadFilterType = 'bandpass';
        let vol = 0.7;
        let decay = 0.2;
        let playbackRate = 1.0;

        if (key === 'SHOOT_KNIFE') {
            // SWISH SOUND (No explosion, just filtered noise)
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(800, t);
            filter.frequency.linearRampToValueAtTime(300, t + 0.15);
            
            gainNode.gain.setValueAtTime(0.8, t);
            gainNode.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
            
            source.playbackRate.value = 1.5;
            source.connect(filter);
            filter.connect(gainNode);
            source.start(t);
            source.stop(t + 0.2);
            return; // Exit special logic
        }

        switch(key) {
            case 'SHOOT_SNIPER':
                type = 'lowpass'; freq = 500; vol = 1.0; decay = 0.6; playbackRate = 0.4;
                break;
            case 'SHOOT_SHOTGUN':
                type = 'lowpass'; freq = 800; vol = 0.9; decay = 0.4; playbackRate = 0.7;
                break;
            case 'SHOOT_AUTO_SHOTGUN':
                type = 'lowpass'; freq = 900; vol = 0.8; decay = 0.3; playbackRate = 0.75;
                break;
            case 'SHOOT_SMG':
                type = 'bandpass'; freq = 1600; vol = 0.6; decay = 0.1; playbackRate = 1.3;
                break;
            case 'SHOOT_PDW':
                type = 'highpass'; freq = 2000; vol = 0.5; decay = 0.08; playbackRate = 1.5;
                break;
            case 'SHOOT_PISTOL':
                type = 'highpass'; freq = 1400; vol = 0.7; decay = 0.15; playbackRate = 1.2;
                break;
            case 'SHOOT_LMG':
                type = 'lowpass'; freq = 700; vol = 0.8; decay = 0.3; playbackRate = 0.8;
                break;
            case 'SHOOT_DMR':
                type = 'bandpass'; freq = 1000; vol = 0.9; decay = 0.35; playbackRate = 0.9;
                break;
            case 'SHOOT_BURST_RIFLE':
                type = 'bandpass'; freq = 1400; vol = 0.7; decay = 0.15; playbackRate = 1.1;
                break;
            default: // RIFLE
                type = 'bandpass'; freq = 1200; vol = 0.7; decay = 0.2; playbackRate = 1.0;
        }

        filter.type = type;
        filter.frequency.setValueAtTime(freq, t);
        gainNode.gain.setValueAtTime(vol, t);
        gainNode.gain.exponentialRampToValueAtTime(0.01, t + decay);
        source.playbackRate.value = playbackRate;

        source.connect(filter);
        filter.connect(gainNode);
        source.start(t);
        source.stop(t + duration);

    } else if (key === 'HIT') {
        // --- HITMARKER (High Ping) ---
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        gainNode.gain.setValueAtTime(0.3, t);
        gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        
        osc.connect(gainNode);
        osc.start(t);
        osc.stop(t + 0.1);

    } else if (key === 'DIE') {
        // --- DEATH SOUND (Low Descent) ---
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.5);
        
        gainNode.gain.setValueAtTime(0.5, t);
        gainNode.gain.linearRampToValueAtTime(0, t + 0.5);

        // Add filter to muffle
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;

        osc.connect(filter);
        filter.connect(gainNode);
        osc.start(t);
        osc.stop(t + 0.5);

    } else if (key === 'RELOAD') {
        // --- RELOAD (Mechanical Slide) ---
        if (!this.noiseBuffer) return;
        const source = this.ctx.createBufferSource();
        source.buffer = this.noiseBuffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2000, t);

        gainNode.gain.setValueAtTime(0, t);
        gainNode.gain.linearRampToValueAtTime(0.4, t + 0.1);
        gainNode.gain.linearRampToValueAtTime(0, t + 0.3);

        source.connect(filter);
        filter.connect(gainNode);
        source.start(t);
        source.stop(t + 0.4);

    } else if (key === 'CAPTURE') {
        // --- CAPTURE (Chime) ---
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t); // A4
        osc.frequency.setValueAtTime(554, t + 0.1); // C#5
        osc.frequency.setValueAtTime(659, t + 0.2); // E5

        gainNode.gain.setValueAtTime(0.2, t);
        gainNode.gain.linearRampToValueAtTime(0, t + 0.6);
        
        osc.connect(gainNode);
        osc.start(t);
        osc.stop(t + 0.6);
    }
  }
}

export const soundManager = new SoundManager();
