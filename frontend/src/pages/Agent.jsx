import React, { useState, useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import ReactMarkdown from 'react-markdown';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Mic, 
  Square, 
  Loader2 
} from 'lucide-react';
import './Agent.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const AgentChat = () => {
  const { getAccessTokenSilently } = useAuth0();
  const [messages, setMessages] = useState([
    { 
      role: 'assistant', 
      content: `👋 **Welcome to your Business Command Center.** I'm your CFO AI Partner. I'm here to help you manage your finances, automate your workflows, and navigate the app. 

* **Financial Analysis**: Ask me things like *"Who was my highest-paying client last month?"*
* **Workflow Automation**: I can handle tasks like *"Add my job tomorrow at 9 AM to my calendar."*

How can I help you grow your business today?`
    }
  ]);
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };

      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
        await handleVoiceTranscription(audioBlob);
        
        // Stop all tracks to turn off the red mic light in browser
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied:", err);
      alert("Please allow microphone access to use voice search.");
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
      const response = await fetch(`${API_URL}/agent/chat/voice`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData,
      });

      const data = await response.json();
      if (data.user_text) {
        setInput(data.user_text);
        // Automatically trigger the send logic with the new text
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
  }, [messages]);

  const executeChat = async (messageText) => {
    if (!messageText.trim()) return;

    const userMessage = { role: 'user', content: messageText };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`${API_URL}/agent/chat`, {
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
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I had trouble connecting." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    executeChat(input);
  };

  return (
    <div className="chat-layout">
      {/* Header */}
      <div className="chat-header">
        <Sparkles className="icon-brand" />
        <h2>CFO Agent</h2>
      </div>

      {/* Messages Area */}
      <div className="messages-container">
        {messages.map((msg, index) => (
          <div key={index} className={`message-wrapper ${msg.role}`}>
            <div className="avatar">
              {msg.role === 'assistant' ? <Bot size={20} /> : <User size={20} />}
            </div>
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
          <div className="message-wrapper assistant">
            <div className="avatar"><Bot size={20} /></div>
            <div className="bubble thinking">
              <span>.</span><span>.</span><span>.</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form className="input-area" onSubmit={handleSend}>
        <input 
          type="text" 
          placeholder={isTranscribing ? "Transcribing voice..." : "Ask about your data..."} 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading || isTranscribing}
        />
        <button type="submit" disabled={isLoading || !input.trim() || isTranscribing}>
          <Send size={20} />
        </button>
      </form>

      {/* Floating Speech Button */}
      <button 
        type="button"
        className={`voice-fab ${isRecording ? 'recording' : ''} ${isTranscribing ? 'processing' : ''}`}
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isLoading || isTranscribing}
        title="Speech to Text"
      >
        {isTranscribing ? (
          <Loader2 className="animate-spin" size={24} />
        ) : isRecording ? (
          <Square size={24} fill="white" />
        ) : (
          <Mic size={24} />
        )}
      </button>
    </div>
  );
};

export default AgentChat;