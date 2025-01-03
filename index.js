
// @todo for some reason /+esm does something very strange with import maps - they stop working!
import sys from 'https://cdn.jsdelivr.net/npm/orbital-sys@1.1.4/src/sys.js'
//import sys from 'here/shared/orbital/orbital-sys/src/sys.js'

//
// a manifest that requests 3d capabilities, puppetry and then builds a 3d scene and an llm agent in that scene
//

sys({

	load:[

		// 3d scene geometry system manager
		'https://cdn.jsdelivr.net/npm/orbital-volume@1.1.4/volume.js',
		//'orbital/orbital-volume/volume.js',

		// puppet behavior system manager
		'https://cdn.jsdelivr.net/npm/orbital-puppet@1.1.5/puppet-chat.js',
		//'orbital/orbital-puppet/puppet-chat.js',

		// declare instances of scene geometry including puppet geometry and animations
		import.meta.url + '/../manifests/geometry001.js',

		// declare an instance of an llm that will help drive the puppet brains
		import.meta.url + '/../manifests/llms001.js',
	],

})

let rcounter = 1000

function sendToPuppet(text) {
	if(!text || !text.length) return
	const interrupt = performance.now()
	sys({
		human:{
			text,
			confidence:1,
			spoken:false,
			final:true,
			interrupt,
			rcounter,
			bcounter:1,
			bargein:true
		}
	})
	rcounter++
}

function resolve(blob) {
	if(!blob || blob.time || blob.tick) return
	if(blob.breath) {
		console.log("got a breath fragment",blob.breath)
        const responseMessage = document.createElement('div');
        responseMessage.className = 'chat-message agent';
        responseMessage.textContent = blob.breath.breath;
        const chatHistory = document.querySelector('.chat-history');
        chatHistory.appendChild(responseMessage);		
	}
}

sys({
	uuid:"companion-intelligence-chat-handler",
	resolve
})

function submitMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (message) {
		sendToPuppet(message)
        const chatHistory = document.querySelector('.chat-history');
        const newMessage = document.createElement('div');
        newMessage.className = 'chat-message user';
        newMessage.textContent = message;
        chatHistory.appendChild(newMessage);
        input.value = '';
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
}

document.getElementById('chat-input').onkeydown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        submitMessage();
    }
}

document.getElementById('button-microphone').onclick = (e) => {
    e.target.classList.toggle('active');
	const microphonePanel = document.getElementById('microphone-panel');
	if (e.target.classList.contains('active')) {
		microphonePanel.style.display = 'block';
	} else {
		microphonePanel.style.display = 'none';
	}
}

document.getElementById('button-agent').onclick = (e) => {
    e.target.classList.toggle('active');
	const agentPanel = document.getElementById('volume001');
	if (e.target.classList.contains('active')) {
		agentPanel.style.display = 'block';
	} else {
		agentPanel.style.display = 'none';
	}
}

document.getElementById('button-barge').onclick = (e) => {
    e.target.classList.toggle('active');
}

document.getElementById('button-auto').onclick = (e) => {
    e.target.classList.toggle('active');
}

document.getElementById('button-submit').onclick = submitMessage


///////////////////////////////////////////
// use this setup

sys({llm_configure:{
	local:false,
	url : 'http://192.168.1.137:3008/api/chat/completions',
	auth : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjlhZjU5ZWQ4LTgxOGUtNDk5ZC05MTE3LTIyODIzY2RiYTQwYyJ9.0Qq64aVq7Ag5x7dhHZmJmqLKvZdrvBB0iVZpCMIAujY',
	model:  "llama3.3:latest"
}})
