#!/usr/bin/env python3
import os
import shutil
import sys
import platform
from pathlib import Path
import argparse
import subprocess
from loguru import logger

logger.remove()  # Remove default handler
logger.add(sys.stderr, format="<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>")

def is_wsl():
    """Check if we're running under Windows Subsystem for Linux."""
    try:
        with open('/proc/version', 'r') as f:
            return 'microsoft' in f.read().lower()
    except:
        return False

def wsl_path_to_windows(wsl_path):
    """Convert a WSL path to a Windows path."""
    try:
        result = subprocess.run(['wslpath', '-w', wsl_path], 
                              capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        logger.error(f"Failed to convert WSL path: {wsl_path}")
        return None

def windows_path_to_wsl(windows_path):
    """Convert a Windows path to a WSL path."""
    try:
        result = subprocess.run(['wslpath', '-u', windows_path], 
                              capture_output=True, text=True, check=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        logger.error(f"Failed to convert Windows path: {windows_path}")
        return None

def find_zomboid_installation():
    """Find the Project Zomboid installation directory."""
    running_in_wsl = is_wsl()
    
    if running_in_wsl:
        # Check Windows Steam locations through WSL
        steam_paths = [
            r'C:\Program Files (x86)\Steam\steamapps\common\ProjectZomboid',
            r'C:\Program Files\Steam\steamapps\common\ProjectZomboid',
        ]
        for path in steam_paths:
            wsl_path = windows_path_to_wsl(path)
            if wsl_path and os.path.exists(wsl_path):
                return wsl_path
    else:
        system = platform.system().lower()
        
        if system == 'windows':
            # Check Steam default location
            steam_paths = [
                os.path.expandvars(r'%ProgramFiles(x86)%\Steam\steamapps\common\ProjectZomboid'),
                os.path.expandvars(r'%ProgramFiles%\Steam\steamapps\common\ProjectZomboid'),
            ]
            for path in steam_paths:
                if os.path.exists(path):
                    return path
        
        elif system == 'linux':
            # Check Steam default location on Linux
            home = os.path.expanduser('~')
            steam_path = os.path.join(home, '.steam/steam/steamapps/common/ProjectZomboid')
            if os.path.exists(steam_path):
                return steam_path
            
            # Check Steam Proton/Wine location
            proton_path = os.path.join(home, '.local/share/Steam/steamapps/common/ProjectZomboid')
            if os.path.exists(proton_path):
                return proton_path
        
        elif system == 'darwin':  # macOS
            # Check Steam default location on macOS
            home = os.path.expanduser('~')
            steam_path = os.path.join(home, 'Library/Application Support/Steam/steamapps/common/ProjectZomboid')
            if os.path.exists(steam_path):
                return steam_path
    
    return None

def copy_textures(zomboid_path, output_path):
    """Copy Item_ icons from Project Zomboid to the overlay's public directory."""
    media_path = os.path.join(zomboid_path, 'media')
    if not os.path.exists(media_path):
        logger.error(f"Could not find media directory at {media_path}")
        return False
    
    # Create output directory
    icons_path = os.path.join(output_path, 'public', 'icons')
    os.makedirs(icons_path, exist_ok=True)

    # Walk through all directories in media
    logger.info("Searching for Item_ icons...")
    count = 0
    for root, _, files in os.walk(media_path):
        for file in files:
            # Look for Item_ prefixed image files
            if file.startswith('Item_') and file.lower().endswith(('.png', '.tga')):
                src_file = os.path.join(root, file)
                dst_file = os.path.join(icons_path, file)
                
                # Copy the file
                logger.debug(f"Copying {file}")
                shutil.copy2(src_file, dst_file)
                count += 1
    
    logger.info(f"Copied {count} item icons to overlay/public/icons/")
    return True

def main():
    parser = argparse.ArgumentParser(description='Extract Project Zomboid textures for the overlay')
    parser.add_argument('--zomboid-path', help='Path to Project Zomboid installation')
    parser.add_argument('--output-path', help='Path to overlay directory', default='.')
    args = parser.parse_args()
    
    # Find Project Zomboid installation if not specified
    zomboid_path = args.zomboid_path
    if zomboid_path and is_wsl() and ':' in zomboid_path:  # Windows path provided
        zomboid_path = windows_path_to_wsl(zomboid_path)
    
    if not zomboid_path:
        zomboid_path = find_zomboid_installation()
        if not zomboid_path:
            logger.error("Could not find Project Zomboid installation. Please specify --zomboid-path")
            sys.exit(1)
    
    logger.info(f"Found Project Zomboid at: {zomboid_path}")
    
    # Convert output path if needed
    output_path = args.output_path
    if is_wsl() and ':' in output_path:  # Windows path provided
        output_path = windows_path_to_wsl(output_path)
    
    # Copy textures
    if copy_textures(zomboid_path, output_path):
        logger.info("Successfully copied textures to overlay/public/icons/")
    else:
        logger.error("Failed to copy textures")
        sys.exit(1)

if __name__ == '__main__':
    main() 