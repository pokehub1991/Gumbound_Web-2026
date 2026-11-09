export class AudioManager {
  private static audioCache: Map<string, HTMLAudioElement> = new Map();
  private static musicAudio?: HTMLAudioElement;
  private static moveLoopAudio?: HTMLAudioElement;
  private static currentMoveSound?: string;
  private static lastBumpTime: number = 0;

  public static isMuted: boolean = false;
  public static isMusicMuted: boolean = false;

  public static sfxVolume: number = (() => {
    try {
      const v = localStorage.getItem("gb_sfx_vol");
      return v !== null ? Math.max(0, Math.min(1, parseFloat(v))) : 0.70;
    } catch {
      return 0.70;
    }
  })();

  public static musicVolume: number = (() => {
    try {
      const v = localStorage.getItem("gb_music_vol");
      return v !== null ? Math.max(0, Math.min(1, parseFloat(v))) : 0.45;
    } catch {
      return 0.45;
    }
  })();

  public static volume: number = AudioManager.sfxVolume;

  public static setSfxVolume(vol: number) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    this.volume = this.sfxVolume;
    try {
      localStorage.setItem("gb_sfx_vol", this.sfxVolume.toString());
    } catch {}
    if (this.moveLoopAudio) {
      this.moveLoopAudio.volume = this.sfxVolume * 0.65;
    }
  }

  public static setMusicVolume(vol: number) {
    this.musicVolume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem("gb_music_vol", this.musicVolume.toString());
    } catch {}
    if (this.musicAudio && !this.isMusicMuted && !this.isMuted) {
      this.musicAudio.volume = this.musicVolume;
    }
  }

  public static preload(soundNames: string[]) {
    for (let soundName of soundNames) {
      if (soundName === "turn") soundName = "turn.ogg";
      if (soundName === "start") soundName = "start.mp3";
      const path = soundName.endsWith(".mp3") || soundName.endsWith(".wav") || soundName.endsWith(".ogg")
        ? `/audio/${soundName}`
        : `/audio/${soundName}.wav`;
      if (!this.audioCache.has(path)) {
        const audio = new Audio(path);
        audio.preload = "auto";
        audio.load();
        this.audioCache.set(path, audio);
      }
    }
  }

  public static play(soundName: string, volScale: number = 1.0) {
    if (this.isMuted) return;

    try {
      let sound = soundName;
      if (sound === "turn") sound = "turn.ogg";
      if (sound === "start") sound = "start.mp3";

      let path = "";
      if (sound.endsWith(".mp3") || sound.endsWith(".wav") || sound.endsWith(".ogg")) {
        path = `/audio/${sound}`;
      } else {
        path = `/audio/${sound}.wav`;
      }

      let audio = this.audioCache.get(path);
      if (!audio) {
        audio = new Audio(path);
        audio.preload = "auto";
        this.audioCache.set(path, audio);
      }

      // Reuse original instance if idle for instant zero-latency trigger, or clone for rapid overlap
      let playInstance: HTMLAudioElement;
      if (audio.paused || audio.ended) {
        audio.currentTime = 0;
        playInstance = audio;
      } else {
        playInstance = audio.cloneNode(true) as HTMLAudioElement;
      }

      playInstance.loop = false; // Strictly enforce one-shot SFX (never loop!)
      playInstance.volume = Math.max(0, Math.min(1, this.volume * volScale));
      playInstance.play().catch(() => {
        // Fallback to .mp3 if .wav was not found
        if (path.endsWith(".wav")) {
          const fallbackPath = path.replace(/\.wav$/, ".mp3");
          const fallbackAudio = new Audio(fallbackPath);
          fallbackAudio.loop = false;
          fallbackAudio.volume = Math.max(0, Math.min(1, this.volume * volScale));
          fallbackAudio.play().catch(() => {});
        }
      });
    } catch {
      // Graceful fallback
    }
  }

  public static startMoveLoop(soundName: string, volScale: number = 0.65) {
    if (this.isMuted) return;
    try {
      if (this.moveLoopAudio && this.currentMoveSound === soundName) {
        if (this.moveLoopAudio.paused) {
          this.moveLoopAudio.play().catch(() => {});
        }
        return;
      }
      this.stopMoveLoop();

      const ext = soundName.includes(".") ? "" : ".wav";
      const path = `/audio/${soundName}${ext}`;
      const audio = new Audio(path);
      audio.loop = true;
      audio.volume = Math.max(0, Math.min(1, this.sfxVolume * volScale));
      audio.play().catch(() => {
        // Fallback to .ogg
        const fallbackPath = `/audio/${soundName}.ogg`;
        const fallbackAudio = new Audio(fallbackPath);
        fallbackAudio.loop = true;
        fallbackAudio.volume = Math.max(0, Math.min(1, this.sfxVolume * volScale));
        fallbackAudio.play().catch(() => {});
        this.moveLoopAudio = fallbackAudio;
      });
      this.moveLoopAudio = audio;
      this.currentMoveSound = soundName;
    } catch {
      // Graceful fallback
    }
  }

  public static stopMoveLoop() {
    if (this.moveLoopAudio) {
      try {
        this.moveLoopAudio.pause();
        this.moveLoopAudio.currentTime = 0;
      } catch {}
      this.moveLoopAudio = undefined;
      this.currentMoveSound = undefined;
    }
  }

  public static playObstacleBump(soundStopName?: string) {
    if (this.isMuted) return;
    const now = Date.now();
    // Authentic GunBound struggle sound cadence: ~850ms cooldown prevents spamming while holding key
    if (now - this.lastBumpTime < 850) return;
    this.lastBumpTime = now;
    const sound = soundStopName || "1nmove";
    this.play(sound, 0.85);
  }

  public static playMusic(filename: string = "dbBattleMiramoTown.mp3", fadeIn: boolean = true) {
    if (this.isMuted || this.isMusicMuted) return;

    try {
      if (this.musicAudio) {
        // If already playing this track smoothly, do not interrupt
        if (this.musicAudio.src.endsWith(filename) && !this.musicAudio.paused) {
          return;
        }
        this.musicAudio.pause();
      }

      this.musicAudio = new Audio(`/audio/${filename}`);
      this.musicAudio.loop = true;

      const attemptPlay = () => {
        if (!this.musicAudio || this.isMuted || this.isMusicMuted) return;
        if (fadeIn) {
          this.musicAudio.volume = 0.02;
          this.musicAudio.play().then(() => {
            let step = 0;
            const totalSteps = 16;
            const targetVol = this.musicVolume;
            const fadeTimer = setInterval(() => {
              step++;
              if (!this.musicAudio || this.isMuted || this.isMusicMuted) {
                clearInterval(fadeTimer);
                return;
              }
              this.musicAudio.volume = Math.min(targetVol, (step / totalSteps) * targetVol);
              if (step >= totalSteps) {
                clearInterval(fadeTimer);
              }
            }, 40);
          }).catch(() => {
            // Autoplay blocked by browser until user gesture: attach one-time listener
            const resumeOnGesture = () => {
              window.removeEventListener("pointerdown", resumeOnGesture);
              window.removeEventListener("keydown", resumeOnGesture);
              if (this.musicAudio && !this.isMuted && !this.isMusicMuted) {
                this.musicAudio.play().catch(() => {});
              }
            };
            window.addEventListener("pointerdown", resumeOnGesture, { once: true });
            window.addEventListener("keydown", resumeOnGesture, { once: true });
          });
        } else {
          this.musicAudio.volume = this.musicVolume;
          this.musicAudio.play().catch(() => {
            const resumeOnGesture = () => {
              window.removeEventListener("pointerdown", resumeOnGesture);
              window.removeEventListener("keydown", resumeOnGesture);
              if (this.musicAudio && !this.isMuted && !this.isMusicMuted) {
                this.musicAudio.play().catch(() => {});
              }
            };
            window.addEventListener("pointerdown", resumeOnGesture, { once: true });
            window.addEventListener("keydown", resumeOnGesture, { once: true });
          });
        }
      };

      attemptPlay();
    } catch {
      // Graceful fallback
    }
  }

  public static stopMusic() {
    if (this.musicAudio) {
      this.musicAudio.pause();
      this.musicAudio = undefined;
    }
  }

  public static toggleMusic(): boolean {
    this.isMusicMuted = !this.isMusicMuted;
    if (this.musicAudio) {
      if (this.isMusicMuted) {
        this.musicAudio.pause();
      } else {
        this.musicAudio.play().catch(() => {});
      }
    }
    return !this.isMusicMuted;
  }

  public static toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      if (this.musicAudio) this.musicAudio.pause();
      this.stopMoveLoop();
    } else if (!this.isMuted && this.musicAudio) {
      this.musicAudio.play().catch(() => {});
    }
    return this.isMuted;
  }
}
