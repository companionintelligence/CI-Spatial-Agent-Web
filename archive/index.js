

const companionscript = 
`
You are a personal assistant and life coach.
For a few specific questions you have pre-defined responses.
For each of the following inputs please give the exact response:

Input: What should I do today?
Response: I see that you haven't exercised in a while, and your friend Kevin mentioned he was going on a hike today to Griffith Park, see if you can join him!

Input: What should I do tonite?
Response: Why not invite your girlfriend to see the full moon on Mullholland drive - here's a music playlist that I made for you."

Input: Thank you 
Respoonse: Don't forget to water the plants and call your mom back as well, have a great evening
`

//
// Load the orbital pub/sub service and then load up a few systems that will handle message traffic
//

import sys from 'orbital-sys/src/sys.js'

sys({
	load:[

		// 3d scene system - observes {volume} components and makes a 3d display on a named div or volume001
		'orbital-volume/volume.js',

		// voice activity detector and stt using whisper with bargein and audio echo cancellation
		// 'here/chat/vad.js',
		// 'here/chat/stt-whisper.js',

		// alternatively a built in stt (doesn't allow bargein or audio echo cancellation)
		'orbital-puppet/chat/stt-sys.js',

		// user interface - placed here in chain because may block some events
		'orbital-puppet/chat-ux.js',

		// reason using an llm
		'orbital-puppet/chat/llm.js',

		// text to speech using a wasm based tts and speech diarization and then an audio player
		'orbital-puppet/chat/tts.js',
		'orbital-puppet/chat/stt-diarization.js',
		'orbital-puppet/chat/audio.js',

		// built-in tts has poor results because it doesn't tell us the duration of the audio output
		// 'here/chat/tts-sys.js',

		// puppet performance - watches for audio packets that are decorated with viseme data
		'orbital-puppet/perform/puppet.js',

		// a fun audio effect
		// 'orbital-puppet/audio-effect.js'
	]
})



//
// a 3d scene - these are messages that get piped to the 3d volume service above and rendered as 3d geometry
//

sys([

	{
		uuid: "scene001",
		volume: {
			geometry: 'scene',
			div: 'volume001',
			near: 0.1,
			far: 100,
			cameraPosition:[0,1.5,1], // @todo move this behavior to camera
			cameraTarget:[0,1.5,0],
			cameraMin: 1,
			cameraMax: 100,
			//background: 0x000000,
			//alpha: false,
			//axes: true,
			prettier: true,
			roomlighting: true,
		}
	},

	{
		uuid: "camera001",
		volume: {
			geometry: 'camera',
			nocontrols: false,
			pose:{
				position:[0,1.5,1],
				love:[0,1.5,0]
			}
		}
	},

	/*
	{
		uuid: "light001",
		volume: {
			geometry:'light',
			light:'directional',
			intensity: 0.8,
			color: 0xffffff,
			pose:{
				position:[1,1,1]
			},
		}
	},

	{

		uuid: "light002",
		volume: {
			geometry:'light',
			light:'ambient',
			color: 0xffffff,
			intensity: 0.3
		}
	},
	*/

	{
		uuid:"backdrop001",
		unused_volume: {
			geometry:'file',
			url:'assets/venues/virtual_store_cute_pastelle.glb',
			metadata: {
				provenance: 'https://sketchfab.com/3d-models/virtual-store-cute-pastelle-953f0f8517eb4af1b1ba5bf85601f7dd',
				creator: 'https://sketchfab.com/mshayan02',
				license: "CC Attribution-NonCommercial",
			},
			transform:{
				whd:[1,1,1],
				xyz:[0,0,1.5],
				ypr:[0,3,0],
			},
		}
	},

	//
	// puppet
	//

	{
		uuid: 'alexandria',

		// decorate this entity with a 3d geometry
		volume: {
			geometry: 'file',
			url: 'assets/avatars/25-1-3_CI_model_female_Shanee.glb',
			xurl: 'assets/avatars/rpm-mixamo-t-posed.glb',
			xurl: 'https://models.readyplayer.me/664956c743dbd726eefeb99b.glb?morphTargets=ARKit,Oculus+Visemes,mouthOpen,mouthSmile,eyesClosed,eyesLookUp,eyesLookDown&textureSizeLimit=1024&textureFormat=png',
			pose: {
				position: [0,0,0]
			},
			animations: { default: `${import.meta.url}/../assets/animations/unarmed-idle.glb` },
		},

		// decorate entity with viseme support on the geometry if any
		puppet: {},

		// general configuration - stuffed here for now
		config: {
			microphone: true,
			bargein: false,
			autosubmit: false,
		},

		// decorate entity with the ability to understand human traffic on the pub/sub network
		llm: {
			stream: true,
			messages: [{
				role: "system",
				content: companionscript,
			}],
			temperature: 0.3,
			max_tokens: 256,

			// this is meant to refer to the in memory llm - if you want ollama set this to false
			llm_local: true,
			
			//llm_url: 'https://api.openai.com/v1/chat/completions',
			//llm_model: 'gpt-4o-mini',
			//llm_auth: '',

			llm_url: 'http://localhost:11434/v1/chat/completions',
			llm_model: 'llama3.2',
			//llm_model: 'deepseek-r1:7b',
			//llm_model: 'deepseek-r1:70b',
			//llm_auth: '',

		},

		// decorate entity with an ability to convert text output to speech
		tts: {
			remote: false,
			xurl: 'https://api.openai.com/v1/audio/speech',
			xmodel: "tts-1",
			// { "name": "Rachel", "id": "21m00Tcm4TlvDq8ikWAM" }
			url: 'https://api.elevenlabs.io/v1/text-to-speech/Rachel',
			model: "eleven_monolingual_v2",
			bearer: 'sk_611e5fa7b083be66a739ceeb8bd77d3599600278f9319272',
			// for openai the voices are alloy, echo, fable, onyx, shimmer, nova - onyx is male
			//voice: "shimmer",
			// local voice for piper - male or female work
			//voice: 'en_US-hfc_female-medium',
			speed: 1,
			volume: 1,
			language: "en",
			trim: 0
		},

		// decorate entity with the ability to convert speech output to animated viseme performances
		diarization: {
			remote: false,
			url: 'https://api.openai.com/v1/audio/speech',
			bearer: '',
		},

	},
])



// after a while perform an opening statement - @todo could add a timeout feature to sys nodes
setTimeout( ()=>{
	const text = "All systems nominal - ready to chat!"
//	sys({perform:{text,final:true,human:false,interrupt:performance.now()}})
},2000)

