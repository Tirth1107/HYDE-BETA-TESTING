# 🎧 Hyde Music

Hyde Music is a **free and open-source music streaming web application** that allows users to discover, organize, and play music with a modern interface and cloud synchronization.

It provides a clean, ad-free music experience with playlist management and account-based syncing across devices.

🌐 Live App  
https://hydemusic.vercel.app

---

# ✨ Features

• 🎵 Search and play music instantly  
• 🔐 User authentication (Google + Email)  
• ☁️ Cloud-synced playlists  
• ❤️ Liked songs auto playlist  
• 🕒 Recently played tracking  
• 📱 Mobile and desktop responsive UI  
• ⚡ Fast search suggestions  
• 🚫 No ads  
• 🧩 Fully open-source  

---

# 🧠 How It Works

Hyde Music acts as a **modern interface for discovering and organizing music**.

The system architecture includes:

### Frontend
- React
- TypeScript
- Vite
- TailwindCSS

### Backend
- Python API
- yt-dlp for music search
- Proxy system for search suggestions

### Authentication & Database
- Supabase Auth
- Supabase PostgreSQL

### Playback
Music playback is handled using a **hidden YouTube iframe player** controlled by a custom UI.

---

# 🏗 Architecture

```
User
  ↓
React Frontend
  ↓
Supabase (Auth + Database)
  ↓
Backend API
  ↓
yt-dlp → YouTube Search
  ↓
YouTube IFrame Player
```

---

# 📦 Tech Stack

Frontend  
- React
- Vite
- TypeScript
- TailwindCSS

Backend  
- Python
- yt-dlp

Infrastructure  
- Supabase
- Vercel

---

# 🚀 Running Locally

## 1️⃣ Clone the Repository

```bash
git clone https://github.com/Tirth1107/Hyde-Music.git
cd Hyde-Music
```

## 2️⃣ Install Dependencies

```bash
npm install
```

## 3️⃣ Setup Environment Variables

Create a `.env` file:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_BACKEND_URL=your_backend_api
VITE_HYDE_API_KEY=your_api_key
```

## 4️⃣ Start Development Server

```bash
npm run dev
```

---

# 🔐 Environment Variables

| Variable | Description |
|--------|-------------|
| VITE_SUPABASE_URL | Supabase project URL |
| VITE_SUPABASE_ANON_KEY | Supabase public key |
| VITE_BACKEND_URL | Backend API endpoint |
| VITE_HYDE_API_KEY | API key used for backend validation |

---

# 📂 Database Tables

Hyde Music uses the following Supabase tables:

• `profiles`  
• `playlists`  
• `playlist_tracks`  
• `recently_played`  
• `now_playing`

These tables manage user data, playlists, and playback state.

---

# ⚠ Disclaimer

Hyde Music does **not host any music files**.

All music is streamed from publicly available sources. Hyde Music acts as an interface for discovering and organizing music.

This project is intended for **educational and personal use**.

---

# 🤝 Contributing

Contributions are welcome.

If you'd like to improve Hyde Music:

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

---

# 🌌 Hyde Ecosystem

Hyde Music is part of the **Hyde open-source ecosystem**, a collection of free tools and applications.

Projects include:

• Hyde Music  
• Hyde Browser  
• Hyde Downloader  
• Hyde Security  

---

# 📜 License

This project is licensed under the **MIT License**.

---

# ⭐ Support

If you like this project, consider giving it a **star on GitHub**.

It helps the project grow and reach more developers.

