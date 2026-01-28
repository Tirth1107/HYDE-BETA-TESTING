import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, User, ChevronRight } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';

const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isSearchPage = location.pathname === '/search';

  return (
    <>
      {/* Main Header Container 
        - backdrop-blur-xl + backdrop-saturate-150 = Apple Glass Effect
        - A slight gradient in the background helps simulate depth
      */}
      <header className="fixed top-0 left-0 right-0 md:left-64 h-20 md:h-24 z-40 px-4 md:px-8 flex items-center justify-between gap-4 transition-all duration-500">
        
        {/* Liquid Glass Background Layer */}
        {/* <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-transparent backdrop-blur-2xl backdrop-saturate-150 border-b border-white/[0.08] pointer-events-none" /> */}

        {/* --- Left / Center: Search Bar --- */}
        <div className="relative flex-1 flex items-center justify-start max-w-2xl min-w-0 z-10">
          <AnimatePresence mode="wait">
            {!isSearchPage && (
              <motion.div
                initial={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.95, filter: 'blur(5px)' }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => navigate('/search')}
                className="w-full group cursor-pointer"
              >
                {/* Search Input "Pill" 
                  - Inner shadow for depth
                  - Subtle top highlight (border-t)
                */}
                <div className="relative overflow-hidden flex items-center space-x-4 bg-white/[0.03] hover:bg-white/[0.08] border-t border-white/[0.1] border-b border-white/[0.02] border-x border-white/[0.05] px-6 py-3.5 rounded-full transition-all duration-300 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.5)] hover:shadow-[0_8px_30px_-10px_rgba(255,255,255,0.1)] active:scale-[0.99]">
                  
                  {/* Subtle Gradient Shine Effect on Hover */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                  <Search className="w-5 h-5 text-zinc-500 group-hover:text-emerald-400 transition-colors duration-300 relative z-10" />
                  
                  <span className="text-base text-zinc-500 font-medium group-hover:text-zinc-200 transition-colors duration-300 relative z-10 truncate tracking-tight">
                    Search your library...
                  </span>

                  {/* Keyboard Shortcut Hint (Optional)
                  <div className="hidden md:flex absolute right-4 items-center gap-1 opacity-0 group-hover:opacity-50 transition-opacity duration-300">
                     <span className="text-[10px] font-mono text-zinc-400 border border-white/10 rounded px-1.5 py-0.5">⌘ K</span>
                  </div> */}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* --- Right: User Profile --- */}
        <div className="relative flex items-center gap-4 shrink-0 z-10">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => navigate('/profile')}
            className="group relative flex items-center gap-3 pl-2 pr-2 md:pr-5 py-1.5 rounded-full bg-black/20 hover:bg-black/40 border border-white/[0.05] hover:border-white/[0.1] transition-all duration-300 shadow-lg backdrop-blur-md"
          >
            {/* Avatar with Glow Ring */}
            <div className="relative">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  className="w-10 h-10 rounded-full object-cover shadow-sm ring-2 ring-transparent group-hover:ring-emerald-500/50 transition-all duration-500"
                  alt="Profile"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center shadow-inner border border-white/5">
                  <User className="w-5 h-5 text-zinc-400" />
                </div>
              )}
              {/* Online/Status Indicator Dot */}
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#121212] rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
            </div>

            {/* Text Info */}
            <div className="hidden sm:flex flex-col items-start text-left">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 group-hover:text-emerald-400 transition-colors duration-300">
                Profile
              </span>
              <div className="flex items-center gap-1">
                {/* <span className="text-sm font-bold text-zinc-200 truncate max-w-[100px] group-hover:text-white transition-colors">
                  {profile?.username || 'Guest'}
                </span> */}
                {/* <ChevronRight className="w-3 h-3 text-zinc-600 group-hover:translate-x-0.5 transition-transform" /> */}
              </div>
            </div>
          </motion.button>
        </div>
      </header>
    </>
  );
};

export default Header;