import type { Meta, StoryObj } from '@storybook/react-vite'

import { ChatBubble } from './ChatBubble'

const meta = {
  title: 'Chat/ChatBubble',
  component: ChatBubble
} satisfies Meta<typeof ChatBubble>

export default meta
type Story = StoryObj<typeof meta>

export const Assistant: Story = {
  args: { message: { id: '1', text: 'Hi! How can I help you today?', isUser: false } }
}

export const User: Story = {
  args: { message: { id: '2', text: 'What time is my next meeting?', isUser: true } }
}
