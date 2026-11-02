export class AudioManager {
  private static audioCache: Map<string, HTMLAudioElement> = new Map();
  private static musicAudio?: HTMLAudioElement;
  public static isMuted: boolean = false;
  public static isMusicMuted: boolean = false;
  public static volume: number = 0.7;

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
        this.audioCache.set(path, audio);
      }

      const playInstance = audio.cloneNode() as HTMLAudioElement;
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
    if (this.isMuted && this.musicAudio) {
      this.musicAudio.pause();
    } else if (!this.isMuted && this.musicAudio) {
      this.musicAudio.play().catch(() => {});
    }
    return this.isMuted;
  }
}
