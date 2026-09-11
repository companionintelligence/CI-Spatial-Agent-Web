"""
Startup script for Grounding DINO Server
Handles model download and server startup
"""

import os
import sys
import subprocess

# Add the server directory to the path
server_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, server_dir)

def main():
    print("=" * 60)
    print("Grounding DINO Object Detection Server")
    print("=" * 60)
    print()
    
    # Step 1: Download weights
    print("Step 1: Checking model weights...")
    try:
        from download_weights import download_weights
        download_weights()
        print()
    except Exception as e:
        print(f"Error downloading weights: {e}")
        print("Will attempt to download on first request...")
        print()
    
    # Step 2: Check PyTorch and CUDA
    print("Step 2: Checking PyTorch installation...")
    try:
        import torch
        print(f"✓ PyTorch version: {torch.__version__}")
        print(f"✓ CUDA available: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            print(f"✓ CUDA device: {torch.cuda.get_device_name(0)}")
            print(f"✓ CUDA memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
        print()
    except ImportError:
        print("✗ PyTorch not installed!")
        print("Please install PyTorch with CUDA support:")
        print("  pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128")
        sys.exit(1)
    
    # Step 3: Start the server
    print("Step 3: Starting FastAPI server...")
    print("=" * 60)
    print()
    
    # Use uvicorn to run the server
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )

if __name__ == "__main__":
    main()
