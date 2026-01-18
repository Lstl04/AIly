import React, { useState, useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import ReactMarkdown from 'react-markdown';
import { 
  Send, 
  User, 
  Mic, 
  Square, 
  Loader2, 
  Hammer, 
  X, 
  Zap, 
  Activity 
} from 'lucide-react';
import './AIly.css';

const AIlySidebar = () => {
  const { getAccessTokenSilently } = useAuth0();
  
  // Sidebar State
  const [isOpen, setIsOpen] = useState(false);
  
  // Chat State
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      content: `**AIly Online.** I'm locked into your business data. What's the job?
      
* **Tracking**: "List all unpaid invoices from this month."
* **Scheduling**: "Put a repair job for 2 PM tomorrow on the calendar."`
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Audio State
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const messagesEndRef = useRef(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  // --- Audio Recording Logic ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
        await handleVoiceTranscription(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (err) {
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  const handleVoiceTranscription = async (blob) => {
    setIsTranscribing(true);
    const formData = new FormData();
    formData.append('file', blob, 'recording.wav');

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch('http://127.0.0.1:8000/api/agent/chat/voice', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();
      if (data.user_text) {
        setInput(data.user_text);
        await executeChat(data.user_text);
      }
    } catch (err) {
      console.error("Transcription error:", err);
    } finally {
      setIsTranscribing(false);
    }
  };

  // --- Chat Logic ---
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const executeChat = async (messageText) => {
    if (!messageText.trim()) return;

    const userMessage = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch('http://127.0.0.1:8000/api/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ message: messageText })
      });

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Connection lost. Check server." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* 1. Minimized Floating Trigger (The Circle) */}
      {!isOpen && (
        <button className="ailly-fab" onClick={() => setIsOpen(true)}>
          <Hammer size={28} />
          <div className="status-dot"></div>
        </button>
      )}

      {/* 2. Sliding Sidebar */}
      <div className={`ailly-sidebar ${isOpen ? 'open' : ''}`}>
        
        {/* Assistant Header Dashboard */}
        <div className="sidebar-header">
          <div className="status-strip">
            <div className="status-indicator">
              <Activity size={12} className="pulse-icon" />
              <span>AILY SYSTEM ACTIVE</span>
            </div>
            <button className="close-btn" onClick={() => setIsOpen(false)}>
              <X size={18} />
            </button>
          </div>
          
          <div className="assistant-identity">
            <div className="avatar-frame">
              <Hammer size={28} />
            </div>
            <div className="id-text">
              <h2>AILY</h2>
              <p>Industrial CFO Assistant</p>
            </div>
          </div>
        </div>

        {/* Messages Container */}
        <div className="sidebar-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`msg-wrapper ${msg.role}`}>
              <div className="bubble">
                {msg.role === 'assistant' ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="msg-wrapper assistant">
              <div className="bubble thinking">
                <span></span><span></span><span></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Footer Input Tray */}
        <div className="sidebar-footer">
          <form className="input-row" onSubmit={(e) => { e.preventDefault(); executeChat(input); }}>
            <input 
              type="text" 
              placeholder={isTranscribing ? "TRANSCRIBING..." : "ENTER COMMAND..."} 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading || isTranscribing}
            />
            <button type="submit" disabled={isLoading || !input.trim() || isTranscribing}>
              <Send size={18} />
            </button>
          </form>

          {/* Voice Command Button */}
          <button 
            type="button"
            className={`mic-button ${isRecording ? 'active' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isLoading || isTranscribing}
          >
            {isTranscribing ? (
              <Loader2 className="spin" size={20} />
            ) : isRecording ? (
              <Square size={20} />
            ) : (
              <Mic size={20} />
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default AIlySidebar;