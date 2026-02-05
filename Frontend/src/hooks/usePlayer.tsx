import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, SkipBack, SkipForward, Repeat, Shuffle,
  Volume2, VolumeX, Maximize2, Minimize2, ChevronDown, Heart,
  ListMusic, BarChart3, TrendingUp, Music, Brain, Settings
} from 'lucide-react';
import { Song, PlayerState } from '../types/music';
import { addToHistory, updateNowPlaying, getNowPlaying } from '@/api/db';
import { searchMusic } from '@/api/client';
import { useAuth } from './useAuth';
import TrackActionMenu from '../components/TrackActionMenu';

// ============================================================================
// MUSIC RECOMMENDATION INTELLIGENCE ENGINE
// ============================================================================

interface ListeningEvent {
  songId: string;
  artist: string;
  genre?: string;
  action: 'play' | 'skip' | 'replay' | 'like' | 'full_listen';
  timestamp: number;
  listenDuration?: number;
  songDuration?: number;
}

interface UserTasteProfile {
  artistPreferences: Map<string, number>;
  genrePreferences: Map<string, number>;
  moodPreferences: Map<string, number>;
  recentlyPlayed: Set<string>;
  recentlySkipped: Set<string>;
  favoriteArtists: string[];
  discoveryOpenness: number;
  lastUpdated: number;
}

interface SessionContext {
  currentSong: Song;
  queue: Song[];
  recentQueue: Song[];
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  skipCount: number;
  repeatCount: number;
  isShuffled: boolean;
  sessionMood?: 'energetic' | 'chill' | 'focus' | 'melancholic' | 'upbeat';
}

interface ScoredCandidate {
  song: Song;
  score: number;
  reasons: {
    artistSimilarity: number;
    genreSimilarity: number;
    moodCompatibility: number;
    noveltyBonus: number;
    repetitionPenalty: number;
    popularitySignal: number;
  };
}

class MusicRecommendationEngine {
  private userProfile: UserTasteProfile;
  private listeningHistory: ListeningEvent[] = [];
  private readonly HISTORY_WINDOW = 50;
  private readonly RECENT_PLAYED_WINDOW = 20;

  constructor() {
    this.userProfile = this.initializeProfile();
  }

  private initializeProfile(): UserTasteProfile {
    return {
      artistPreferences: new Map(),
      genrePreferences: new Map(),
      moodPreferences: new Map(),
      recentlyPlayed: new Set(),
      recentlySkipped: new Set(),
      favoriteArtists: [],
      discoveryOpenness: 0.3,
      lastUpdated: Date.now(),
    };
  }

  public recordListeningEvent(event: ListeningEvent): void {
    this.listeningHistory.push(event);
    if (this.listeningHistory.length > this.HISTORY_WINDOW) {
      this.listeningHistory.shift();
    }
    this.updateTasteProfile(event);
  }

  private updateTasteProfile(event: ListeningEvent): void {
    const { artist, genre, action, listenDuration, songDuration } = event;
    const completionRatio = listenDuration && songDuration
      ? listenDuration / songDuration
      : 1;

    const currentArtistScore = this.userProfile.artistPreferences.get(artist) || 0;

    switch (action) {
      case 'full_listen':
        this.userProfile.artistPreferences.set(artist, currentArtistScore + 3);
        break;
      case 'like':
        this.userProfile.artistPreferences.set(artist, currentArtistScore + 5);
        break;
      case 'replay':
        this.userProfile.artistPreferences.set(artist, currentArtistScore + 4);
        break;
      case 'skip':
        const penalty = completionRatio < 0.3 ? -2 : -0.5;
        this.userProfile.artistPreferences.set(artist, Math.max(0, currentArtistScore + penalty));
        this.userProfile.recentlySkipped.add(event.songId);
        break;
      case 'play':
        const credit = completionRatio * 1.5;
        this.userProfile.artistPreferences.set(artist, currentArtistScore + credit);
        break;
    }

    if (genre) {
      const currentGenreScore = this.userProfile.genrePreferences.get(genre) || 0;
      const genreBoost = action === 'skip' ? -1 : completionRatio * 2;
      this.userProfile.genrePreferences.set(genre, Math.max(0, currentGenreScore + genreBoost));
    }

    this.userProfile.recentlyPlayed.add(event.songId);
    if (this.userProfile.recentlyPlayed.size > this.RECENT_PLAYED_WINDOW) {
      const oldest = Array.from(this.userProfile.recentlyPlayed)[0];
      this.userProfile.recentlyPlayed.delete(oldest);
    }

    this.userProfile.favoriteArtists = Array.from(this.userProfile.artistPreferences.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([artist]) => artist);

    const recentSkips = this.listeningHistory
      .slice(-10)
      .filter(e => e.action === 'skip').length;

    if (recentSkips > 5) {
      this.userProfile.discoveryOpenness = Math.max(0.1, this.userProfile.discoveryOpenness - 0.05);
    } else if (recentSkips < 2) {
      this.userProfile.discoveryOpenness = Math.min(0.5, this.userProfile.discoveryOpenness + 0.05);
    }

    this.userProfile.lastUpdated = Date.now();
  }

