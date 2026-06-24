import React, { useState, useEffect } from "react";
import { localDb } from "../../lib/localDb";
import "./sqlConsole.css";

const SqlConsole = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState("SELECT * FROM users");
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (isOpen) {
      // Run initial query to show contents
      handleExecute("SELECT * FROM users");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExecute = (sqlToRun) => {
    const activeSql = sqlToRun || query;
    if (!activeSql.trim()) return;

    try {
      setError(null);
      const res = localDb.query(activeSql);
      setResults(res);
      setHistory((prev) => [activeSql, ...prev.slice(0, 19)]);
    } catch (err) {
      console.error(err);
      setError(err.message || "An error occurred while executing the query.");
      setResults(null);
    }
  };

  const templates = [
    { label: "List Users", sql: "SELECT * FROM users" },
    { label: "List Chats", sql: "SELECT * FROM chats" },
    { label: "List Stories", sql: "SELECT * FROM stories" },
    { label: "My Profile Info", sql: "SELECT * FROM users WHERE id = 'guest_user'" },
    { label: "Update Status", sql: "UPDATE users SET status = 'Offline mode hacker 💻' WHERE id = 'guest_user'" },
  ];

  const renderResults = () => {
    if (!results) return <p className="sql-console__no-data">No results to display.</p>;

    if (Array.isArray(results)) {
      if (results.length === 0) {
        return <p className="sql-console__empty-set">Empty set (0 rows returned).</p>;
      }

      // Render table
      const headers = Object.keys(results[0]);
      return (
        <div className="sql-console__table-wrapper">
          <table className="sql-console__table">
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((row, idx) => (
                <tr key={idx}>
                  {headers.map((h) => {
                    const val = row[h];
                    const displayVal = typeof val === "object" ? JSON.stringify(val) : String(val);
                    return (
                      <td key={h} title={displayVal}>
                        {displayVal.length > 50 ? displayVal.substring(0, 50) + "..." : displayVal}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // Single object response
    return (
      <pre className="sql-console__json">
        {JSON.stringify(results, null, 2)}
      </pre>
    );
  };

  return (
    <div className="sql-console__overlay">
      <div className="sql-console__box">
        <div className="sql-console__header">
          <h3>🗄️ SQLite Interactive Console (Guest DB)</h3>
          <button className="sql-console__close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="sql-console__body">
          <p className="sql-console__intro">
            Interact with the SQLite-style emulated Local Storage database. Write query commands below:
          </p>

          <div className="sql-console__templates">
            {templates.map((t) => (
              <button
                key={t.label}
                className="sql-console__template-btn"
                onClick={() => {
                  setQuery(t.sql);
                  handleExecute(t.sql);
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="sql-console__editor">
            <textarea
              className="sql-console__textarea"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter SQL statement here..."
              rows={4}
            />
            <button className="sql-console__run-btn" onClick={() => handleExecute()}>
              ⚡ Execute Query
            </button>
          </div>

          {error && <div className="sql-console__error">⚠️ Error: {error}</div>}

          <div className="sql-console__results-section">
            <h4>Query Results:</h4>
            <div className="sql-console__results">{renderResults()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SqlConsole;
