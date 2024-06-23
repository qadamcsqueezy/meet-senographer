// modal.js
function createModal(content) {
    const modal = document.createElement('div');
    modal.innerHTML = `
      <div id="meetSenographer-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 10000;">
        <div style="background-color: white; padding: 20px; border-radius: 10px; width: 80%; max-width: 800px; max-height: 80%; overflow-y: auto;">
          <h2>Edit Summary</h2>
          <textarea id="editor" style="width: 100%; height: 300px; margin-bottom: 20px;"></textarea>
          <div>
            <button id="downloadBtn">Download</button>
            <button id="copyBtn">Copy</button>
            <button id="closeBtn">Close</button>
          </div>
          <div id="statusMessage" style="margin-top: 10px; color: green;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const editor = document.getElementById('editor');
    const statusMessage = document.getElementById('statusMessage');
    editor.value = content;

    document.getElementById('downloadBtn').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'download', content: editor.value });
        showStatus('Content downloaded');
    });

    document.getElementById('copyBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(editor.value).then(() => {
            showStatus('Content copied to clipboard!');
            chrome.runtime.sendMessage({ action: 'saveLastTranscript', content: editor.value });
        });
    });

    document.getElementById('closeBtn').addEventListener('click', closeModal);

    // Prevent closing the modal when clicking inside it
    modal.querySelector('div > div').addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Only allow closing the modal by clicking the close button
    document.getElementById('closeBtn').addEventListener('click', closeModal);
}

function showStatus(message) {
    const statusMessage = document.getElementById('statusMessage');
    statusMessage.textContent = message;
    setTimeout(() => {
        statusMessage.textContent = '';
    }, 3000);
}

function closeModal() {
    const modal = document.getElementById('meetSenographer-modal');
    if (modal) {
        modal.remove();
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showModal') {
        createModal(request.content);
    }
});