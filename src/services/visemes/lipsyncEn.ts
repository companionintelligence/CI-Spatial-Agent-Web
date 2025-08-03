/**
 * @class English lip-sync processor
 * @author Mika Suominen
 * Adapted for TypeScript and modern avatar system
 */

interface LipsyncRules {
  [key: string]: string[]
}

interface VisemeResult {
  visemes: string[]
  times: number[]
  durations: number[]
}

export class LipsyncEn {
  private rules: LipsyncRules

  constructor() {
    // English words to Oculus visemes, algorithmic rules adapted from:
    //   NRL Report 7948, "Automatic Translation of English Text to Phonetics by Means of Letter-to-Sound Rules" (1976)
    //   by HONEY SUE ELOVITZ, RODNEY W. JOHNSON, ASTRID McHUGH, AND JOHN E. SHORE
    this.rules = {
      'A': [
        "[A] =aa", " [ARE] =aa RR", " [AR]O=aa RR", "[AR]#=E RR",
        " ^[AS]#=E SS", "[A]WA=aa", "[AW]=aa", " :[ANY]=E nn I",
        "[A]^+#=E", "#:[ALLY]=aa nn I", " [AL]#=aa nn", "[AGAIN]=aa kk E nn",
        "#:[AG]E=I kk", "[A]^+:#=aa", ":[A]^+ =E", "[A]^%=E",
        " [ARR]=aa RR", "[ARR]=aa RR", " :[AR] =aa RR", "[AR] =E",
        "[AR]=aa RR", "[AIR]=E RR", "[AI]=E", "[AY]=E", "[AU]=aa",
        "#:[AL] =aa nn", "#:[ALS] =aa nn SS", "[ALK]=aa kk", "[AL]^=aa nn",
        " :[ABLE]=E PP aa nn", "[ABLE]=aa PP aa nn", "[ANG]+=E nn kk", "[A]=aa"
      ],
      'B': [
        " [BE]^#=PP I", "[BEING]=PP I I nn", " [BOTH] =PP O TH",
        " [BUS]#=PP I SS", "[BUIL]=PP I nn", "[B]=PP"
      ],
      'C': [
        " [CH]^=kk", "^E[CH]=kk", "[CH]=CH", " S[CI]#=SS aa",
        "[CI]A=SS", "[CI]O=SS", "[CI]EN=SS", "[C]+=SS",
        "[CK]=kk", "[COM]%=kk aa PP", "[C]=kk"
      ],
      'D': [
        "#:[DED] =DD I DD", ".E[D] =DD", "#^:E[D] =DD", " [DE]^#=DD I",
        " [DO] =DD U", " [DOES]=DD aa SS", " [DOING]=DD U I nn",
        " [DOW]=DD aa", "[DU]A=kk U", "[D]=DD"
      ],
      'E': [
        "#:[E] =", "'^:[E] =", " :[E] =I", "#[ED] =DD", "#:[E]D =",
        "[EV]ER=E FF", "[E]^%=I", "[ERI]#=I RR I", "[ERI]=E RR I",
        "#:[ER]#=E", "[ER]#=E RR", "[ER]=E", " [EVEN]=I FF E nn",
        "#:[E]W=", "@[EW]=U", "[EW]=I U", "[E]O=I", "#:&[ES] =I SS",
        "#:[E]S =", "#:[ELY] =nn I", "#:[EMENT]=PP E nn DD", "[EFUL]=FF U nn",
        "[EE]=I", "[EARN]=E nn", " [EAR]^=E", "[EAD]=E DD", "#:[EA] =I aa",
        "[EA]SU=E", "[EA]=I", "[EIGH]=E", "[EI]=I", " [EYE]=aa", "[EY]=I",
        "[EU]=I U", "[E]=E"
      ],
      'F': [
        "[FUL]=FF U nn", "[F]=FF"
      ],
      'G': [
        "[GIV]=kk I FF", " [G]I^=kk", "[GE]T=kk E", "SU[GGES]=kk kk E SS",
        "[GG]=kk", " B#[G]=kk", "[G]+=kk", "[GREAT]=kk RR E DD",
        "#[GH]=", "[G]=kk"
      ],
      'H': [
        " [HAV]=I aa FF", " [HERE]=I I RR", " [HOUR]=aa EE", "[HOW]=I aa",
        "[H]#=I", "[H]="
      ],
      'I': [
        " [IN]=I nn", " [I] =aa", "[IN]D=aa nn", "[IER]=I E",
        "#:R[IED] =I DD", "[IED] =aa DD", "[IEN]=I E nn", "[IE]T=aa E",
        " :[I]%=aa", "[I]%=I", "[IE]=I", "[I]^+:#=I", "[IR]#=aa RR",
        "[IZ]%=aa SS", "[IS]%=aa SS", "[I]D%=aa", "+^[I]^+=I",
        "[I]T%=aa", "#^:[I]^+=I", "[I]^+=aa", "[IR]=E", "[IGH]=aa",
        "[ILD]=aa nn DD", "[IGN] =aa nn", "[IGN]^=aa nn", "[IGN]%=aa nn",
        "[IQUE]=I kk", "[I]=I"
      ],
      'J': [
        "[J]=kk"
      ],
      'K': [
        " [K]N=", "[K]=kk"
      ],
      'L': [
        "[LO]C#=nn O", "L[L]=", "#^:[L]%=aa nn", "[LEAD]=nn I DD", "[L]=nn"
      ],
      'M': [
        "[MOV]=PP U FF", "[M]=PP"
      ],
      'N': [
        "E[NG]+=nn kk", "[NG]R=nn kk", "[NG]#=nn kk", "[NGL]%=nn kk aa nn",
        "[NG]=nn kk", "[NK]=nn kk", " [NOW] =nn aa", "[N]=nn"
      ],
      'O': [
        "[OF] =aa FF", "[OROUGH]=E RR O", "#:[OR] =E", "#:[ORS] =E SS",
        "[OR]=aa RR", "[ONE]=I aa nn", "[OW]=O", " [OVER]=O FF E",
        "[OV]=aa FF", "[O]^%=O", "[O]^EN=O", "[O]^I#=O", "[OL]D=O nn",
        "[OUGHT]=aa DD", "[OUGH]=aa FF", "[OU]=aa", "[OY]=aa", "[OING]=O I nn",
        "[OI]=aa", "[OOR]=aa RR", "[OOK]=U kk", "[OOD]=U DD", "[OO]=U",
        "[O]=aa"
      ],
      'P': [
        "[PH]=FF", "[PEOP]=PP I PP", "[POW]=PP aa", "[PUT] =PP U DD", "[P]=PP"
      ],
      'Q': [
        "[QUAR]=kk aa RR", "[QU]=kk I", "[Q]=kk"
      ],
      'R': [
        " [RE]^#=RR I", "[R]=RR"
      ],
      'S': [
        "[SH]=SS", "#[SION]=SS aa nn", "#[SIA]=SS aa", "#[SIO]=SS O",
        "#:[SIS] =SS I SS", "#[S]#=SS", "[S]=SS"
      ],
      'T': [
        " [THE] =DD aa", "[TO] =DD U", "[THAT]=DD aa DD", "[THIS] =DD I SS",
        "[THEY]=DD E", "[THERE]=DD E RR", "[TION]=SS aa nn", "[TIA]=SS aa",
        "[TIO]=SS O", "[TH]=TH", "[TCH]=CH", "[T]=DD"
      ],
      'U': [
        " [UN]I=I U nn", " [UN]=aa nn", " [UPON]=aa PP aa nn", "[UR]#=E RR",
        "[UR]=E", "[U]^ =aa", "[U]^^=aa", "[UY]=aa", "[U]=I U"
      ],
      'V': [
        "[VIEW]=FF I U", "[V]=FF"
      ],
      'W': [
        " [WERE]=I E RR", "[WA]S=I aa", "[WA]T=I aa", "[WHERE]=I E RR",
        "[WHAT]=I aa DD", "[WHOL]=I O nn", "[WHO]=I U", "[WH]=I",
        "[WAR]=I aa RR", "[WOR]=I E", "[WR]=RR", "[W]=I"
      ],
      'X': [
        "[X]=kk SS"
      ],
      'Y': [
        "[YOUNG]=I aa nn", " [YOUR]=I aa RR", " [YOU]=I U", " [YES]=I E SS",
        " [Y]=I", "#:^[Y] =I", "#:^[Y]I=I", " :[Y] =aa", "[Y]=I"
      ],
      'Z': [
        "[Z]=SS"
      ]
    }
  }

