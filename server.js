require("dotenv").config()

const express = require("express")
const cors = require("cors")
const fetch = (...args)=>import("node-fetch").then(({default:fetch})=>fetch(...args))
const fs = require("fs")
const path = require("path")
const gTTS = require("gtts")

const ffmpeg = require("fluent-ffmpeg")
const ffmpegPath = require("ffmpeg-static")
const ffprobePath = require("ffprobe-static").path

ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static("public"))

const PORT = process.env.PORT || 3000

if(!fs.existsSync("tmp")) fs.mkdirSync("tmp")

/* ---------------- CLEANUP UTILITIES ---------------- */

// Delete a single file safely
function safeDelete(filePath) {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
            console.log("[CLEANUP] Deleted:", filePath)
        }
    } catch (e) {
        console.warn("[CLEANUP] Could not delete:", filePath, e.message)
    }
}

// Wipe ALL files inside tmp/
function cleanTmp() {
    try {
        const files = fs.readdirSync("tmp")
        for (const file of files) {
            const full = path.join("tmp", file)
            if (fs.statSync(full).isFile()) {
                fs.unlinkSync(full)
            }
        }
        console.log(`[CLEANUP] Wiped tmp/ (${files.length} files removed)`)
    } catch (e) {
        console.warn("[CLEANUP] tmp wipe error:", e.message)
    }
}

// Clean on startup — remove any leftover files from previous runs
cleanTmp()

// Track the current final video so we can delete it on page unload
let currentFinalVideo = null

/* ---------------- PROGRESS TRACKING ---------------- */
let progress = { percent: 0, step: "Idle", detail: "", videoUrl: null }

function setProgress(percent, step, detail, videoUrl) {
    progress = { percent, step, detail: detail || "", videoUrl: videoUrl || progress.videoUrl }
    console.log(`[PROGRESS ${percent}%] ${step} — ${detail || ""}`) 
}

app.get("/api/progress", (req, res) => {
    res.json(progress)
})

/* --- CLEANUP ENDPOINT: called when user refreshes/closes tab --- */
app.post("/api/cleanup", (req, res) => {
    console.log("[CLEANUP] User left — wiping tmp/")
    cleanTmp()
    currentFinalVideo = null
    progress = { percent: 0, step: "Idle", detail: "" }
    res.json({ cleaned: true })
})

/* ---------------- SCRIPT GENERATION ---------------- */
async function generateScript(topic){

    const res = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            method:"POST",
            headers:{
                Authorization:`Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type":"application/json"
            },
            body:JSON.stringify({
                model:"llama-3.3-70b-versatile",
                messages:[
                    {
                        role:"user",
                        content:`Create a detailed educational explanation about ${topic}.

Divide it into 25 scenes.

Each scene must start with "Scene X:" and contain 2 short narration sentences.`
                    }
                ]
            })
        })

    const data = await res.json()

    return data.choices[0].message.content

}
/* ---------------- AI KEYWORD GENERATOR ---------------- */
/* ---------------- AI KEYWORD GENERATOR ---------------- */

async function generateKeywords(script){

    const res = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            method:"POST",
            headers:{
                "Authorization":`Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type":"application/json"
            },
            body:JSON.stringify({
                model:"llama-3.3-70b-versatile",
                messages:[
                    {
                        role:"user",
                        content:`Extract 5 short visual search keywords from this narration.

Example:
"Photosynthesis happens in plants using sunlight"

Output:
plant sunlight leaf photosynthesis nature

Text:
${script}`
                    }
                ],
                temperature:0.2,
                max_tokens:50
            })
        })

    const data = await res.json()

    return data.choices[0].message.content.trim()
}
/* ---------------- SCENE KEYWORD GENERATOR ---------------- */

async function generateSceneKeywords(scenes){

    const res = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            method:"POST",
            headers:{
                "Authorization":`Bearer ${process.env.GROQ_API_KEY}`,
                "Content-Type":"application/json"
            },
            body:JSON.stringify({
                model:"llama-3.3-70b-versatile",
                messages:[
                    {
                        role:"user",
                        content:`For each scene below generate ONE short visual keyword for stock footage search.

Return ONLY keywords line by line.

Scenes:
${scenes.join("\n")}`
                    }
                ],
                temperature:0.2,
                max_tokens:200
            })
        })

    const data = await res.json()

    return data.choices[0].message.content
        .split("\n")
        .map(k=>k.trim())
        .filter(k=>k)
}


/* ---------------- SPLIT SCENES ---------------- */

function splitScenes(script){

    const parts = script.split("Scene")

    return parts
        .map(s=>"Scene"+s)
        .filter(s=>s.length>20)

}
/* ---------------- CLEAN SCRIPT FOR NARRATION ---------------- */

function cleanScript(script){

    return script
        .replace(/Scene\s*\d+\s*:/gi,"")   // remove Scene 1:
        .replace(/\n/g," ")               // remove line breaks
        .replace(/\s+/g," ")              // clean extra spaces
        .trim()

}

/* ---------------- VOICE ---------------- */

