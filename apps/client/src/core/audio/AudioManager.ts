export class AudioManager {
  private static audioCache: Map<string, HTMLAudioElement> = new Map();
  private static musicAudio?: HTMLAudioElement;
  private static moveLoopAudio?: HTMLAudioElement;
  private static currentMoveSound?: string;
  public static isMuted: boolean = false;
  public static isMusicMuted: boolean = false;
  public static volume: number = 0.7;

  public static preload(soundNames: string[]) {
    for (const soundName of soundNames) {
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
      let path = "";
      if (soundName.endsWith(".mp3") || soundName.endsWith(".wav") || soundName.endsWith(".ogg")) {
        path = `/audio/${soundName}`;
      } else {
        path = `/audio/${soundName}.wav`;
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

      playInstance.volume = Math.max(0, Math.min(1, this.volume * volScale));
      playInstance.play().catch(() => {
        // Fallback to .mp3 if .wav was not found
        if (path.endsWith(".wav")) {
          const fallbackPath = path.replace(/\.wav$/, ".mp3");
          const fallbackAudio = new Audio(fallbackPath);
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
      if (this.moveLoopAudio && this.currentMoveSound === soundName && !this.moveLoopAudio.paused) {
        return;
      }
      this.stopMoveLoop();

      const ext = soundName.includes(".") ? "" : ".wav";
      const path = `/audio/${soundName}${ext}`;
      const audio = new Audio(path);
      audio.loop = true;
      audio.volume = Math.max(0, Math.min(1, this.volume * volScale));
      audio.play().catch(() => {
        // Fallback to .ogg
        const fallbackPath = `/audio/${soundName}.ogg`;
        const fallbackAudio = new Audio(fallbackPath);
        fallbackAudio.loop = true;
        fallbackAudio.volume = Math.max(0, Math.min(1, this.volume * volScale));
        fallbackAudio.play().catch(() => {});
        this.moveLoopAudio = fallbackAudio;
      });
      this.moveLoopAudio = audio;
      this.currentMoveSound = soundName;
    } catch {
      // Graceful fallback
    }
  }

  public static stopMoveLoop(stopSoundName?: string) {
    if (this.moveLoopAudio) {
      try {
        this.moveLoopAudio.pause();
        this.moveLoopAudio.currentTime = 0;
      } catch {}
      this.moveLoopAudio = undefined;
      this.currentMoveSound = undefined;

      if (stopSoundName && !this.isMuted) {
        this.play(stopSoundName, 0.7);
      }
    }
  }

  public static playMusic(filename: string = "dbBattleMiramoTown.mp3") {
    if (this.isMuted || this.isMusicMuted) return;

    try {
      if (this.musicAudio) {
        this.musicAudio.pause();
      }

      this.musicAudio = new Audio(`/audio/${filename}`);
      this.musicAudio.loop = true;
      this.musicAudio.volume = this.volume * 0.45;
      this.musicAudio.play().catch(() => {});
    } catch {
      // Ignored
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
