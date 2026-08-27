"""
Grounding DINO Object Detection Server
FastAPI backend for real-time object detection in AR
"""

import os
import base64
import io
import json
import logging
from typing import List, Optional
from datetime import datetime

import numpy as np
import cv2
from PIL import Image
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Grounding DINO Object Detection Server",
    description="Real-time object detection for AR applications",
    version="1.0.0"
)

# CORS middleware to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model instance
model = None

class DetectionResult(BaseModel):
    """Detection result model"""
    label: str
    confidence: float
    bbox: List[float]  # [x1, y1, x2, y2]
    center: List[float]  # [x, y] normalized center point

class DetectionResponse(BaseModel):
    """Response model for detection results"""
    detections: List[DetectionResult]
    inference_time_ms: float
    timestamp: str


def get_model():
    """Lazy load the Grounding DINO model"""
    global model
    if model is None:
        logger.info("Loading Grounding DINO model...")
        try:
            from groundingdino.util.inference import load_model, load_image, predict, annotate
            import torch
            
            # Use the config bundled with the installed groundingdino package so it
            # always matches the installed version (avoids attribute mismatch errors).
            import groundingdino as _gdino_pkg
            config_path = os.path.join(
                os.path.dirname(_gdino_pkg.__file__), "config", "GroundingDINO_SwinT_OGC.py"
            )
            weights_path = os.path.join(os.path.dirname(__file__), "weights", "groundingdino_swint_ogc.pth")
            
            # Download weights if they don't exist
            if not os.path.exists(weights_path):
                logger.info("Downloading model weights...")
                os.makedirs(os.path.dirname(weights_path), exist_ok=True)
                import urllib.request
                url = "https://github.com/IDEA-Research/GroundingDINO/releases/download/v0.1.0-alpha/groundingdino_swint_ogc.pth"
                urllib.request.urlretrieve(url, weights_path)
                logger.info("Model weights downloaded successfully")
            
            # Load model
            model = load_model(config_path, weights_path)
            
            # Move to GPU if available
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            model = model.to(device)
            
            logger.info(f"Model loaded successfully on {device}")
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            raise
    return model


def detect_objects(image_np: np.ndarray, text_prompt: str = "object", box_threshold: float = 0.35, text_threshold: float = 0.25) -> List[DetectionResult]:
    """
    Run object detection on an image
    
    Args:
        image_np: numpy array of the image (BGR format from OpenCV)
        text_prompt: text description of what to detect (e.g., "chair . table . person")
        box_threshold: confidence threshold for bounding boxes
        text_threshold: confidence threshold for text matching
    
    Returns:
        List of DetectionResult objects
    """
    try:
        from groundingdino.util.inference import predict
        from groundingdino.datasets import transforms as T
        import torch
        
        model = get_model()
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
        # Convert BGR numpy array → RGB PIL Image (same starting point as load_image)
        image_rgb = cv2.cvtColor(image_np, cv2.COLOR_BGR2RGB)
        image_pil = Image.fromarray(image_rgb)
        
        # Apply the exact transform groundingdino's load_image uses so predict()
        # receives a correctly shaped and normalised torch.Tensor
        transform = T.Compose([
            T.RandomResize([800], max_size=1333),
            T.ToTensor(),
            T.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        ])
        image_tensor, _ = transform(image_pil, None)
        
        # Run inference
        boxes, logits, phrases = predict(
            model=model,
            image=image_tensor,
            caption=text_prompt,
            box_threshold=box_threshold,
            text_threshold=text_threshold,
            device=device,
        )
        
        results = []
        h, w = image_np.shape[:2]
        
        for box, logit, phrase in zip(boxes, logits, phrases):
            # Grounding DINO returns boxes in normalized [cx, cy, w, h] format (0-1).
            # Treat them correctly — NOT as [x1, y1, x2, y2].
            cx_n, cy_n, bw_n, bh_n = box.tolist()

            # Convert to pixel corner coordinates
            x1 = (cx_n - bw_n / 2) * w
            y1 = (cy_n - bh_n / 2) * h
            x2 = (cx_n + bw_n / 2) * w
            y2 = (cy_n + bh_n / 2) * h

            # Center is directly cx_n, cy_n (already normalized 0-1)
            results.append(DetectionResult(
                label=phrase,
                confidence=float(logit),
                bbox=[float(x1), float(y1), float(x2), float(y2)],
                center=[cx_n, cy_n]
            ))
        
        return results
    except Exception as e:
        logger.error(f"Error in detection: {e}")
        return []


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "running",
        "service": "Grounding DINO Object Detection Server",
        "version": "1.0.0",
        "cuda_available": is_cuda_available()
    }


@app.get("/health")
async def health():
    """Detailed health check"""
    try:
        import torch
        return {
            "status": "healthy",
            "pytorch_version": torch.__version__,
            "cuda_available": torch.cuda.is_available(),
            "cuda_device": torch.cuda.get_device_name(0) if torch.cuda.is_available() else None,
            "model_loaded": model is not None
        }
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}


def is_cuda_available():
    """Check if CUDA is available"""
    try:
        import torch
        return torch.cuda.is_available()
    except:
        return False


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time detection"""
    await websocket.accept()
    logger.info("WebSocket connection established")
    
    try:
        while True:
            # Receive message from client
            message = await websocket.receive_text()
            data = json.loads(message)
            
            # Parse the message
            action = data.get("action", "detect")
            
            if action == "detect":
                # Get base64 image
                image_b64 = data.get("image", "")
                text_prompt = data.get("prompt", "object")
                box_threshold = data.get("box_threshold", 0.35)
                text_threshold = data.get("text_threshold", 0.25)
                
                if not image_b64:
                    await websocket.send_json({
                        "error": "No image provided",
                        "timestamp": datetime.now().isoformat()
                    })
                    continue
                
                # Decode base64 image
                try:
                    image_data = base64.b64decode(image_b64.split(",")[-1])
                    image = Image.open(io.BytesIO(image_data))
                    image_np = np.array(image)
                    
                    # Convert RGB to BGR for OpenCV
                    if len(image_np.shape) == 3 and image_np.shape[2] == 3:
                        image_np = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
                    
                    # Run detection
                    import time
                    start_time = time.time()
                    
                    detections = detect_objects(
                        image_np, 
                        text_prompt, 
                        box_threshold, 
                        text_threshold
                    )
                    
                    inference_time = (time.time() - start_time) * 1000  # Convert to ms
                    
                    # Send response
                    response = DetectionResponse(
                        detections=detections,
                        inference_time_ms=inference_time,
                        timestamp=datetime.now().isoformat()
                    )
                    
                    await websocket.send_json(response.model_dump())
                    
                except Exception as e:
                    logger.error(f"Error processing image: {e}")
                    await websocket.send_json({
                        "error": str(e),
                        "timestamp": datetime.now().isoformat()
                    })
            
            elif action == "ping":
                await websocket.send_json({"status": "pong"})
                
    except WebSocketDisconnect:
        logger.info("WebSocket connection closed")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.close()


if __name__ == "__main__":
    import uvicorn
    
    # Pre-load model on startup
    try:
        get_model()
    except Exception as e:
        logger.warning(f"Could not pre-load model: {e}")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
