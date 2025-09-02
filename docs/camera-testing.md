# Camera System Testing Guide

## Quick Start Testing

To test the camera system without a backend:

### 1. Enable Camera Only

Create `.env.local` file:
```bash
VITE_CAMERA_ENABLED=true
VITE_CAMERA_BACKEND_ENABLED=false
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. Test Camera Access

1. Open the application in browser
2. Click the camera button (📷) in the control panel
3. Allow camera permissions when prompted
4. You should see camera controls appear

### 4. Test with Mock Backend

Create a simple mock server for testing:

```javascript
// mock-server.js
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.post('/camera/analyze', (req, res) => {
  console.log('Received camera frame:', {
    timestamp: req.body.timestamp,
    imageSize: req.body.image.length,
    dimensions: `${req.body.width}x${req.body.height}`,
    format: req.body.format
  });
  
  // Mock analysis response
  res.json({
    success: true,
    timestamp: req.body.timestamp,
    analysis: {
      timestamp: req.body.timestamp,
      faces: [{
        boundingBox: { x: 100, y: 80, width: 200, height: 240 },
        confidence: 0.95
      }],
      emotions: [{
        emotion: Math.random() > 0.5 ? 'happy' : 'neutral',
        confidence: 0.8 + Math.random() * 0.2
      }],
      attention: {
        isLooking: Math.random() > 0.3,
        attentionScore: 0.5 + Math.random() * 0.5
      }
    }
  });
});

app.listen(3001, () => {
  console.log('Mock camera backend running on http://localhost:3001');
});
```

Run mock server:
```bash
node mock-server.js
```

Update `.env.local`:
```bash
VITE_CAMERA_ENABLED=true
VITE_CAMERA_BACKEND_ENABLED=true
VITE_CAMERA_BACKEND_URL=http://localhost:3001/camera/analyze
VITE_CAMERA_CAPTURE_INTERVAL=2000
```

### 5. Expected Behavior

With camera enabled:
- Camera button (📷) appears in control panel
- Clicking enables camera access request
- Camera preview appears when streaming
- Backend button (📤) appears when camera is enabled

With backend enabled:
- Frames sent every 2 seconds to backend
- Mock emotions and attention trigger avatar reactions
- Analysis results displayed in expanded camera panel

### 6. Integration Testing

The camera system integrates with existing avatar systems:

**Emotion Integration:**
- Detected emotions (confidence > 0.7) update avatar facial expressions
- Test by having backend return different emotions

**Gaze Integration:**
- High attention scores (> 0.5) trigger avatar gaze toward camera
- Test by having backend return varying attention scores

**Privacy Features:**
- Toggle "Blur background" and "Face detection only" options
- These settings are sent to backend in the request options

### 7. Debugging

Enable browser DevTools to see:
- Camera service status messages
- Backend API requests/responses  
- Analysis integration logs
- Any errors in camera access or API communication

## Production Deployment

For production use:

1. Set up proper HTTPS backend endpoint
2. Configure authentication API keys
3. Implement actual computer vision analysis
4. Consider rate limiting and resource usage
5. Add monitoring for camera service health