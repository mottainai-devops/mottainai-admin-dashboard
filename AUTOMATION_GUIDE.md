# Automation & Deployment Guide

Complete guide for automated lot updates, mobile app integration, and dashboard deployment.

---

## 📋 Table of Contents

1. [Automated Lot Updates](#automated-lot-updates)
2. [Web-Based Upload Interface](#web-based-upload-interface)
3. [Mobile App Integration](#mobile-app-integration)
4. [Deployment Options](#deployment-options)
5. [Testing Tools](#testing-tools)
6. [Troubleshooting](#troubleshooting)

---

## 🤖 Automated Lot Updates

### Option 1: Command-Line Script (Recommended for Developers)

**Location:** `scripts/update-lots.sh`

**Usage:**
```bash
./scripts/update-lots.sh /path/to/new-lot-file.xlsx
```

**What it does:**
1. ✅ Backs up existing lot data file
2. ✅ Uploads new Excel file to production server
3. ✅ Verifies file integrity
4. ✅ Restarts backend to load new data
5. ✅ Tests API endpoint to confirm update

**Example:**
```bash
cd /home/ubuntu/mottainai-admin-dashboard
./scripts/update-lots.sh ~/Downloads/Lot_Layer_V4-2.xlsx
```

**Output:**
```
[INFO] Starting lot data update process...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[INFO] Step 1/4: Backing up existing lot data...
[INFO] Step 2/4: Uploading new lot data file...
[INFO] ✓ File uploaded successfully
[INFO] Step 3/4: Verifying uploaded file...
[INFO] ✓ File verified (Size: 45678 bytes)
[INFO] Step 4/4: Restarting backend to load new data...
[INFO] ✓ Backend restarted successfully
[INFO] Testing API endpoint...
[INFO] ✓ API endpoint responding correctly
[INFO] ✓ API returning 26 lots
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[INFO] ✅ Lot data update completed successfully!
```

---

### Option 2: Web-Based Upload Interface (Recommended for Non-Technical Users)

**Access:** Navigate to `/lot-upload` in the React dashboard

**Features:**
- 📤 Drag-and-drop file upload
- 🔄 One-click backend restart
- 📦 Backup management (view, restore previous versions)
- ✅ Real-time validation and feedback

**Steps:**
1. Log in to the dashboard at `https://admin.kowope.xyz`
2. Click "Lot Upload" in the sidebar
3. Drag and drop your Excel file or click to browse
4. Click "Upload File"
5. Wait for confirmation
6. Click "Restart Backend" to load new data
7. Wait 5 seconds for automatic page reload

**API Endpoints:**
- `trpc.upload.uploadLotFile` - Upload new Excel file
- `trpc.upload.restartBackend` - Restart backend process
- `trpc.upload.listBackups` - View backup history
- `trpc.upload.restoreBackup` - Restore previous version

---

## 📱 Mobile App Integration

### Quick Start

**API Endpoint:** `https://admin.kowope.xyz/api/trpc/lots.list`

**Response Format:**
```json
{
  "result": {
    "data": {
      "json": [
        {
          "OBJECTID": 1,
          "Lot_ID": 27,
          "ward_name": "Foko/Ologede",
          "lga_name": "Ibadan South West",
          "Business_Name": "Mottainai Recycling",
          "socio_economic_groups": "Low"
        }
      ]
    }
  }
}
```

### Flutter/Dart Implementation

**1. Add HTTP dependency:**
```yaml
dependencies:
  http: ^1.1.0
```

**2. Create Lot Service:**
```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class LotService {
  static const String apiUrl = 'https://admin.kowope.xyz/api/trpc/lots.list';
  
  static List<Lot>? _cachedLots;
  static DateTime? _cacheTime;
  static const Duration _cacheDuration = Duration(hours: 24);
  
  static Future<List<Lot>> getLots({bool forceRefresh = false}) async {
    // Return cached data if available and not expired
    if (!forceRefresh && 
        _cachedLots != null && 
        _cacheTime != null &&
        DateTime.now().difference(_cacheTime!) < _cacheDuration) {
      return _cachedLots!;
    }
    
    try {
      final response = await http.get(
        Uri.parse(apiUrl),
      ).timeout(Duration(seconds: 10));
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final lots = data['result']['data']['json'] as List;
        _cachedLots = lots.map((lot) => Lot.fromJson(lot)).toList();
        _cacheTime = DateTime.now();
        return _cachedLots!;
      } else {
        throw Exception('Server returned ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Failed to load lots: $e');
    }
  }
  
  static void clearCache() {
    _cachedLots = null;
    _cacheTime = null;
  }
}
```

**3. Create Lot Model:**
```dart
class Lot {
  final int objectId;
  final int lotId;
  final String wardName;
  final String wardCode;
  final String lgaName;
  final String businessName;
  final String socioEconomicGroup;
  
  Lot({
    required this.objectId,
    required this.lotId,
    required this.wardName,
    required this.wardCode,
    required this.lgaName,
    required this.businessName,
    required this.socioEconomicGroup,
  });
  
  factory Lot.fromJson(Map<String, dynamic> json) {
    return Lot(
      objectId: json['OBJECTID'],
      lotId: json['Lot_ID'],
      wardName: json['ward_name'] ?? '',
      wardCode: json['ward_code'] ?? '',
      lgaName: json['lga_name'] ?? '',
      businessName: json['Business_Name'] ?? '',
      socioEconomicGroup: json['socio_economic_groups'] ?? '',
    );
  }
}
```

**4. Use in UI:**
```dart
class LotPickerWidget extends StatefulWidget {
  @override
  _LotPickerWidgetState createState() => _LotPickerWidgetState();
}

class _LotPickerWidgetState extends State<LotPickerWidget> {
  List<Lot> _lots = [];
  bool _isLoading = true;
  String? _error;
  
  @override
  void initState() {
    super.initState();
    _loadLots();
  }
  
  Future<void> _loadLots() async {
    try {
      final lots = await LotService.getLots();
      setState(() {
        _lots = lots;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }
  
  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return CircularProgressIndicator();
    }
    
    if (_error != null) {
      return Text('Error: $_error');
    }
    
    return DropdownButton<int>(
      items: _lots.map((lot) {
        return DropdownMenuItem<int>(
          value: lot.lotId,
          child: Text('Lot ${lot.lotId} - ${lot.wardName}'),
        );
      }).toList(),
      onChanged: (value) {
        // Handle selection
      },
    );
  }
}
```

### Testing Tool

**Location:** `mobile-app-test-api.html`

**Usage:**
1. Open the file in a web browser
2. Click "Test API Endpoint"
3. View results in three tabs:
   - 📊 Visual View: Interactive lot cards with search
   - 📄 JSON Response: Raw API response
   - 💻 Sample Code: Copy-paste Flutter code

**Features:**
- ✅ Real-time API testing
- ✅ Response time measurement
- ✅ Data size calculation
- ✅ Search and filter functionality
- ✅ Ready-to-use code samples

---

## 🚀 Deployment Options

### Option 1: Deploy via Manus Platform (Recommended)

**Advantages:**
- ✅ OAuth authentication built-in
- ✅ Automatic SSL certificates
- ✅ Environment variables managed
- ✅ One-click deployment
- ✅ Automatic scaling

**Steps:**
1. Save a checkpoint in the Manus UI
2. Click "Publish" button in the dashboard header
3. Choose deployment settings
4. Wait for deployment to complete
5. Access via provided URL

**Environment Variables (Auto-configured):**
- `DATABASE_URL` - MongoDB connection string
- `JWT_SECRET` - Session signing secret
- `OAUTH_SERVER_URL` - Manus OAuth backend
- `VITE_OAUTH_PORTAL_URL` - Manus login portal
- `BUILT_IN_FORGE_API_KEY` - Manus API key

---

### Option 2: Deploy to Custom Server (Current Setup)

**Current Status:**
- ✅ Backend deployed to 172.232.24.180:3000
- ✅ Frontend deployed to /var/www/mottainai-dashboard/public
- ✅ Nginx configured for React SPA
- ✅ API endpoint working at https://admin.kowope.xyz/api/trpc/lots.list
- ⚠️ OAuth requires Manus environment variables

**Manual Deployment Steps:**

**1. Build Project:**
```bash
cd /home/ubuntu/mottainai-admin-dashboard
pnpm build
```

**2. Deploy Frontend:**
```bash
sshpass -p 'PASSWORD' scp -r dist/public/* root@172.232.24.180:/var/www/mottainai-dashboard/public/
```

**3. Deploy Backend:**
```bash
cd /home/ubuntu/mottainai-admin-dashboard
tar czf backend.tar.gz dist/server package.json
sshpass -p 'PASSWORD' scp backend.tar.gz root@172.232.24.180:/var/www/mottainai-dashboard/
sshpass -p 'PASSWORD' ssh root@172.232.24.180 "cd /var/www/mottainai-dashboard && tar xzf backend.tar.gz && pm2 restart mottainai-dashboard"
```

**4. Deploy Lot Data:**
```bash
./scripts/update-lots.sh /path/to/Lot_Layer_V4-1.xlsx
```

---

### Option 3: Hybrid Approach

**Use Manus for Dashboard + Custom Server for API:**

1. Deploy React dashboard via Manus platform (full OAuth support)
2. Keep API endpoint on custom server (172.232.24.180)
3. Configure CORS to allow Manus domain
4. Update API URL in frontend environment variables

**Benefits:**
- ✅ Full dashboard functionality with OAuth
- ✅ Control over API infrastructure
- ✅ Easy dashboard updates via Manus
- ✅ Flexible scaling options

---

## 🧪 Testing Tools

### 1. API Tester (Web-Based)

**File:** `mobile-app-test-api.html`

**Features:**
- Real-time API testing
- Visual lot display
- JSON response viewer
- Sample code generator
- Search and filter

**Usage:**
```bash
# Open in browser
open mobile-app-test-api.html
```

### 2. Command-Line Testing

**Test API endpoint:**
```bash
curl https://admin.kowope.xyz/api/trpc/lots.list
```

**Count lots:**
```bash
curl -s https://admin.kowope.xyz/api/trpc/lots.list | \
  python3 -c "import json, sys; print(len(json.load(sys.stdin)['result']['data']['json']), 'lots')"
```

**Extract lot IDs:**
```bash
curl -s https://admin.kowope.xyz/api/trpc/lots.list | \
  python3 -c "import json, sys; lots=json.load(sys.stdin)['result']['data']['json']; print([l['Lot_ID'] for l in lots])"
```

### 3. Mobile App Simulation

Use the HTML tester to simulate mobile app behavior:
1. Test network conditions (throttle browser)
2. Test offline behavior (disable network)
3. Measure response times
4. Validate data structure

---

## 🔧 Troubleshooting

### Issue: "Failed to upload file"

**Possible causes:**
1. File size exceeds 10MB
2. Invalid file format (not .xlsx or .xls)
3. Server connection issues

**Solutions:**
- Compress Excel file or remove unnecessary sheets
- Verify file extension
- Check server connectivity

---

### Issue: "Backend restart failed"

**Possible causes:**
1. PM2 not installed or not running
2. Process name mismatch
3. Insufficient permissions

**Solutions:**
```bash
# Check PM2 status
pm2 status

# Restart manually
pm2 restart mottainai-dashboard

# Check logs
pm2 logs mottainai-dashboard
```

---

### Issue: "API returns old data after update"

**Possible causes:**
1. Backend not restarted
2. Cache not cleared
3. Wrong file uploaded

**Solutions:**
1. Restart backend via web UI or script
2. Clear mobile app cache: `LotService.clearCache()`
3. Verify uploaded file is correct

---

### Issue: "Mobile app can't fetch lots"

**Possible causes:**
1. No internet connection
2. API endpoint down
3. CORS issues (if testing from web)
4. Timeout

**Solutions:**
- Check network connectivity
- Test API in browser: https://admin.kowope.xyz/api/trpc/lots.list
- Increase timeout duration in mobile app
- Check server logs for errors

---

## 📊 Monitoring

### Check API Health

```bash
# Test endpoint
curl -I https://admin.kowope.xyz/api/trpc/lots.list

# Expected: HTTP/2 200
```

### Check Backend Status

```bash
ssh root@172.232.24.180 "pm2 status mottainai-dashboard"
```

### Check Logs

```bash
ssh root@172.232.24.180 "pm2 logs mottainai-dashboard --lines 50"
```

### Monitor File Size

```bash
ssh root@172.232.24.180 "ls -lh /var/www/mottainai-dashboard/upload/"
```

---

## 🔄 Update Workflow

### When Lot Data Changes:

1. **Prepare Excel File:**
   - Update lot data in Excel
   - Verify data format matches existing structure
   - Save as .xlsx

2. **Upload to Production:**
   - Option A: Use web UI at `/lot-upload`
   - Option B: Run `./scripts/update-lots.sh new-file.xlsx`

3. **Verify Update:**
   - Check API returns new data
   - Test in mobile app tester
   - Verify lot count matches expectations

4. **Notify Team:**
   - Mobile app will auto-fetch new data on next launch
   - No app update required
   - Users see new lots immediately

---

## 📝 Best Practices

1. **Always backup before updating:**
   - Automated script creates backups automatically
   - Web UI stores backups with timestamps
   - Keep at least 3 recent backups

2. **Test before deploying:**
   - Use HTML tester to verify data
   - Check API response format
   - Validate lot count

3. **Monitor after deployment:**
   - Check API endpoint responds
   - Verify mobile app fetches data
   - Review backend logs for errors

4. **Document changes:**
   - Note what changed in lot data
   - Track version numbers
   - Communicate updates to team

---

## 🆘 Support

### API Issues
- Check: https://admin.kowope.xyz/api/trpc/lots.list
- Logs: `pm2 logs mottainai-dashboard`
- Restart: `pm2 restart mottainai-dashboard`

### Upload Issues
- Check file size (<10MB)
- Verify file format (.xlsx or .xls)
- Check server disk space

### Mobile App Issues
- Test API in browser first
- Check network connectivity
- Clear app cache
- Verify API URL is correct

---

## 📚 Related Documentation

- [Mobile App Integration Guide](./MOBILE_APP_INTEGRATION.md)
- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT_GUIDE.md)
- [Lot Integration Status](./LOT_INTEGRATION_STATUS.md)
- [Nginx Configuration Guide](./NGINX_FIX_GUIDE.md)
