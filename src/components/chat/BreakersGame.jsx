import React, { useEffect, useRef, useState } from "react";
import "./breakersGame.css";

const BreakersGame = ({ onSuccess }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameState, setGameState] = useState("start"); // "start", "playing", "lost", "won"
  const [paddleX, setPaddleX] = useState(0);
  
  // Game parameters
  const canvasWidth = 480;
  const canvasHeight = 300;
  const paddleHeight = 12;
  const paddleWidth = 75;
  const ballRadius = 8;
  
  // Bricks configuration: 3 rows, 6 columns
  const brickRowCount = 3;
  const brickColumnCount = 6;
  const brickWidth = 65;
  const brickHeight = 16;
  const brickPadding = 10;
  const brickOffsetTop = 45;
  const brickOffsetLeft = 20;

  // Mutable game state using refs to avoid closure stale state in animation loop
  const ballState = useRef({
    x: canvasWidth / 2,
    y: canvasHeight - 30,
    dx: 3,
    dy: -3
  });
  
  const currentPaddleX = useRef((canvasWidth - paddleWidth) / 2);
  const bricks = useRef([]);
  const keysPressed = useRef({ left: false, right: false });
  const animationFrameId = useRef(null);

  // Initialize bricks
  const initBricks = () => {
    const tempBricks = [];
    for (let c = 0; c < brickColumnCount; c++) {
      tempBricks[c] = [];
      for (let r = 0; r < brickRowCount; r++) {
        tempBricks[c][r] = { x: 0, y: 0, status: 1, color: getBrickColor(r) };
      }
    }
    bricks.current = tempBricks;
  };

  const getBrickColor = (row) => {
    if (row === 0) return "#ef4444"; // Red
    if (row === 1) return "#fbbf24"; // Orange
    return "#3b82f6"; // Blue
  };

  // Reset ball and paddle
  const resetPosition = () => {
    ballState.current = {
      x: canvasWidth / 2,
      y: canvasHeight - 40,
      dx: 2.5 + Math.random() * 1,
      dy: -3
    };
    currentPaddleX.current = (canvasWidth - paddleWidth) / 2;
  };

  const handleStartGame = () => {
    initBricks();
    resetPosition();
    setScore(0);
    setLives(3);
    setGameState("playing");
  };

  // Input listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Right" || e.key === "ArrowRight") {
        keysPressed.current.right = true;
      } else if (e.key === "Left" || e.key === "ArrowLeft") {
        keysPressed.current.left = true;
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === "Right" || e.key === "ArrowRight") {
        keysPressed.current.right = false;
      } else if (e.key === "Left" || e.key === "ArrowLeft") {
        keysPressed.current.left = false;
      }
    };

    const handleMouseMove = (e) => {
      if (!canvasRef.current || gameState !== "playing") return;
      const rect = canvasRef.current.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      if (relativeX > 0 && relativeX < canvasWidth) {
        currentPaddleX.current = Math.max(0, Math.min(canvasWidth - paddleWidth, relativeX - paddleWidth / 2));
        setPaddleX(currentPaddleX.current);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [gameState]);

  // Main game loop
  useEffect(() => {
    if (gameState !== "playing") {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const drawBall = () => {
      ctx.beginPath();
      ctx.arc(ballState.current.x, ballState.current.y, ballRadius, 0, Math.PI * 2);
      ctx.fillStyle = "#10b981"; // Emerald green
      ctx.shadowBlur = 10;
      ctx.shadowColor = "#10b981";
      ctx.fill();
      ctx.closePath();
      ctx.shadowBlur = 0; // reset
    };

    const drawPaddle = () => {
      ctx.beginPath();
      ctx.rect(currentPaddleX.current, canvasHeight - paddleHeight - 5, paddleWidth, paddleHeight);
      ctx.fillStyle = "#38bdf8"; // Sky blue
      ctx.shadowBlur = 8;
      ctx.shadowColor = "#38bdf8";
      ctx.fill();
      ctx.closePath();
      ctx.shadowBlur = 0; // reset
    };

    const drawBricks = () => {
      for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
          if (bricks.current[c][r].status === 1) {
            const brickX = c * (brickWidth + brickPadding) + brickOffsetLeft;
            const brickY = r * (brickHeight + brickPadding) + brickOffsetTop;
            bricks.current[c][r].x = brickX;
            bricks.current[c][r].y = brickY;
            ctx.beginPath();
            ctx.rect(brickX, brickY, brickWidth, brickHeight);
            ctx.fillStyle = bricks.current[c][r].color;
            ctx.shadowBlur = 6;
            ctx.shadowColor = bricks.current[c][r].color;
            ctx.fill();
            ctx.closePath();
            ctx.shadowBlur = 0; // reset
          }
        }
      }
    };

    const collisionDetection = () => {
      let activeBricks = 0;
      for (let c = 0; c < brickColumnCount; c++) {
        for (let r = 0; r < brickRowCount; r++) {
          const b = bricks.current[c][r];
          if (b.status === 1) {
            activeBricks++;
            // Check intersection
            if (
              ballState.current.x > b.x &&
              ballState.current.x < b.x + brickWidth &&
              ballState.current.y > b.y &&
              ballState.current.y < b.y + brickHeight
            ) {
              ballState.current.dy = -ballState.current.dy;
              b.status = 0;
              setScore((s) => s + 10);
              
              // Speed up ball slightly on hit to make it interesting
              ballState.current.dx *= 1.02;
              ballState.current.dy *= 1.02;
            }
          }
        }
      }
      
      // Win condition: no active bricks left
      if (activeBricks === 0) {
        setGameState("won");
      }
    };

    const updateGame = () => {
      // Clear
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      
      // Draw elements
      drawBricks();
      drawBall();
      drawPaddle();
      
      // Collide bricks
      collisionDetection();

      // Keyboard paddle movement
      if (keysPressed.current.right) {
        currentPaddleX.current = Math.min(canvasWidth - paddleWidth, currentPaddleX.current + 7);
      } else if (keysPressed.current.left) {
        currentPaddleX.current = Math.max(0, currentPaddleX.current - 7);
      }

      // Ball wall bouncing
      if (ballState.current.x + ballState.current.dx > canvasWidth - ballRadius || ballState.current.x + ballState.current.dx < ballRadius) {
        ballState.current.dx = -ballState.current.dx;
      }
      
      if (ballState.current.y + ballState.current.dy < ballRadius) {
        ballState.current.dy = -ballState.current.dy;
      } else if (ballState.current.y + ballState.current.dy > canvasHeight - ballRadius - paddleHeight - 5) {
        // Paddle collision check
        if (
          ballState.current.x > currentPaddleX.current - 2 && 
          ballState.current.x < currentPaddleX.current + paddleWidth + 2
        ) {
          // Calculate bounce angle depending on where it hits paddle
          const relativeHit = (ballState.current.x - (currentPaddleX.current + paddleWidth / 2)) / (paddleWidth / 2);
          ballState.current.dx = relativeHit * 4;
          ballState.current.dy = -Math.abs(ballState.current.dy);
        } else if (ballState.current.y + ballState.current.dy > canvasHeight - ballRadius) {
          // Ball fell past bottom boundary
          setLives((prevLives) => {
            const nextLives = prevLives - 1;
            if (nextLives === 0) {
              setGameState("lost");
            } else {
              resetPosition();
            }
            return nextLives;
          });
        }
      }

      // Move ball
      ballState.current.x += ballState.current.dx;
      ballState.current.y += ballState.current.dy;

      if (gameState === "playing") {
        animationFrameId.current = requestAnimationFrame(updateGame);
      }
    };

    updateGame();

    return () => {
      cancelAnimationFrame(animationFrameId.current);
    };
  }, [gameState]);

  return (
    <div className="wa-breakers" ref={containerRef}>
      <div className="wa-breakers__card">
        <h2 className="wa-breakers__title">🎮 BREAKERS ESCAPE GAME</h2>
        
        {gameState === "start" && (
          <div className="wa-breakers__screen">
            <p className="wa-breakers__desc">
              To exit the AI Boredom Zone, you must break all the bricks and escape!
            </p>
            <p className="wa-breakers__hint">
              Use your <strong>Mouse</strong> or <strong>Left/Right Arrow Keys</strong> to move the blue paddle.
            </p>
            <button className="wa-breakers__btn wa-breakers__btn--start" onClick={handleStartGame}>
              Start Game
            </button>
          </div>
        )}

        {gameState === "playing" && (
          <div className="wa-breakers__game-wrapper">
            <div className="wa-breakers__hud">
              <span>❤️ Lives: {lives}</span>
              <span>⭐ Score: {score}</span>
            </div>
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              className="wa-breakers__canvas"
            />
          </div>
        )}

        {gameState === "lost" && (
          <div className="wa-breakers__screen">
            <div className="wa-breakers__screen-icon">💀</div>
            <h3>GAME OVER</h3>
            <p className="wa-breakers__desc">You got blasted by the bricks. Don't worry, the bots are laughing, but you can retry!</p>
            <button className="wa-breakers__btn wa-breakers__btn--retry" onClick={handleStartGame}>
              Retry Game
            </button>
          </div>
        )}

        {gameState === "won" && (
          <div className="wa-breakers__screen">
            <div className="wa-breakers__screen-icon">🎉</div>
            <h3>VICTORY!</h3>
            <p className="wa-breakers__desc">You cleared all the bricks and earned your exit pass from the AI Boredom Zone!</p>
            <button className="wa-breakers__btn wa-breakers__btn--exit" onClick={onSuccess}>
              Exit Boredom Group
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BreakersGame;
