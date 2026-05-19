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

    // Start polling for progress
    const pollInterval = setInterval(async () => {
        try {
            const pRes = await fetch("/api/progress")
            const pData = await pRes.json()
            updateProgress(pData.percent, pData.step, pData.detail)
        } catch (e) { /* ignore */ }
    }, 1000)

    try {
        const res = await fetch("/api/create-video", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ topic, duration })
        })

        const data = await res.json()

        clearInterval(pollInterval)

        if (data.success) {

            updateProgress(100, "Complete!", "Your video is ready to watch.")

            setTimeout(() => {
                progressSection.style.display = "none"
                videoSection.style.display = "block"

                const video = document.getElementById("videoPlayer")
                video.src = data.video
                video.load()
                video.play()
            }, 600)

        } else {
            progressSection.style.display = "none"
            alert("Video generation failed. Check the server console for details.")
        }

    } catch (err) {
        clearInterval(pollInterval)
        progressSection.style.display = "none"
        alert("Error: " + err.message)
    }

    btn.disabled = false
    btn.textContent = "Generate Video"
}

function updateProgress(percent, label, detail) {
    document.getElementById("progressBar").style.width = percent + "%"
    document.getElementById("progressPercent").textContent = Math.round(percent) + "%"
    document.getElementById("progressLabel").textContent = label
    document.getElementById("progressDetail").textContent = detail || ""
}