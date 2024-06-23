chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    console.log(message.type)
    if (message.type == "new_meeting_started") {
        // Saving current tab id, to download transcript when this tab is closed
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            const tabId = tabs[0].id
            chrome.storage.local.set({ meetingTabId: tabId }, function () {
                console.log("Meeting tab id saved")
            })
        })
    }
    if (message.action === 'download') {
        downloadFile(message.content, message.filename);
    } else if (message.action === 'getLastTranscript') {
        chrome.storage.local.get(['lastTranscript'], async function (result) {
            sendResponse({ transcript: result.lastTranscript, title: await chrome.storage.local.get(['lastTitle']) });
        });
        return true;
    } else if (message.action === 'getLastSummary') {
        chrome.storage.local.get(['lastSummary'], async function (result) {
            sendResponse({ summary: result.lastSummary, title: await chrome.storage.local.get(['lastTitle']) });
        });
        return true;
    } else if (message.action === 'saveLastTranscript') {
        chrome.storage.local.set({ lastTranscript: message.content });
    }
    if (message.type == "download") {
        // Invalidate tab id since transcript is downloaded, prevents double downloading of transcript from tab closed event listener
        chrome.storage.local.set({ meetingTabId: null }, function () {
            console.log("Meeting tab id cleared")
        })
        downloadTranscript()
    }
    return true
})
// Add this message listener for content script messages


// Download transcript if meeting tab is closed
chrome.tabs.onRemoved.addListener(function (tabid) {
    chrome.storage.local.get(["meetingTabId"], function (data) {
        if (tabid == data.meetingTabId) {
            console.log("Successfully intercepted tab close")
            downloadTranscript()
            // Clearing meetingTabId to prevent misfires of onRemoved until next meeting actually starts
            chrome.storage.local.set({ meetingTabId: null }, function () {
                console.log("Meeting tab id cleared for next meeting")
            })
        }
    })
})
async function fetchData(text) {
    const url = 'https://integrate.api.nvidia.com/v1/chat/completions';
    const apiKey = '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';  // Securely store and retrieve your API key
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };
    const body = JSON.stringify({
        model: "microsoft/phi-3-mini-128k-instruct",
        messages: [{
            role: "user", content: `Summarize the key points from the daily meeting about concerning Dabastore(A delivery platform for the future of retailers). Include important decisions, action items, and any unresolved questions. Here is the transcription:\n\n${text}\n`
        }],
        temperature: 0.2,
        top_p: 0.7,
        max_tokens: 1024,
        stream: true
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: body
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        } else {
            const data = await response.json();
            console.log(data);
            return data;
        }
    } catch (error) {
        console.error('Error fetching data: ', error);
        return
    }
}
async function fetchSummary(text) {
    const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';

    // Get the GROQ API key from storage
    const { groqApiKey } = await chrome.storage.sync.get(['groqApiKey']);
    const groqApiKeyToUse = groqApiKey || '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'; // Use stored key or fallback to default
    const { defaultPrompt } = await chrome.storage.sync.get(['defaultPrompt']);
    const promptToUse = defaultPrompt || `Summarize the key points from the daily meeting about Dabastore project (delivery platform), Include important decisions, action items, and any unresolved questions. Here is the transcription:\n\n`;


    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKeyToUse}`
    };
    const requestBody = {
        messages: [
            {
                role: "user",
                content: `${promptToUse} ${text}`,
            }
        ],
        model: "llama3-70b-8192",
        temperature: 1,
        max_tokens: 1024,
        top_p: 1,
        stream: false,
        stop: null
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content;
    } catch (error) {
        console.error('Error fetching data: ', error);
        return null;
    }
}

// Call the function to execute the fetch request

// Call the function to execute the fetch request
async function downloadTranscript() {
    chrome.storage.local.get(["userName", "transcript", "chatMessages", "meetingTitle", "meetingStartTimeStamp"], async function (result) {
        if (result.userName && result.transcript && result.chatMessages) {
            const fileName = result.meetingTitle && result.meetingStartTimeStamp ? `${result.meetingTitle} at ${result.meetingStartTimeStamp}` : `TranscripTonic/Meeting`
            const lines = []
            result.transcript.forEach(entry => {
                lines.push(`${entry.personName} (${entry.timeStamp})`)
                lines.push(entry.personTranscript)
                lines.push("")
            })
            lines.push("")
            lines.push("")
            if (result.chatMessages.length > 0) {
                lines.push("---------------")
                lines.push("CHAT MESSAGES")
                lines.push("---------------")
                result.chatMessages.forEach(entry => {
                    lines.push(`${entry.personName} (${entry.timeStamp})`)
                    lines.push(entry.chatMessageText)
                    lines.push("")
                })
                lines.push("")
                lines.push("")
            }
            const onlyTranscript = lines.join("\n").replace(/You \(/g, result.userName + " (");
            lines.push("---------------")
            const textContent = lines.join("\n").replace(/You \(/g, result.userName + " (")
            const summary = await fetchSummary(onlyTranscript);

            chrome.storage.local.set({ lastTranscript: textContent, lastSummary: summary, lastTitle: fileName }, function () {
                console.log("Last transcript and summary saved");
            });

            chrome.windows.create({
                url: chrome.runtime.getURL("editor.html"),
                type: "popup",
                width: 600,
                height: 400,
                top: 50,
                left: 50
            }, function (window) {
                chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                    if (info.status === 'complete' && tabId === window.tabs[0].id) {
                        chrome.tabs.sendMessage(tabId, { action: 'populateEditor', summary: summary, fullTranscript: textContent, title: fileName });
                        chrome.tabs.onUpdated.removeListener(listener);
                    }
                });
            });
        } else {
            console.log("No transcript found")
        }
    });
}
function downloadFile(content, fileName) {

    const blob = new Blob([content], { type: "text/plain" });
    const reader = new FileReader();
    // Download once blob is read
    reader.onload = function (event) {
        const dataUrl = event.target.result

        // Create a download with Chrome Download API
        chrome.downloads.download({
            url: dataUrl,
            filename: fileName,
            conflictAction: "uniquify"
        }).then(() => {
            console.log("Transcript downloaded to MeetSenographer directory")
        }).catch((error) => {
            console.log(error)
            chrome.downloads.download({
                url: dataUrl,
                filename: fileName ?? "MeetSenographer/Transcript.txt",
                conflictAction: "uniquify"
            })
            console.log("Invalid file name. Transcript downloaded to MeetSenographer directory with simple file name.")
        })
    }

    // Read the blob and download as text file
    reader.readAsDataURL(blob);
}



