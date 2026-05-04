# 360° Image Loading Fix

## Problem
360° images were not loading in the mobile app even though campus maps worked.

## Root Cause
1. **Empty strings in database**: Some nodes had empty strings (`""`) for `image360` instead of `null`
2. **Incorrect boolean check**: `!!n.image360` returned `true` for empty strings
3. **buildUrl didn't filter empty strings**: Empty strings were passed through

## Solution Applied

### 1. Updated `buildUrl()` Function
**File**: `src/routes/mobileApi.js`

```javascript
const buildUrl = (req, path) => {
    if (!path || path.trim() === '') return null;  // ← Added empty string check
    
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;  // Return Cloudinary URLs as-is
    }
    
    return `${req.protocol}://${req.get('host')}/media/${path}`;
};
```

### 2. Fixed `has_360_image` Check
**Before**: `has_360_image: !!n.image360` (true for empty strings ❌)
**After**: `has_360_image: !!(n.image360 && n.image360.trim())` (false for empty strings ✅)

## Test Results

```
Node: BLDG-1 (empty string)
  has_360_image: false ✅
  image360_url: null ✅

Node: NO-BLDG (Cloudinary URL)
  has_360_image: true ✅
  image360_url: https://res.cloudinary.com/dir9ljc5q/... ✅

Node: BLDG-2 (Cloudinary URL)
  has_360_image: true ✅
  image360_url: https://res.cloudinary.com/dir9ljc5q/... ✅
```

## What the Mobile App Now Receives

### Empty Image Node
```json
{
  "node_code": "BLDG-1",
  "has_360_image": false,
  "image360_url": null
}
```

### Valid Image Node
```json
{
  "node_code": "NO-BLDG",
  "has_360_image": true,
  "image360_url": "https://res.cloudinary.com/dir9ljc5q/image/upload/v1764689986/campus-navigator/360-images/l4kqoq2zt6gnvaljedv1.jpg"
}
```

## Mobile App Should Check

```javascript
// In your React Native code
if (node.has_360_image && node.image360_url) {
  // Load the 360° image from node.image360_url
  <Image source={{ uri: node.image360_url }} />
}
```

## Verified Working
- ✅ Empty strings return `null`
- ✅ `has_360_image` is `false` for empty/null
- ✅ Cloudinary URLs returned as-is
- ✅ No `/media/` prefix added to Cloudinary URLs
- ✅ Maps working (blueprint_image uses same buildUrl)

## Next Steps for Mobile App
1. Restart the Express server: `npm start`
2. Check that `has_360_image` is `true` for nodes with images
3. Verify `image360_url` contains full Cloudinary URL
4. Ensure React Native `Image` component can load HTTPS URLs
5. Check for CORS/SSL issues if images still don't load

## Test Commands

```bash
# Start server
npm start

# Check API response
curl http://localhost:3000/api/mobile/nodes/NO-BLDG
```

Expected response should have:
```json
{
  "node": {
    "image360_url": "https://res.cloudinary.com/dir9ljc5q/...",
    ...
  }
}
```
