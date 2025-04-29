#!/usr/bin/env python3
import json
import time
import os
import sys
import argparse
from pathlib import Path
import websockets
import asyncio
from typing import Dict, Any, Optional, Set
from loguru import logger
from image_processor import ImageProcessor
from dotenv import load_dotenv
import shutil

load_dotenv()

# Configure logging to both console and file
logger.remove()  # Remove default handler
logger.add(sys.stderr, format="<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>")
logger.add("event_daemon.log", rotation="1 day", retention="7 days", format="{time:YYYY-MM-DD HH:mm:ss.SSS} | {level: <8} | {name}:{function}:{line} - {message}")

def convert_windows_path_to_wsl(path: str) -> str:

    
    # If it's already a WSL path, return as is
    if path.startswith('/'):
        return path
        
    # Handle paths with drive letters (e.g., C:\Users\...)
    if ':' in path:
        # Split drive letter and path
        drive, path = path.split(':', 1)
        # Convert backslashes to forward slashes first
        path = path.replace('\\', '/')
        # Convert to WSL format
        return "/mnt/" + drive.lower() + path
    
    # If no drive letter, assume relative path
    return path.replace('\\', '/')

def get_default_events_path() -> str:
    """Get the default path for events.json based on user's home directory."""
    if os.name == 'nt':  # Windows
        return os.path.expandvars('%USERPROFILE%\\Zomboid\\Saves\\events.json')
    else:  # WSL or Linux
        # Assuming running in WSL, point to Windows user's Zomboid directory
        windows_path = os.path.expandvars('C:\\Users\\%USERNAME%\\Zomboid\\Saves\\events.json')
        return convert_windows_path_to_wsl(windows_path)

def parse_args():
    parser = argparse.ArgumentParser(description='Project Zomboid Event Daemon')
    parser.add_argument('--events-file', type=str, default=get_default_events_path(),
                       help='Path to events.json file (default: <user>/Zomboid/Saves/events.json)')
    parser.add_argument('--host', type=str, default='localhost',
                       help='WebSocket server host (default: localhost)')
    parser.add_argument('--port', type=int, default=8080,
                       help='WebSocket server port (default: 8080)')
    parser.add_argument('--log-level', type=str, default='INFO',
                       choices=['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'],
                       help='Set the logging level')
    parser.add_argument('--verbose', action='store_true',
                       help='Enable verbose logging of all events')
    
    args = parser.parse_args()
    # Convert Windows path to WSL path if needed
    args.events_file = convert_windows_path_to_wsl(args.events_file)
    return args

class EventValidator:
    @staticmethod
    def validate_player_stats(stats: Dict[str, Any]) -> bool:
        if not isinstance(stats, dict):
            return False
        
        required_fields = {
            'health': float,
            'position': dict,
            'moodles': dict
        }
        
        for field, field_type in required_fields.items():
            if field not in stats or not isinstance(stats[field], field_type):
                return False
        
        if not all(isinstance(v, (int, float)) for v in stats['position'].values()):
            return False
        
        if not all(isinstance(v, (int, float)) for v in stats['moodles'].values()):
            return False
        
        return True

    @staticmethod
    def validate_event(event: Dict[str, Any]) -> bool:
        if not isinstance(event, dict) or 'type' not in event:
            return False
        
        event_type = event['type']
        
        # Validate common fields
        if 'timestamp' not in event or not isinstance(event['timestamp'], (int, float)):
            return False
            
        # Type-specific validation
        if event_type in ['attack', 'hit']:
            required_fields = ['itemName', 'itemType', 'hit']
            if not all(field in event for field in required_fields):
                return False
                
        elif event_type == 'xp_gain':
            required_fields = ['perk', 'amount', 'level']
            if not all(field in event for field in required_fields):
                return False
                
        elif event_type == 'player_update':
            if 'player' not in event or not EventValidator.validate_player_stats(event['player']):
                return False
        
        return True

