import React, { useState, useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import ReactMarkdown from 'react-markdown';
import { Send, Bot, User, Sparkles } from 'lucide-react'; // Nice icons
import './Agent.css';

const AgentChat = () => {
  const { getAccessTokenSilently, user } = useAuth0();
  const [messages, setMessages] = useState([
  { 
    role: 'assistant', 
    content: `👋 **Welcome to your Business Command Center.** I'm your CFO AI Partner. I'm here to help you manage your finances, automate your workflows, and navigate the app. Here are a few things I can do for you:

* **Financial Analysis**: Ask me things like *"Who was my highest-paying client last month?"* or *"Summarize my expenses by category."*
* **Workflow Automation**: I can handle tasks like *"Remind John about his unpaid invoice"* or *"Add my job tomorrow at 9 AM to my calendar."*
* **App Navigation**: If you're lost, just ask *"Where do I upload receipts?"*

How can I help you grow your business today?`
  }
]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
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
        body: JSON.stringify({ message: userMessage.content })
      });

      const data = await response.json();
      
      // Add Bot Response
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I had trouble connecting to the server." }]);
    } finally {
      setIsLoading(false);
    }
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
        
        {/* Loading Indicator */}
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
          placeholder="Ask about your data..." 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default AgentChat;