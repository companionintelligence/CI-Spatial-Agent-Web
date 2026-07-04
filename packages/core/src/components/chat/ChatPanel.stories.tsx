import type { Meta, StoryObj } from '@storybook/react-vite'

import type { ConversationMessage } from '../../services/conversation/conversationType'
import { ChatPanel } from './ChatPanel'

const messages: ConversationMessage[] = [
  { id: '1', text: 'Hey, can you summarize my morning?', isUser: true, timestamp: 1 },
  {
    id: '2',
    text: 'Good morning! You have a standup at 9:30 and a design review at 11.',
    isUser: false,
    timestamp: 2
  },
  { id: '3', text: 'Move the design review to the afternoon.', isUser: true, timestamp: 3 },
  {
    id: '4',
    text: 'Done — the design review is now at 2:00pm and everyone has been notified.',
    isUser: false,
    timestamp: 4
  }
]

const meta = {
  title: 'Chat/ChatPanel',
  component: ChatPanel,
  parameters: { layout: 'fullscreen' },
  args: { messages }
} satisfies Meta<typeof ChatPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Conversation: Story = {}

export const Empty: Story = {
  args: { messages: [] }
}
