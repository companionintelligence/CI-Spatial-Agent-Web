# Publishing to App Store for Apple Vision Pro

This guide walks you through publishing your CI Agent WebSpatial app to the App Store for Apple Vision Pro.

## Prerequisites

### 1. Apple Developer Account
- **Required**: Active Apple Developer Program membership ($99/year)
- Sign up at: https://developer.apple.com/programs/
- Your Team ID will be needed (found in Apple Developer portal)

### 2. App Store Connect Setup
1. Log in to [App Store Connect](https://appstoreconnect.apple.com/)
2. Create a new app:
   - Click **"My Apps"** → **"+"** → **"New App"**
   - Select **"Apple Vision Pro"** as the platform
   - Fill in app information:
     - **Name**: "CI Agent" (or your preferred name)
     - **Primary Language**: English (or your choice)
     - **Bundle ID**: `com.companionintel.agent` (must match your .env.local)
     - **SKU**: Unique identifier (e.g., `ci-agent-001`)

### 3. Required Information
Before publishing, gather:
- **Bundle ID**: `com.companionintelligence.agent` (from your .env.local)
- **Team ID**: Your Apple Developer Team ID (e.g., `PB6UYXKVW6`)
- **App Version**: Semantic version (e.g., `1.0.0`, `1.0.1`)
- **App Store Connect Credentials**: Username and App-Specific Password

## Step 1: Configure Production Environment

### Update `.env.local` for Production

```bash
# Production Server URL (your hosted app)
# This should be your production HTTPS URL where the app is hosted
XR_PROD_SERVER=https://your-production-domain.com/webspatial/avp

# Bundle ID (must match App Store Connect)
XR_BUNDLE_ID=com.companionintelligence.agent

# Team ID (from Apple Developer portal)
XR_TEAM_ID=PB6UYXKVW6

# Version (must match App Store Connect version)
# Use semantic versioning: MAJOR.MINOR.PATCH (e.g., 1.0.0, 1.0.1, 1.1.0)
XR_VERSION=1.0.0

# App Store Connect Credentials
# Use an App-Specific Password, not your regular Apple ID password
# Generate at: https://appleid.apple.com/account/manage
XR_DEV_NAME=your-apple-id@example.com
XR_DEV_PASSWORD=xxxx-xxxx-xxxx-xxxx
```

**Note on Version Management:**
- The version in `XR_VERSION` must match the version in App Store Connect
- Consider updating `package.json` and `public/manifest.json` version fields for consistency
- Each App Store submission requires a new version number (must be incremented)

### Important Notes:
- **XR_PROD_SERVER**: Must be a publicly accessible HTTPS URL where your built app is hosted
- **App-Specific Password**: Required for App Store Connect API access
  - Go to https://appleid.apple.com/account/manage
  - Sign in → Security → App-Specific Passwords
  - Generate a new password for "App Store Connect API"

## Step 2: Build Production Bundle

### 2.1 Build Your Web App

First, build the production version of your web app:

```bash
# Build the production bundle
npm run build

# This creates optimized files in the dist/ directory
```

### 2.2 Deploy to Production Server

Deploy the contents of the `dist/` directory to your production server. The app must be:
- Served over **HTTPS** (required for visionOS)
- Accessible at the URL specified in `XR_PROD_SERVER`
- Properly configured with CORS headers if needed

**Example deployment options:**
- AWS S3 + CloudFront
- Vercel
- Netlify
- Your own server with HTTPS

### 2.3 Verify Production Build

Test that your production URL works:
```bash
# Visit your production URL in Safari
# Should load the app correctly
curl https://your-production-domain.com/webspatial/avp
```

## Step 3: Build visionOS App Bundle

Use WebSpatial Builder to create the native visionOS app:

```bash
# Build the app bundle for App Store submission
npm run build:avp
```

This command:
- Packages your web app as a native visionOS app
- Signs it with your Apple Developer credentials
- Creates an `.app` bundle ready for submission

**Expected output:**
- App bundle in `dist/` or specified output directory
- Signed with your Team ID
- Ready for App Store submission

## Step 4: Publish to App Store

### Option A: Using npm script (Recommended)

```bash
# Publish directly to App Store Connect
npm run publish:avp
```

This command:
- Uses your `.env.local` configuration
- Uploads the app to App Store Connect
- Submits for review (if configured)

### Option B: Manual Command

```bash
# If you need to override settings
dotenv -e .env.local -- sh -c 'webspatial-builder publish \
  --base=$XR_PROD_SERVER \
  --bundle-id=$XR_BUNDLE_ID \
  --teamId=$XR_TEAM_ID \
  --version=$XR_VERSION \
  --u=$XR_DEV_NAME \
  --p=$XR_DEV_PASSWORD'
```

## Step 5: App Store Connect Configuration

### 5.1 App Information

In App Store Connect, configure:

1. **App Information**:
   - App Name: "CI Agent"
   - Subtitle: Brief description
   - Category: Productivity / Utilities / Entertainment
   - Privacy Policy URL: (required)

2. **Pricing and Availability**:
   - Set price (Free or Paid)
   - Select countries/regions

### 5.2 App Store Listing

1. **Screenshots** (Required):
   - Capture screenshots on Apple Vision Pro
   - Required sizes:
     - 1024x1024 (App Icon)
     - Various sizes for screenshots
   - Use the Vision Pro simulator or device

2. **Description**:
   ```
   CI Agent is a spatial computing app featuring an AI-powered 3D avatar 
   with conversational capabilities. Interact with your AI assistant in 
   immersive 3D space on Apple Vision Pro.
   ```

3. **Keywords**: 
   - AI, avatar, spatial computing, assistant, conversation

4. **Support URL**: Your support website
5. **Marketing URL**: (Optional) Your marketing site

### 5.3 App Privacy

Configure privacy details:
- **Microphone**: Required (for voice input)
- **Network Access**: Required (for LLM/API calls)
- Add privacy policy explaining data usage

### 5.4 Build Submission

1. In App Store Connect, go to your app
2. Navigate to **"TestFlight"** or **"App Store"** tab
3. Click **"+"** to add a new build
4. Select the build uploaded by `webspatial-builder publish`
5. Fill in version information
6. Submit for review

## Step 6: App Review Process

### What Apple Reviews:

1. **Functionality**: App works as described
2. **Guidelines Compliance**: Follows App Store Review Guidelines
3. **Metadata Accuracy**: Screenshots/description match app
4. **Performance**: App performs well on Vision Pro
5. **Privacy**: Privacy policy and data handling

### Common Rejection Reasons:

- **Missing Privacy Policy**: Required for apps with network access
- **Incomplete Metadata**: Missing screenshots or descriptions
- **Performance Issues**: App crashes or poor performance
- **Guideline Violations**: Content or functionality issues

### Review Timeline:

- **Initial Review**: 24-48 hours typically
- **Re-submission**: If rejected, fix issues and resubmit

## Step 7: Testing Before Submission

### Test on Device/Simulator

1. **Build for Testing**:
   ```bash
   npm run build:avp
   ```

2. **Install on Vision Pro**:
   - Use Xcode to install on device
   - Or use TestFlight for beta testing

3. **Test Key Features**:
   - ✅ App launches correctly
   - ✅ 3D avatar renders
   - ✅ Voice input works
   - ✅ LLM responses work
   - ✅ UI is responsive
   - ✅ No crashes

### TestFlight Beta Testing (Recommended)

1. Upload build to TestFlight
2. Invite beta testers
3. Collect feedback
4. Fix issues before App Store submission

## Troubleshooting

### Build Errors

**"Invalid Bundle ID"**:
- Ensure `XR_BUNDLE_ID` matches App Store Connect exactly
- Check Bundle ID is registered in Apple Developer portal

**"Invalid Team ID"**:
- Verify `XR_TEAM_ID` is correct
- Check you have proper permissions in Apple Developer account

**"Authentication Failed"**:
- Use App-Specific Password, not regular password
- Verify credentials in `.env.local`

**"Production Server Not Accessible"**:
- Ensure `XR_PROD_SERVER` is publicly accessible
- Must be HTTPS
- Test URL in browser first

### Publishing Errors

**"Upload Failed"**:
- Check network connection
- Verify App Store Connect API access
- Check file size limits

**"Version Already Exists"**:
- Increment `XR_VERSION` in `.env.local`
- Update version in App Store Connect

## Checklist Before Publishing

- [ ] Apple Developer account active
- [ ] App created in App Store Connect
- [ ] Bundle ID matches in `.env.local` and App Store Connect
- [ ] Production server deployed and accessible
- [ ] `XR_PROD_SERVER` points to production HTTPS URL
- [ ] App-Specific Password generated and set in `.env.local`
- [ ] App tested on Vision Pro device/simulator
- [ ] Screenshots captured
- [ ] App description and metadata prepared
- [ ] Privacy policy URL added
- [ ] App icon (1024x1024) ready
- [ ] Version number set correctly

## Additional Resources

- [Apple Developer Documentation](https://developer.apple.com/documentation/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [WebSpatial Documentation](https://webspatial.com/docs) (if available)

## Support

For issues specific to:
- **WebSpatial Builder**: Check WebSpatial documentation
- **App Store Submission**: Apple Developer Support
- **App Review**: App Store Connect support

---

**Note**: This process uses WebSpatial Builder which packages your web app as a native visionOS app. The exact commands and options may vary based on the WebSpatial Builder version. Refer to the WebSpatial documentation for the most up-to-date information.