function generateVoice(script){

    return new Promise((resolve,reject)=>{

        const file = `tmp/voice_${Date.now()}.mp3`

        const gtts = new gTTS(script,"en")

        gtts.save(file,(err)=>{
            if(err) reject(err)
            else resolve(file)
        })

    })
}

/* ---------------- PEXELS VIDEO ---------------- */

async function getPexelsVideo(topic){

    const res = await fetch(
        `https://api.pexels.com/videos/search?query=${topic}&per_page=30`,
        {
            headers:{
                Authorization:process.env.PEXELS_API_KEY
            }
        })

    const data = await res.json()

    return data.videos
}

/* ---------------- DOWNLOAD VIDEO ---------------- */

async function downloadVideo(url,file){

    const res = await fetch(url)

    const buffer = await res.arrayBuffer()

    fs.writeFileSync(file,Buffer.from(buffer))

}

/* ---------------- NORMALIZE VIDEO ---------------- */

function normalizeVideo(input,output){

    return new Promise((resolve,reject)=>{

        ffmpeg(input)
            .outputOptions([
                "-vf scale=1280:720",
                "-r 30",
                "-c:v libx264",
                "-preset veryfast",
                "-pix_fmt yuv420p"
            ])
            .on("end",()=>resolve(output))
            .on("error",reject)
            .save(output)

    })

}
/* ---------------- TRIM VIDEO ---------------- */

function trimVideo(input,output,duration){

    return new Promise((resolve,reject)=>{

        ffmpeg(input)
            .setStartTime(0)
            .setDuration(duration)
            .outputOptions([
                "-c:v libx264",
                "-preset veryfast",
                "-pix_fmt yuv420p"
            ])
            .on("end",()=>resolve(output))
            .on("error",reject)
            .save(output)

    })

}

/* ---------------- MERGE MANY VIDEOS ---------------- */

function mergeVideos(videoList,output){

    return new Promise((resolve,reject)=>{

        const fileList = `tmp/list_${Date.now()}.txt`

        let txt=""

        videoList.forEach(v=>{
            txt += `file '${path.resolve(v)}'\n`
        })

        fs.writeFileSync(fileList,txt)

        ffmpeg()
            .input(fileList)
            .inputOptions([
                "-f concat",
                "-safe 0"
            ])
            .outputOptions([
                "-c:v libx264",
                "-preset veryfast",
                "-crf 23",
                "-pix_fmt yuv420p"
            ])
            .on("end",()=>resolve(output))
            .on("error",reject)
            .save(output)

    })

}

/* ---------------- MERGE VIDEO + AUDIO ---------------- */

function mergeVideoAudio(video,audio,output){

    return new Promise((resolve,reject)=>{

        ffmpeg()
            .input(video)
            .input(audio)
            .outputOptions([
                "-map 0:v:0",
                "-map 1:a:0",
                "-c:v copy",
                "-c:a aac",
                "-shortest"
            ])
            .on("end",()=>resolve(output))
            .on("error",reject)
            .save(output)

    })

}
/* ---------------- GENERATE SYNCED SUBTITLES ---------------- */

async function generateSRT(script, audioDuration){

    const sentences = script.split(".").filter(s => s.trim())

    const perLine = audioDuration / sentences.length

    let time = 0
    let srt = ""

    sentences.forEach((line,index)=>{

        const start = new Date(time*1000).toISOString().substr(11,8)+",000"

        time += perLine

        const end = new Date(time*1000).toISOString().substr(11,8)+",000"

        srt += `${index+1}\n`
        srt += `${start} --> ${end}\n`
        srt += `${line.trim()}\n\n`

    })

    const file = `tmp/subtitles_${Date.now()}.srt`

    fs.writeFileSync(file,srt)

    return file
}
/* ---------------- BURN SUBTITLES ---------------- */

function addSubtitles(video,subtitles,output){

    return new Promise((resolve,reject)=>{

        // Use absolute path and escape backslashes for Linux/Windows compat
        const absSubPath = path.resolve(subtitles).replace(/\\/g, '/').replace(/:/g, '\\:')

        ffmpeg(video)
            .outputOptions([
                `-vf`, `subtitles='${absSubPath}'`
            ])
            .on("end",()=>resolve(output))
            .on("error",reject)
            .save(output)

    })
}
/* ---------------- GET AUDIO DURATION ---------------- */

function getAudioDuration(file){

    return new Promise((resolve,reject)=>{

        ffmpeg.ffprobe(file,(err,data)=>{

            if(err) reject(err)

            resolve(data.format.duration)

        })

    })

}

/* ---------------- API ---------------- */

app.post("/api/create-video", (req,res)=> {

    const {topic} = req.body

    if (!topic) {
        return res.status(400).json({ success: false, error: "No topic provided" })
    }

    // Respond IMMEDIATELY so Render doesn't timeout
    res.json({ success: true, started: true })

    // Run the pipeline in the background
    runPipeline(topic)
})

