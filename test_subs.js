const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

const videoFile = 'test_vid.mp4';
const subFile = 'test_sub.srt';
const outputFile = 'test_out.mp4';

// Create dummy video and sub
fs.writeFileSync(subFile, "1\n00:00:00,000 --> 00:00:02,000\nHello World");

// Create dummy video
ffmpeg()
    .input('color=c=black:s=1280x720:r=30')
    .inputFormat('lavfi')
    .duration(2)
    .save(videoFile)
    .on('end', () => {
        console.log("Dummy video created. Burning subs...");
        const absSubPath = path.resolve(subFile).replace(/\\/g, '/').replace(/:/g, '\\:');
        
        ffmpeg(videoFile)
            .outputOptions([
                `-vf`, `subtitles=${absSubPath}`,
                "-c:v libx264",
                "-preset ultrafast"
            ])
            .on("stderr", (line) => console.log(line))
            .on("end", () => console.log("Done!"))
            .on("error", (err) => console.error("Error:", err))
            .save(outputFile);
    });
