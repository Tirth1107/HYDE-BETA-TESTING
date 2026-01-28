import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search as SearchIcon, Play, Clock, AlertCircle, RefreshCcw, Music, X } from 'lucide-react';
import { searchMusic, getSuggestions } from '../api/client';
import { usePlayer } from '../hooks/usePlayer';
import { Song } from '../types/music';
import TrackActionMenu from '../components/TrackActionMenu';

const Search: React.FC = () => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const { playTrackList, currentSong } = usePlayer();

  // --- Click Outside to Close Suggestions ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- Search Handler ---
  const handleSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    setQuery(trimmed);
    setShowSuggestions(false);
    setLoading(true);
    setError(null);

    try {
      const data = await searchMusic(trimmed);
      setResults(data);
    } catch (err: any) {
      console.error("Search Error:", err);
      setError("Unable to connect to the music server. Please try again in a few moments.");
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Suggestion Fetcher ---
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.trim().length > 1) {
        const sugs = await getSuggestions(query);
        setSuggestions(sugs);
      } else {
        setSuggestions([]);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  // Handle Input Change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setShowSuggestions(true);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "3:45";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 md:p-8 min-h-full pb-24"
    >
      {/* --- Search Bar Section --- */}
      <div className="max-w-3xl mx-auto relative mb-12 z-50" ref={searchContainerRef}>
        <div className="relative group">
          
          {/* LIQUID GLASS SEARCH BAR CONTAINER */}
          <div className="
            relative overflow-hidden rounded-2xl
            bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent
            backdrop-blur-3xl saturate-150
            border-t border-l border-white/[0.15] border-r-white/[0.05] border-b-black/20
            shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]
            transition-all duration-500 ease-out
            group-focus-within:shadow-[0_8px_40px_0_rgba(16,185,129,0.15)]
            group-focus-within:bg-white/[0.1]
            group-focus-within:border-emerald-500/30
          ">
            
            {/* Glossy Reflection Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent h-1/2 opacity-50 pointer-events-none" />

            <div className="relative flex items-center px-6 py-5">
              <SearchIcon className="w-6 h-6 text-zinc-400 group-focus-within:text-emerald-400 transition-colors duration-300 drop-shadow-lg" />
              
              <input
                type="text"
                value={query}
                onChange={handleInputChange}
                onFocus={() => { if(suggestions.length > 0) setShowSuggestions(true); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
                placeholder="What do you want to listen to?"
                className="w-full bg-transparent pl-4 pr-10 text-xl font-medium text-white placeholder-zinc-500/80 outline-none drop-shadow-md"
              />

              {/* Clear Button with Glass effect */}
              {query && (
                <button 
                  onClick={() => { setQuery(''); setSuggestions([]); setResults([]); }}
                  className="absolute right-6 p-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-zinc-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* --- Suggestions Dropdown (Glass Morphism Match) --- */}
        <AnimatePresence>
          {showSuggestions && suggestions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 12, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -10, scale: 0.98, filter: 'blur(10px)' }}
              transition={{ duration: 0.3, type: "spring", stiffness: 200, damping: 20 }}
              className="
                absolute top-full left-0 right-0 
                bg-zinc-900/80 backdrop-blur-3xl 
                border-t border-white/10 border-b border-black/50 border-x border-white/5
                rounded-2xl overflow-hidden shadow-2xl z-50
              "
            >
              {suggestions.map((s, i) => (
                <button
                  key={`sug-${i}`}
                  onClick={() => handleSearch(s)}
                  className="w-full text-left px-6 py-4 text-base text-zinc-300 hover:text-white hover:bg-white/[0.08] transition-all flex items-center space-x-4 border-b border-white/[0.03] last:border-0 group"
                >
                  <SearchIcon className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                  <span className="font-medium tracking-wide">{s}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- Main Content Area --- */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-70">
          <div className="w-14 h-14 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-6 shadow-[0_0_20px_rgba(16,185,129,0.3)]"></div>
          <p className="text-zinc-400 font-medium tracking-wide animate-pulse">Scanning frequencies...</p>
        </div>
      ) : error ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto"
        >
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold mb-3 text-white">Connection Interrupted</h2>
          <p className="text-zinc-400 text-sm mb-8 leading-relaxed">{error}</p>
          <button
            onClick={() => handleSearch(query)}
            className="flex items-center space-x-2 bg-white text-black px-8 py-3 rounded-full font-bold hover:scale-105 active:scale-95 transition-all shadow-lg"
          >
            <RefreshCcw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
        </motion.div>
      ) : results.length > 0 ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold tracking-tight text-white mb-6">Search Results</h2>
          
          <div className="bg-zinc-900/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_2fr_1fr_48px] gap-4 px-6 py-4 text-zinc-500 text-[11px] font-bold uppercase tracking-widest border-b border-white/5">
              <span>Track</span>
              <span>Artist</span>
              <span className="text-right pr-4"><Clock className="w-3 h-3 inline" /></span>
              <span></span>
            </div>

            {/* Results List */}
            {results.map((track, i) => {
              const isActive = currentSong?.id === track.id;
              return (
                <div
                  key={track.youtube_id}
                  onClick={() => playTrackList(results, i)}
                  className={`grid grid-cols-[1fr_2fr_1fr_48px] gap-4 px-4 py-3 hover:bg-white/5 transition-colors cursor-pointer group items-center border-b border-white/[0.02] last:border-0 ${
                    isActive ? 'bg-emerald-500/10 hover:bg-emerald-500/15' : ''
                  }`}
                >
                  <div className="flex items-center space-x-4 min-w-0">
                    <div className="relative w-10 h-10 md:w-12 md:h-12 flex-shrink-0 rounded-lg overflow-hidden shadow-lg group-hover:scale-105 transition-transform duration-300">
                      <img src={track.coverUrl} className="w-full h-full object-cover" alt="" />
                      <div className={`absolute inset-0 bg-black/40 flex items-center justify-center ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                        {isActive ? (
                           <img src="https://open.spotifycdn.com/cdn/images/equaliser-animated-green.f93a2ef4.gif" className="w-4 h-4" alt="playing" />
                        ) : (
                           <Play className="w-5 h-5 text-white fill-white" />
                        )}
                      </div>
                    </div>
                    <span className={`font-semibold truncate text-sm md:text-base ${isActive ? 'text-emerald-400' : 'text-zinc-200 group-hover:text-white'}`}>
                      {track.title}
                    </span>
                  </div>

                  <span className={`text-sm truncate font-medium ${isActive ? 'text-emerald-500/80' : 'text-zinc-400 group-hover:text-zinc-300'}`}>
                    {track.artist}
                  </span>

                  <span className="text-sm text-zinc-500 font-mono text-right pr-4">
                    {formatDuration(track.duration)}
                  </span>

                  <div className="flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                    <TrackActionMenu song={track} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* --- Empty State: Browse Genres --- */
        <div className="space-y-8 max-w-5xl mx-auto">
          <h2 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-6">Browse by Genre</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {[
              { label: 'Pop', color: 'from-pink-500 to-rose-600' },
              { label: 'Hip-Hop', color: 'from-orange-500 to-amber-700' },
              { label: 'Indie', color: 'from-emerald-500 to-teal-700' },
              { label: 'Chill', color: 'from-blue-500 to-indigo-700' },
              { label: 'Rock', color: 'from-purple-500 to-violet-700' },
              { label: 'R&B', color: 'from-indigo-500 to-purple-800' },
              { label: 'Electronic', color: 'from-cyan-400 to-blue-600' },
              { label: 'Jazz', color: 'from-yellow-500 to-orange-600' },
            ].map((genre) => (
              <motion.div
                key={genre.label}
                whileHover={{ scale: 1.03, y: -5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSearch(genre.label)}
                className={`aspect-[4/5] rounded-2xl p-6 cursor-pointer relative overflow-hidden bg-gradient-to-br ${genre.color} shadow-lg hover:shadow-2xl transition-all group`}
              >
                <h3 className="text-2xl font-black italic tracking-tighter text-white uppercase relative z-10">{genre.label}</h3>
                
                {/* Decorative Elements */}
                <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700 ease-out" />
                <Music className="absolute right-4 bottom-4 w-10 h-10 text-white/20 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300" />
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default Search;