#!/usr/bin/env python3
"""
Simple script to align sprites in a sprite sheet.
This addresses alignment issues by centering sprites horizontally
and aligning them to the bottom of their cells.
"""

import argparse
from pathlib import Path
from image_processor import ImageProcessor
from PIL import Image, ImageDraw

def draw_grid(image, rows, cols, color=(255, 0, 0, 128)):
    """Draw a grid on an image to visualize cell boundaries for troubleshooting."""
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

def main():
    """Process sprite sheet alignment based on command line arguments."""
    parser = argparse.ArgumentParser(description="Align sprites in a sprite sheet")
    parser.add_argument("input", help="Path to input sprite sheet")
    parser.add_argument("output", help="Path to save aligned sprite sheet")
    parser.add_argument("--rows", type=int, default=2, help="Number of rows in sprite sheet (default: 2)")
    parser.add_argument("--cols", type=int, default=2, help="Number of columns in sprite sheet (default: 2)")
    parser.add_argument("--bottom-padding", type=int, default=2, help="Padding from bottom edge (default: 2)")
    parser.add_argument("--debug", action="store_true", help="Save debug version with grid lines")
    args = parser.parse_args()
    
    # Create image processor
    processor = ImageProcessor()
    
    # Process the sprite sheet
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: Input file '{input_path}' not found")
        return False
    
    # Load the image to log its dimensions
    with Image.open(input_path) as img:
        print(f"Input image size: {img.size[0]}x{img.size[1]}, mode: {img.mode}")
        cell_width = img.size[0] // args.cols
        cell_height = img.size[1] // args.rows
        print(f"Cell size: {cell_width}x{cell_height}")
    
    print(f"Aligning sprites in {input_path} with bottom padding: {args.bottom_padding}px...")
    
    # Apply the custom bottom padding
    # This is a bit of a hack - we modify the class attribute directly
    # A cleaner approach would be to add a parameter to align_sprite_sheet
    import types
    original_method = processor.align_sprite_sheet
    
    def modified_align_method(self, input_path, output_path, rows=2, cols=2, bottom_padding=args.bottom_padding):
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
                    new_y = y1 + cell_height - sprite_height - bottom_padding  # Bottom align with padding
                    
                    print(f"Cell ({row},{col}): Original bbox={bbox}, New position=({new_x},{new_y})")
                    
                    # Paste sprite into the aligned sheet
                    aligned_sheet.paste(sprite, (new_x, new_y), sprite)
            
            # Save the aligned sprite sheet
            aligned_sheet.save(output_path)
            print(f"Created aligned sprite sheet at {output_path}")
            
            # If debug mode is enabled, save a version with grid lines
            if args.debug:
                debug_path = output_path.replace('.png', '_debug.png')
                debug_img = aligned_sheet.copy()
                draw_grid(debug_img, rows, cols)
                debug_img.save(debug_path)
                print(f"Created debug version with grid lines at {debug_path}")
                
            return True
            
        except Exception as e:
            print(f"Error aligning sprite sheet: {e}")
            return False
    
    # Replace the method
    processor.align_sprite_sheet = types.MethodType(modified_align_method, processor)
    
    # Call the modified method
    success = processor.align_sprite_sheet(
        str(input_path), 
        args.output,
        rows=args.rows,
        cols=args.cols
    )
    
    if success:
        print(f"Successfully aligned sprites. Output saved to {args.output}")
        return True
    else:
        print("Failed to align sprites. Check logs for details.")
        return False

if __name__ == "__main__":
    main() 