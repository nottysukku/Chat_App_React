import React from 'react'
import './chatbot.css'

const openChatbot = () => {
    alert('Chatbot is not available yet')
}


const Chatbot = () => {
  return (
    <div id="chatbot-father" onClick={openChatbot}>
    <div id="chatbot">
      <img id="chatgpt-icon" src="./chatgpt-icon.jpg" alt="chatbot" />
    </div>
  </div>
  )
}

export default Chatbot