  private scoreSong(candidate: Song, context: SessionContext): ScoredCandidate {
    const reasons = {
      artistSimilarity: this.calculateArtistSimilarity(candidate, context),
      genreSimilarity: this.calculateGenreSimilarity(candidate, context),
      moodCompatibility: this.calculateMoodCompatibility(candidate, context),
      noveltyBonus: this.calculateNoveltyBonus(candidate),
      repetitionPenalty: this.calculateRepetitionPenalty(candidate, context),
      popularitySignal: this.calculatePopularitySignal(candidate),
    };

    const score =
      reasons.artistSimilarity * 0.30 +
      reasons.genreSimilarity * 0.20 +
      reasons.moodCompatibility * 0.25 +
      reasons.noveltyBonus * 0.10 +
      reasons.repetitionPenalty * 0.10 +
      reasons.popularitySignal * 0.05;

    return { song: candidate, score, reasons };
  }

  private calculateArtistSimilarity(candidate: Song, context: SessionContext): number {
    const candidateArtist = candidate.artist;
    const currentArtist = context.currentSong.artist;

    if (candidateArtist === currentArtist) {
      return 80;
    }

    const artistScore = this.userProfile.artistPreferences.get(candidateArtist) || 0;

    if (this.userProfile.favoriteArtists.includes(candidateArtist)) {
      return 90 + artistScore;
    }

    const maxScore = Math.max(...Array.from(this.userProfile.artistPreferences.values()), 1);
    return (artistScore / maxScore) * 70;
  }

  private calculateGenreSimilarity(candidate: Song, context: SessionContext): number {
    if (!candidate.genre) return 50;

    const genreScore = this.userProfile.genrePreferences.get(candidate.genre) || 0;
    const maxScore = Math.max(...Array.from(this.userProfile.genrePreferences.values()), 1);
    return (genreScore / maxScore) * 100;
  }

  private calculateMoodCompatibility(candidate: Song, context: SessionContext): number {
    if (context.skipCount > 3) {
      return this.userProfile.favoriteArtists.includes(candidate.artist) ? 90 : 40;
    }

    if (context.repeatCount > 0) {
      return candidate.artist === context.currentSong.artist ? 95 : 60;
    }

    return 70;
  }

  private calculateNoveltyBonus(candidate: Song): number {
    const artistScore = this.userProfile.artistPreferences.get(candidate.artist) || 0;

    if (artistScore === 0) {
      return this.userProfile.discoveryOpenness * 100;
    }

    if (artistScore < 3) {
      return this.userProfile.discoveryOpenness * 50;
    }

    return 10;
  }

  private calculateRepetitionPenalty(candidate: Song, context: SessionContext): number {
    if (this.userProfile.recentlyPlayed.has(candidate.id)) {
      return -80;
    }

    if (this.userProfile.recentlySkipped.has(candidate.id)) {
      return -100;
    }

    const recentArtists = context.recentQueue.slice(-3).map(s => s.artist);
    if (recentArtists.includes(candidate.artist)) {
      return -40;
    }

    return 0;
  }

  private calculatePopularitySignal(candidate: Song): number {
    const views = candidate.views || 0;
    if (views > 10000000) return 20;
    if (views > 1000000) return 15;
    if (views > 100000) return 10;
    return 5;
  }

  public recommendNextSongs(
    candidates: Song[],
    context: SessionContext,
    count: number = 3
  ): Song[] {
    const scored = candidates.map(c => this.scoreSong(c, context));
    scored.sort((a, b) => b.score - a.score);

    const familiar = scored.filter(s =>
      this.userProfile.favoriteArtists.includes(s.song.artist) ||
      (this.userProfile.artistPreferences.get(s.song.artist) || 0) > 3
    );

    const discovery = scored.filter(s =>
      !this.userProfile.favoriteArtists.includes(s.song.artist) &&
      (this.userProfile.artistPreferences.get(s.song.artist) || 0) <= 3
    );

    const results: Song[] = [];
    const targetFamiliar = Math.ceil(count * (1 - this.userProfile.discoveryOpenness));
    const targetDiscovery = count - targetFamiliar;

    for (let i = 0; i < targetFamiliar && i < familiar.length; i++) {
      results.push(familiar[i].song);
    }

    for (let i = 0; i < targetDiscovery && i < discovery.length; i++) {
      results.push(discovery[i].song);
    }

    if (results.length < count) {
      const remaining = scored
        .filter(s => !results.includes(s.song))
        .slice(0, count - results.length)
        .map(s => s.song);
      results.push(...remaining);
    }

    console.log(`🎵 Recommended ${results.length} songs:`, {
      familiar: targetFamiliar,
      discovery: targetDiscovery,
      discoveryOpenness: this.userProfile.discoveryOpenness
    });

    return results;
  }

  public getRecommendationStrategy(): string {
    const skipRate = this.listeningHistory.slice(-10)
      .filter(e => e.action === 'skip').length / 10;

    if (skipRate > 0.5) {
      return 'focus_mode';
    } else if (this.userProfile.discoveryOpenness > 0.4) {
      return 'discovery_mode';
    } else {
      return 'balanced';
    }
  }

  public getUserProfile(): UserTasteProfile {
    return { ...this.userProfile };
  }

  public resetProfile(): void {
    this.userProfile = this.initializeProfile();
    this.listeningHistory = [];
  }

  public exportProfile(): string {
    return JSON.stringify({
      profile: {
        artistPreferences: Array.from(this.userProfile.artistPreferences.entries()),
        genrePreferences: Array.from(this.userProfile.genrePreferences.entries()),
        favoriteArtists: this.userProfile.favoriteArtists,
        discoveryOpenness: this.userProfile.discoveryOpenness,
      },
      history: this.listeningHistory.slice(-20),
    }, null, 2);
  }

