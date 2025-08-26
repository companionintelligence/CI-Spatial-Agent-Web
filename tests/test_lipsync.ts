// run this like so:  npx tsx test_lipsync.ts >& test_log.md

import { lipsyncConvert } from './src/services/visemes/lipsyncQueue.ts'
import { defaultVisemeConfig } from './src/services/visemes/visemeConfig.ts'

function words_to_visemes_convert_test() {

  const whisperBlob = {
    words: [ "2", "plus", "2", "equals", "4" ],
    wtimes: [ 0, 163.81913192587265 ,396.61487249107574 ,561.9740863655143 ,1123.453985094403 ],
    wdurations: [ 100,160,100,480,100 ]
  }

  const result = lipsyncConvert(whisperBlob, 'en', defaultVisemeConfig)

  console.log(JSON.stringify(result, null, 2))
}

words_to_visemes_convert_test()

