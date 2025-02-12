import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

//
// Types
//
type Room = {
  id: number;
  title: string;
  question: string;
  hint: string;
  answer: string;
};

type PlayerData = {
  id: string;
  name: string;
  solvedRooms: { room: number; timeTaken: number }[];
  finished: boolean;
  totalTime?: number;
};

//
// Data & Rooms
//
const rooms: Room[] = [
  {
    id: 1,
    title: 'The Cipher Door',
    question:
      'Decode this message to find the key: "Uifsf jt b tfdsfu nfub fodpefe!"',
    hint: 'Shift each letter back by -1',
    answer: 'there is a secret meta encoded',
  },
  {
    id: 2,
    title: 'The Debugging Maze',
    question: `Fix the error in this Python code:
    
def greet(name)
    print("Hello " + name)`,
    hint: 'Check the function definition syntax',
    answer: 'def greet(name):',
  },
];

//
// Main Component
//
const App: React.FC = () => {
  //
  // Login & Mode States
  //
  const [loginInput, setLoginInput] = useState<string>('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [playerName, setPlayerName] = useState<string>('');

  //
  // Game States (only for players)
  //
  const [currentRoom, setCurrentRoom] = useState<number>(1);
  const [timer, setTimer] = useState<number>(100); // Adjusted for testing; change to 600 for 10 minutes
  const [answer, setAnswer] = useState<string>('');
  const [showHint, setShowHint] = useState<boolean>(false);
  const [hintsRemaining, setHintsRemaining] = useState<number>(3);
  const [score, setScore] = useState<number>(0);
  const [gameStartTime, setGameStartTime] = useState<number>(0);
  // State to show the finish modal
  const [showFinishModal, setShowFinishModal] = useState<boolean>(false);
  // New state to show the game over modal when time is up.
  const [showGameOverModal, setShowGameOverModal] = useState<boolean>(false);

  //
  // Admin Panel Data (players progress)
  //
  const [playersData, setPlayersData] = useState<PlayerData[]>([]);

  //
  // Socket Connection
  //
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to the Socket.IO server.
    socketRef.current = io('http://localhost:4000');
    // Listen for updates about players’ progress.
    socketRef.current.on('playersUpdate', (data: PlayerData[]) => {
      setPlayersData(data);
    });
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  //
  // When a player logs in (and is not an admin) start the game and emit "playerJoined".
  //
  useEffect(() => {
    if (isLoggedIn && !isAdmin) {
      socketRef.current?.emit('playerJoined', { name: playerName });
      setGameStartTime(Date.now());
    }
  }, [isLoggedIn, isAdmin, playerName]);

  //
  // Timer effect – only for players (not admins)
  //
  useEffect(() => {
    if (!isLoggedIn || isAdmin) return; // do not run for admin
    const countdown = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(countdown);
  }, [isLoggedIn, isAdmin]);

  //
  // When timer reaches 0, trigger the Game Over modal.
  //
  useEffect(() => {
    if (timer === 0) {
      setShowGameOverModal(true);
    }
  }, [timer]);

  //
  // Before unload event handler to warn the user about refreshing the page.
  //
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // This message may not be shown in modern browsers, but it triggers the confirmation dialog.
      e.preventDefault();
      e.returnValue = "Warning: All your progress will be lost if you refresh the page. Are you sure?";
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  //
  // Helper function to format seconds into mm:ss
  //
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  //
  // Handle login – if the entered value matches "adminfusiontech", switch to admin mode;
  // otherwise, use the entered name as the player’s name.
  //
  const handleLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = loginInput.trim();
    if (trimmed === 'adminfusiontech') {
      setIsAdmin(true);
      setPlayerName('Admin');
    } else if (trimmed !== '') {
      setPlayerName(trimmed);
      setIsLoggedIn(true);
    }
    setLoginInput('');
  };

  //
  // When a player submits an answer
  //
  const handleSubmit = (): void => {
    // Prevent submission if game is over
    if (showGameOverModal) return;

    const currentQuestion = rooms[currentRoom - 1];
    if (
      answer.toLowerCase().trim() === currentQuestion.answer.toLowerCase().trim()
    ) {
      // Correct answer: increase score
      setScore((prev) => prev + 100);
      // Calculate cumulative time (in seconds) from game start
      const timeTaken = Math.floor((Date.now() - gameStartTime) / 1000);
      // Tell the server this room was solved
      socketRef.current?.emit('roomSolved', {
        name: playerName,
        room: currentRoom,
        timeTaken: timeTaken,
      });
      if (currentRoom < rooms.length) {
        setCurrentRoom((prev) => prev + 1);
        setAnswer('');
        setShowHint(false);
      } else {
        // Game complete – emit finish event with total time and show finish modal
        socketRef.current?.emit('gameFinished', {
          name: playerName,
          totalTime: timeTaken,
        });
        setShowFinishModal(true);
      }
    } else {
      // Incorrect answer: reduce score and notify the player.
      setScore((prev) => Math.max(0, prev - 20));
      alert('Incorrect answer. Try again!');
    }
  };

  //
  // Show a hint (if available)
  //
  const showHintHandler = (): void => {
    if (hintsRemaining > 0) {
      setHintsRemaining((prev) => prev - 1);
      setShowHint(true);
    }
  };

  //
  // If the user hasn’t logged in yet, render the login screen.
  //
  if (!isLoggedIn && !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <form
          onSubmit={handleLogin}
          className="bg-gray-800 p-6 rounded-lg border border-purple-600"
        >
          <h2 className="text-2xl mb-4">Enter Your Name</h2>
          <input
            type="text"
            value={loginInput}
            onChange={(e) => setLoginInput(e.target.value)}
            className="w-full bg-gray-700 border border-purple-500 p-2 rounded mb-4"
            placeholder="Enter your name or admin key..."
          />
          <button
            type="submit"
            className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded w-full"
          >
            Start
          </button>
        </form>
      </div>
    );
  }

  //
  // If in admin mode, render the admin panel.
  //
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <h1 className="text-3xl font-bold mb-4">Admin Panel</h1>
        <h1 className="text-2xl font-bold mb-4 text-red-500 bg-red-900 border rounded-md p-2 w-fit">
          do not refresh the page⚠️💀
        </h1>

        {playersData.length === 0 ? (
          <p>No players have joined yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-gray-800 border border-purple-600">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b border-purple-500">
                    Player Name
                  </th>
                  <th className="py-2 px-4 border-b border-purple-500">
                    Solved Rooms
                  </th>
                  <th className="py-2 px-4 border-b border-purple-500">
                    Total Time (s)
                  </th>
                </tr>
              </thead>
              <tbody>
                {playersData.map((player) => (
                  <tr key={player.id} className="text-center">
                    <td className="py-2 px-4 border-b border-purple-500">
                      {player.name}
                    </td>
                    <td className="py-2 px-4 border-b border-purple-500">
                      {player.solvedRooms.length > 0
                        ? player.solvedRooms
                            .map(
                              (r) =>
                                `Room ${r.room} (at ${r.timeTaken}s)`
                            )
                            .join(', ')
                        : 'None'}
                    </td>
                    <td className="py-2 px-4 border-b border-purple-500">
                      {player.finished ? player.totalTime : 'In progress'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  //
  // Player Game UI
  //
  const currentQuestion = rooms[currentRoom - 1];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 w-[375px] mx-auto">
      <div className="fixed top-0 left-0 w-full bg-gray-800 p-4 border-b border-purple-600">
        <div className="flex justify-between items-center">
          <span className="bg-purple-800 text-white px-2 py-1 rounded">
            Player: {playerName}
          </span>
          <span className="text-red-500 text-2xl font-mono">
            {formatTime(timer)}
          </span>
          <span className="text-green-400">
            Room {currentRoom}/{rooms.length}
          </span>
        </div>
      </div>
      <div className="mt-20 mb-24">
        <div className="h-2 bg-gray-700 rounded overflow-hidden mb-6">
          <div
            className="h-full bg-purple-500"
            style={{ width: `${(currentRoom / rooms.length) * 100}%` }}
          ></div>
        </div>
        <div className="bg-gray-800 p-6 border border-purple-600 rounded-lg shadow-lg mb-6">
          <h2 className="text-2xl font-bold text-purple-400 mb-2">
            Room {currentRoom}: {currentQuestion.title}
          </h2>
          <div className="bg-gray-900 p-4 rounded-lg text-green-400 mb-4 border border-gray-700">
            {currentQuestion.question}
          </div>
          <input
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full bg-gray-700 border border-purple-500 text-white p-2 rounded mb-4"
            placeholder="Enter your answer..."
            disabled={showGameOverModal}  // Disable input if game is over
          />
          {showHint && (
            <div className="bg-gray-700 p-3 rounded border border-purple-500 text-purple-300 mb-4">
              {currentQuestion.hint}
            </div>
          )}
          <div className="flex gap-4">
            <button
              onClick={handleSubmit}
              className="bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded w-full"
              disabled={showGameOverModal}  // Disable button if game is over
            >
              Submit Answer
            </button>
            <button
              onClick={showHintHandler}
              disabled={hintsRemaining === 0 || showGameOverModal}
              className={`border px-4 py-2 rounded w-full ${
                hintsRemaining === 0
                  ? 'border-gray-600 text-gray-500'
                  : 'border-purple-500 text-purple-400'
              }`}
            >
              Hint ({hintsRemaining})
            </button>
          </div>
        </div>
        <div className="bg-gray-800 p-4 border border-purple-600 rounded-lg shadow-lg">
          <div className="flex justify-between text-sm text-white">
            <span>Score: {score}</span>
            <span>Time Bonus: {Math.floor(timer / 10)}</span>
            <span>Hints: {hintsRemaining}</span>
          </div>
        </div>
      </div>

      {/* Finish Modal */}
      {showFinishModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-75 z-50">
          <div className="bg-gray-800 p-8 rounded shadow-lg text-center">
            <h2 className="text-3xl font-bold text-green-400 mb-4">
              Congratulations!🎉
            </h2>
            <p className="text-xl text-white mb-4">
              You've completed all rooms!
            </p>
            <img
              src="https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExdXZodWh1cW9sZ3FkMDV0MXpiZjA5bGJjNXVzZGEzbXlwcTIxcjZjMCZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3ohs83ZGJ3hC3yc5Dq/giphy.gif"
              alt="Congratulations GIF"
              className="w-64 mx-auto mb-4 border rounded-xl"
            />
            <button
              onClick={() => setShowFinishModal(false)}
              className="mt-4 bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {showGameOverModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-transparent bg-opacity-75 z-50">
          <div className="bg-black p-8 rounded-xl m-5 shadow-lg text-center">
            <h2 className="text-3xl font-bold text-red-500 mb-4">
              GAME OVER 💀
            </h2>
            <p className="text-xl text-white mb-4">
              Time's up! You cannot play anymore.
            </p>
            <img
              src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExdnAweDgxdG9ubHlrcGF3eDF3c2NnNTZtdjQ1ZHB6dG5vcXV2bGI3ciZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9dHM/fdGbhuUQpGQkkuuzIr/giphy.gif"
              alt="Game Over GIF"
              className="w-64 mx-auto mb-4 border-none rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
