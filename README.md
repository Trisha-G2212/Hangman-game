Hangman Game 🎮
A modern, interactive Hangman Game built with HTML, CSS, and JavaScript, featuring both single-player and multiplayer modes. The project includes smooth animations, responsive design, and engaging UI elements to enhance the classic word-guessing experience.

📌 Features
Single Player Mode

Random word selection with hints.

Interactive on-screen keyboard and physical keyboard support.

Animated hangman drawing for wrong guesses.

Confetti celebration on winning.

Hint system with one-time usage.

Multiplayer Mode

Create or join rooms with unique room codes.

Nickname support for players.

Word master input system for custom words.

Real-time guessing and score tracking.

Winner announcement with trophy animation.

UI & Animations

Smooth transitions (fadeIn, slideUp, pop, shake).

Confetti effects on victory.

Responsive design for mobile and desktop.

Stylish modals for win/lose states.

🛠️ Tech Stack
Frontend: HTML, CSS, JavaScript

Animations: CSS keyframes

Multiplayer Communication: Socket-based (requires backend setup)

Design: Responsive layout with modern UI components

📂 Project Structure
Code
├── index.html          # Main HTML file
├── style.css           # Styling and animations
├── game.js             # Core game logic (single player)
├── app.js              # Screen navigation & multiplayer integration
├── README.md           # Project documentation
🚀 Installation & Setup
Clone the repository:

bash
git clone https://github.com/your-username/hangman-game.git
cd hangman-game
Open index.html in your browser for single-player mode.

For multiplayer mode, ensure you have a backend server running with Socket.IO support. Update the connection logic in app.js accordingly.

🎮 Usage
Single Player:

Start a game from the menu.

Guess letters using the on-screen keyboard or your physical keyboard.

Use the hint button if stuck (only once per game).

Win by guessing all letters before the hangman is fully drawn.

Multiplayer:

Enter a nickname and create/join a room.

The word master inputs a word.

Other players guess letters in real-time.

Scores are tracked and displayed after each round.

Final winner is announced with scores.

📖 File Details
style.css

Defines UI styling, animations, and responsive layout.

Includes custom animations like fadeIn, pop, shake, confetti-fall.

game.js

Handles single-player game logic.

Functions for rendering word display, keyboard, tracking guesses, win/lose conditions, and confetti effects.

app.js

Manages screen navigation (menu, single-player, multiplayer).

Handles multiplayer room creation, joining, and leaving.

Integrates with multiplayer backend via sockets.

🤝 Contribution Guidelines
Contributions are welcome!
To contribute:

Fork the repository.

Create a new branch (feature/your-feature).

Commit changes with clear messages.

Submit a pull request.

📜 License
This project is licensed under the MIT License.
You are free to use, modify, and distribute this software with proper attribution.

Code
MIT License

Copyright (c) 2026 G.Trisha

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
👩‍💻 Author
G.Trisha  
Passionate developer focused on building interactive web applications with engaging user experiences.
