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
        downloadFile(message.content);
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
            // Create file name if values or provided, use default otherwise
            const fileName = result.meetingTitle && result.meetingStartTimeStamp ? `MeetSenographer/Transcript-${result.meetingTitle} at ${result.meetingStartTimeStamp}.txt` : `MeetSenographer/Transcript.txt`

            // Create an array to store lines of the text file
            const lines = []

            // Iterate through the transcript array and format each entry
            result.transcript.forEach(entry => {
                lines.push(`${entry.personName} (${entry.timeStamp})`)
                lines.push(entry.personTranscript)
                // Add an empty line between entries
                lines.push("")
            })
            lines.push("")
            lines.push("")

            if (result.chatMessages.length > 0) {
                // Iterate through the chat messages array and format each entry
                lines.push("---------------")
                lines.push("CHAT MESSAGES")
                lines.push("---------------")
                result.chatMessages.forEach(entry => {
                    lines.push(`${entry.personName} (${entry.timeStamp})`)
                    lines.push(entry.chatMessageText)
                    // Add an empty line between entries
                    lines.push("")
                })
                lines.push("")
                lines.push("")
            }
            const onlyTranscript = lines.join("\n").replace(/You \(/g, result.userName + " (");
            // Add branding
            lines.push("---------------")
            lines.push("Summary:")


            // Join the lines into a single string, replace "You" with userName from storage
            const textContent = lines.join("\n").replace(/You \(/g, result.userName + " (")
            const summary = await fetchSummary(onlyTranscript);
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                chrome.windows.create({
                    url: chrome.runtime.getURL("editor.html"),
                    type: "popup",
                    width: 800,
                    height: 600
                }, function (window) {
                    // Wait for the popup to load, then send the summary
                    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                        if (info.status === 'complete' && tabId === window.tabs[0].id) {
                            chrome.tabs.sendMessage(tabId, { action: 'populateEditor', summary: textContent + "\n\n" + summary });
                            chrome.tabs.onUpdated.removeListener(listener);
                        }
                    });
                });
            });
            // chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            //     chrome.tabs.sendMessage(tabs[0].id, {
            //         action: 'showModal',
            //         content: textContent + "\n\n" + summary
            //     });
            // });
            // chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            //     chrome.windows.create({
            //         url: chrome.runtime.getURL("editor.html"),
            //         type: "popup",
            //         width: 800,
            //         height: 600
            //     }, function (window) {
            //         // Wait for the popup to load, then send the summary
            //         chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            //             if (info.status === 'complete' && tabId === window.tabs[0].id) {
            //                 chrome.tabs.sendMessage(tabId, { action: 'populateEditor', summary: textContent + "\n\n" + summary });
            //                 chrome.tabs.onUpdated.removeListener(listener);
            //             }
            //         });
            //     });
            // });
            // Create a blob containing the text content
            // const blob = new Blob([textContent + "\n" + data], { type: "text/plain" })

            // // Read the blob as a data URL
            // const reader = new FileReader()

            // // Download once blob is read
            // reader.onload = function (event) {
            //     const dataUrl = event.target.result

            //     // Create a download with Chrome Download API
            //     chrome.downloads.download({
            //         url: dataUrl,
            //         filename: fileName,
            //         conflictAction: "uniquify"
            //     }).then(() => {
            //         console.log("Transcript downloaded to MeetSenographer directory")
            //     }).catch((error) => {
            //         console.log(error)
            //         chrome.downloads.download({
            //             url: dataUrl,
            //             filename: "MeetSenographer/Transcript.txt",
            //             conflictAction: "uniquify"
            //         })
            //         console.log("Invalid file name. Transcript downloaded to MeetSenographer directory with simple file name.")
            //     })
            // }

            // // Read the blob and download as text file
            // reader.readAsDataURL(blob)
        }
        else
            console.log("No transcript found")
    })
}
function downloadFile(content) {

    const blob = new Blob([content], { type: "text/plain" });
    const reader = new FileReader();

    // Download once blob is read
    reader.onload = function (event) {
        const dataUrl = event.target.result

        // Create a download with Chrome Download API
        chrome.downloads.download({
            url: dataUrl,
            filename: "Transcript.txt",
            conflictAction: "uniquify"
        }).then(() => {
            console.log("Transcript downloaded to MeetSenographer directory")
        }).catch((error) => {
            console.log(error)
            chrome.downloads.download({
                url: dataUrl,
                filename: "MeetSenographer/Transcript.txt",
                conflictAction: "uniquify"
            })
            console.log("Invalid file name. Transcript downloaded to MeetSenographer directory with simple file name.")
        })
    }

    // Read the blob and download as text file
    reader.readAsDataURL(blob);
}