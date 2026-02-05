import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Heart, Music, Clock, Sparkles, Disc3, Radio, ListMusic, Waves, Star, Zap, TrendingUp } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getUserPlaylists, createPlaylist as apiCreatePlaylist } from '../api/db';
import { Song, Playlist as AppPlaylist } from '../types/music';
import { Link } from 'react-router-dom';

// Playlist cover gradient combinations
const PLAYLIST_GRADIENTS = [
  'from-violet-600 via-purple-600 to-fuchsia-600',
  'from-cyan-500 via-blue-600 to-indigo-700',
  'from-emerald-500 via-teal-600 to-cyan-700',
  'from-orange-500 via-red-600 to-pink-700',
  'from-yellow-400 via-orange-500 to-red-600',
  'from-lime-500 via-green-600 to-emerald-700',
  'from-rose-500 via-pink-600 to-purple-700',
  'from-indigo-500 via-purple-600 to-pink-600',
  'from-sky-400 via-cyan-500 to-teal-600',
  'from-amber-500 via-yellow-600 to-orange-700',
];

// Playlist icon options
const PLAYLIST_ICONS = [Music, Disc3, Radio, ListMusic, Waves, Star, Zap, TrendingUp, Sparkles];

// Animated musical notes component
const FloatingNotes: React.FC<{ delay?: number }> = ({ delay = 0 }) => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ y: 100, opacity: 0, rotate: 0 }}
          animate={{
            y: -100,
            opacity: [0, 1, 1, 0],
            rotate: 360,
            x: [0, Math.random() * 40 - 20, Math.random() * 40 - 20, 0]
          }}
          transition={{
            duration: 4 + Math.random() * 2,
            delay: delay + i * 0.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute text-white/20"
          style={{
            left: `${10 + i * 15}%`,
            fontSize: `${16 + Math.random() * 12}px`
          }}
        >
          ♪
        </motion.div>
      ))}
    </div>
  );
};

// Animated wave pattern for liked songs
const WavePattern: React.FC = () => {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-10">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute h-px bg-white w-full"
          style={{ top: `${20 + i * 20}%` }}
          animate={{
            x: ['-100%', '100%'],
          }}
          transition={{
            duration: 8 - i * 0.5,
            repeat: Infinity,
            ease: "linear",
            delay: i * 0.3
          }}
        />
      ))}
    </div>
  );
};

// Enhanced playlist card component
const PlaylistCard: React.FC<{
  playlist: AppPlaylist;
  index: number;
  username: string;
}> = ({ playlist, index, username }) => {
  const [isHovered, setIsHovered] = useState(false);
  const gradient = PLAYLIST_GRADIENTS[index % PLAYLIST_GRADIENTS.length];
  const Icon = PLAYLIST_ICONS[index % PLAYLIST_ICONS.length];

  return (
    <Link to={`/playlist/${playlist.id}`}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 + index * 0.05, duration: 0.4 }}
        whileHover={{ y: -8, transition: { duration: 0.2 } }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className="group cursor-pointer"
      >
        <div className="bg-zinc-900/60 backdrop-blur-sm p-4 rounded-xl border border-white/5 hover:border-white/10 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/10">
          {/* Playlist Cover */}
          <div className="relative aspect-square mb-4 rounded-lg overflow-hidden shadow-lg">
            {/* Gradient Background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />
            
            {/* Animated mesh gradient overlay */}
            <motion.div
              className="absolute inset-0 opacity-30"
              style={{
                background: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(255,255,255,0.2) 0%, transparent 50%)'
              }}
              animate={{
                scale: isHovered ? 1.1 : 1,
                rotate: isHovered ? 5 : 0,
              }}
              transition={{ duration: 0.6 }}
            />

            {/* Grid pattern */}
            <div className="absolute inset-0 opacity-10" style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }} />

            {/* Icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{
                  scale: isHovered ? 1.2 : 1,
                  rotate: isHovered ? 10 : 0,
                }}
                transition={{ duration: 0.3 }}
              >
                <Icon className="w-16 h-16 text-white drop-shadow-2xl" strokeWidth={1.5} />
              </motion.div>
            </div>

            {/* Floating particles on hover */}
            <AnimatePresence>
              {isHovered && (
                <>
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                      animate={{
                        opacity: [0, 1, 0],
                        scale: [0, 1, 0],
                        x: (Math.random() - 0.5) * 100,
                        y: (Math.random() - 0.5) * 100,
                      }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: 1.5,
                        delay: i * 0.1,
                        repeat: Infinity,
                        repeatDelay: 0.5
                      }}
                      className="absolute top-1/2 left-1/2 w-1 h-1 bg-white rounded-full"
                    />
                  ))}
                </>
              )}
            </AnimatePresence>

            {/* Glass reflection effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-transparent opacity-50" />
          </div>

          {/* Playlist Info */}
          <div className="space-y-1">
            <motion.h3
              className="font-bold text-white truncate group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-pink-400 transition-all"
              animate={{ x: isHovered ? 2 : 0 }}
            >
              {playlist.name}
            </motion.h3>
            <p className="text-sm text-zinc-500 flex items-center gap-1.5">
              <ListMusic className="w-3.5 h-3.5" />
              <span>Playlist • {username}</span>
            </p>
          </div>
        </div>
      </motion.div>
    </Link>
  );
};

