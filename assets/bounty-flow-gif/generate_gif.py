#!/usr/bin/env python3
"""
SolFoundry Bounty Flow Animated GIF Generator
Creates an animated GIF showing the bounty creation and submission flow
"""

from PIL import Image, ImageDraw, ImageFont
import os

# Configuration
WIDTH, HEIGHT = 800, 600
FPS = 2
FRAMES = []

# Color scheme (SolFoundry brand)
DARK_BG = (0x0f, 0x17, 0x2a)  # Dark slate
EMERALD = (0x10, 0xb9, 0x81)   # Emerald green
MAGENTA = (0xec, 0x48, 0x99)   # Magenta/pink
WHITE = (0xff, 0xff, 0xff)
GRAY = (0x94, 0xa3, 0xb8)

def create_frame(step_num, active_step, total_steps=5):
    """Create a single frame of the animation"""
    img = Image.new('RGB', (WIDTH, HEIGHT), DARK_BG)
    draw = ImageDraw.Draw(img)
    
    # Title
    title = "SolFoundry Bounty Flow"
    draw.text((WIDTH//2, 50), title, fill=WHITE, anchor='mm')
    
    # Steps
    steps = [
        "1. Create Bounty",
        "2. Fund Bounty", 
        "3. Submit Work",
        "4. AI Review",
        "5. Get Paid"
    ]
    
    # Draw flow diagram
    step_positions = [(100, 200), (250, 200), (400, 200), (550, 200), (700, 200)]
    
    for i, (pos, step) in enumerate(zip(step_positions, steps)):
        x, y = pos
        
        # Box color based on active step
        if i < active_step:
            box_color = EMERALD  # Completed
            text_color = DARK_BG
        elif i == active_step:
            box_color = MAGENTA  # Active
            text_color = WHITE
        else:
            box_color = (0x33, 0x41, 0x55)  # Pending
            text_color = GRAY
        
        # Draw box
        box_width, box_height = 120, 80
        draw.rounded_rectangle([
            (x - box_width//2, y - box_height//2),
            (x + box_width//2, y + box_height//2)
        ], radius=10, fill=box_color)
        
        # Draw text
        draw.text((x, y), step, fill=text_color, anchor='mm')
        
        # Draw arrow (except last)
        if i < len(steps) - 1:
            arrow_x = x + box_width//2 + 25
            draw.line([(arrow_x, y), (arrow_x + 40, y)], fill=EMERALD, width=3)
            # Arrow head
            draw.polygon([
                (arrow_x + 40, y),
                (arrow_x + 35, y - 5),
                (arrow_x + 35, y + 5)
            ], fill=EMERALD)
    
    # Progress indicator
    progress = (active_step + 1) / total_steps
    bar_width = WIDTH - 100
    bar_height = 10
    bar_x = 50
    bar_y = 350
    
    # Background
    draw.rounded_rectangle([
        (bar_x, bar_y),
        (bar_x + bar_width, bar_y + bar_height)
    ], radius=5, fill=(0x33, 0x41, 0x55))
    
    # Progress fill
    fill_width = int(bar_width * progress)
    if fill_width > 0:
        draw.rounded_rectangle([
            (bar_x, bar_y),
            (bar_x + fill_width, bar_y + bar_height)
        ], radius=5, fill=EMERALD)
    
    # Step counter
    draw.text((WIDTH//2, 400), f"Step {active_step + 1} of {total_steps}", fill=GRAY, anchor='mm')
    
    # SolFoundry branding
    draw.text((WIDTH - 20, HEIGHT - 20), "SolFoundry", fill=MAGENTA, anchor='rm')
    
    return img

# Generate frames
for step in range(5):
    # Hold each step for 2 frames
    for _ in range(2):
        frame = create_frame(step, step)
        FRAMES.append(frame)

# Add final frame (all complete)
final_frame = create_frame(5, 5)
FRAMES.append(final_frame)

# Save as GIF
output_path = os.path.join(os.path.dirname(__file__), 'bounty-flow.gif')
FRAMES[0].save(
    output_path,
    save_all=True,
    append_images=FRAMES[1:],
    duration=500,
    loop=0,
    optimize=True
)

print(f"✓ GIF created: {output_path}")
print(f"  - {len(FRAMES)} frames")
print(f"  - {WIDTH}x{HEIGHT} pixels")
print(f"  - {FPS} FPS")