  /**
   * Pre-process text for lipsync
   */
  preProcessText(text: string): string {
    return text.replace(/[^a-zA-Z\s]/g, '').toUpperCase()
  }

  /**
   * Convert words to visemes
   */
  wordsToVisemes(words: string): VisemeResult | null {
    if (!words || words.length === 0) return null

    const cleanWords = this.preProcessText(words)
    const phonemes = this.textToPhonemes(cleanWords)
    if (!phonemes || phonemes.length === 0) return null

    return this.phonemesToVisemes(phonemes)
  }

  private textToPhonemes(text: string): string[] {
    const words = text.split(' ').filter(word => word.length > 0)
    const phonemes: string[] = []

    for (const word of words) {
      const wordPhonemes = this.wordToPhonemes(word)
      phonemes.push(...wordPhonemes)
    }

    return phonemes
  }

  private wordToPhonemes(word: string): string[] {
    let result = word
    const phonemes: string[] = []

    // Apply rules for each letter
    for (const letter of Object.keys(this.rules)) {
      const rules = this.rules[letter]
      for (const rule of rules) {
        const [pattern, replacement] = rule.split('=')
        if (replacement) {
          const regex = this.createRegexFromPattern(pattern)
          result = result.replace(regex, replacement)
        }
      }
    }

    // Split result into individual phonemes
    const phonemeTokens = result.split(' ').filter(token => token.length > 0)
    for (const token of phonemeTokens) {
      if (this.isValidPhoneme(token)) {
        phonemes.push(token)
      }
    }

    return phonemes
  }