class EventDaemon:
    """
    Main daemon class that manages WebSocket connections and event broadcasting.
    Watches the events.json file for new events and sends them to connected clients.
    """
    def __init__(self, events_file: str, host: str, port: int, verbose: bool = False):
        self.events_file = Path(events_file)
        self.screen_pos_file = self.events_file.parent / "screen_pos.json"
        self.host = host
        self.port = port
        self.clients: Set[websockets.WebSocketServerProtocol] = set()
        self.last_position = 0
        self.last_screen_pos = 0
        self.server = None
        self.image_processor = ImageProcessor()
        self.verbose = verbose

    async def start_server(self):
        """Start the WebSocket server and begin watching for events"""
        self.server = await websockets.serve(self.handle_client, self.host, self.port)
        logger.info(f"Server started on ws://{self.host}:{self.port}")
        await self.watch_events()

    async def handle_client(self, websocket: websockets.WebSocketServerProtocol, path: str):
        """Handle new WebSocket client connections"""
        self.clients.add(websocket)
        logger.info(f"New client connected. Total clients: {len(self.clients)}")
        try:
            await websocket.wait_closed()
        finally:
            self.clients.remove(websocket)
            logger.info(f"Client disconnected. Total clients: {len(self.clients)}")

    async def broadcast(self, message: str):
        """Broadcast a message to all connected clients"""
        if not self.clients:
            return
            
        disconnected = set()
        for client in self.clients:
            try:
                await client.send(message)
            except websockets.exceptions.ConnectionClosed:
                disconnected.add(client)
                
        # Remove disconnected clients
        for client in disconnected:
            self.clients.remove(client)
            logger.info(f"Removed disconnected client. Total clients: {len(self.clients)}")

    async def watch_events(self):
        """
        Continuously watch the events.json file for new events.
        When new events are detected, they are broadcast to all connected clients.
        """
        # Wait for file to exist
        while not self.events_file.exists():
            logger.info(f"Waiting for events file at {self.events_file}...")
            await asyncio.sleep(1)

        logger.info(f"Found events file at {self.events_file}")
        
        while True:
            try:
                # Check for new events
                current_size = self.events_file.stat().st_size
                if current_size > self.last_position:
                    # New data available
                    async with asyncio.Lock():  # Ensure thread-safe file reading
                        with open(self.events_file, 'r') as f:
                            f.seek(self.last_position)
                            new_lines = f.readlines()
                            
                            for line in new_lines:
                                line = line.strip()
                                if not line:  # Skip empty lines
                                    continue
                                try:
                                    event = json.loads(line)
                                    
                                    # Validate event structure
                                    if not EventValidator.validate_event(event):
                                        if self.verbose:
                                            logger.warning(f"Invalid event structure: {event}")
                                        continue
                                        
                                    # Broadcast event to all clients
                                    await self.broadcast(line)
                                    if self.verbose:
                                        logger.debug(f"Broadcast event: {event}")
                                except json.JSONDecodeError as e:
                                    if self.verbose:
                                        logger.error(f"Error parsing JSON: {e}")
                                    continue
                                except Exception as e:
                                    if self.verbose:
                                        logger.error(f"Error processing event: {e}")
                                    continue
                    
                    self.last_position = current_size

                # Check for new screen position data
                if self.screen_pos_file.exists():
                    current_screen_pos_size = self.screen_pos_file.stat().st_size
                    if current_screen_pos_size > self.last_screen_pos:
                        async with asyncio.Lock():
                            with open(self.screen_pos_file, 'r') as f:
                                f.seek(self.last_screen_pos)
                                new_lines = f.readlines()
                                
                                for line in new_lines:
                                    line = line.strip()
                                    if not line:
                                        continue
                                    try:
                                        screen_pos = json.loads(line)
                                        if self.verbose:
                                            logger.debug(f"Broadcast screen position: {screen_pos}")
                                        
                                        # Process the screenshot if it exists
                                        screenshot_path = Path(convert_windows_path_to_wsl("C:\\Users\\Khalen\\Zomboid\\Screenshots\\face_capture_temp.png"))
                                        logger.debug(f"Processing screenshot at: {screenshot_path}")
                                        time.sleep(1)
                                        if screenshot_path.exists():
                                            # Crop the screenshot using the screen position
                                            cropped_path = self.image_processor.crop_screenshot(
                                                str(screenshot_path),
                                                screen_pos
                                            )
                                            if cropped_path:
                                                logger.info(f"Successfully cropped screenshot to {cropped_path}")
                                                # Clean up the temporary screenshot
                                                screenshot_path.unlink()
                                                
                                                # Generate sprite sheet using DALL-E with the cropped face as reference
                                                sprite_sheet_path = Path("overlay/assets/sprite_sheet.png")
                                                if self.image_processor.generate_sprite_sheet_dalle(
                                                    str(sprite_sheet_path),
                                                    face_image=Path(cropped_path)
                                                ):
                                                    logger.info("Created new DALL-E generated sprite sheet")
                                                    # Broadcast that a new sprite sheet is available
                                                    await self.broadcast(json.dumps({
                                                        "type": "sprite_sheet_updated",
                                                        "path": str(sprite_sheet_path)
                                                    }))
                                    except json.JSONDecodeError as e:
                                        if self.verbose:
                                            logger.error(f"Error parsing screen position JSON: {e}")
                                        continue
                                    
                        # Clear the screen_pos file after reading
                        with open(self.screen_pos_file, 'w') as f:
                            f.write('')
                        self.last_screen_pos = 0
            
            except Exception as e:
                logger.error(f"Error reading file: {e}")
            
            await asyncio.sleep(0.1)  # Small delay between checks

async def main():
    """Main entry point for the event daemon"""
    args = parse_args()
    
    # Set log level from arguments
    logger.level(args.log_level)
    
    daemon = EventDaemon(args.events_file, args.host, args.port, args.verbose)
    await daemon.start_server()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Shutting down daemon...")
    except Exception as e:
        logger.critical(f"Fatal error: {e}")
        raise