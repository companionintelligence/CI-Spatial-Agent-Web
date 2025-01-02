
// @todo for some reason /+esm does something very strange with import maps - they stop working!
import sys from 'https://cdn.jsdelivr.net/npm/orbital-sys@1.1.2/src/sys.js'
//import sys from 'here/shared/orbital/orbital-sys/src/sys.js'

//
// a manifest that requests 3d capabilities, puppetry and then builds a 3d scene and an llm agent in that scene
//

sys({

	load:[

		// 3d scene geometry system manager
		'https://cdn.jsdelivr.net/npm/orbital-volume@latest/volume.js',

		// puppet behavior system manager
		'https://cdn.jsdelivr.net/npm/orbital-puppet@1.1.2/puppet-chat.js',
		//'orbital/orbital-puppet/puppet-chat.js',

		// declare instances of scene geometry including puppet geometry and animations
		import.meta.url + '/../geometry001.js',

		// declare an instance of an llm that will help drive the puppet brains
		import.meta.url + '/../llms001.js',
	],

})


