/**
 * Utility functions for text processing in TTS
 */

function numberToWords(num: number): string {
  const a = [
    '',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
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
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

  const numToWords = (n: number): string => {
    if (n < 20) return a[n]
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? '-' + a[n % 10] : '')
    if (n < 1000) return a[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + numToWords(n % 100) : '')
    return numToWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '')
  }

  return numToWords(num)
}

function convertAmountToWords(amount: number): string {
  const [dollars, cents] = amount.toFixed(2).split('.')
  const dollarPart = numberToWords(parseInt(dollars))
  const centPart = numberToWords(parseInt(cents))
  return `${dollarPart} dollars${Number(cents) > 0 ? ' and ' + centPart + ' cents' : ''}`
}

/**
 * Converts dollar amounts in text to spoken words
 * @param sentence The text to process
 * @returns Text with dollar amounts converted to words
 */
export function fixDollars(sentence: string): string {
  return sentence.replace(/\$\d+(\.\d{1,2})?/g, (match) => {
    const amount = parseFloat(match.replace('$', ''))
    return convertAmountToWords(amount)
  })
}

/**
 * Cleans text for TTS processing
 * @param text The text to clean
 * @returns Cleaned text
 */
export function cleanText(text: string): string {
  return fixDollars(text).replace(/[*<>#%-]/g, '')
}
