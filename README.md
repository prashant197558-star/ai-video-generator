# 🎬 AI Explainer Video Generator

An AI-powered web application that automatically generates full explainer videos with narration, stock footage, and subtitles — just enter a topic!

## ✨ Features

- **AI Script Generation** — Uses Groq (LLaMA 3.3 70B) to create a 25-scene educational script
- **Text-to-Speech** — Converts the script to natural voice narration via Google TTS
- **Smart Stock Footage** — AI generates keywords per scene and fetches matching videos from Pexels
- **Auto Video Editing** — Downloads, normalizes, trims, and merges 25 clips using FFmpeg
- **Synced Subtitles** — Generates and burns SRT subtitles into the final video
- **Real-time Progress Bar** — Live progress tracking from 0% to 100%
- **Auto Cleanup** — Deletes all temp files during generation; wipes final video on page refresh to save storage

## 🛠 Tech Stack

- **Backend:** Node.js, Express
- **AI:** Groq API (LLaMA 3.3 70B)
- **TTS:** Google Text-to-Speech (gTTS)
- **Video:** FFmpeg (via fluent-ffmpeg)
- **Stock Footage:** Pexels API
- **Frontend:** Vanilla HTML/CSS/JS

## 🚀 Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/ai-video-generator.git
cd ai-video-generator
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy the example env file and add your API keys:

```bash
cp .env.example .env
```

Edit `.env` with your keys:

```
PORT=3000
GROQ_API_KEY=your_groq_api_key
PEXELS_API_KEY=your_pexels_api_key
```

**Get your API keys:**
- Groq API Key → [console.groq.com](https://console.groq.com)
- Pexels API Key → [pexels.com/api](https://www.pexels.com/api/)

### 4. Run the server

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## ☁️ Deploy on Render (Free)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. Add Environment Variables in the Render dashboard:
   - `GROQ_API_KEY`
   - `PEXELS_API_KEY`
6. Click **Deploy** 🚀

## 📁 Project Structure

```
├── server.js          # Express server + video pipeline
├── public/
│   ├── index.html     # Frontend UI
│   ├── style.css      # Styling
│   └── script.js      # Frontend logic + progress polling
├── package.json
├── .env.example       # Required env vars template
├── .gitignore
└── README.md
```

## ⚙️ How It Works

1. User enters a topic → hits Generate
2. AI generates a 25-scene script
3. Script is converted to speech (TTS)
4. AI extracts visual keywords per scene
5. Stock videos are fetched from Pexels for each keyword
6. Each clip is downloaded → normalized (1280x720) → trimmed to scene duration
7. All clips are merged into one video
8. Voice narration is overlaid
9. Subtitles are generated and burned in
10. Final video is served to the user
11. All temp files are deleted — only the final video remains
12. On page refresh/close, the final video is also deleted

## 📝 License

MIT
