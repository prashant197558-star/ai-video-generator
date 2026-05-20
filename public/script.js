// Clean up when user refreshes or closes the tab
window.addEventListener("beforeunload", () => {
    navigator.sendBeacon("/api/cleanup")
})

document.getElementById("generateBtn").addEventListener("click", generate)

async function generate() {

    const topic = document.getElementById("topicInput").value.trim()
    const duration = document.getElementById("durationSelect").value

    if (!topic) {
        document.getElementById("topicInput").focus()
        return
    }

    const btn = document.getElementById("generateBtn")
    const progressSection = document.getElementById("progressSection")
    const videoSection = document.getElementById("videoSection")

    // Disable button & show progress
    btn.disabled = true
    btn.textContent = "Generating..."
    videoSection.style.display = "none"
    progressSection.style.display = "block"

    updateProgress(0, "Starting...", "Sending your topic to the AI pipeline...")

    try {
        // Fire the API call — it returns immediately
        await fetch("/api/create-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topic, duration })
        })
    } catch (err) {
        // Ignore — the pipeline runs in the background
    }

    // Poll for progress until complete or error
    const pollInterval = setInterval(async () => {
        try {
            const pRes = await fetch("/api/progress")
            const pData = await pRes.json()
            updateProgress(pData.percent, pData.step, pData.detail)

            // Check if complete
            if (pData.percent >= 100 && pData.videoUrl) {
                clearInterval(pollInterval)

                setTimeout(() => {
                    progressSection.style.display = "none"
                    videoSection.style.display = "block"

                    const video = document.getElementById("videoPlayer")
                    video.src = pData.videoUrl
                    video.load()
                    video.play()

                    btn.disabled = false
                    btn.textContent = "Generate Video"
                }, 800)
            }

            // Check if error
            if (pData.step === "Error") {
                clearInterval(pollInterval)
                progressSection.style.display = "none"
                alert("Video generation failed: " + pData.detail)
                btn.disabled = false
                btn.textContent = "Generate Video"
            }

        } catch (e) { /* ignore network blips */ }
    }, 2000)
}

function updateProgress(percent, label, detail) {
    document.getElementById("progressBar").style.width = percent + "%"
    document.getElementById("progressPercent").textContent = Math.round(percent) + "%"
    document.getElementById("progressLabel").textContent = label
    document.getElementById("progressDetail").textContent = detail || ""
}