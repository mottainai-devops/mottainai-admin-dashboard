# Mobile App Lot API Testing Guide

## Overview

The lot API at `https://admin.kowope.xyz/api/trpc/lots.list` is now live and serving all 26 operational lots from your ArcGIS data. This guide explains how to test the API integration end-to-end.

## Current Status

✅ **Lot API**: Live at `https://admin.kowope.xyz/api/trpc/lots.list`  
✅ **LotService**: Created at `/home/ubuntu/mottainai_survey_app/lib/services/lot_service.dart`  
✅ **API Response**: Returns 26 lots with all metadata  
⏳ **Mobile App Integration**: Ready for implementation  

## Testing the API

### Option 1: Direct API Test (Immediate)

Test the API directly using curl or any HTTP client:

```bash
curl -s 'https://admin.kowope.xyz/api/trpc/lots.list' | jq
```

**Expected Response:**
```json
{
  "result": {
    "data": {
      "json": [
        {
          "lotId": "LOT001",
          "lotName": "Lot 1",
          "ward": "Ward 1",
          "lga": "Ikeja",
          "company": "Company A",
          "paytWebhook": "https://...",
          "monthlyWebhook": "https://..."
        },
        // ... 25 more lots
      ]
    }
  }
}
```

### Option 2: Interactive HTML Tester

Use the testing tool at `/home/ubuntu/mottainai-admin-dashboard/mobile-app-test-api.html`:

1. Open the file in a web browser
2. Click "Test Lot API"
3. View all 26 lots with search functionality
4. Verify data structure matches mobile app needs

### Option 3: Mobile App Integration (Full Test)

The `LotService` class is ready at `/home/ubuntu/mottainai_survey_app/lib/services/lot_service.dart`.

**To integrate:**

1. **Import the service** in your pickup form:
   ```dart
   import 'package:mottainai_survey_app/services/lot_service.dart';
   ```

2. **Fetch lots on screen load**:
   ```dart
   List<OperationalLot> lots = [];
   bool isLoading = true;
   
   @override
   void initState() {
     super.initState();
     _loadLots();
   }
   
   Future<void> _loadLots() async {
     setState(() => isLoading = true);
     try {
       final fetchedLots = await LotService.fetchLots();
       setState(() {
         lots = fetchedLots;
         isLoading = false;
       });
     } catch (e) {
       print('Error loading lots: $e');
       setState(() => isLoading = false);
     }
   }
   ```

3. **Display in dropdown**:
   ```dart
   DropdownButton<String>(
     items: lots.map((lot) {
       return DropdownMenuItem(
         value: lot.lotId,
         child: Text('${lot.lotId} - ${lot.lotName} (${lot.ward})'),
       );
     }).toList(),
     onChanged: (value) {
       // Handle lot selection
     },
   )
   ```

## API Features

### Caching
- **Duration**: 24 hours
- **Storage**: SharedPreferences
- **Offline Support**: Uses cached data when network unavailable

### Data Structure
Each lot includes:
- `lotId`: Unique identifier (e.g., "LOT001")
- `lotName`: Display name (e.g., "Lot 1")
- `ward`: Ward name
- `lga`: Local Government Area
- `company`: Assigned company name
- `paytWebhook`: PAYT webhook URL
- `monthlyWebhook`: Monthly webhook URL

## Testing Checklist

- [ ] API returns 200 status code
- [ ] Response contains 26 lots
- [ ] All lots have required fields (lotId, lotName, ward, lga, company)
- [ ] Webhook URLs are properly formatted
- [ ] Caching works (second request loads from cache)
- [ ] Offline mode uses cached data
- [ ] Lot selection updates form correctly
- [ ] Search/filter functionality works

## Troubleshooting

### API Returns Empty
- Check network connectivity
- Verify URL is correct: `https://admin.kowope.xyz/api/trpc/lots.list`
- Check backend logs on production server

### Caching Not Working
- Clear app data and test again
- Check SharedPreferences permissions
- Verify cache key: `operational_lots_cache`

### Lots Not Displaying
- Check JSON parsing in `OperationalLot.fromJson()`
- Verify data structure matches API response
- Add debug prints to see raw API response

## Next Steps

1. **Test the API directly** using curl or the HTML tester
2. **Integrate into mobile app** following the code samples above
3. **Build and test APK** with real lot data
4. **Verify end-to-end** that lot selection works in production

## Support Files

- **Integration Guide**: `MOBILE_APP_INTEGRATION.md`
- **LotService Code**: `/home/ubuntu/mottainai_survey_app/lib/services/lot_service.dart`
- **API Tester**: `mobile-app-test-api.html`
- **Automation Guide**: `AUTOMATION_GUIDE.md`

## Current APK

The existing APK (v2.2.0) does NOT include lot API integration. To test the new functionality, you'll need to:

1. Integrate the LotService code
2. Update the pickup form
3. Build a new APK with `flutter build apk --release`

---

**API Status**: ✅ Live and working  
**Last Updated**: November 19, 2025  
**Lot Count**: 26 operational lots