  public importProfile(data: string): void {
    try {
      const parsed = JSON.parse(data);
      this.userProfile.artistPreferences = new Map(parsed.profile.artistPreferences);
      this.userProfile.genrePreferences = new Map(parsed.profile.genrePreferences);
      this.userProfile.favoriteArtists = parsed.profile.favoriteArtists;
      this.userProfile.discoveryOpenness = parsed.profile.discoveryOpenness;
    } catch (error) {
      console.error('Failed to import profile:', error);
    }
  }
}

// ============================================================================
// PLAYER CONTEXT & PROVIDER
// ============================================================================

interface PlayerContextType extends PlayerState {
  playSong: (song: Song) => void;
  pauseSong: () => void;
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  seekTo: (progress: number) => void;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  addToQueue: (song: Song) => void;
  clearQueue: () => void;
  playTrackList: (tracks: Song[], startIndex?: number) => void;
  exportUserProfile: () => string;
  resetRecommendations: () => void;
  skipCount: number;
  repeatCount: number;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

const formatTime = (seconds: number) => {
  if (!seconds) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const isTitleTooSimilar = (currentTitle: string, newTitle: string) => {
  const clean1 = currentTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
  const clean2 = newTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean1.includes(clean2) || clean2.includes(clean1);
};

// Desktop Full Screen Player Component
const DesktopFullScreenPlayer = ({
  currentTrack, isPlaying, progress, duration, volume, isShuffled, repeatMode,
  onClose, onTogglePlay, onNext, onPrev, onSeek, onVolumeChange, onToggleShuffle, onToggleRepeat
}: any) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-gradient-to-b from-zinc-900 via-black to-black z-[100] flex flex-col items-center justify-center p-8"
    >
      <button onClick={onClose} className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-full transition-colors">
        <ChevronDown className="w-6 h-6" />
      </button>

      <div className="w-full max-w-2xl flex flex-col items-center space-y-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-purple-500/20 blur-3xl opacity-50 group-hover:opacity-70 transition-opacity duration-500" />
          <img
            src={currentTrack.coverUrl || currentTrack.image}
            alt={currentTrack.title}
            className="relative w-80 h-80 rounded-3xl shadow-2xl object-cover ring-1 ring-white/10"
          />
        </motion.div>

        <div className="w-full text-center space-y-2">
          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-4xl font-bold text-white"
          >
            {currentTrack.title}
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-xl text-zinc-400"
          >
            {currentTrack.artist}
          </motion.p>
        </div>

        <div className="w-full space-y-2">
          <input
            type="range"
            min="0"
            max={duration}
            value={progress}
            onChange={onSeek}
            className="w-full h-2 bg-zinc-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:scale-110 transition-transform"
          />
          <div className="flex justify-between text-sm text-zinc-400">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-center space-x-6">
          <button onClick={onToggleShuffle} className={`p-3 rounded-full transition-all ${isShuffled ? 'text-emerald-500 bg-emerald-500/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
            <Shuffle className="w-5 h-5" />
          </button>
          <button onClick={onPrev} className="p-3 text-zinc-400 hover:text-white hover:bg-white/5 rounded-full transition-colors">
            <SkipBack className="w-6 h-6" />
          </button>
          <button onClick={onTogglePlay} className="p-5 bg-white text-black rounded-full hover:scale-105 transition-transform shadow-lg">
            {isPlaying ? <Pause className="w-8 h-8" fill="currentColor" /> : <Play className="w-8 h-8" fill="currentColor" />}
          </button>
          <button onClick={onNext} className="p-3 text-zinc-400 hover:text-white hover:bg-white/5 rounded-full transition-colors">
            <SkipForward className="w-6 h-6" />
          </button>
          <button onClick={onToggleRepeat} className={`p-3 rounded-full transition-all ${repeatMode !== 'off' ? 'text-emerald-500 bg-emerald-500/10' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}>
            <Repeat className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <button className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-full transition-colors">
            {volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={onVolumeChange}
            className="w-32 h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
          />
        </div>
      </div>
    </motion.div>
  );
};

// Main Provider Component
export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [state, setState] = useState<PlayerState>({
    currentSong: null,
    isPlaying: false,
    progress: 0,
    currentTime: 0,
    duration: 0,
    volume: 75,
    isShuffled: false,
    repeatMode: 'off',
    queue: [],
  });

  const [skipCount, setSkipCount] = useState(0);
  const [repeatCount, setRepeatCount] = useState(0);
  const playerRef = useRef<any>(null);
  const playerReady = useRef(false);
  const isFetchingQueue = useRef(false);
  const recommendationEngine = useRef(new MusicRecommendationEngine());
  const nextSongRef = useRef<() => void>();

  const getVideoId = (song: Song) => song.youtube_id || song.id.replace('yt_', '');

  const getTimeOfDay = (): SessionContext['timeOfDay'] => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 21) return 'evening';
    return 'night';
  };

  // Initial Fetch
  useEffect(() => {
    if (!user) return;

    const fetchLastState = async () => {
      try {
        const lastState = await getNowPlaying(user.id);
        if (lastState && lastState.song) {
          setState(prev => ({
            ...prev,
            currentSong: lastState.song,
            currentTime: lastState.position,
            isPlaying: false,
            progress: (lastState.position / (lastState.song.duration || 1)) * 100
          }));
        }
      } catch (error) {
        console.error("Failed to fetch last state", error);
      }
    };

    fetchLastState();
  }, [user]);

  // Track completion events
  useEffect(() => {
    if (!state.isPlaying && state.currentSong && state.currentTime > 0) {
      const completionRatio = state.currentTime / (state.duration || 1);
      if (completionRatio > 0.9) {
        recommendationEngine.current.recordListeningEvent({
          songId: state.currentSong.id,
          artist: state.currentSong.artist,
          genre: (state.currentSong as any).genre,
          action: 'full_listen',
          timestamp: Date.now(),
          listenDuration: state.currentTime,
          songDuration: state.duration,
        });
      }
    }
  }, [state.isPlaying, state.currentSong, state.currentTime, state.duration]);

  // INTELLIGENT AUTO-QUEUE LOGIC
  useEffect(() => {
    const handleIntelligentAutoQueue = async () => {
      const { currentSong, queue, isShuffled } = state;
      if (!currentSong || isFetchingQueue.current) return;

      const currentIndex = queue.findIndex(s => s.id === currentSong.id);
      const needsMoreSongs = queue.length === 0 || currentIndex >= queue.length - 2;

      if (needsMoreSongs) {
        isFetchingQueue.current = true;
        try {
          console.log("🎵 Intelligent Auto-Queue: Analyzing listening patterns...");
          const recentHistory = queue.slice(-10);
          const sessionContext: SessionContext = {
            currentSong,
            queue,
            recentQueue: recentHistory,
            timeOfDay: getTimeOfDay(),
            skipCount,
            repeatCount,
            isShuffled,
          };

          const strategy = recommendationEngine.current.getRecommendationStrategy();
          console.log(`📊 Strategy: ${strategy}`);

          const searchQuery = strategy === 'focus_mode'
            ? `${currentSong.artist} best songs`
            : strategy === 'discovery_mode'
              ? `similar to ${currentSong.artist} new artists`
              : `${currentSong.artist} radio`;

          let candidates = await searchMusic(searchQuery);
          candidates = candidates.filter(c =>
            !queue.some(q => q.id === c.id) &&
            c.id !== currentSong.id &&
            !isTitleTooSimilar(currentSong.title, c.title)
          );

          const recommendations = recommendationEngine.current.recommendNextSongs(
            candidates,
            sessionContext,
            5
          );

          if (recommendations.length > 0) {
            console.log(`✅ Added ${recommendations.length} intelligent recommendations`);
            setState(prev => ({
              ...prev,
              queue: [...prev.queue, ...recommendations]
            }));
          } else {
            console.log("⚠️ No recommendations found, using fallback");
            const fallback = candidates.slice(0, 3);
            setState(prev => ({
              ...prev,
              queue: [...prev.queue, ...fallback]
            }));
          }
        } catch (error) {
          console.error("Auto-Queue Error:", error);
        } finally {
          isFetchingQueue.current = false;
        }
      }
    };

    handleIntelligentAutoQueue();
  }, [state.currentSong, state.queue, skipCount, repeatCount]);

  // --- MOBILE BACKGROUND PLAYBACK HACK ---
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const SILENT_MP3 = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//OEAAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDV1dXV1dXV1dXV1dXV1dXV1dXV1dXV1dXV6urq6urq6urq6urq6urq6urq6urq6urq6v////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAASAAAAAA//OEMAAAAAAA';

    if (!silentAudioRef.current) {
      const audio = new Audio(SILENT_MP3);
      audio.loop = true;
      audio.volume = 0;
      audio.preload = 'auto';
      silentAudioRef.current = audio;
    }
  }, []);

  useEffect(() => {
    const audio = silentAudioRef.current;
    if (!audio) return;

    if (state.isPlaying) {
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn("Silent audio play blocked:", error);
        });
      }
    } else {
      audio.pause();
    }
  }, [state.isPlaying]);

  // Next song function
  const nextSong = useCallback(() => {
    const { currentSong, currentTime, duration, queue, isShuffled, repeatMode } = state;

    // Record skip if applicable
    if (currentSong && currentTime < duration * 0.7) {
      recommendationEngine.current.recordListeningEvent({
        songId: currentSong.id,
        artist: currentSong.artist,
        genre: (currentSong as any).genre,
        action: 'skip',
        timestamp: Date.now(),
        listenDuration: currentTime,
        songDuration: duration,
      });
      setSkipCount(prev => prev + 1);
    }

    // Handle repeat one
    if (repeatMode === 'one' && currentSong) {
      const videoId = getVideoId(currentSong);
      if (playerRef.current && playerReady.current) {
        playerRef.current.loadVideoById(videoId);
      }
      setState(prev => ({
        ...prev,
        progress: 0,
        currentTime: 0,
        isPlaying: true
      }));
      return;
    }

    // Find next track
    if (queue.length === 0 || !currentSong) {
      setState(prev => ({ ...prev, isPlaying: false }));
      return;
    }

    const currentIndex = queue.findIndex(s => s.id === currentSong.id);
    let nextIndex;

    if (isShuffled) {
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
      } while (queue.length > 1 && nextIndex === currentIndex);
    } else {
      nextIndex = currentIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeatMode === 'off') {
          setState(prev => ({ ...prev, isPlaying: false }));
          return;
        }
        nextIndex = 0;
      }
    }

    const nextTrack = queue[nextIndex];
    if (!nextTrack) {
      setState(prev => ({ ...prev, isPlaying: false }));
      return;
    }

    const videoId = getVideoId(nextTrack);
    if (playerRef.current && playerReady.current) {
      playerRef.current.loadVideoById(videoId);
    }

    if (user) {
      addToHistory(user.id, nextTrack);
      updateNowPlaying(user.id, nextTrack, true, 0);
    }

    setState(prev => ({
      ...prev,
      currentSong: nextTrack,
      progress: 0,
      currentTime: 0,
      isPlaying: true
    }));
  }, [state, user]);

  // Store nextSong in ref for YouTube API callback
  useEffect(() => {
    nextSongRef.current = nextSong;
  }, [nextSong]);

  // YouTube API
  useEffect(() => {
    if (!document.getElementById('youtube-player-hidden')) {
      const playerDiv = document.createElement('div');
      playerDiv.id = 'youtube-player-hidden';
      playerDiv.style.cssText = 'position: absolute; top: -9999px; left: -9999px; opacity: 0; pointer-events: none; z-index: -1;';
      document.body.appendChild(playerDiv);
    }

    const initPlayer = () => {
      if (playerRef.current) return;

      playerRef.current = new window.YT.Player('youtube-player-hidden', {
        height: '0',
        width: '0',
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin
        },
        events: {
          onReady: (event: any) => {
            playerReady.current = true;
            event.target.setVolume(state.volume);
            console.log("✅ YouTube Player Ready");
          },
          onStateChange: (event: any) => {
            console.log("🎵 Player State Changed:", event.data);
            
            if (event.data === window.YT.PlayerState.PLAYING) {
              setState(prev => ({ ...prev, isPlaying: true }));
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setState(prev => ({ ...prev, isPlaying: false }));
            } else if (event.data === window.YT.PlayerState.ENDED) {
              console.log("🎵 Song ended - Auto-playing next...");
              setState(prev => ({ ...prev, isPlaying: false }));
              // Use the ref to get the latest version of nextSong
              if (nextSongRef.current) {
                nextSongRef.current();
              }
            }
          },
          onError: (e: any) => {
            console.error("❌ YT Error:", e);
            // Skip to next song on error
            if (nextSongRef.current) {
              nextSongRef.current();
            }
          }
        }
      });
    };

    if (!window.YT) {
      if (!document.getElementById('youtube-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'youtube-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        window.onYouTubeIframeAPIReady = initPlayer;
      } else {
        window.onYouTubeIframeAPIReady = initPlayer;
      }
    } else {
      initPlayer();
    }
  }, []);

  useEffect(() => {
    if (playerRef.current && playerReady.current) {
      playerRef.current.setVolume(state.volume);
    }
  }, [state.volume]);

  // Actions
  const playSong = useCallback((song: Song) => {
    const videoId = getVideoId(song);
    if (playerRef.current && playerReady.current) {
      if (state.currentSong?.id === song.id) playerRef.current.playVideo();
      else playerRef.current.loadVideoById(videoId);
    }

    recommendationEngine.current.recordListeningEvent({
      songId: song.id,
      artist: song.artist,
      genre: (song as any).genre,
      action: 'play',
      timestamp: Date.now(),
    });

    if (user) {
      addToHistory(user.id, song);
      updateNowPlaying(user.id, song, true, 0);
    }

    setState(prev => {
      const queueHasSong = prev.queue.some(s => s.id === song.id);
      return {
        ...prev,
        currentSong: song,
        isPlaying: true,
        progress: 0,
        currentTime: 0,
        queue: queueHasSong ? prev.queue : [...prev.queue, song]
      };
    });

    setRepeatCount(prev => prev + 1);
  }, [user, state.currentSong]);

  const playTrackList = useCallback((tracks: Song[], startIndex: number = 0) => {
    const song = tracks[startIndex];
    if (!song) return;

    const videoId = getVideoId(song);
    if (playerRef.current && playerReady.current) playerRef.current.loadVideoById(videoId);

    if (user) {
      addToHistory(user.id, song);
      updateNowPlaying(user.id, song, true, 0);
    }

    setState(prev => ({
      ...prev,
      currentSong: song,
      isPlaying: true,
      progress: 0,
      currentTime: 0,
      queue: tracks,
      isShuffled: false,
    }));
  }, [user]);

  const pauseSong = useCallback(() => {
    if (playerRef.current && playerReady.current) playerRef.current.pauseVideo();
    setState(prev => {
      if (user && prev.currentSong) updateNowPlaying(user.id, prev.currentSong, false, prev.currentTime);
      return { ...prev, isPlaying: false };
    });
  }, [user]);

  const togglePlay = useCallback(() => {
    if (state.isPlaying) pauseSong();
    else {
      if (playerRef.current && playerReady.current) playerRef.current.playVideo();
      setState(prev => ({ ...prev, isPlaying: true }));
    }
  }, [state.isPlaying, pauseSong]);

  const prevSong = useCallback(() => {
    if (state.currentTime > 3) {
      seekTo(0);
      return;
    }

    const { queue, currentSong } = state;
    if (queue.length === 0 || !currentSong) return;

    const currentIndex = queue.findIndex(s => s.id === currentSong.id);
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) prevIndex = queue.length - 1;

    const prevTrack = queue[prevIndex];
    if (!prevTrack) return;

    const videoId = getVideoId(prevTrack);
    if (playerRef.current && playerReady.current) playerRef.current.loadVideoById(videoId);

    if (user) {
      addToHistory(user.id, prevTrack);
      updateNowPlaying(user.id, prevTrack, true, 0);
    }

    setState(prev => ({
      ...prev,
      currentSong: prevTrack,
      progress: 0,
      currentTime: 0,
      isPlaying: true
    }));
  }, [state, user]);

  const seekTo = useCallback((progress: number) => {
    if (playerRef.current && playerReady.current) {
      const duration = playerRef.current.getDuration();
      if (duration) {
        const seekTime = (progress / 100) * duration;
        playerRef.current.seekTo(seekTime, true);
      }
    }

    setState(prev => {
      const newTime = (progress / 100) * (prev.duration || 0);
      if (user && prev.currentSong) updateNowPlaying(user.id, prev.currentSong, prev.isPlaying, newTime);
      return { ...prev, progress, currentTime: newTime };
    });
  }, [user]);

  const setVolume = useCallback((volume: number) => {
    setState(prev => ({ ...prev, volume }));
  }, []);

  const toggleShuffle = useCallback(() => {
    setState(prev => ({ ...prev, isShuffled: !prev.isShuffled }));
  }, []);

  const toggleRepeat = useCallback(() => {
    setState(prev => ({
      ...prev,
      repeatMode: prev.repeatMode === 'off' ? 'all' : prev.repeatMode === 'all' ? 'one' : 'off',
    }));
  }, []);

  const addToQueue = useCallback((song: Song) => {
    setState(prev => ({ ...prev, queue: [...prev.queue, song] }));
  }, []);

  const clearQueue = useCallback(() => {
    setState(prev => ({ ...prev, queue: [] }));
  }, []);

  const exportUserProfile = useCallback(() => {
    return recommendationEngine.current.exportProfile();
  }, []);

  const resetRecommendations = useCallback(() => {
    recommendationEngine.current.resetProfile();
    console.log("🔄 Recommendation profile reset");
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state.isPlaying) {
      interval = setInterval(() => {
        if (playerRef.current && playerRef.current.getCurrentTime) {
          const current = playerRef.current.getCurrentTime();
          const total = playerRef.current.getDuration();
          if (total > 0) {
            setState(prev => ({
              ...prev,
              progress: (current / total) * 100,
              currentTime: current,
              duration: total
            }));
          }
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [state.isPlaying]);

  // ============================================================================
  // MEDIA SESSION API (Mobile Background Playback)
  // ============================================================================
  useEffect(() => {
    if ('mediaSession' in navigator && state.currentSong) {
      const { currentSong, isPlaying } = state;

      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist,
        artwork: [
          { src: currentSong.coverUrl || currentSong.image || '', sizes: '96x96', type: 'image/jpeg' },
          { src: currentSong.coverUrl || currentSong.image || '', sizes: '128x128', type: 'image/jpeg' },
          { src: currentSong.coverUrl || currentSong.image || '', sizes: '192x192', type: 'image/jpeg' },
          { src: currentSong.coverUrl || currentSong.image || '', sizes: '256x256', type: 'image/jpeg' },
          { src: currentSong.coverUrl || currentSong.image || '', sizes: '384x384', type: 'image/jpeg' },
          { src: currentSong.coverUrl || currentSong.image || '', sizes: '512x512', type: 'image/jpeg' },
        ]
      });

      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

      navigator.mediaSession.setActionHandler('play', () => togglePlay());
      navigator.mediaSession.setActionHandler('pause', () => togglePlay());
      navigator.mediaSession.setActionHandler('previoustrack', () => prevSong());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextSong());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          const percent = (details.seekTime / (state.duration || 1)) * 100;
          seekTo(percent);
        }
      });
    }
  }, [state.currentSong, state.isPlaying, state.duration, togglePlay, prevSong, nextSong, seekTo]);

  return (
    <PlayerContext.Provider value={{
      ...state,
      playSong,
      pauseSong,
      togglePlay,
      nextSong,
      prevSong,
      seekTo,
      setVolume,
      toggleShuffle,
      toggleRepeat,
      addToQueue,
      clearQueue,
      playTrackList,
      exportUserProfile,
      resetRecommendations,
      skipCount,
      repeatCount,
    }}>
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within a PlayerProvider');
  return context;
};

