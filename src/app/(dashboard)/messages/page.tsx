import type { Metadata } from 'next'
import { MessagesContent } from './messages-content'

export const metadata: Metadata = { title: 'Mensajes' }

export default function MessagesPage() {
  return <MessagesContent />
}
