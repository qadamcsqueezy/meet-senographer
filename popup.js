window.onload = function () {
  const lastMeetingTranscriptLink = document.querySelector("#last-meeting-transcript")


  // chrome.storage.sync.get(["operationMode"], function (result) {
  //   if (result.operationMode == undefined)
  //     autoModeRadio.checked = true
  //   else if (result.operationMode == "auto")
  //     autoModeRadio.checked = true
  //   else if (result.operationMode == "manual")
  //     manualModeRadio.checked = true
  // })

  // autoModeRadio.addEventListener("change", function () {
  //   chrome.storage.sync.set({ operationMode: "auto" }, function () { })
  // })
  // manualModeRadio.addEventListener("change", function () {
  //   chrome.storage.sync.set({ operationMode: "manual" }, function () { })
  // })
  lastMeetingTranscriptLink.addEventListener("click", () => {
    chrome.storage.local.get(["transcript"], function (result) {
      if (result.transcript)
        chrome.runtime.sendMessage({ action: "open_editor" }, function (response) {
          console.log(response)
        })
      else
        alert("Couldn't find the last meeting's transcript. May be attend one?")
    })
  })

  const defaultPromptInput = document.querySelector('#default-prompt');
  const groqApiKeyInput = document.querySelector('#groq-api-key');
  const saveSettingsButton = document.querySelector('#save-settings');

  // Load saved settings
  chrome.storage.sync.get(['defaultPrompt', 'groqApiKey'], function (result) {
    defaultPromptInput.value = result.defaultPrompt || 'Summarize the key points from the daily meeting about concerning Dabastore(A delivery platform for the future of retailers). Include important decisions, action items, and any unresolved questions. Here is the transcription:';
    groqApiKeyInput.value = result.groqApiKey || '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';
  });
  // Save settings
  saveSettingsButton.addEventListener('click', function () {
    chrome.storage.sync.set({
      defaultPrompt: defaultPromptInput.value,
      groqApiKey: groqApiKeyInput.value
    }, function () {
      showStatus('Settings saved!');
    });
  });
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });
  document.getElementById('download-last-transcript').addEventListener('click', function () {
    chrome.runtime.sendMessage({ action: 'getLastTranscript' }, function (response) {
      if (response.transcript) {
        chrome.runtime.sendMessage({
          action: 'download',
          content: response.transcript,
          filename: response.title ? response.title + " Last_Transcript.txt" : 'TranscripTonic/Last_Full_Transcript.txt'
        });
      } else {
        alert('No recent transcript available.');
      }
    });
  });

  document.getElementById('download-last-summary').addEventListener('click', function () {
    chrome.runtime.sendMessage({ action: 'getLastSummary', }, function (response) {
      if (response.summary) {
        chrome.runtime.sendMessage({
          action: 'download',
          content: response.summary,
          filename: response.title ? response.title + " Last_Summary.txt" : 'TranscripTonic/Last_Summary.txt'
        });
      } else {
        alert('No recent summary available.');
      }
    });
  });
}
function showStatus(message) {
  const statusMessage = document.querySelector('#status-message');
  statusMessage.textContent = message;
  statusMessage.classList.add('show');
  setTimeout(() => {
    statusMessage.classList.remove('show');
  }, 3000);
}