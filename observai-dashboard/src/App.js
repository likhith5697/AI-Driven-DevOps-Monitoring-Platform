import { useState, useRef, useEffect } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000";

function App() {
  const [question, setQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  const chatEndRef = useRef(null);

  // Auto scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, loading]);

  const askAI = async () => {
    if (!question) return;

    const userQuestion = question;

    setChatHistory((prev) => [...prev, { user: userQuestion, ai: null }]);
    setQuestion("");
    setLoading(true);

    try {
      const res = await axios.get(`${API_URL}/ask`, {
        params: { question: userQuestion },
        timeout: 15000,
      });

      const answerText = res.data.answer || "No answer received.";

      setChatHistory((prev) =>
        prev.map((msg, i) =>
          i === prev.length - 1 ? { ...msg, ai: answerText } : msg
        )
      );
    } catch (err) {
      console.error(err);

      setChatHistory((prev) =>
        prev.map((msg, i) =>
          i === prev.length - 1
            ? { ...msg, ai: "Error contacting AI agent." }
            : msg
        )
      );
    }

    setLoading(false);
  };

  const getHealth = async () => {
    setLoading(true);

    setChatHistory((prev) => [...prev, { user: "Get Health Report", ai: null }]);

    try {
      const res = await axios.get(`${API_URL}/health-report`, {
        timeout: 15000,
      });

      const reportText = res.data.report || "No report available.";

      setChatHistory((prev) =>
        prev.map((msg, i) =>
          i === prev.length - 1 ? { ...msg, ai: reportText } : msg
        )
      );
    } catch (err) {
      console.error(err);

      setChatHistory((prev) =>
        prev.map((msg, i) =>
          i === prev.length - 1
            ? { ...msg, ai: "Error fetching health report." }
            : msg
        )
      );
    }

    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>ObservAI Chat Dashboard</h1>

      {/* Chat Window */}
      <div style={styles.chatBox}>
        {chatHistory.length === 0 && !loading && (
          <p style={{ opacity: 0.6 }}>
            Ask about system health, logs, or metrics...
          </p>
        )}

        {chatHistory.map((msg, idx) => (
          <div key={idx} style={styles.chatMessage}>
            <div style={styles.userBubble}>
              <b>You</b>
              <p>{msg.user}</p>
            </div>

            <div style={styles.aiBubble}>
              <b>AI</b>
              <p>{msg.ai || "Analyzing logs and metrics..."}</p>
            </div>
          </div>
        ))}

        {loading && <p style={styles.loading}>AI is analyzing system data...</p>}

        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div style={styles.inputArea}>
        <input
          style={styles.input}
          placeholder="Ask about system health or last request..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && askAI()}
        />

        <button
          style={styles.button}
          onClick={askAI}
          disabled={loading}
        >
          Ask AI
        </button>

        <button
          style={styles.button2}
          onClick={getHealth}
          disabled={loading}
        >
          Health
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "Arial",
    background: "#0f172a",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    color: "white",
    padding: "30px",
  },

  title: {
    textAlign: "center",
    marginBottom: "20px",
  },

  chatBox: {
    flex: 1,
    overflowY: "auto",
    background: "#020617",
    padding: "20px",
    borderRadius: "10px",
    marginBottom: "20px",
  },

  chatMessage: {
    marginBottom: "20px",
  },

  userBubble: {
    background: "#2563eb",
    padding: "12px",
    borderRadius: "10px",
    maxWidth: "60%",
    marginLeft: "auto",
    marginBottom: "10px",
  },

  aiBubble: {
    background: "#1e293b",
    padding: "12px",
    borderRadius: "10px",
    maxWidth: "60%",
  },

  inputArea: {
    display: "flex",
    gap: "10px",
  },

  input: {
    flex: 1,
    padding: "12px",
    borderRadius: "6px",
    border: "1px solid #334155",
  },

  button: {
    padding: "10px 18px",
    background: "#3b82f6",
    border: "none",
    color: "white",
    borderRadius: "5px",
    cursor: "pointer",
  },

  button2: {
    padding: "10px 18px",
    background: "#10b981",
    border: "none",
    color: "white",
    borderRadius: "5px",
    cursor: "pointer",
  },

  loading: {
    opacity: 0.6,
    fontStyle: "italic",
  },
};

export default App;