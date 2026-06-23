import React, { useState, useCallback, useRef, useEffect } from 'react';
import './chatbot.css';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

const Chatbot = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hello! I'm your AI assistant powered by Gemini. Ask me anything!" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch(GEMINI_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: updatedMessages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content }]
          }))
        })
      });

      const data = await response.json();
      const assistantMessage = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';
      
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }]);
    } catch (error) {
      console.error('Gemini API error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, there was an error. Please try again.' }]);
    } finally {
      setIsTyping(false);
    }
  }, [input, messages]);

  if (!isOpen) return null;

  return (
    <div className="wa-chatbot__overlay">
      <div className="wa-chatbot__container">
        <div className="wa-chatbot__header">
          <div className="wa-chatbot__header-info">
            <div className="wa-chatbot__status-dot"></div>
            <h3>Gemini AI Assistant</h3>
          </div>
          <button className="wa-chatbot__close" onClick={onClose}>✕</button>
        </div>
        <div className="wa-chatbot__messages">
          {messages.map((msg, i) => (
            <div key={i} className={`wa-chatbot__msg ${msg.role === 'user' ? 'wa-chatbot__msg--user' : 'wa-chatbot__msg--bot'}`}>
              <div className="wa-chatbot__bubble">
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="wa-chatbot__msg wa-chatbot__msg--bot">
              <div className="wa-chatbot__bubble wa-chatbot__typing">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="wa-chatbot__input-area">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            placeholder="Ask Gemini anything..."
            className="wa-chatbot__input"
          />
          <button onClick={handleSend} className="wa-chatbot__send" disabled={!input.trim() || isTyping}>
            ➤
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