async function runPipeline(topic) {

    // Clean any previous session files before starting
    cleanTmp()
    currentFinalVideo = null
    progress.videoUrl = null

    // Collect all temp file paths so we can delete them later
    const tempFiles = []

    try {

        setProgress(2, "Generating Script", `Creating a 25-scene script about "${topic}"...`)

        const script = await generateScript(topic)

        console.log(script)

        setProgress(8, "Splitting Scenes", "Parsing the script into individual scenes...")

        const scenes = splitScenes(script)

        console.log("Scenes:", scenes.length)

        setProgress(12, "Generating Keywords", "AI is extracting visual keywords for each scene...")

        const sceneKeywords = await generateSceneKeywords(scenes)

        console.log("Scene Keywords:", sceneKeywords)

        setProgress(18, "Generating Voice", "Converting script to speech narration...")

        const narrationText = cleanScript(script)

        const voice = await generateVoice(narrationText)
        tempFiles.push(voice)

        console.log("Voice:", voice)

        setProgress(22, "Analyzing Audio", "Measuring narration duration...")

        const audioDuration = await getAudioDuration(voice)

        const sceneDuration = audioDuration / scenes.length

        console.log("Total narration duration:", audioDuration)
        console.log("Scene duration:", sceneDuration)

        setProgress(25, "AI Keywords", "Generating search keywords for stock footage...")

        const keywords = await generateKeywords(script)

        console.log("AI Keywords:", keywords)

        let videoFiles = []
        let usedVideos = new Set()

        // Clips take 25% → 80% of total progress
        const clipStartPct = 28
        const clipEndPct = 80

        for (let i = 0; i < scenes.length; i++) {

            const pct = clipStartPct + ((clipEndPct - clipStartPct) * i / scenes.length)

            setProgress(Math.round(pct), `Processing Clip ${i + 1}/${scenes.length}`, `Downloading & processing scene ${i + 1}...`)

            const keyword = sceneKeywords[i] || topic

            console.log("Searching video for:", keyword)

            const pexelsVideos = await getPexelsVideo(keyword)

            let clip

            do{
                clip = pexelsVideos[Math.floor(Math.random()*pexelsVideos.length)]
            }
            while(usedVideos.has(clip.id) && usedVideos.size < pexelsVideos.length)

            usedVideos.add(clip.id)

            const videoFile = clip.video_files.find(v => v.quality === "sd")

            const url = videoFile ? videoFile.link : clip.video_files[0].link

            const rawFile = `tmp/raw_${i}.mp4`
            const normalizedFile = `tmp/clip_${i}.mp4`
            const trimmedFile = `tmp/trim_${i}.mp4`

            tempFiles.push(rawFile, normalizedFile, trimmedFile)

            await downloadVideo(url, rawFile)

            // Delete raw immediately after normalizing
            await normalizeVideo(rawFile, normalizedFile)
            safeDelete(rawFile)

            // Delete normalized immediately after trimming
            await trimVideo(normalizedFile, trimmedFile, sceneDuration)
            safeDelete(normalizedFile)

            videoFiles.push(trimmedFile)

        }

        setProgress(82, "Merging Clips", "Joining all video clips together...")

        const mergedVideo = `tmp/merged_${Date.now()}.mp4`
        tempFiles.push(mergedVideo)

        await mergeVideos(videoFiles, mergedVideo)

        // Delete all trimmed clips after merge
        videoFiles.forEach(f => safeDelete(f))

        setProgress(88, "Adding Narration", "Overlaying voice narration onto video...")

        const narratedVideo = `tmp/narrated_${Date.now()}.mp4`
        tempFiles.push(narratedVideo)

        await mergeVideoAudio(mergedVideo, voice, narratedVideo)

        // Delete merged video and voice after narration
        safeDelete(mergedVideo)
        safeDelete(voice)

        setProgress(92, "Generating Subtitles", "Creating synced subtitle file...")

        const subtitleFile = await generateSRT(narrationText, audioDuration)
        tempFiles.push(subtitleFile)

        setProgress(95, "Burning Subtitles", "Embedding subtitles into video...")

        const finalVideo = `tmp/final_${Date.now()}.mp4`

        await addSubtitles(narratedVideo, subtitleFile, finalVideo)

        // Delete narrated video and subtitle file — only final remains
        safeDelete(narratedVideo)
        safeDelete(subtitleFile)

        // Also delete any leftover list_*.txt files
        try {
            fs.readdirSync("tmp").forEach(f => {
                if (f.startsWith("list_")) safeDelete(path.join("tmp", f))
            })
        } catch(e) {}

        currentFinalVideo = finalVideo
        const videoUrl = `/video/${path.basename(finalVideo)}`

        setProgress(100, "Complete!", "Your video is ready.", videoUrl)

        console.log("Done:", finalVideo)
        console.log("[CLEANUP] All intermediate files deleted. Only final video remains.")

    } catch (err) {

        console.error("ERROR:", err)

        setProgress(0, "Error", err.message || "Something went wrong.")

        // On error, clean everything
        cleanTmp()

    }

}



app.use("/video",express.static("tmp"))

app.listen(PORT,()=>{
    console.log("Server running on",PORT)
})