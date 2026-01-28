import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { Song, PlayerState } from '@/types/music';
import { addToHistory, updateNowPlaying, getNowPlaying } from '@/api/db';
import { useAuth } from './useAuth';

// --- Interfaces ---
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
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

// --- Global Types ---
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  // --- State ---
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

  const playerRef = useRef<any>(null);
  const playerReady = useRef(false);

  // Helper to extract Video ID safely
  const getVideoId = (song: Song) => song.youtube_id || song.id.replace('yt_', '');

  // --- Initial Fetch (Restore State) ---
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
            isPlaying: false, // Don't auto-play on reload
            progress: (lastState.position / (lastState.song.duration || 1)) * 100
          }));
        }
      } catch (error) {
        console.error("Failed to fetch last state", error);
      }
    };
    fetchLastState();
  }, [user]);

  // --- YouTube API Initialization ---
  useEffect(() => {
    // 1. Create hidden DOM element
    if (!document.getElementById('youtube-player-hidden')) {
      const playerDiv = document.createElement('div');
      playerDiv.id = 'youtube-player-hidden';
      playerDiv.style.cssText = 'position: absolute; top: -9999px; left: -9999px; visibility: hidden;';
      document.body.appendChild(playerDiv);
    }

    // 2. Define Init Function
    const initPlayer = () => {
      console.log("YT Player: Initializing...");
      if (playerRef.current) {
        console.log("YT Player: Already initialized");
        return;
      }

      try {
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
              console.log("YT Player: Ready");
              playerReady.current = true;
              event.target.setVolume(state.volume);
            },
            onStateChange: (event: any) => {
              console.log("YT Player State Change:", event.data);
              if (event.data === window.YT.PlayerState.PLAYING) {
                console.log("YT Player: Playing");
                setState(prev => ({ ...prev, isPlaying: true }));
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                console.log("YT Player: Paused");
                setState(prev => ({ ...prev, isPlaying: false }));
              } else if (event.data === window.YT.PlayerState.BUFFERING) {
                console.log("YT Player: Buffering...");
              } else if (event.data === window.YT.PlayerState.ENDED) {
                console.log("YT Player: Ended");
                setState(prev => ({ ...prev, isPlaying: false }));
                nextSong();
              }
            },
            onError: (e: any) => {
              console.error("YT Player Error:", e.data);
              // Common errors: 2 (invalid param), 5 (HTML5 error), 100 (not found), 101/150 (embed restricted)
            }
          }
        });
      } catch (err) {
        console.error("YT Player: Failed to create instance", err);
      }
    };

    // 3. Load Script
    console.log("YT Player: Loading script...");
    if (!window.YT) {
      if (!document.getElementById('youtube-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'youtube-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
        window.onYouTubeIframeAPIReady = () => {
          console.log("YT Player: API Ready callback triggered");
          initPlayer();
        };
      } else {
        window.onYouTubeIframeAPIReady = initPlayer;
      }
    } else {
      console.log("YT Player: window.YT already exists");
      initPlayer();
    }
  }, []); // Run once on mount

  // --- Sync Volume Changes ---
  useEffect(() => {
    if (playerRef.current && playerReady.current) {
      playerRef.current.setVolume(state.volume);
    }
  }, [state.volume]);

  // --- Actions ---

  const playSong = useCallback((song: Song) => {
    console.log("YT Player: playSong requested", song.title);
    // 1. Control Player
    const videoId = getVideoId(song);

    if (playerRef.current && playerReady.current) {
      if (state.currentSong?.id === song.id) {
        console.log("YT Player: Unpausing current song");
        playerRef.current.playVideo();
      } else {
        console.log("YT Player: Loading video ID", videoId);
        playerRef.current.loadVideoById(videoId);
      }
    } else {
      console.warn("YT Player: Not ready for playSong", { playerRef: !!playerRef.current, playerReady: playerReady.current });
    }

    // 2. DB Sync
    if (user) {
      addToHistory(user.id, song);
      updateNowPlaying(user.id, song, true, 0);
    }

    // 3. Update State
    setState(prev => {
      // Check if song exists in queue, if not add it
      const queueHasSong = prev.queue.some(s => s.id === song.id);
      const newQueue = queueHasSong ? prev.queue : [...prev.queue, song];

      return {
        ...prev,
        currentSong: song,
        isPlaying: true,
        progress: 0,
        currentTime: 0,
        queue: newQueue
      };
    });
  }, [user, state.currentSong]);

  const playTrackList = useCallback((tracks: Song[], startIndex: number = 0) => {
    const song = tracks[startIndex];
    if (!song) return;

    console.log("YT Player: playTrackList requested", song.title);
    const videoId = getVideoId(song);
    if (playerRef.current && playerReady.current) {
      console.log("YT Player: Loading video ID from list", videoId);
      playerRef.current.loadVideoById(videoId);
    } else {
      console.warn("YT Player: Not ready for playTrackList");
    }

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
      isShuffled: false, // Usually playing a list resets shuffle
    }));
  }, [user]);

  const pauseSong = useCallback(() => {
    if (playerRef.current && playerReady.current) {
      playerRef.current.pauseVideo();
    }

    setState(prev => {
      if (user && prev.currentSong) {
        updateNowPlaying(user.id, prev.currentSong, false, prev.currentTime);
      }
      return { ...prev, isPlaying: false };
    });
  }, [user]);

  const togglePlay = useCallback(() => {
    if (state.isPlaying) {
      pauseSong();
    } else {
      if (playerRef.current && playerReady.current) {
        playerRef.current.playVideo();
      }
      setState(prev => ({ ...prev, isPlaying: true }));
    }
  }, [state.isPlaying, pauseSong]);

  // Helper for Next/Prev logic
  const getNextTrack = (direction: 'next' | 'prev') => {
    const { queue, currentSong, isShuffled, repeatMode } = state;
    if (queue.length === 0 || !currentSong) return null;

    const currentIndex = queue.findIndex(s => s.id === currentSong.id);
    if (currentIndex === -1) return queue[0]; // Fallback

    if (repeatMode === 'one' && direction === 'next') {
      // Note: Usually "Next" button overrides Repeat One, 
      // but auto-play (onEnd) respects it. 
      // If this function is called by a user click, we usually skip.
      // If called by 'ended' event, we might loop. 
      // For simplicity here, we proceed to next logic.
    }

    let nextIndex;
    if (isShuffled) {
      // Simple shuffle: random index that isn't current
      // A better shuffle would use a "shuffledQueue" array
      do {
        nextIndex = Math.floor(Math.random() * queue.length);
      } while (queue.length > 1 && nextIndex === currentIndex);
    } else {
      if (direction === 'next') {
        nextIndex = currentIndex + 1;
        if (nextIndex >= queue.length) {
          if (repeatMode === 'off') return null; // Stop at end
          nextIndex = 0; // Loop back
        }
      } else {
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) {
          nextIndex = queue.length - 1; // Loop to end
        }
      }
    }

    return queue[nextIndex];
  };

  const nextSong = useCallback(() => {
    // We calculate next track using current state (via closure or ref)
    // Use functional state to be safe, but we need the calculated song to trigger Player
    // The safest way is to read from current 'state' in scope if we include it in dependency

    // Better: use the helper logic inside setState? No, we need side effects (Player).
    // We will trust 'state' is fresh due to dependency array.

    const nextTrack = getNextTrack('next');
    if (!nextTrack) {
      // End of queue behavior
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
  }, [state, user]); // Dependencies crucial here

  const prevSong = useCallback(() => {
    // Logic: If playing > 3 seconds, restart song. Else go to prev.
    if (state.currentTime > 3) {
      seekTo(0);
      return;
    }

    const prevTrack = getNextTrack('prev');
    if (!prevTrack) return;

    const videoId = getVideoId(prevTrack);
    if (playerRef.current && playerReady.current) {
      playerRef.current.loadVideoById(videoId);
    }

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
    // Progress is 0-100
    if (playerRef.current && playerReady.current) {
      const duration = playerRef.current.getDuration();
      if (duration) {
        const seekTime = (progress / 100) * duration;
        playerRef.current.seekTo(seekTime, true);
      }
    }

    setState(prev => {
      const newTime = (progress / 100) * (prev.duration || 0);

      // Debounce DB update ideally, but here we do it direct
      if (user && prev.currentSong) {
        updateNowPlaying(user.id, prev.currentSong, prev.isPlaying, newTime);
      }

      return {
        ...prev,
        progress,
        currentTime: newTime
      };
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
    setState(prev => {
      // Avoid duplicates if desired, or allow them. Here we allow.
      return { ...prev, queue: [...prev.queue, song] };
    });
  }, []);

  const clearQueue = useCallback(() => {
    setState(prev => ({ ...prev, queue: [] }));
  }, []);

  // --- Progress Timer ---
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

  return (
    <PlayerContext.Provider
      value={{
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
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};