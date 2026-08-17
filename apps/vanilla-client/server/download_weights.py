"""
Download Grounding DINO model weights
"""

import os
import urllib.request
import sys

WEIGHTS_URL = "https://github.com/IDEA-Research/GroundingDINO/releases/download/v0.1.0-alpha/groundingdino_swint_ogc.pth"
WEIGHTS_FILENAME = "groundingdino_swint_ogc.pth"

def download_weights():
    """Download the model weights if they don't exist"""
    
    # Create weights directory
    weights_dir = os.path.join(os.path.dirname(__file__), "weights")
    os.makedirs(weights_dir, exist_ok=True)
    
    weights_path = os.path.join(weights_dir, WEIGHTS_FILENAME)
    
    if os.path.exists(weights_path):
        print(f"✓ Model weights already exist at: {weights_path}")
        return weights_path
    
    print(f"Downloading Grounding DINO model weights...")
    print(f"URL: {WEIGHTS_URL}")
    print(f"Destination: {weights_path}")
    print()
    
    try:
        # Download with progress
        def report_progress(block_num, block_size, total_size):
            downloaded = block_num * block_size
            percent = min(100, downloaded * 100 / total_size)
            mb_downloaded = downloaded / (1024 * 1024)
            mb_total = total_size / (1024 * 1024)
            print(f"\rProgress: {percent:.1f}% ({mb_downloaded:.1f} MB / {mb_total:.1f} MB)", end="", flush=True)
        
        urllib.request.urlretrieve(WEIGHTS_URL, weights_path, reporthook=report_progress)
        print()  # New line after progress
        print(f"✓ Download complete!")
        print(f"✓ Weights saved to: {weights_path}")
        return weights_path
        
    except Exception as e:
        print(f"\n✗ Error downloading weights: {e}")
        # Clean up partial download
        if os.path.exists(weights_path):
            os.remove(weights_path)
        sys.exit(1)

if __name__ == "__main__":
    download_weights()
