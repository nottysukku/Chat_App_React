import React, { useState, useCallback } from "react";
import Modal from "react-modal";
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  TypingIndicator
} from "@chatscope/chat-ui-kit-react";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
import { MessageCircle } from "lucide-react";
import OpenAI from "openai";
import "./chatbot.css";

Modal.setAppElement("#root");
const openai = new OpenAI({
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    dangerouslyAllowBrowser: true
});


const Chatbot = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      message: "Hello, I'm ChatGPT! Ask me anything!",
      sentTime: "just now",
      sender: "ChatGPT"
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const handleSend = useCallback(async (message) => {
    if (!message.trim()) return;

    const newMessage = {
      message,
      direction: "outgoing",
      sender: "user",
      sentTime: new Date().toLocaleTimeString()
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setIsTyping(true);

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: updatedMessages.map((msg) => ({
          role: msg.sender === "ChatGPT" ? "assistant" : "user",
          content: msg.message
        }))
      });

      const assistantMessage = response.choices[0]?.message?.content || "Sorry, I couldn't understand your message.";
      setMessages([
        ...updatedMessages,
        {
          message: assistantMessage,
          sender: "ChatGPT",
          sentTime: new Date().toLocaleTimeString()
        }
      ]);
    } catch (error) {
      console.error("Error processing message:", error);
      setMessages([
        ...updatedMessages,
        {
          message: "Sorry, there was an error processing your message.",
          sender: "ChatGPT",
          sentTime: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  }, [messages]);

  return (
    <div className="chatbot-container">
      <button
        className="chatbot-trigger"
        onClick={() => setIsModalOpen(true)}
        aria-label="Open chat"
      >
        <MessageCircle className="chatbot-icon" />
      </button>

      <Modal
        isOpen={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        className="chatbot-modal"
        overlayClassName="chatbot-overlay"
        
      >
        <div className="modal-content1">
          <div className="modal-header">
            <div className="header-content">
              <div className="status-indicator"></div>
              <h2>AI Assistant</h2>
            </div>
            <button
              onClick={() => setIsModalOpen(false)}
              className="close-button"
              aria-label="Close chat"
            >
              ×
            </button>
          </div>

          <div className="chat-container">
            <MainContainer>
              <ChatContainer>
                <MessageList
                  scrollBehavior="smooth"
                  typingIndicator={isTyping ? <TypingIndicator content="AI is thinking..." /> : null}
                >
                  {messages.map((message, i) => (
                    <Message key={i} model={message} />
                  ))}
                </MessageList>
                <MessageInput
                  placeholder="Type your message here..."
                  onSend={handleSend}
                  attachButton={false}
                />
              </ChatContainer>
            </MainContainer>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Chatbot;