// ============================================================================
// PLAYER UI COMPONENT
// ============================================================================

const Player: React.FC = () => {
  const {
    currentSong, isPlaying, currentTime, duration,
    volume, togglePlay, setVolume, nextSong, prevSong,
    isShuffled, toggleShuffle, repeatMode, toggleRepeat, seekTo, progress
  } = usePlayer();

  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullScreen(false); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seekTo((Number(e.target.value) / (duration || 1)) * 100);
  };

  const toggleMute = () => setVolume(volume > 0 ? 0 : 75);

  if (!currentSong) return null;

  return (
    <>
      {/* Desktop Bar */}
      <div className="hidden md:flex fixed bottom-0 left-0 right-0 h-20 bg-zinc-900/95 backdrop-blur-2xl border-t border-white/5 items-center px-4 z-50">
        <div className="flex items-center space-x-3 w-1/4">
          <img src={currentSong.coverUrl || currentSong.image} alt={currentSong.title} className="w-14 h-14 rounded-lg object-cover ring-1 ring-white/10" onClick={() => setIsFullScreen(true)} />
          <div className="flex-1 min-w-0">
            <div onClick={() => setIsFullScreen(true)} className="text-sm font-bold truncate text-white cursor-pointer hover:underline decoration-emerald-500 decoration-2 underline-offset-4">{currentSong.title}</div>
            <div className="text-xs text-zinc-400 truncate">{currentSong.artist}</div>
          </div>
          <TrackActionMenu song={currentSong} />
        </div>

        <div className="flex flex-col items-center w-2/4 space-y-2">
          <div className="flex items-center space-x-4">
            <button onClick={toggleShuffle} className={`p-2 rounded-full transition-all ${isShuffled ? 'text-emerald-500 bg-emerald-500/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}><Shuffle className="w-4 h-4" /></button>
            <button onClick={prevSong} className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-full transition-colors"><SkipBack className="w-5 h-5" /></button>
            <button onClick={togglePlay} className="p-3 bg-white text-black rounded-full hover:scale-105 transition-transform shadow-lg">{isPlaying ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5" fill="currentColor" />}</button>
            <button onClick={nextSong} className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-full transition-colors"><SkipForward className="w-5 h-5" /></button>
            <button onClick={toggleRepeat} className={`p-2 rounded-full transition-all ${repeatMode !== 'off' ? 'text-emerald-500 bg-emerald-500/10' : 'text-zinc-500 hover:text-white hover:bg-white/5'}`}><Repeat className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center space-x-2 w-full">
            <span className="text-xs text-zinc-400 w-10 text-right">{formatTime(currentTime)}</span>
            <input type="range" min="0" max={duration} value={currentTime} onChange={handleSeek} className="flex-1 h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer hover:[&::-webkit-slider-thumb]:scale-110 transition-transform" />
            <span className="text-xs text-zinc-400 w-10">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 w-1/4">
          <button onClick={toggleMute} className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-full transition-colors">{volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}</button>
          <div className="relative w-24 h-1 bg-zinc-800 rounded-full group">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full" style={{ width: `${volume}%` }} />
            <input type="range" min="0" max="100" value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="absolute inset-0 opacity-0 cursor-pointer" />
          </div>
          <button onClick={() => setIsFullScreen(true)} className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-full transition-colors"><Maximize2 className="w-5 h-5" /></button>
        </div>
      </div>

      {/* Desktop Fullscreen Overlay */}
      <AnimatePresence>
        {isFullScreen && (
          <DesktopFullScreenPlayer
            currentTrack={currentSong} isPlaying={isPlaying} progress={currentTime} duration={duration} volume={volume} isShuffled={isShuffled} repeatMode={repeatMode}
            onClose={() => setIsFullScreen(false)}
            onTogglePlay={togglePlay} onNext={nextSong} onPrev={prevSong} onSeek={handleSeek}
            onVolumeChange={(e: any) => setVolume(Number(e.target.value))} onToggleShuffle={toggleShuffle} onToggleRepeat={toggleRepeat}
          />
        )}
      </AnimatePresence>

      {/* Mobile Mini */}
      <AnimatePresence>
        {!isMobileExpanded && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            onClick={() => setIsMobileExpanded(true)}
            className="md:hidden fixed bottom-0 left-2 right-2 h-14 bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-xl flex items-center px-3 space-x-3 z-[90] shadow-2xl"
          >
            <img src={currentSong.coverUrl || currentSong.image} alt={currentSong.title} className="w-10 h-10 rounded-lg object-cover ring-1 ring-white/10" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate text-white">{currentSong.title}</div>
              <div className="text-xs text-zinc-400 truncate">{currentSong.artist}</div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); togglePlay() }} className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-black">{isPlaying ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Fullscreen */}
      <AnimatePresence>
        {isMobileExpanded && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="md:hidden fixed inset-0 bg-gradient-to-b from-zinc-900 via-black to-black z-[100] flex flex-col p-6"
          >
            <div className="flex items-center justify-between mb-8">
              <button onClick={() => setIsMobileExpanded(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10"><ChevronDown className="w-5 h-5" /></button>
              <div className="text-sm font-semibold">Now Playing</div>
              <div className="w-8" />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center space-y-8">
              <img src={currentSong.coverUrl || currentSong.image} alt={currentSong.title} className="w-72 h-72 rounded-2xl shadow-2xl object-cover ring-1 ring-white/10" />
              <div className="text-center space-y-2">
                <div className="text-2xl font-bold text-white">{currentSong.title}</div>
                <div className="text-lg text-zinc-400">{currentSong.artist}</div>
              </div>
              <div className="w-full space-y-2">
                <input type="range" min="0" max={duration} value={currentTime} onChange={handleSeek} className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full" />
                <div className="flex justify-between text-xs text-zinc-400"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
              </div>
              <div className="flex items-center justify-center space-x-6">
                <button onClick={toggleShuffle} className={isShuffled ? 'text-emerald-500' : 'text-zinc-400'}><Shuffle className="w-6 h-6" /></button>
                <button onClick={prevSong}><SkipBack className="w-7 h-7" /></button>
                <button onClick={togglePlay} className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center">{isPlaying ? <Pause className="w-7 h-7" fill="currentColor" /> : <Play className="w-7 h-7" fill="currentColor" />}</button>
                <button onClick={nextSong}><SkipForward className="w-7 h-7" /></button>
                <button onClick={toggleRepeat} className={repeatMode !== 'off' ? 'text-emerald-500' : 'text-zinc-400'}><Repeat className="w-6 h-6" /></button>
              </div>
              <div className="flex items-center space-x-3">
                <button onClick={toggleMute}>{volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}</button>
                <div className="text-sm text-zinc-400">{volume}%</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// ============================================================================
// TASTE PROFILE DASHBOARD COMPONENT
// ============================================================================

interface ProfileData {
  profile: {
    artistPreferences: [string, number][];
    genrePreferences: [string, number][];
    favoriteArtists: string[];
    discoveryOpenness: number;
  };
  history: any[];
}

const StatCard: React.FC<{ label: string; value: number; icon: string }> = ({
  label,
  value,
  icon,
}) => (
  <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/5">
    <div className="text-2xl mb-1">{icon}</div>
    <div className="text-2xl font-bold text-white">{value}</div>
    <div className="text-sm text-zinc-400">{label}</div>
  </div>
);

export const TasteProfileDashboard: React.FC = () => {
  const { exportUserProfile, resetRecommendations } = usePlayer();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = () => {
    try {
      const data = JSON.parse(exportUserProfile());
      setProfileData(data);
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  if (!profileData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-zinc-400">Loading your taste profile...</div>
        </div>
      </div>
    );
  }

  const topArtists = profileData.profile.artistPreferences
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const topGenres = profileData.profile.genrePreferences
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const discoveryLevel = profileData.profile.discoveryOpenness * 100;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Brain className="w-8 h-8 text-emerald-500" />
            <h1 className="text-3xl font-bold text-white">Your Music DNA</h1>
          </div>
          <p className="text-zinc-400">
            AI-powered insights into your listening patterns
          </p>
        </div>
        <button
          onClick={() => {
            if (confirm('Reset your taste profile? This cannot be undone.')) {
              resetRecommendations();
              loadProfile();
            }
          }}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm flex items-center gap-2 transition-colors"
        >
          <Settings className="w-4 h-4" />
          Reset Profile
        </button>
      </div>

      <div className="bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 rounded-2xl p-6 border border-emerald-500/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              <h3 className="text-lg font-semibold text-white">Discovery Mode</h3>
            </div>
            <p className="text-sm text-zinc-400">
              How open you are to new music
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-emerald-500">
              {discoveryLevel.toFixed(0)}%
            </div>
            <div className="text-sm text-zinc-400">
              {discoveryLevel < 25 ? 'Conservative' :
                discoveryLevel < 40 ? 'Balanced' :
                  discoveryLevel < 60 ? 'Adventurous' : 'Explorer'}
            </div>
          </div>
        </div>
        <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${discoveryLevel}%` }} />
        </div>
        <p className="mt-4 text-sm text-zinc-300">
          {discoveryLevel < 25 && "You prefer familiar favorites. We'll keep recommendations close to what you know."}
          {discoveryLevel >= 25 && discoveryLevel < 40 && "You enjoy a healthy mix of old and new. Perfect balance!"}
          {discoveryLevel >= 40 && discoveryLevel < 60 && "You're open to exploring new artists and genres. We'll introduce fresh sounds!"}
          {discoveryLevel >= 60 && "You're a music explorer! We'll push boundaries with diverse recommendations."}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-zinc-800/30 rounded-2xl p-6 border border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <Music className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-semibold text-white">Top Artists</h3>
          </div>
          <div className="space-y-3">
            {topArtists.map(([artist, score], index) => {
              const maxScore = topArtists[0][1];
              const percentage = (score / maxScore) * 100;
              return (
                <div key={artist}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-500">
                        {index + 1}
                      </div>
                      <span className="text-sm font-medium text-white truncate">
                        {artist}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-400">
                      {score.toFixed(1)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-zinc-800/30 rounded-2xl p-6 border border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <ListMusic className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-semibold text-white">Favorite Genres</h3>
          </div>
          {topGenres.length > 0 ? (
            <div className="space-y-3">
              {topGenres.map(([genre, score], index) => {
                const maxScore = topGenres[0][1];
                const percentage = (score / maxScore) * 100;
                return (
                  <div key={genre}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white capitalize">
                        {genre}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {score.toFixed(1)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-zinc-400 text-center">
                Listen to more music to see your genre preferences!
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-zinc-800/30 rounded-2xl p-6 border border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-emerald-500" />
          <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Songs Skipped"
            value={profileData.history.filter(e => e.action === 'skip').length}
            icon="⏭️"
          />
          <StatCard
            label="Songs Replayed"
            value={profileData.history.filter(e => e.action === 'replay').length}
            icon="🔁"
          />
          <StatCard
            label="Full Listens"
            value={profileData.history.filter(e => e.action === 'full_listen').length}
            icon="✅"
          />
        </div>
      </div>

      <div className="bg-zinc-800/30 rounded-2xl p-6 border border-white/5">
        <h3 className="text-lg font-semibold text-white mb-4">How AI Learns Your Taste</h3>
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-black font-bold">
              1
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">Listen & Track</h4>
              <p className="text-sm text-zinc-400">
                We monitor which songs you play fully, skip, or replay to understand your preferences.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center text-black font-bold">
              2
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">Build Profile</h4>
              <p className="text-sm text-zinc-400">
                Artists and genres you love get higher scores. Skipped content lowers their weight.
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center text-black font-bold">
              3
            </div>
            <div>
              <h4 className="font-semibold text-white mb-1">Smart Recommendations</h4>
              <p className="text-sm text-zinc-400">
                We balance 70% familiar favorites with 30% new discoveries tailored to your evolving taste.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Player;