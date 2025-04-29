#!/usr/bin/env python3
"""
Image processing module for Project Zomboid Twitch Integration.
Handles screenshot cropping and sprite sheet creation.
"""

import json
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from PIL import Image
import os
import time
from openai import OpenAI
import base64
from io import BytesIO
from loguru import logger

from dotenv import load_dotenv

load_dotenv()

class ImageProcessor:
    # Fixed offsets and dimensions for the face portrait relative to the character screen
    FACE_OFFSET_X = 55  # 1712 - 1657 = 55 pixels from panel left
    FACE_OFFSET_Y = 47  # 381 - 334 = 47 pixels from panel top
    FACE_WIDTH = 48     # Width of the face portrait
    FACE_HEIGHT = 48    # Height of the face portrait

    def __init__(self, output_dir: str = "face_captures", api_key: Optional[str] = None):
        """
        Initialize the image processor.
        
        Args:
            output_dir: Directory to store cropped images and sprite sheets
            api_key: OpenAI API key for DALL-E integration
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        self.cropped_images: List[Path] = []
        
        # Initialize OpenAI client if API key is provided
   
        self.client = OpenAI()
            
    def encode_image_base64(self, image_path: str) -> str:
        """
        Encode an image file as base64.
        
        Args:
            image_path: Path to the image file
            
        Returns:
            str: Base64 encoded image
        """
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
            
    def generate_sprite_sheet_prompt(self) -> str:
        """
        Generate the prompt for DALL-E to create a sprite sheet.
        
        Returns:
            str: The formatted prompt
        """
        return """Create a pixel art sprite sheet for a talking head avatar inspired by 1990s first-person shooter games.

Style Requirements:
- Pixel art with 16-32 pixel blockiness
- 2x2 grid layout (4 frames total)
- Each frame: 256x256 pixels (total canvas 512x512)
- Fully transparent background
- Character centered in each frame with face and shoulders visible
- Front-lit face with consistent lighting
- No camera angle changes between frames
- Limited color palette (~16 colors)
- Bold shading and sharp pixel outlines
- No blurring or anti-aliasing

Frame Expressions:
1. Neutral expression (mouth closed)
2. Small mouth open (light talking)
3. Wide mouth open (shouting)
4. Raised eyebrow / smirk

