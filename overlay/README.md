# Project Zomboid Stream HUD

A modular and maintainable HUD overlay for Project Zomboid streams.

## Structure

The HUD is organized into several modules, each responsible for a specific aspect of the system:

### Core Modules

- `hud.js`: Main entry point that initializes and coordinates all other modules
- `config.js`: Centralized configuration for the entire system
- `WebSocketManager.js`: Handles WebSocket connections and reconnection logic
- `StateManager.js`: Manages state persistence using localStorage
- `UIManager.js`: Handles all UI updates and interactions
- `SpriteManager.js`: Manages sprite loading and texture mapping

### Directory Structure

```
overlay/
├── assets/           # Image assets and sprite sheets
├── scripts/          # JavaScript modules
│   ├── config.js
│   ├── hud.js
│   ├── WebSocketManager.js
│   ├── StateManager.js
│   ├── UIManager.js
│   └── SpriteManager.js
├── index.html        # Main HTML file
├── style.css         # Stylesheet
└── spriteData.js     # Sprite data definitions
```

## Adding New Features

The modular structure makes it easy to add new features:

1. **New Panels**: Create new panel templates in `index.html` and add corresponding update methods in `UIManager.js`
2. **New Events**: Add new event handlers in the `handleEvent` method of `hud.js`
3. **New State Properties**: Update the state structure in `StateManager.js`

## Configuration

All configuration is centralized in `config.js`. Key settings include:

- WebSocket connection details
- UI positioning
- Toast notification duration
- Debug mode
- Sprite sheet paths
- State persistence settings

## Development

1. Clone the repository
2. Open `index.html` in a web browser
3. The HUD will automatically connect to the WebSocket server at `ws://127.0.0.1:8080`

## Future Improvements

The system is designed to be easily extensible. Potential future improvements include:

- Additional HUD panels (stamina, thirst, skills)
- Customizable panel layouts
- Theme support
- Performance optimizations
- Additional event types
- Plugin system for third-party extensions 