// Main Library Component
const Library: React.FC = () => {
  const { user, profile } = useAuth();
  const [playlists, setPlaylists] = useState<AppPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateAnimation, setShowCreateAnimation] = useState(false);

  const fetchLibrary = async () => {
    if (!user) return;
    setLoading(true);
    const data = await getUserPlaylists(user.id);
    setPlaylists(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchLibrary();
  }, [user]);

  const handleCreatePlaylist = async () => {
    if (!user) return;
    setShowCreateAnimation(true);
    const name = `My Playlist #${playlists.length + 1}`;
    const newPl = await apiCreatePlaylist(user.id, name);
    if (newPl) {
      setPlaylists([...playlists, newPl]);
      setTimeout(() => setShowCreateAnimation(false), 1000);
    }
  };

  const username = profile?.username || user?.username || 'User';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen p-4 md:p-8 pb-32"
    >
      {/* Animated background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
        <motion.div
          className="absolute top-20 right-20 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-20 left-20 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.5, 0.3, 0.5],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-8 relative">
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent mb-2">
            Your Library
          </h1>
          <p className="text-zinc-500 flex items-center gap-2">
            <Music className="w-4 h-4" />
            {playlists.length} {playlists.length === 1 ? 'playlist' : 'playlists'}
          </p>
        </motion.div>

        {/* Create Button */}
        <motion.button
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleCreatePlaylist}
          className="relative p-4 bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-2xl transition-all shadow-lg hover:shadow-purple-500/50 group"
        >
          <AnimatePresence>
            {showCreateAnimation && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 2, opacity: 0 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-purple-500 rounded-2xl"
              />
            )}
          </AnimatePresence>
          <Plus className="w-6 h-6 relative z-10 group-hover:rotate-90 transition-transform duration-300" />
        </motion.button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 md:gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square bg-zinc-800/50 rounded-lg mb-4" />
              <div className="h-4 bg-zinc-800/50 rounded w-3/4 mb-2" />
              <div className="h-3 bg-zinc-800/50 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6">
          {/* Liked Songs - Featured Card */}
          <Link to="/playlist/liked" className="md:col-span-2 lg:col-span-1 xl:col-span-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3 }}
              className="group relative h-full min-h-[280px] bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-8 rounded-2xl overflow-hidden shadow-2xl cursor-pointer border border-white/10"
            >
              {/* Animated background elements */}
              <WavePattern />
              <FloatingNotes delay={0} />
              
              {/* Gradient mesh overlay */}
              <motion.div
                className="absolute inset-0 opacity-20"
                style={{
                  background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(255,255,255,0.3) 0%, transparent 50%)'
                }}
                animate={{
                  scale: [1, 1.05, 1],
                  rotate: [0, 5, 0],
                }}
                transition={{
                  duration: 6,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />

              {/* Content */}
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 10 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl shadow-xl">
                      <Heart className="w-10 h-10 fill-white text-white drop-shadow-lg" />
                    </div>
                  </motion.div>
                  
                  <motion.div
                    animate={{
                      rotate: [0, 360],
                    }}
                    transition={{
                      duration: 20,
                      repeat: Infinity,
                      ease: "linear"
                    }}
                  >
                    <Sparkles className="w-6 h-6 text-white/40" />
                  </motion.div>
                </div>

                <div>
                  <motion.h2
                    className="text-3xl md:text-4xl font-black text-white mb-2 drop-shadow-lg"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                  >
                    Liked Songs
                  </motion.h2>
                  <motion.p
                    className="text-white/90 font-medium flex items-center gap-2"
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <Clock className="w-4 h-4" />
                    Synced With the Hyde's Rock Type Heart 
                  </motion.p>
                </div>
              </div>

              {/* Shine effect on hover */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
                style={{ transform: 'skewX(-20deg)' }}
              />

              {/* Corner decoration */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-bl-full" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-tr-full" />
            </motion.div>
          </Link>

          {/* User Playlists */}
          {playlists.map((pl, index) => (
            <PlaylistCard
              key={pl.id}
              playlist={pl}
              index={index}
              username={username}
            />
          ))}

          {/* Empty State */}
          {playlists.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="col-span-full flex flex-col items-center justify-center py-20 px-4"
            >
              <motion.div
                animate={{
                  y: [0, -10, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                <ListMusic className="w-20 h-20 text-zinc-700 mb-4" strokeWidth={1.5} />
              </motion.div>
              <h3 className="text-xl font-bold text-zinc-400 mb-2">No playlists yet</h3>
              <p className="text-zinc-600 text-center max-w-md mb-6">
                Create your first playlist and start organizing your favorite music
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleCreatePlaylist}
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-full font-semibold flex items-center gap-2 shadow-lg hover:shadow-purple-500/50 transition-all"
              >
                <Plus className="w-5 h-5" />
                Create Playlist
              </motion.button>
            </motion.div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default Library;