function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        submitMessage();
    }
}

function submitMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (message) {
        const chatHistory = document.querySelector('.chat-history');
        const newMessage = document.createElement('div');
        newMessage.className = 'chat-message user';
        newMessage.textContent = message;
        chatHistory.appendChild(newMessage);
        const responseMessage = document.createElement('div');
        responseMessage.className = 'chat-message participant';
        responseMessage.textContent = "I see your message";
        chatHistory.appendChild(responseMessage);
        input.value = '';
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
}

function toggleButton(button) {
    button.classList.toggle('active');
    if (button === document.querySelector('.left-buttons button:nth-child(1)')) {
        const microphonePanel = document.getElementById('microphone-panel');
        if (button.classList.contains('active')) {
            microphonePanel.style.display = 'block';
        } else {
            microphonePanel.style.display = 'none';
        }
    } else if (button === document.querySelector('.left-buttons button:nth-child(2)')) {
        const agentPanel = document.getElementById('volume001');
        if (button.classList.contains('active')) {
            agentPanel.style.display = 'block';
        } else {
            agentPanel.style.display = 'none';
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    const resizer = document.querySelector('.resizer');
    if(!resizer) return
    const chatHistory = document.querySelector('.chat-history');
    const chatInput = document.querySelector('.chat-input');
    let isResizing = false;
    resizer.addEventListener('mousedown', function(e) {
        isResizing = true;
        document.body.style.cursor = 'row-resize';
        console.log("resizing")
    });
    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;
        console.log("resizing2")
        const containerHeight = document.querySelector('.container').offsetHeight;
        const newHeight = e.clientY - chatHistory.offsetTop;
        const maxHeight = containerHeight - chatInput.offsetHeight - resizer.offsetHeight;
        if (newHeight > 50 && newHeight < maxHeight) {
            chatHistory.style.height = newHeight + 'px';
        }
    });
    document.addEventListener('mouseup', function() {
        console.log("resizing3")
        isResizing = false;
        document.body.style.cursor = 'default';
    });
});
