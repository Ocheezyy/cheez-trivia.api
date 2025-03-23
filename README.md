# Trivia API

The Trivia API is a backend service built with Express and Socket.IO to power the real-time multiplayer trivia game, Cheez Trivia. It handles game state, player interactions, and real-time events using WebSockets.

## Tech Stack

- **Node.js**
- **Express.js** (API framework)
- **Socket.IO** (real-time communication)
- **Redis** (caching and real-time event handling)
- **TypeScript** (typed JavaScript for better maintainability)

## Features

- **WebSocket-based real-time communication** with Socket.IO
- **Room-based multiplayer trivia support**
- **Automatic game progression** with countdown timers
- **Player reconnection handling**
- **Redis** for game room state

## Getting Started

### Prerequisites
Make sure you have the following installed:
- [Node.js](https://nodejs.org/) (v20 or higher)
- npm or [Yarn](https://yarnpkg.com/) 
- Redis

### Installation

#### 1. Clone the repository:
```sh
git clone https://github.com/ocheezyy/cheez-trivia.api.git
cd trivia-api
```

#### 2. Install dependencies:
```sh
npm install # or yarn install 
```

#### 3. Create an `.env` file:
```sh
PORT=3001
REDIS_URL=redis://localhost:6379
```

#### 4. Start the development server:
```sh
yarn dev  # or npm run dev
```

The API will be available at `http://localhost:3001`

## Deployment

To build and deploy the project:
```sh
npm build
```
Then run:
```sh
npm start
```

## API Endpoints

### WebSocket Events
#### `connect`
- A client connects to the WebSocket server.

#### `joinRoom`
- Players join a game room.

#### `newQuestion`
- Emits a new trivia question to all players in a room.

#### `submitAnswer`
- Handles answer submissions and updates scores.

#### `gameOver`
- Emits the final game results.

## Contributing
Pull requests are welcome! Feel free to submit issues or feature requests.

## License
MIT License. See [`LICENSE`](https://github.com/ocheezyy/cheez-trivia.api/LICENSE) file for details.

