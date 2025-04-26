#!/usr/bin/env python3
import json
import time
import os
import sys
import argparse
import logging
from pathlib import Path
import websockets
import asyncio
from typing import Dict, Any, Optional, Set

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('event_daemon.log')
    ]
)
logger = logging.getLogger('EventDaemon')

def convert_windows_path_to_wsl(path: str) -> str:
    """Convert a Windows path to a WSL-compatible path."""
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
        return f"/mnt/{drive.lower()}{path}"
    
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
    def __init__(self, events_file: str, host: str, port: int):
        self.events_file = Path(events_file)
        self.host = host
        self.port = port
        self.last_position = 0
        self.clients: Set[websockets.WebSocketServerProtocol] = set()
        
    async def register(self, websocket: websockets.WebSocketServerProtocol):
        self.clients.add(websocket)
        try:
            logger.info(f"Client connected. Total clients: {len(self.clients)}")
            await websocket.wait_closed()
        finally:
            self.clients.remove(websocket)
            logger.info(f"Client disconnected. Remaining clients: {len(self.clients)}")

    async def broadcast(self, message: str):
        if not self.clients:
            return
        
        # Broadcast to all connected clients
        disconnected_clients = set()
        for client in self.clients:
            try:
                await client.send(message)
            except websockets.exceptions.ConnectionClosed:
                disconnected_clients.add(client)
            except Exception as e:
                logger.error(f"Error sending to client: {e}")
                disconnected_clients.add(client)
        
        # Remove disconnected clients
        for client in disconnected_clients:
            self.clients.remove(client)

    async def watch_events(self):
        # Wait for file to exist
        while not self.events_file.exists():
            logger.info(f"Waiting for {self.events_file} to be created...")
            await asyncio.sleep(1)
        
        # Get initial file size
        self.last_position = self.events_file.stat().st_size
        
        while True:
            try:
                if not self.events_file.exists():
                    logger.warning("Events file was deleted, waiting for recreation...")
                    self.last_position = 0
                    await asyncio.sleep(1)
                    continue

                current_size = self.events_file.stat().st_size
                
                if current_size < self.last_position:
                    # File was truncated/recreated
                    logger.info("Events file was truncated or recreated")
                    self.last_position = 0
                
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
                                        logger.warning(f"Invalid event structure: {event}")
                                        continue
                                        
                                    # Broadcast event to all clients
                                    await self.broadcast(line)
                                    logger.debug(f"Broadcast event: {event}")
                                except json.JSONDecodeError as e:
                                    logger.error(f"Error parsing JSON: {e}")
                                    continue
                                except Exception as e:
                                    logger.error(f"Error processing event: {e}")
                                    continue
                    
                    self.last_position = current_size
            
            except Exception as e:
                logger.error(f"Error reading file: {e}")
            
            await asyncio.sleep(0.1)  # Small delay between checks

    async def start_server(self):
        async with websockets.serve(self.register, self.host, self.port):
            logger.info(f"WebSocket server started on ws://{self.host}:{self.port}")
            await self.watch_events()  # Start watching for events

async def main():
    args = parse_args()
    
    # Set log level from arguments
    logging.getLogger().setLevel(getattr(logging, args.log_level))
    
    daemon = EventDaemon(args.events_file, args.host, args.port)
    await daemon.start_server()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Shutting down daemon...")
    except Exception as e:
        logger.critical(f"Fatal error: {e}")
        sys.exit(1) 