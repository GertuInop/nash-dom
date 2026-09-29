import { ChevronLeft, MessageCircle, Send } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppStore, useUser } from '../store'
import { EmptyState } from '../ui'

function avatarLetter(type: string) {
  if (type === 'uk') return 'UK'
  if (type === 'topic') return 'T'
  return 'O'
}

function ChatComposer({ chatId }: { chatId: string }) {
  const sendMessage = useAppStore((s) => s.sendMessage)
  const lastSendAt = useAppStore((s) => s.lastSendAt)
  const [text, setText] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 400)
    return () => window.clearInterval(id)
  }, [])

  const wait = Math.max(0, 3000 - (now - lastSendAt))
  const disabled = wait > 0 || !text.trim()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (disabled) return
    const ok = await sendMessage(chatId, text)
    if (ok) setText('')
  }

  return (
    <form className="composer" onSubmit={onSubmit}>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={wait > 0 ? `Подождите ${Math.ceil(wait / 1000)} с` : 'Сообщение'}
      />
      <button className="send" type="submit" disabled={disabled} aria-label="Отправить">
        <Send size={18} />
      </button>
    </form>
  )
}

function Thread({ chatId }: { chatId: string }) {
  const user = useUser()
  const chats = useAppStore((s) => s.chats)
  const messagesAll = useAppStore((s) => s.messages)
  const messages = messagesAll.filter((m) => m.chatId === chatId)
  const chat = chats.find((c) => c.id === chatId)
  const navigate = useNavigate()

  if (!chat) {
    return <EmptyState icon={<MessageCircle size={40} />} title="Чат не найден" text="" />
  }

  return (
    <div className="chat-main">
      <header className="header thread-bar">
        <button
          type="button"
          className="icon-btn"
          aria-label="Назад"
          onClick={() => navigate('/app/chats')}
        >
          <ChevronLeft size={22} />
        </button>
        <div className="grow">
          <h2>{chat.name}</h2>
          <div className="sub">{chat.type === 'topic' ? 'Тема дома' : 'Чат дома'}</div>
        </div>
      </header>
      <div className="content">
        <div className="messages">
          {messages.length === 0 ? (
            <p className="muted" style={{ textAlign: 'center' }}>
              Напишите первое сообщение
            </p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`bubble${m.hidden ? ' hidden' : m.senderId === user?.id ? ' me' : ''}`}
              >
                {m.hidden ? (
                  m.text
                ) : (
                  <>
                    <div className="who">{m.senderName}</div>
                    <div>{m.text}</div>
                    <div className="time">{m.time}</div>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      <ChatComposer chatId={chatId} />
    </div>
  )
}

export function ChatsScreen() {
  const user = useUser()
  const chatsAll = useAppStore((s) => s.chats)
  const chats = chatsAll.filter((c) => c.houseId === user?.houseId)
  const { chatId } = useParams()
  const navigate = useNavigate()
  const wide = useMediaWide()

  const list = (
    <div className="chat-list">
      <div className="pad" style={{ paddingBottom: 0 }}>
        <button type="button" className="back-btn" onClick={() => navigate('/app')}>
          <ChevronLeft size={18} /> Назад
        </button>
      </div>
      {chats.length === 0 ? (
        <EmptyState
          icon={<MessageCircle size={40} />}
          title="Нет чатов"
          text="Выберите дом — появятся общий чат и чат с УК."
        />
      ) : (
        chats.map((chat) => (
          <button
            key={chat.id}
            type="button"
            className={chatId === chat.id ? 'chat-row active' : 'chat-row'}
            onClick={() => navigate(`/app/chats/${chat.id}`)}
          >
            <div className={`avatar${chat.type === 'uk' ? ' uk' : chat.type === 'topic' ? ' t' : ''}`}>
              {avatarLetter(chat.type)}
            </div>
            <div className="grow">
              <div className="row-top">
                <strong>{chat.name}</strong>
                <span className="muted" style={{ fontSize: 12 }}>
                  {chat.time}
                </span>
              </div>
              <div className="preview">{chat.lastMessage}</div>
            </div>
            {chat.unread > 0 ? <span className="unread">{chat.unread}</span> : null}
          </button>
        ))
      )}
    </div>
  )

  if (wide) {
    return (
      <div className="chat-layout">
        {list}
        {chatId ? (
          <Thread chatId={chatId} />
        ) : (
          <div className="chat-placeholder">Выберите чат слева</div>
        )}
      </div>
    )
  }

  if (chatId) return <Thread chatId={chatId} />
  return <div className="chat-layout">{list}</div>
}

export function useMediaWide() {
  const [wide, setWide] = useState(() => window.matchMedia('(min-width: 900px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 900px)')
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}
