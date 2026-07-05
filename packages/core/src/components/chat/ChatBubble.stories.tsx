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

export const LongAssistant: Story = {
  args: {
    message: {
      id: '3',
      text: 'Here is the full rundown: your 9:30 standup is confirmed, the design review moved to 2:00pm, and I drafted a reply to the vendor email that is waiting in your outbox for a final look before it sends.',
      isUser: false
    }
  }
}
