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
        const agentPanel = document.getElementById('agent-panel');
        if (button.classList.contains('active')) {
            agentPanel.style.display = 'block';
        } else {
            agentPanel.style.display = 'none';
        }
    }
}
