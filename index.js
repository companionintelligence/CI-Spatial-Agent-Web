
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
		//'https://cdn.jsdelivr.net/npm/orbital-puppet@1.1.5/puppet-chat.js',
		'orbital/orbital-puppet/puppet-chat.js',

		// declare instances of scene geometry including puppet geometry and animations
		import.meta.url + '/../manifests/geometry001.js',

		// declare an instance of an llm that will help drive the puppet brains
		import.meta.url + '/../manifests/llms001.js',
	],

})

//
// configure the systems above
// @note the exposed key - this repo must not be public nor shared widely for now
// @note it may make sense to allow for auth token such as jwt to be entered in the chat interface
//

sys({configuration:{
	// microphone on or off
	microphone: true,
	// built-in stt
	builtin_stt: false,
	// barge in allowed - allow spoken aborts (although important for speech to speech it can be overly annoying in noisy environments)
	bargein: false,
	// auto-submit complete spoken utterances; a nice feature in voice to voice interactions
	autosubmit: false,
	// use local llm (fetched as a wasm module but sadly does not run on mobile and is compute heavy)
	local: false,
	// remote url of llm service if any
	url: 'https://api.openai.com/v1/chat/completions',
	// bearer token for authentication for remote fetch
	auth : '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',
	// override any llm specific pre-prompt for the system as in 'you are a helpful digital assistant'
	prompt: null,
	// for openai this is a low cost model
	model: 'gpt-3.5-turbo',
	// specific voice for piper
	voice: null,
}})

////////////////////////////////////////////////////////////////////////////////////////////////////////
// a small user interface on the document html
////////////////////////////////////////////////////////////////////////////////////////////////////////////

let rcounter = 1000
const ChatInput = document.getElementById('chat-input');
let typing = 0

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
	if(blob.human && blob.human.text && blob.human.spoken && blob.human.text.length && !typing) {
		ChatInput.value = blob.human.text
	}
	if(blob.breath) {
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
    const message = ChatInput.value.trim();
    if (message && message.length) {
		sendToPuppet(message)
		const chatHistory = document.querySelector('.chat-history');
        const newMessage = document.createElement('div');
        newMessage.className = 'chat-message user';
        newMessage.textContent = message;
        chatHistory.appendChild(newMessage);
        chatHistory.scrollTop = chatHistory.scrollHeight;
		ChatInput.value = '';
    }
}

ChatInput.onkeydown = (event) => {
	typing = ChatInput.value.length ? true : false
    if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
		typing = 0
        submitMessage();
		event.preventDefault()
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

