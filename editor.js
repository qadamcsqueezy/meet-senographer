document.addEventListener('DOMContentLoaded', function () {
    const editor = document.getElementById('editor');
    const copyBtn = document.getElementById('copyBtn');
    const saveSummaryBtn = document.getElementById('saveSummaryBtn');
    const downloadFullBtn = document.getElementById('downloadFullBtn');
    const statusMessage = document.getElementById('statusMessage');
    let fullTranscript = '';
    let title = '';
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'populateEditor') {
            editor.value = request.summary;
            fullTranscript = request.fullTranscript;
            title = request.title;

        }
    });

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(editor.value).then(() => {
            showStatus('Summary copied to clipboard!');
        });
    });

    saveSummaryBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({
            action: 'download',
            content: editor.value,
            filename: title ? title + " Summary.txt" : 'TranscripTonic/Summary.txt'
        });
        showStatus('Summary saved');
    });

    downloadFullBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({
            action: 'download',
            content: fullTranscript,
            filename: title ? title + " Transcript.txt" : 'TranscripTonic/Transcript.txt'
        });
        showStatus('Full transcript downloaded');
    });

    function showStatus(message) {
        statusMessage.textContent = message;
        setTimeout(() => {
            statusMessage.textContent = '';
        }, 3000);
    }
});