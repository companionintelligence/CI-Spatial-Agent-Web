/**
 * @class English lip-sync processor
 * @author Mika Suominen (original), Adapted for TypeScript and modern avatar system
 *
 * English words to Oculus visemes, algorithmic rules adapted from:
 * NRL Report 7948, "Automatic Translation of English Text to Phonetics by Means of Letter-to-Sound Rules" (1976)
 * by HONEY SUE ELOVITZ, RODNEY W. JOHNSON, ASTRID McHUGH, AND JOHN E. SHORE
 * Available at: https://apps.dtic.mil/sti/pdfs/ADA021929.pdf
 */

interface VisemeResult {
  words: string
  visemes: string[]
  times: number[]
  durations: number[]
  i: number
}

interface VisemeRule {
  regex: RegExp
  move: number
  visemes: string[]
}

type RuleSet = Record<string, VisemeRule[]>

export class LipsyncEn {
  private rules: RuleSet = {}
  private visemeDurations: Record<string, number>
  private specialDurations: Record<string, number>
  private digits: string[]
  private ones: string[]
  private tens: string[]
  private teens: string[]
  private symbols: Record<string, string>
  private symbolsReg: RegExp

  constructor() {
    // English words to Oculus visemes rules
    const rawRules: Record<string, string[]> = {
      A: [
        '[A] =aa',
        ' [ARE] =aa RR',
        ' [AR]O=aa RR',
        '[AR]#=E RR',
        ' ^[AS]#=E SS',
        '[A]WA=aa',
        '[AW]=aa',
        ' :[ANY]=E nn I',
        '[A]^+#=E',
        '#:[ALLY]=aa nn I',
        ' [AL]#=aa nn',
        '[AGAIN]=aa kk E nn',
        '#:[AG]E=I kk',
        '[A]^+:#=aa',
        ':[A]^+ =E',
        '[A]^%=E',
        ' [ARR]=aa RR',
        '[ARR]=aa RR',
        ' :[AR] =aa RR',
        '[AR] =E',
        '[AR]=aa RR',
        '[AIR]=E RR',
        '[AI]=E',
        '[AY]=E',
        '[AU]=aa',
        '#:[AL] =aa nn',
        '#:[ALS] =aa nn SS',
        '[ALK]=aa kk',
        '[AL]^=aa nn',
        ' :[ABLE]=E PP aa nn',
        '[ABLE]=aa PP aa nn',
        '[ANG]+=E nn kk',
        '[A]=aa'
      ],

      B: [' [BE]^#=PP I', '[BEING]=PP I I nn', ' [BOTH] =PP O TH', ' [BUS]#=PP I SS', '[BUIL]=PP I nn', '[B]=PP'],

      C: [
        ' [CH]^=kk',
        '^E[CH]=kk',
        '[CH]=CH',
        ' S[CI]#=SS aa',
        '[CI]A=SS',
        '[CI]O=SS',
        '[CI]EN=SS',
        '[C]+=SS',
        '[CK]=kk',
        '[COM]%=kk aa PP',
        '[C]=kk'
      ],

      D: [
        '#:[DED] =DD I DD',
        '.E[D] =DD',
        '#^:E[D] =DD',
        ' [DE]^#=DD I',
        ' [DO] =DD U',
        ' [DOES]=DD aa SS',
        ' [DOING]=DD U I nn',
        ' [DOW]=DD aa',
        '[DU]A=kk U',
        '[D]=DD'
      ],

      E: [
        '#:[E] =',
        "'^:[E] =",
        ' :[E] =I',
        '#[ED] =DD',
        '#:[E]D =',
        '[EV]ER=E FF',
        '[E]^%=I',
        '[ERI]#=I RR I',
        '[ERI]=E RR I',
        '#:[ER]#=E',
        '[ER]#=E RR',
        '[ER]=E',
        ' [EVEN]=I FF E nn',
        '#:[E]W=',
        '@[EW]=U',
        '[EW]=I U',
        '[E]O=I',
        '#:&[ES] =I SS',
        '#:[E]S =',
        '#:[ELY] =nn I',
        '#:[EMENT]=PP E nn DD',
        '[EFUL]=FF U nn',
        '[EE]=I',
        '[EARN]=E nn',
        ' [EAR]^=E',
        '[EAD]=E DD',
        '#:[EA] =I aa',
        '[EA]SU=E',
        '[EA]=I',
        '[EIGH]=E',
        '[EI]=I',
        ' [EYE]=aa',
        '[EY]=I',
        '[EU]=I U',
        '[E]=E'
      ],

      F: ['[FUL]=FF U nn', '[F]=FF'],

      G: [
        '[GIV]=kk I FF',
        ' [G]I^=kk',
        '[GE]T=kk E',
        'SU[GGES]=kk kk E SS',
        '[GG]=kk',
        ' B#[G]=kk',
        '[G]+=kk',
        '[GREAT]=kk RR E DD',
        '#[GH]=',
        '[G]=kk'
      ],

      H: [' [HAV]=I aa FF', ' [HERE]=I I RR', ' [HOUR]=aa EE', '[HOW]=I aa', '[H]#=I', '[H]='],

      I: [
        ' [IN]=I nn',
        ' [I] =aa',
        '[IN]D=aa nn',
        '[IER]=I E',
        '#:R[IED] =I DD',
        '[IED] =aa DD',
        '[IEN]=I E nn',
        '[IE]T=aa E',
        ' :[I]%=aa',
        '[I]%=I',
        '[IE]=I',
        '[I]^+:#=I',
        '[IR]#=aa RR',
        '[IZ]%=aa SS',
        '[IS]%=aa SS',
        '[I]D%=aa',
        '+^[I]^+=I',
        '[I]T%=aa',
        '#^:[I]^+=I',
        '[I]^+=aa',
        '[IR]=E',
        '[IGH]=aa',
        '[ILD]=aa nn DD',
        '[IGN] =aa nn',
        '[IGN]^=aa nn',
        '[IGN]%=aa nn',
        '[IQUE]=I kk',
        '[I]=I'
      ],

      J: ['[J]=kk'],

      K: [' [K]N=', '[K]=kk'],

      L: ['[LO]C#=nn O', 'L[L]=', '#^:[L]%=aa nn', '[LEAD]=nn I DD', '[L]=nn'],

      M: ['[MOV]=PP U FF', '[M]=PP'],

      N: [
        'E[NG]+=nn kk',
        '[NG]R=nn kk',
        '[NG]#=nn kk',
        '[NGL]%=nn kk aa nn',
        '[NG]=nn',
        '[NK]=nn kk',
        ' [NOW] =nn aa',
        '[N]=nn'
      ],

      O: [
        '[OF] =aa FF',
        '[OROUGH]=E O',
        '#:[OR] =E',
        '#:[ORS] =E SS',
        '[OR]=aa RR',
        ' [ONE]=FF aa nn',
        '[OW]=O',
        ' [OVER]=O FF E',
        '[OV]=aa FF',
        '[O]^%=O',
        '[O]^EN=O',
        '[O]^I#=O',
        '[OL]D=O nn',
        '[OUGHT]=aa DD',
        '[OUGH]=aa FF',
        ' [OU]=aa',
        'H[OU]S#=aa',
        '[OUS]=aa SS',
        '[OUR]=aa RR',
        '[OULD]=U DD',
        '^[OU]^L=aa',
        '[OUP]=U OO',
        '[OU]=aa',
        '[OY]=O',
        '[OING]=O I nn',
        '[OI]=O',
        '[OOR]=aa RR',
        '[OOK]=U kk',
        '[OOD]=U DD',
        '[OO]=U',
        '[O]E=O',
        '[O] =O',
        '[OA]=O',
        ' [ONLY]=O nn nn I',
        ' [ONCE]=FF aa nn SS',
        "[ON'T]=O nn DD",
        'C[O]N=aa',
        '[O]NG=aa',
        ' ^:[O]N=aa',
        'I[ON]=aa nn',
        '#:[ON] =aa nn',
        '#^[ON]=aa nn',
        '[O]ST =O',
        '[OF]^=aa FF',
        '[OTHER]=aa TH E',
        '[OSS] =aa SS',
        '#^:[OM]=aa PP',
        '[O]=aa'
      ],

      P: ['[PH]=FF', '[PEOP]=PP I PP', '[POW]=PP aa', '[PUT] =PP U DD', '[P]=PP'],

      Q: ['[QUAR]=kk FF aa RR', '[QU]=kk FF', '[Q]=kk'],

      R: [' [RE]^#=RR I', '[R]=RR'],

      S: [
        '[SH]=SS',
        '#[SION]=SS aa nn',
        '[SOME]=SS aa PP',
        '#[SUR]#=SS E',
        '[SUR]#=SS E',
        '#[SU]#=SS U',
        '#[SSU]#=SS U',
        '#[SED] =SS DD',
        '#[S]#=SS',
        '[SAID]=SS E DD',
        '^[SION]=SS aa nn',
        '[S]S=',
        '.[S] =SS',
        '#:.E[S] =SS',
        '#^:##[S] =SS',
        '#^:#[S] =SS',
        'U[S] =SS',
        ' :#[S] =SS',
        ' [SCH]=SS kk',
        '[S]C+=',
        '#[SM]=SS PP',
        "#[SN]'=SS aa nn",
        '[S]=SS'
      ],

      T: [
        ' [THE] =TH aa',
        '[TO] =DD U',
        '[THAT] =TH aa DD',
        ' [THIS] =TH I SS',
        ' [THEY]=TH E',
        ' [THERE]=TH E RR',
        '[THER]=TH E',
        '[THEIR]=TH E RR',
        ' [THAN] =TH aa nn',
        ' [THEM] =TH E PP',
        '[THESE] =TH I SS',
        ' [THEN]=TH E nn',
        '[THROUGH]=TH RR U',
        '[THOSE]=TH O SS',
        '[THOUGH] =TH O',
        ' [THUS]=TH aa SS',
        '[TH]=TH',
        '#:[TED] =DD I DD',
        'S[TI]#N=CH',
        '[TI]O=SS',
        '[TI]A=SS',
        '[TIEN]=SS aa nn',
        '[TUR]#=CH E',
        '[TU]A=CH U',
        ' [TWO]=DD U',
        '[T]=DD'
      ],

      U: [
        ' [UN]I=I U nn',
        ' [UN]=aa nn',
        ' [UPON]=aa PP aa nn',
        '@[UR]#=U RR',
        '[UR]#=I U RR',
        '[UR]=E',
        '[U]^ =aa',
        '[U]^^=aa',
        '[UY]=aa',
        ' G[U]#=',
        'G[U]%=',
        'G[U]#=FF',
        '#N[U]=I U',
        '@[U]=I',
        '[U]=I U'
      ],

      V: ['[VIEW]=FF I U', '[V]=FF'],

      W: [
        ' [WERE]=FF E',
        '[WA]S=FF aa',
        '[WA]T=FF aa',
        '[WHERE]=FF E RR',
        '[WHAT]=FF aa DD',
        '[WHOL]=I O nn',
        '[WHO]=I U',
        '[WH]=FF',
        '[WAR]=FF aa RR',
        '[WOR]^=FF E',
        '[WR]=RR',
        '[W]=FF'
      ],

      X: [' [X]=SS', '[X]=kk SS'],

      Y: [
        '[YOUNG]=I aa nn',
        ' [YOU]=I U',
        ' [YES]=I E SS',
        ' [Y]=I',
        '#^:[Y] =I',
        '#^:[Y]I=I',
        ' :[Y] =aa',
        ' :[Y]#=aa',
        ' :[Y]^+:#=I',
        ' :[Y]^#=I',
        '[Y]=I'
      ],

      Z: ['[Z]=SS']
    }

    // Regex operators for pattern matching
    const ops: Record<string, string> = {
      '#': '[AEIOUY]+', // One or more vowels AEIOUY
      '.': '[BDVGJLMNRWZ]', // One voiced consonant BDVGJLMNRWZ
      '%': '(?:ER|E|ES|ED|ING|ELY)', // One of ER, E, ES, ED, ING, ELY
      '&': '(?:[SCGZXJ]|CH|SH)', // One of S, C, G, Z, X, J, CH, SH
      '@': '(?:[TSRDLZNJ]|TH|CH|SH)', // One of T, S, R, D, L, Z, N, J, TH, CH, SH
      '^': '[BCDFGHJKLMNPQRSTVWXZ]', // One consonant BCDFGHJKLMNPQRSTVWXZ
      '+': '[EIY]', // One of E, I, Y
      ':': '[BCDFGHJKLMNPQRSTVWXZ]*', // Zero or more consonants BCDFGHJKLMNPQRSTVWXZ
      ' ': '\\b' // Start/end of the word
    }

    // Convert rules to regex patterns
    Object.keys(rawRules).forEach((key) => {
      this.rules[key] = rawRules[key].map((rule) => {
        const posL = rule.indexOf('[')
        const posR = rule.indexOf(']')
        const posE = rule.indexOf('=')
        const strLeft = rule.substring(0, posL)
        const strLetters = rule.substring(posL + 1, posR)
        const strRight = rule.substring(posR + 1, posE)
        const strVisemes = rule.substring(posE + 1)

        const o: VisemeRule = { regex: new RegExp(''), move: 0, visemes: [] }

        let exp = ''
        exp += [...strLeft].map((x) => ops[x] || x).join('')
        const ctxLetters = [...strLetters]
        ctxLetters[0] = ctxLetters[0].toLowerCase()
        exp += ctxLetters.join('')
        o.move = ctxLetters.length
        exp += [...strRight].map((x) => ops[x] || x).join('')
        o.regex = new RegExp(exp)

        if (strVisemes.length) {
          strVisemes.split(' ').forEach((viseme) => {
            if (viseme) {
              o.visemes.push(viseme)
            }
          })
        }

        return o
      })
    })

    // Viseme durations in relative unit (1=average)
    this.visemeDurations = {
      aa: 0.95,
      E: 0.9,
      I: 0.92,
      O: 0.96,
      U: 0.95,
      PP: 1.08,
      SS: 1.23,
      TH: 1,
      DD: 1.05,
      FF: 1.0,
      kk: 1.21,
      nn: 0.88,
      RR: 0.88,
      CH: 1.1,
      sil: 1
    }

    // Pauses in relative units (1=average)
    this.specialDurations = { ' ': 1, ',': 3, '-': 0.5 }

    // English number words
    this.digits = ['oh', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
    this.ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
    this.tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
    this.teens = [
      'ten',
      'eleven',
      'twelve',
      'thirteen',
      'fourteen',
      'fifteen',
      'sixteen',
      'seventeen',
      'eighteen',
      'nineteen'
    ]

    // Symbols to English
    this.symbols = {
      '%': 'percent',
      '€': 'euros',
      '&': 'and',
      '+': 'plus',
      $: 'dollars'
    }
    this.symbolsReg = /[%€&+$]/g
  }

  private convertDigitByDigit(num: number): string {
    const numStr = String(num).split('')
    let numWords = ''
    for (let m = 0; m < numStr.length; m++) {
      numWords += this.digits[parseInt(numStr[m])] + ' '
    }
    return numWords.substring(0, numWords.length - 1) // Kill final space
  }

  private convertSetsOfTwo(num: number): string {
    const numStr = String(num)
    const firstNumHalf = numStr.substring(0, 2)
    const secondNumHalf = numStr.substring(2, 4)
    let numWords = this.convertTens(parseInt(firstNumHalf))
    if (secondNumHalf && secondNumHalf !== '00') {
      numWords += ' ' + this.convertTens(parseInt(secondNumHalf))
    }
    return numWords.trim()
  }

  private convertMillions(num: number): string {
    if (num >= 1000000000) {
      // Handle billions
      const billions = Math.floor(num / 1000000000)
      const remainder = num % 1000000000
      let result = this.convertHundreds(billions) + ' billion'
      if (remainder > 0) {
        result += ' ' + this.convertMillions(remainder)
      }
      return result
    } else if (num >= 1000000) {
      const millions = Math.floor(num / 1000000)
      const remainder = num % 1000000
      let result = this.convertHundreds(millions) + ' million'
      if (remainder > 0) {
        result += ' ' + this.convertThousands(remainder)
      }
      return result
    } else {
      return this.convertThousands(num)
    }
  }

  private convertThousands(num: number): string {
    if (num >= 1000) {
      const thousands = Math.floor(num / 1000)
      const remainder = num % 1000
      let result = this.convertHundreds(thousands) + ' thousand'
      if (remainder > 0) {
        result += ' ' + this.convertHundreds(remainder)
      }
      return result
    } else {
      return this.convertHundreds(num)
    }
  }

  private convertHundreds(num: number): string {
    if (num > 99) {
      const hundreds = Math.floor(num / 100)
      const remainder = num % 100
      let result = this.ones[hundreds] + ' hundred'
      if (remainder > 0) {
        result += ' ' + this.convertTens(remainder)
      }
      return result
    } else {
      return this.convertTens(num)
    }
  }

  private convertTens(num: number): string {
    if (num < 10) {
      return this.ones[num] || ''
    } else if (num >= 10 && num < 20) {
      return this.teens[num - 10]
    } else {
      const tensDigit = Math.floor(num / 10)
      const onesDigit = num % 10
      let result = this.tens[tensDigit]
      if (onesDigit > 0) {
        result += ' ' + this.ones[onesDigit]
      }
      return result
    }
  }

  private convertNumberToWords(num: string): string {
    const numInt = parseInt(num)
    if (numInt === 0) {
      return 'zero'
    } else if (numInt >= 1900 && numInt <= 1999) {
      // 20th century years: read as nineteen XX
      return this.convertSetsOfTwo(numInt)
    } else if (numInt === 2010) {
      // Special case: 2010 should be "two thousand ten"
      return 'two thousand ten'
    } else if (numInt >= 2011 && numInt <= 2099) {
      // Other 21st century years 2011-2099: read as twenty XX
      return this.convertSetsOfTwo(numInt)
    } else if (numInt === 2000) {
      return 'two thousand'
    } else if (numInt >= 2001 && numInt <= 2009) {
      return 'two thousand ' + this.ones[numInt - 2000]
    } else {
      // Regular number conversion for all other cases
      return this.convertMillions(numInt)
    }
  }

  /**
   * Full text processing that includes number-to-words conversion
   * Use this for complete text preprocessing including numbers
   * @param s Text
   * @return Fully processed text with numbers converted to words
   */
  fullTextProcessing(s: string): string {
    let result = s

    // Handle symbols to words conversion - add spaces around them
    result = result.replace(this.symbolsReg, (symbol) => {
      return ' ' + this.symbols[symbol] + ' '
    })

    // Handle special symbols that aren't in symbolsReg
    result = result.replace(/=/g, ' equals ')

    // Handle decimal points and number separators
    result = result.replace(/(\d)[,.](\d)/g, '$1 point $2')

    // Handle phone numbers (xxx-xxxx or xxx-xxx-xxxx pattern) - convert digit by digit
    result = result.replace(/\b(\d{3})-(\d{3})-(\d{4})\b/g, (_, area, exchange, number) => {
      return (
        this.convertDigitByDigit(parseInt(area)) +
        ' ' +
        this.convertDigitByDigit(parseInt(exchange)) +
        ' ' +
        this.convertDigitByDigit(parseInt(number))
      )
    })
    result = result.replace(/\b(\d{3})-(\d{4})\b/g, (_, prefix, number) => {
      return this.convertDigitByDigit(parseInt(prefix)) + ' ' + this.convertDigitByDigit(parseInt(number))
    })

    // Handle special digit-by-digit cases before general number conversion
    result = result.replace(/\d+/g, (match) => {
      const numInt = parseInt(match)

      // Emergency numbers: 911, 411, etc - digit by digit
      if (match.length === 3 && (numInt === 911 || numInt === 411 || numInt === 511 || numInt === 811)) {
        return this.convertDigitByDigit(numInt)
      }

      // Common area codes - digit by digit (only for commonly known area codes)
      if (
        match.length === 3 &&
        (numInt === 555 ||
          numInt === 415 ||
          numInt === 212 ||
          numInt === 310 ||
          numInt === 213 ||
          numInt === 323 ||
          numInt === 818 ||
          numInt === 424)
      ) {
        return this.convertDigitByDigit(numInt)
      }

      // ZIP codes (5 digits, 10000-99999): digit by digit
      if (match.length === 5 && numInt >= 10000) {
        return this.convertDigitByDigit(numInt)
      }

      return this.convertNumberToWords(match)
    })

    // Remove unwanted characters but preserve letters and spaces
    result = result.replace(/[#_*'":;!?()-]/g, ' ')

    // Remove any remaining non-alphabetic characters except spaces
    result = result.replace(/[^a-zA-Z\s]/g, ' ')

    // Remove excessive repeated characters (but not spaces)
    result = result.replace(/([a-zA-Z])\1\1+/g, '$1$1')

    // Clean up spaces: collapse multiple spaces to single space
    result = result.replace(/\s+/g, ' ')

    // Remove diacritics and normalize
    result = result
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .normalize('NFC')

    // Trim and convert to uppercase
    return result.trim().toUpperCase()
  }

  /**
   * Preprocess text:
   * - convert symbols to words
   * - convert numbers to words
   * - filter out characters that should be left unspoken
   * @param s Text
   * @param includeNumbers Whether to convert numbers to words (default: false for backward compatibility)
   * @return Pre-processed text.
   */
  preProcessText(s: string, includeNumbers: boolean = false): string {
    if (includeNumbers) {
      return this.fullTextProcessing(s)
    }

    // Original behavior for backward compatibility with tests
    let result = s

    // First handle symbols to words conversion (only when we want to keep them)
    result = result.replace(this.symbolsReg, (symbol) => {
      return ' ' + this.symbols[symbol] + ' '
    })

    // Handle number separators (only for valid numbers we want to convert)
    result = result.replace(/(\d),(\d)/g, '$1 point $2')

    // Handle email addresses - remove @ and . without adding spaces
    result = result.replace(/([a-zA-Z])[@.]([a-zA-Z])/g, '$1$2')

    // Remember where original double spaces were (mark them with a unique placeholder)
    result = result.replace(/ {2}/g, '__DOUBLE_SPACE__')

    // Remove numbers and special characters, keep only letters and spaces and our placeholders
    result = result.replace(/[^a-zA-Z\s_]/g, ' ')

    // Normalize spaces: collapse multiple spaces to single space
    result = result.replace(/\s+/g, ' ')

    // Restore original double spaces
    result = result.replace(/__DOUBLE_SPACE__/g, '  ')

    // Remove excessive repeated characters (but not spaces)
    result = result.replace(/([a-zA-Z])\1\1+/g, '$1$1')

    // Remove diacritics and normalize
    result = result
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .normalize('NFC')

    // Trim leading spaces
    result = result.replace(/^ +/, '').toUpperCase()

    // Check if we should preserve trailing space:
    // Only add trailing space if original ended with non-alphabetic chars AND
    // result doesn't already end with space AND
    // the non-alphabetic chars weren't symbols that got converted to words
    const endsWithNonAlphabetic = /[^a-zA-Z\s]$/.test(s)
    const originalHadSymbols = this.symbolsReg.test(s)

    // If original had symbols, clean up any trailing spaces from symbol conversion
    if (originalHadSymbols) {
      result = result.replace(/ +$/, '')
    } else if (endsWithNonAlphabetic && !result.endsWith(' ')) {
      result += ' '
    }

    return result
  }

  /**
   * Convert word to Oculus LipSync Visemes and durations
   * @param w Text
   * @return Oculus LipSync Visemes and durations.
   */
  wordsToVisemes(w: string): VisemeResult | null {
    if (!w || w.length === 0) return null

    const processedText = this.preProcessText(w)
    if (!processedText) return null

    const o: VisemeResult = {
      words: processedText, // Already uppercase from preProcessText
      visemes: [],
      times: [],
      durations: [],
      i: 0
    }
    let t = 0

    const chars = [...o.words]
    while (o.i < chars.length) {
      const c = chars[o.i]
      const ruleset = this.rules[c]

      if (ruleset) {
        let matched = false
        for (let i = 0; i < ruleset.length; i++) {
          const rule = ruleset[i]
          const test = o.words.substring(0, o.i) + c.toLowerCase() + o.words.substring(o.i + 1)
          const matches = test.match(rule.regex)

          if (matches) {
            rule.visemes.forEach((viseme) => {
              if (o.visemes.length && o.visemes[o.visemes.length - 1] === viseme) {
                const d = 0.7 * (this.visemeDurations[viseme] || 1)
                o.durations[o.durations.length - 1] += d
                t += d
              } else {
                const d = this.visemeDurations[viseme] || 1
                o.visemes.push(viseme)
                o.times.push(t)
                o.durations.push(d)
                t += d
              }
            })
            o.i += rule.move
            matched = true
            break
          }
        }

        if (!matched) {
          o.i++
        }
      } else {
        o.i++
        t += this.specialDurations[c] || 0
      }
    }

    return o.visemes.length > 0 ? o : null
  }
}
