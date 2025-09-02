# Camera Backend API Integration

This document describes the camera backend API integration for the CI-XR-Web system.

## Overview

The camera service captures webcam frames and sends them to a backend API for analysis. The analysis results are then integrated with the existing emotion and gaze systems to enhance avatar interactions.

## Configuration

Add these environment variables to your `.env.local` file:

```bash
# Enable camera service
VITE_CAMERA_ENABLED=true

# Camera capture settings
VITE_CAMERA_WIDTH=640
VITE_CAMERA_HEIGHT=480
VITE_CAMERA_FRAMERATE=15

# Backend API settings
VITE_CAMERA_BACKEND_ENABLED=true
VITE_CAMERA_BACKEND_URL=https://your-api.example.com/camera/analyze
VITE_CAMERA_BACKEND_API_KEY=your_api_key_here

# Frame processing
VITE_CAMERA_CAPTURE_INTERVAL=1000  # Send frame every 1000ms
VITE_CAMERA_IMAGE_FORMAT=jpeg
VITE_CAMERA_IMAGE_QUALITY=0.8

# Privacy settings
VITE_CAMERA_BLUR_BACKGROUND=false
VITE_CAMERA_FACE_DETECTION_ONLY=false
```

## Backend API Specification

### Endpoint

```
POST {VITE_CAMERA_BACKEND_URL}
```

### Headers

```
Content-Type: application/json
Authorization: Bearer {VITE_CAMERA_BACKEND_API_KEY}
```

### Request Body

```json
{
  "timestamp": 1640995200000,
  "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA...",
  "width": 640,
  "height": 480,
  "format": "jpeg",
  "options": {
    "send_full_frames": true,
    "send_analysis_only": false,
    "blur_background": false,
    "face_detection_only": false
  }
}
```

### Response Body

```json
{
  "success": true,
  "timestamp": 1640995200000,
  "analysis": {
    "timestamp": 1640995200000,
    "faces": [
      {
        "boundingBox": {
          "x": 100,
          "y": 80,
          "width": 200,
          "height": 240
        },
        "confidence": 0.95,
        "landmarks": [
          {
            "type": "eye",
            "position": { "x": 150, "y": 120 },
            "confidence": 0.92
          }
        ]
      }
    ],
    "emotions": [
      {
        "emotion": "happy",
        "confidence": 0.85
      }
    ],
    "attention": {
      "isLooking": true,
      "gazeDirection": { "x": 0.1, "y": 0.05 },
      "headPose": { "yaw": 5.2, "pitch": -2.1, "roll": 0.8 },
      "attentionScore": 0.78
    },
    "gestures": [
      {
        "gesture": "wave",
        "confidence": 0.72,
        "boundingBox": {
          "x": 300,
          "y": 200,
          "width": 100,
          "height": 150
        }
      }
    ]
  }
}
```

### Error Response

```json
{
  "success": false,
  "timestamp": 1640995200000,
  "error": "Face detection failed"
}
```

## Integration with Avatar System

The camera analysis results are automatically integrated with the existing systems:

### Emotion Integration
- When emotions are detected with confidence > 0.7, the avatar's emotion is updated
- Supported emotions: happy, sad, angry, surprised, fear, disgust, neutral

### Gaze Integration  
- When attention.isLooking is true and attention.attentionScore > 0.5, avatar gaze is triggered
- The gaze duration is set to 2000ms with randomness factor of 0.8

### Example Integration Code

```typescript
// In useAgent.ts - camera analysis callback
onAnalysis: (analysis) => {
  // Integrate camera analysis with emotion system
  if (analysis.emotions && analysis.emotions.length > 0) {
    const emotion = analysis.emotions[0]
    if (emotion.confidence > 0.7) {
      emotes.actions.setEmotion(emotion.emotion as EmotionType)
    }
  }
  
  // Integrate attention data with gaze system
  if (analysis.attention && analysis.attention.isLooking && analysis.attention.attentionScore > 0.5) {
    emotes.actions.triggerGaze({ duration: 2000, randomness: 0.8 })
  }
}
```

## UI Controls

The camera system includes UI controls in the main control panel:

- **📷 Camera Button**: Enables/disables camera capture
- **📤 Backend Button**: Enables/disables sending frames to backend (only visible when camera is enabled)

Additional controls are available in the expanded camera component:
- Backend URL configuration
- Privacy settings (blur background, face detection only)
- Real-time analysis results display

## Example Backend Implementation (Python/Flask)

```python
from flask import Flask, request, jsonify
import base64
import cv2
import numpy as np

app = Flask(__name__)

@app.route('/camera/analyze', methods=['POST'])
def analyze_camera():
    try:
        data = request.json
        
        # Decode base64 image
        image_data = data['image'].split(',')[1]  # Remove data:image/jpeg;base64, prefix
        image_bytes = base64.b64decode(image_data)
        
        # Convert to OpenCV image
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Perform your analysis here
        # - Face detection
        # - Emotion recognition  
        # - Gaze estimation
        # - Gesture recognition
        
        # Example response
        analysis = {
            "timestamp": data['timestamp'],
            "faces": [
                {
                    "boundingBox": {"x": 100, "y": 80, "width": 200, "height": 240},
                    "confidence": 0.95
                }
            ],
            "emotions": [
                {
                    "emotion": "happy",
                    "confidence": 0.85
                }
            ],
            "attention": {
                "isLooking": True,
                "attentionScore": 0.78
            }
        }
        
        return jsonify({
            "success": True,
            "timestamp": data['timestamp'],
            "analysis": analysis
        })
        
    except Exception as e:
        return jsonify({
            "success": False,
            "timestamp": data.get('timestamp', 0),
            "error": str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

## Privacy and Security Considerations

1. **Camera Permissions**: The system requests camera access only when enabled
2. **Data Transmission**: Images are sent as base64 encoded data over HTTPS
3. **API Authentication**: Supports API key authentication via Bearer token
4. **Privacy Controls**: 
   - Option to blur background
   - Option to only detect faces (no full frame sending)
   - Configurable capture intervals to limit data transmission

## Troubleshooting

### Common Issues

1. **Camera Access Denied**: Ensure browser has camera permissions
2. **Backend API Errors**: Check API URL and authentication key
3. **No Analysis Results**: Verify backend API is returning expected response format
4. **Performance Issues**: Increase capture interval or reduce image quality

### Debug Information

Enable browser developer tools to see:
- Camera service status messages
- API request/response data
- Analysis integration results