Visual Style:
- Inspired by classic Doom Guy status bar sprites
- Maintain consistent character proportions across all frames
- Use clear, defined pixel edges
- Ensure each expression is distinct and recognizable"""
        
    def generate_sprite_sheet_dalle(self, 
                                  output_path: str = "dalle_sprite_sheet.png",
                                  face_image: Optional[Path] = None) -> Optional[Path]:
        """
        Generate a sprite sheet using DALL-E.
        
        Args:
            output_path: Where to save the generated sprite sheet
            face_image: Optional path to reference face image
            
        Returns:
            Optional[Path]: Path to generated sprite sheet if successful
        """
        if not self.client:
            logger.error("OpenAI client not initialized. Please provide API key.")
            return None
            
        try:
            # Prepare the prompt
            prompt = self.generate_sprite_sheet_prompt()
            
            if face_image and face_image.exists():
                # Use images.edit if we have a reference image
                logger.info("Generating sprite sheet with reference image...")
                with open(face_image, "rb") as img_file:
                    response = self.client.images.edit(
                        model="gpt-image-1",
                        image=img_file,
                        prompt=prompt,
                    )

            if not response.data:
                logger.error("No image data received from DALL-E")
                return None
                
            # Decode and process image
            image_data = base64.b64decode(response.data[0].b64_json)
            image = Image.open(BytesIO(image_data))
            
            # Ensure output directory exists
            output_path = Path(output_path)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Save with transparency
            image.save(output_path, "PNG")
            logger.info(f"Generated sprite sheet saved to {output_path}")
            
            return output_path
            
        except Exception as e:
            logger.error(f"Error generating sprite sheet with DALL-E: {e}")
            return None

    def get_face_coordinates(self, panel_pos: Dict[str, int]) -> Tuple[int, int, int, int]:
        """
        Calculate the exact coordinates of the face portrait given the panel position.
        
        Args:
            panel_pos: Dictionary containing x, y coordinates of the character panel
            
        Returns:
            Tuple[int, int, int, int]: (x1, y1, x2, y2) coordinates for cropping
        """
        x1 = panel_pos['x'] + self.FACE_OFFSET_X
        y1 = panel_pos['y'] + self.FACE_OFFSET_Y
        x2 = x1 + self.FACE_WIDTH
        y2 = y1 + self.FACE_HEIGHT
        return (x1, y1, x2, y2)
        
    def validate_crop_area(self, img: Image.Image, x1: int, y1: int, x2: int, y2: int) -> bool:
        """
        Validate that the crop area is within image bounds.
        
        Args:
            img: PIL Image object
            x1, y1: Top-left corner coordinates
            x2, y2: Bottom-right corner coordinates
            
        Returns:
            bool: True if crop area is valid, False otherwise
        """
        img_width, img_height = img.size
        return (x1 >= 0 and y1 >= 0 and 
                x2 <= img_width and y2 <= img_height)
    
    def crop_screenshot(self, screenshot_path: str, screen_pos: Dict[str, int]) -> Optional[Path]:
        """
        Crop a screenshot to extract just the face portrait.
        
        Args:
            screenshot_path: Path to the full screenshot
            screen_pos: Dictionary containing panel x, y position
            
        Returns:
            Optional[Path]: Path to the cropped image if successful, None otherwise
        """
        try:
            # Load the screenshot
            with Image.open(screenshot_path) as img:
                # Calculate face coordinates
                x1, y1, x2, y2 = self.get_face_coordinates(screen_pos)
                
                # Log the coordinates we're using
                logger.debug(f"Cropping face at coordinates: ({x1}, {y1}, {x2}, {y2})")
                
                # Validate crop area
                if not self.validate_crop_area(img, x1, y1, x2, y2):
                    logger.error(f"Invalid face crop area: ({x1}, {y1}, {x2}, {y2})")
                    return None
                
                # Perform the crop
                cropped = img.crop((x1, y1, x2, y2))
                
                # Generate output filename with timestamp
                timestamp = int(time.time())
                output_path = self.output_dir / f"face_{timestamp}.png"
                
                # Save the cropped image
                cropped.save(output_path)
                self.cropped_images.append(output_path)
                
                logger.info(f"Saved face portrait to {output_path}")
                return output_path
                
        except Exception as e:
            logger.error(f"Error cropping face portrait: {e}")
            return None
            
    def align_sprite_sheet(self, input_path: str, output_path: str, rows: int = 2, cols: int = 2, bottom_padding: int = 2, debug: bool = False) -> bool:
        """
        Align sprites in a sprite sheet to be centered horizontally and aligned to bottom of their cells.
        
        Args:
            input_path: Path to the input sprite sheet image
            output_path: Path to save the aligned sprite sheet
            rows: Number of rows in the sprite sheet
            cols: Number of columns in the sprite sheet
            bottom_padding: Padding from bottom edge in pixels
            debug: If True, save a debug version with grid lines
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Load the sprite sheet image
            sprite_sheet = Image.open(input_path).convert('RGBA')
            
            # Get the dimensions of the sprite sheet
            sheet_width, sheet_height = sprite_sheet.size
            
            # Calculate the dimensions of each cell
            cell_width = sheet_width // cols
            cell_height = sheet_height // rows
            
            # Create a new image for the aligned sprite sheet
            aligned_sheet = Image.new('RGBA', (sheet_width, sheet_height), (0, 0, 0, 0))
            
            # Process each cell
            for row in range(rows):
                for col in range(cols):
                    # Customize padding based on row position
                    # Use different padding for bottom row sprites
                    current_padding = bottom_padding
                    if row == 1:  # Bottom row (assuming rows=2)
                        current_padding = bottom_padding + 10  # Increase padding for bottom row
                    
                    # Extract the cell from the original sheet
                    x1 = col * cell_width
                    y1 = row * cell_height
                    x2 = x1 + cell_width
                    y2 = y1 + cell_height
                    
                    cell = sprite_sheet.crop((x1, y1, x2, y2))
                    
                    # Find the bounding box of the sprite in the cell (non-transparent pixels)
                    bbox = self._get_non_transparent_bbox(cell)
                    if not bbox:
                        # If no non-transparent pixels found, just copy the cell as is
                        aligned_sheet.paste(cell, (x1, y1))
                        continue
                    
                    # Extract the sprite based on the bounding box
                    left, top, right, bottom = bbox
                    sprite = cell.crop((left, top, right, bottom))
                    
                    # Calculate new position to center horizontally and align to bottom
                    sprite_width = right - left
                    sprite_height = bottom - top
                    
                    new_x = x1 + (cell_width - sprite_width) // 2
                    new_y = y1 + cell_height - sprite_height - current_padding  # Add position-specific padding
                    
                    # Log the alignment details for debugging
                    logger.debug(f"Cell ({row},{col}): Original bbox={bbox}, New position=({new_x},{new_y}), Bottom padding={current_padding}")
                    
                    # Paste sprite into the aligned sheet
                    aligned_sheet.paste(sprite, (new_x, new_y), sprite)
            
            # Save the aligned sprite sheet
            aligned_sheet.save(output_path)
            logger.info(f"Created aligned sprite sheet at {output_path}")
            
            # If debug mode is enabled, save a version with grid lines
            if debug:
                debug_path = output_path.replace('.png', '_debug.png')
                debug_img = aligned_sheet.copy()
                self._draw_grid(debug_img, rows, cols)
                debug_img.save(debug_path)
                logger.info(f"Created debug version with grid lines at {debug_path}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error aligning sprite sheet: {e}")
            return False
            
    def _get_non_transparent_bbox(self, image: Image.Image) -> Optional[Tuple[int, int, int, int]]:
        """
        Find the bounding box of non-transparent pixels in an image.
        
        Args:
            image: PIL Image with RGBA mode
            
        Returns:
            Optional[Tuple[int, int, int, int]]: (left, top, right, bottom) or None if no non-transparent pixels
        """
        # Convert image to numpy array for faster processing if numpy is available
        try:
            import numpy as np
            data = np.array(image)
            alpha = data[:, :, 3]
            non_transparent = alpha > 0
            
            if not np.any(non_transparent):
                return None
                
            rows = np.any(non_transparent, axis=1)
            cols = np.any(non_transparent, axis=0)
            
            top = np.argmax(rows)
            bottom = len(rows) - np.argmax(rows[::-1])
            left = np.argmax(cols)
            right = len(cols) - np.argmax(cols[::-1])
            
            return left, top, right, bottom
            
        except ImportError:
            # Fallback to PIL-only processing (slower)
            width, height = image.size
            left, top, right, bottom = width, height, 0, 0
            
            for y in range(height):
                for x in range(width):
                    if image.getpixel((x, y))[3] > 0:  # If pixel is not fully transparent
                        left = min(left, x)
                        top = min(top, y)
                        right = max(right, x + 1)
                        bottom = max(bottom, y + 1)
            
            if right > left and bottom > top:
                return left, top, right, bottom
            return None
            
    def create_sprite_sheet(self, output_path: str = "sprite_sheet.png") -> bool:
        """
        Create a sprite sheet from collected face portraits.
        
        Args:
            output_path: Path to save the sprite sheet
            
        Returns:
            bool: True if successful, False otherwise
        """
        if not self.cropped_images:
            logger.warning("No face portraits available for sprite sheet")
            return False
            
        try:
            # Load all images
            images = [Image.open(path) for path in self.cropped_images]
            
            # Get dimensions of first image (should be FACE_WIDTH x FACE_HEIGHT)
            width, height = images[0].size
            
            # Create a new image for the sprite sheet
            # Using 2x2 grid as specified in image_prompt.txt
            sprite_sheet = Image.new('RGBA', (width * 2, height * 2))
            
            # Paste images into the sprite sheet
            for i, img in enumerate(images[:4]):  # Only use first 4 images
                x = (i % 2) * width
                y = (i // 2) * height
                sprite_sheet.paste(img, (x, y))
            
            # Save the sprite sheet
            sprite_sheet.save(output_path)
            logger.info(f"Created sprite sheet at {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error creating sprite sheet: {e}")
            return False
            
    def clear_cropped_images(self):
        """Clear the list of cropped images."""
        self.cropped_images = []

    def _draw_grid(self, image, rows, cols, color=(255, 0, 0, 128)):
        """Draw a grid on an image to visualize cell boundaries for troubleshooting."""
        from PIL import ImageDraw
        
        draw = ImageDraw.Draw(image)
        width, height = image.size
        
        cell_width = width // cols
        cell_height = height // rows
        
        # Draw horizontal lines
        for i in range(1, rows):
            y = i * cell_height
            draw.line([(0, y), (width, y)], fill=color, width=1)
        
        # Draw vertical lines
        for i in range(1, cols):
            x = i * cell_width
            draw.line([(x, 0), (x, height)], fill=color, width=1)
        
        return image 