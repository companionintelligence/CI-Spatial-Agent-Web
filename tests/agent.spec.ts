import { test, expect, type Page } from '@playwright/test'
import { expectedPatterns, getQuestionsFromCategory } from './data/questionBank'

/**
 * Helper function to wait for agent to be ready
 */
async function waitForAgentReady(page: Page) {
  // Wait for the main app container to be visible
  await page.waitForSelector('.app-container, div[class*="min-h-screen"]', { timeout: 30000 })
  
  // Wait for the 3D canvas to load
  await page.waitForSelector('canvas', { timeout: 30000 })
  
  // Give the agent a bit more time to initialize
  await page.waitForTimeout(2000)
}

/**
 * Helper function to send a message to the agent
 */
async function sendMessage(page: Page, message: string) {
  // Find the chat input
  const chatInput = page.locator('input[type="text"], textarea, input[placeholder*="Type"], input[placeholder*="message"]').first()
  
  // Type the message
  await chatInput.fill(message)
  
  // Submit (look for send button or press Enter)
  const sendButton = page.locator('button[type="submit"], button:has-text("Send")').first()
  if (await sendButton.isVisible().catch(() => false)) {
    await sendButton.click()
  } else {
    await chatInput.press('Enter')
  }
}

/**
 * Helper function to wait for and get agent response
 */
async function waitForAgentResponse(page: Page, timeout = 15000): Promise<string> {
  // Wait for a message bubble or response element to appear
  // This will depend on your chat UI structure
  try {
    const responseLocator = page.locator('[class*="message"], [class*="bubble"], [class*="response"]').last()
    await responseLocator.waitFor({ timeout })
    return await responseLocator.textContent() || ''
  } catch (error) {
    console.warn('Could not get agent response:', error)
    return ''
  }
}

/**
 * Helper to check if avatar is animating
 */
async function checkAvatarAnimation(page: Page): Promise<boolean> {
  // Check if canvas is rendering and changing
  const canvas = page.locator('canvas').first()
  
  if (!await canvas.isVisible()) {
    return false
  }
  
  // Take two screenshots of the canvas at different times
  const screenshot1 = await canvas.screenshot()
  await page.waitForTimeout(500)
  const screenshot2 = await canvas.screenshot()
  
  // Compare - if they're different, the avatar is animating
  return Buffer.compare(screenshot1, screenshot2) !== 0
}

test.describe('Agent Question Bank Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/')
    
    // Wait for agent to be ready
    await waitForAgentReady(page)
    
    // Take a screenshot of the initial state
    await page.screenshot({ path: 'playwright-report/screenshots/initial-state.png' })
  })

  test('should load the application successfully', async ({ page }) => {
    // Check that the main container is visible
    await expect(page.locator('.app-container, div[class*="min-h-screen"]')).toBeVisible()
    
    // Check that the canvas is visible
    await expect(page.locator('canvas')).toBeVisible()
    
    // Check that there's some UI element for chat
    const hasChatInput = await page.locator('input, textarea').count() > 0
    expect(hasChatInput).toBe(true)
  })

  test('should have avatar visible and animating', async ({ page }) => {
    // Check canvas is visible
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible()
    
    // Check if avatar is animating
    const isAnimating = await checkAvatarAnimation(page)
    expect(isAnimating).toBe(true)
  })

  test.describe('Greeting Questions', () => {
    for (const question of getQuestionsFromCategory('greetings')) {
      test(`should respond to: "${question}"`, async ({ page }) => {
        await sendMessage(page, question)
        
        const response = await waitForAgentResponse(page)
        
        // Check that we got a response
        expect(response.length).toBeGreaterThan(0)
        
        // Optionally check for expected pattern
        if (expectedPatterns.greetings) {
          expect(response).toMatch(expectedPatterns.greetings)
        }
        
        // Check avatar is still animating after response
        const isAnimating = await checkAvatarAnimation(page)
        expect(isAnimating).toBe(true)
      })
    }
  })

  test.describe('Information Questions', () => {
    for (const question of getQuestionsFromCategory('information').slice(0, 3)) {
      test(`should respond to: "${question}"`, async ({ page }) => {
        await sendMessage(page, question)
        
        const response = await waitForAgentResponse(page)
        
        expect(response.length).toBeGreaterThan(0)
        
        if (expectedPatterns.information) {
          expect(response).toMatch(expectedPatterns.information)
        }
      })
    }
  })

  test.describe('Technical Questions', () => {
    for (const question of getQuestionsFromCategory('technical').slice(0, 2)) {
      test(`should respond to: "${question}"`, async ({ page }) => {
        await sendMessage(page, question)
        
        const response = await waitForAgentResponse(page, 20000) // Longer timeout for complex questions
        
        expect(response.length).toBeGreaterThan(0)
      })
    }
  })

  test.describe('Conversational Questions', () => {
    for (const question of getQuestionsFromCategory('conversational').slice(0, 2)) {
      test(`should respond to: "${question}"`, async ({ page }) => {
        await sendMessage(page, question)
        
        const response = await waitForAgentResponse(page)
        
        expect(response.length).toBeGreaterThan(0)
      })
    }
  })

  test.describe('Math and Logic Questions', () => {
    for (const question of getQuestionsFromCategory('mathLogic').slice(0, 3)) {
      test(`should respond to: "${question}"`, async ({ page }) => {
        await sendMessage(page, question)
        
        const response = await waitForAgentResponse(page)
        
        expect(response.length).toBeGreaterThan(0)
        
        // Check for numbers in response
        if (expectedPatterns.mathLogic) {
          expect(response).toMatch(expectedPatterns.mathLogic)
        }
      })
    }
  })

  test('should handle rapid consecutive messages', async ({ page }) => {
    const questions = ['Hello', 'How are you?', 'What is your name?']
    
    for (const question of questions) {
      await sendMessage(page, question)
      await page.waitForTimeout(500) // Small delay between messages
    }
    
    // Wait for final response
    await waitForAgentResponse(page, 20000)
    
    // Check avatar is still responsive
    const isAnimating = await checkAvatarAnimation(page)
    expect(isAnimating).toBe(true)
  })

  test('should maintain conversation context', async ({ page }) => {
    // First message
    await sendMessage(page, 'My name is Test User')
    await waitForAgentResponse(page)
    
    // Follow-up that requires context
    await sendMessage(page, 'What is my name?')
    const response = await waitForAgentResponse(page)
    
    // Should mention the name we provided
    expect(response.toLowerCase()).toContain('test')
  })
})