  private createRegexFromPattern(pattern: string): RegExp {
    // Simplified pattern matching - this would need full implementation
    // For now, basic bracket matching
    const escaped = pattern.replace(/\[|\]/g, '').replace(/\^|\+|#|%|:/g, '')
    return new RegExp(escaped, 'gi')
  }

  private isValidPhoneme(token: string): boolean {
    const validPhonemes = ['aa', 'E', 'I', 'O', 'U', 'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR']
    return validPhonemes.includes(token)
  }

  private phonemesToVisemes(phonemes: string[]): VisemeResult {
    const visemes: string[] = []
    const times: number[] = []
    const durations: number[] = []

    let currentTime = 0
    const defaultDuration = 150 // ms

    for (const phoneme of phonemes) {
      const viseme = this.phonemeToViseme(phoneme)
      if (viseme) {
        visemes.push(viseme)
        times.push(currentTime)
        durations.push(defaultDuration)
        currentTime += defaultDuration
      }
    }

    return { visemes, times, durations }
  }

  private phonemeToViseme(phoneme: string): string | null {
    // Mapping from phonemes to visemes
    const mapping: Record<string, string> = {
      'aa': 'aa',
      'E': 'E',
      'I': 'I',
      'O': 'O',
      'U': 'U',
      'PP': 'PP',
      'FF': 'FF',
      'TH': 'TH',
      'DD': 'DD',
      'kk': 'kk',
      'CH': 'CH',
      'SS': 'SS',
      'nn': 'nn',
      'RR': 'RR'
    }

    return mapping[phoneme] || null
  }
}
