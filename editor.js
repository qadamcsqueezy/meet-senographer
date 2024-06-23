document.addEventListener('DOMContentLoaded', function () {
    const editor = document.getElementById('editor');
    const downloadBtn = document.getElementById('downloadBtn');
    const copyBtn = document.getElementById('copyBtn');
    const statusMessage = document.getElementById('statusMessage');

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'populateEditor') {
            editor.value = request.summary;
        }
    });

    downloadBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'download', content: editor.value });
        showStatus('Content downloaded');
    });

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(editor.value).then(() => {
            showStatus('Content copied to clipboard!');
            chrome.runtime.sendMessage({ action: 'saveLastTranscript', content: editor.value });
        });
    });

    function showStatus(message) {
        statusMessage.textContent = message;
        setTimeout(() => {
            statusMessage.textContent = '';
        }, 3000);
    }
});