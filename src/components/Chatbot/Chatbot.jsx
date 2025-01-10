import React, { useState } from "react";
import Modal from "react-modal";
import axios from "axios";
import './chatbot.css';

Modal.setAppElement("#root");

const Chatbot = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e) => {
    setInputText(e.target.value);
  };

  const handleSubmit = async () => {
    if (!inputText.trim()) return;
    
    setLoading(true);
    try {
      const res = await axios.post("YOUR_LLAMA_API_URL", {
        prompt: inputText,
      }, {
        headers: {
          Authorization: `Bearer YOUR_API_KEY`,
        },
      });
      setResponse(res.data.response || "No response received.");
    } catch (error) {
      setResponse("Error: " + error.message);
    }
    setLoading(false);
  };

  const openChatbot = (e) => {
    e.stopPropagation();
    setIsModalOpen(true);
  };

  const closeChatbot = () => {
    setIsModalOpen(false);
  };

  return (
    <>
      <div className="chatbot-father">
        <div className="chatbot" onClick={openChatbot}>
          <img className="chatgpt-icon" src="./chatgpt-icon.jpg" alt="chatbot" />
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onRequestClose={closeChatbot}
        shouldCloseOnOverlayClick={true}
        shouldCloseOnEsc={true}
        style={{
          overlay: {
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            zIndex: 99999999999
          },
          content: {
            display: 'flex',
            justifyContent: 'center',
            position: 'absolute',
            top: '50%',
            left: '50%',
            right: 'auto',
            bottom: 'auto',
            transform: 'translate(-50%, -50%)',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '80vh',
            padding: '20px',
            borderRadius: '15px',
            border: 'none',
            background: '#fff',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            overflow: 'auto'
          }
        }}
      >
        <div className="modal-content">
          <div className="modal-header">
            <h2>Chat with AI Assistant</h2>
            <button onClick={closeChatbot} className="close-button">×</button>
          </div>

          <div className="input-section">
            <textarea
              value={inputText}
              onChange={handleInputChange}
              placeholder="Type your message here..."
              className="input-field"
            />
            <button 
              onClick={handleSubmit} 
              disabled={loading || !inputText.trim()} 
              className={`submit-button ${loading ? 'loading' : ''}`}
            >
              {loading ? "Processing..." : "Send"}
            </button>
          </div>

          {response && (
            <div className="response-section">
              <div className="response-content">
                {response}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default Chatbot;