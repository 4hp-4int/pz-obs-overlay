# Project Zomboid Twitch Integration

A real-time integration system that connects Project Zomboid gameplay events with Twitch chat, featuring a transparent overlay for viewer messages.

## Overview

This project consists of three main components:

1. **Lua Mod** (`media/lua/client/ZomboidEventMod.lua`): A Project Zomboid mod that tracks and logs game events
2. **Event Daemon** (`event_daemon.py`): A Python service that reads game events and broadcasts them via WebSocket
3. **Transparent Overlay** (`overlay/`): A web-based overlay that displays Twitch chat messages in-game

## Features

- Real-time tracking of player stats and events
- WebSocket-based event broadcasting
- Transparent overlay for Twitch chat messages
- Cross-platform support (Windows/WSL)
- Configurable event tracking and logging

## Setup Instructions

### 1. Install the Lua Mod

1. Copy the `media` folder to your Project Zomboid mods directory
2. Enable the mod in the Project Zomboid launcher

### 2. Start the Event Daemon

```bash
# Install dependencies
pip install -r requirements.txt

# Start the daemon
python event_daemon.py
```

Optional arguments:
- `--events-file`: Path to events.json (default: auto-detected)
- `--host`: WebSocket server host (default: localhost)
- `--port`: WebSocket server port (default: 8080)
- `--log-level`: Logging level (default: INFO)

### 3. Setup the Overlay

```bash
cd overlay
npm install
npm run dev
```

The overlay will be available at `http://localhost:5173`

## Configuration

### Event Daemon

The event daemon can be configured using command-line arguments or by modifying the default values in `event_daemon.py`.

### Lua Mod

The mod's configuration can be adjusted in `ZomboidEventMod.lua`:
- `EVENT_FILE`: Path to write events
- `debug`: Enable/disable debug logging
- `stateUpdateInterval`: Interval for state updates (in milliseconds)

## Event Types

The system tracks various game events including:
- Player state updates
- XP gains
- Zombie kills
- Player stats and position

## Development

### Project Structure

```
.
├── media/                 # Project Zomboid mod files
│   └── lua/
│       └── client/
│           └── ZomboidEventMod.lua
├── overlay/              # Transparent overlay web app
│   ├── src/
│   ├── index.html
│   └── package.json
├── event_daemon.py      # Python event daemon
├── requirements.txt     # Python dependencies
└── README.md
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
