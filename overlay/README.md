# Project Zomboid Overlay

A transparent React overlay for Project Zomboid that displays player stats in real-time.

## Features

- Real-time player stats display
- Health and weight monitoring
- Equipment tracking
- Indoor/outdoor status indicator
- Coordinate display
- Smooth animations and transitions
- Transparent background for OBS integration

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

## Development

Start the development server:
```bash
npm run dev
```

The overlay will be available at `http://localhost:5173`

## OBS Setup

1. Add a new Browser Source in OBS
2. Set the URL to `http://localhost:5173`
3. Set the width to 1920 and height to 1080
4. Enable "Shutdown source when not visible"
5. Enable "Refresh cache when scene becomes active"

## Mock Mode

To test the overlay without the game running, add `?mock=true` to the URL:
```
http://localhost:5173?mock=true
```

This will enable mock data generation for testing purposes.

## WebSocket Connection

The overlay connects to `ws://localhost:8765` by default. Make sure your Project Zomboid mod is configured to send data to this endpoint.

## Project Structure

```
src/
├─ main.tsx
├─ context/StatsContext.tsx
├─ hooks/useWebSocket.ts
├─ hooks/useThrottledValue.ts
├─ components/
│  ├─ VitalsPanel.tsx
│  ├─ EnvironmentBadge.tsx
│  └─ CoordsBox.tsx
├─ assets/ (placeholder weapon icons)
└─ tailwind.config.ts
```

## Styling

The overlay uses Tailwind CSS for styling with custom colors and animations. The main accent color is a neon purple to match Soumir branding.

## License

MIT
