import React from 'react';
import './LoadingPopup.css'; // Import the CSS file

const LoadingPopup = ({ progress }) => {
  return (
    <div className="loading-popup-overlay">
      <div className="loading-popup-container">
        <div className="loading-spinner-container">
          <div className="loading-spinner"></div>
        </div>
        <p className="loading-text">Uploading file...</p>
        <div className="loading-progress-bar">
          <div
            className="loading-progress-bar-fill"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        <p className="loading-progress-percentage">{Math.round(progress)}%</p>
      </div>
    </div>
  );
};

export default LoadingPopup;
