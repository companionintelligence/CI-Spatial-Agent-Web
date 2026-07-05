import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { ChatInput } from './ChatInput'

/**
 * ChatInput is a controlled component (its text lives in the parent). The
 * stories host it in a tiny stateful wrapper so typing behaves like it does in
 * the app, while still exercising the real `onSubmit` callback via `fn()`.
 */
const meta = {
  title: 'Chat/ChatInput',
  component: ChatInput,
  parameters: { layout: 'fullscreen' },
  args: {
    message: '',
    onMessageChange: fn(),
    onSubmit: fn(),
    onKeyPress: fn(),
    isRecording: false
  }
} satisfies Meta<typeof ChatInput>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {}

export const WithText: Story = {
  args: { message: 'What is on my calendar tomorrow?' }
}

export const Recording: Story = {
  args: { isRecording: true, vadDetecting: true }
}

export const SttListening: Story = {
  args: { isRecording: true, sttListening: true, sttTranscript: 'remind me to' }
}

/**
 * Type into the field and press the send button; assert `onSubmit` fired with
 * the typed text. A stateful wrapper feeds `message` back so the controlled
 * textarea updates as the user types.
 */
export const TypeAndSubmit: Story = {
  render: (args) => {
    const [message, setMessage] = useState(args.message)
    return (
      <ChatInput
        {...args}
        message={message}
        onMessageChange={(value) => {
          args.onMessageChange(value)
          setMessage(value)
        }}
      />
    )
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement)
    const textarea = canvas.getByPlaceholderText('Type your message here...')
    await userEvent.type(textarea, 'hello there')
    await userEvent.click(canvas.getByRole('button'))
    await expect(args.onSubmit).toHaveBeenCalledWith('hello there')
  }
}
