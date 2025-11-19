# Mobile App Integration Guide

## 🎯 Objective

Update the mobile app to fetch the 26 active operational lots from the new API endpoint instead of using hardcoded lot lists.

---

## ✅ API Endpoint Ready

**Base URL:** `https://admin.kowope.xyz/api/trpc/lots.list`

**Method:** GET

**Response Format:**
```json
{
  "result": {
    "data": {
      "json": [
        {
          "OBJECTID": 1,
          "lga_code": 31010,
          "ward_name": "Foko/Ologede ",
          "ward_code": "OYSISW05",
          "Lot_ID": 27,
          "socio_economic_groups": "Low",
          "lga_name": "Ibadan South West",
          "state_code": "OY",
          "state_name": "Oyo",
          "Business_Name": "Mottainai Recycling"
        },
        ...
      ]
    }
  }
}
```

---

## 📱 Mobile App Changes

### 1. Remove Hardcoded Lot Lists

**Before:**
```dart
// Hardcoded lot list
final List<int> availableLots = [27, 61, 76, 80, 87, 99, 107, 108, ...];
```

**After:**
```dart
// Fetch from API
Future<List<Lot>> fetchLots() async {
  final response = await http.get(
    Uri.parse('https://admin.kowope.xyz/api/trpc/lots.list'),
  );
  
  if (response.statusCode == 200) {
    final data = json.decode(response.body);
    final lots = data['result']['data']['json'] as List;
    return lots.map((lot) => Lot.fromJson(lot)).toList();
  } else {
    throw Exception('Failed to load lots');
  }
}
```

### 2. Create Lot Model

```dart
class Lot {
  final int objectId;
  final int lotId;
  final String wardName;
  final String wardCode;
  final String lgaName;
  final String businessName;
  final String socioEconomicGroup;
  final String stateName;
  final String stateCode;

  Lot({
    required this.objectId,
    required this.lotId,
    required this.wardName,
    required this.wardCode,
    required this.lgaName,
    required this.businessName,
    required this.socioEconomicGroup,
    required this.stateName,
    required this.stateCode,
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
      stateName: json['state_name'] ?? '',
      stateCode: json['state_code'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'OBJECTID': objectId,
      'Lot_ID': lotId,
      'ward_name': wardName,
      'ward_code': wardCode,
      'lga_name': lgaName,
      'Business_Name': businessName,
      'socio_economic_groups': socioEconomicGroup,
      'state_name': stateName,
      'state_code': stateCode,
    };
  }
}
```

### 3. Update UI Components

**Lot Dropdown/Picker:**
```dart
class LotPicker extends StatefulWidget {
  @override
  _LotPickerState createState() => _LotPickerState();
}

class _LotPickerState extends State<LotPicker> {
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
      final lots = await fetchLots();
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
          child: Text('Lot ${lot.lotId} - ${lot.wardName} (${lot.businessName})'),
        );
      }).toList(),
      onChanged: (value) {
        // Handle selection
      },
    );
  }
}
```

### 4. Add Caching (Optional but Recommended)

```dart
class LotService {
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

    // Fetch fresh data
    final lots = await fetchLots();
    _cachedLots = lots;
    _cacheTime = DateTime.now();
    return lots;
  }

  static void clearCache() {
    _cachedLots = null;
    _cacheTime = null;
  }
}
```

### 5. Error Handling

```dart
Future<List<Lot>> fetchLots() async {
  try {
    final response = await http.get(
      Uri.parse('https://admin.kowope.xyz/api/trpc/lots.list'),
    ).timeout(Duration(seconds: 10));
    
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      final lots = data['result']['data']['json'] as List;
      return lots.map((lot) => Lot.fromJson(lot)).toList();
    } else {
      throw Exception('Server returned ${response.statusCode}');
    }
  } on TimeoutException {
    throw Exception('Request timed out');
  } on SocketException {
    throw Exception('No internet connection');
  } catch (e) {
    throw Exception('Failed to load lots: $e');
  }
}
```

---

## 🧪 Testing

### 1. Test API Endpoint

```bash
curl https://admin.kowope.xyz/api/trpc/lots.list
```

Expected: JSON response with 26 lots

### 2. Test in Mobile App

1. **Fresh Install:** Uninstall and reinstall app to ensure no cached data
2. **Network Test:** Test with good and poor network conditions
3. **Offline Test:** Verify graceful handling when offline
4. **Data Validation:** Verify all 26 lots appear in dropdown
5. **Selection Test:** Verify lot selection works correctly

### 3. Verify Lot IDs

Current 26 active lots (from Excel):
- Lot 27, 61, 76, 80, 87, 99, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126

---

## 📊 Benefits

1. **Single Source of Truth:** Lot data managed centrally in Excel → API → Mobile App
2. **Easy Updates:** Update Excel file, redeploy backend, mobile app automatically gets new data
3. **Consistency:** Admin dashboard and mobile app show same lot data
4. **Scalability:** Can add more lots without mobile app updates

---

## 🔄 Update Process (Future)

When lots change:

1. Update `Lot_Layer_V4-1.xlsx` file
2. Redeploy backend: `pm2 restart mottainai-dashboard`
3. Mobile app automatically fetches new data (no update needed!)
4. Optional: Force refresh in app settings to clear cache

---

## 📝 API Response Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `OBJECTID` | int | Unique object identifier | 1 |
| `Lot_ID` | int | Lot number | 27 |
| `ward_name` | string | Ward name | "Foko/Ologede" |
| `ward_code` | string | Ward code | "OYSISW05" |
| `lga_name` | string | Local Government Area | "Ibadan South West" |
| `lga_code` | int | LGA code | 31010 |
| `Business_Name` | string | Operating company | "Mottainai Recycling" |
| `socio_economic_groups` | string | Socio-economic level | "Low", "Medium", "High" |
| `state_name` | string | State name | "Oyo" |
| `state_code` | string | State code | "OY" |

---

## 🚀 Deployment Checklist

- [ ] Update mobile app code to fetch from API
- [ ] Add Lot model class
- [ ] Implement caching mechanism
- [ ] Add error handling
- [ ] Test with production API
- [ ] Verify all 26 lots appear
- [ ] Test offline behavior
- [ ] Update app version number
- [ ] Deploy to app stores
- [ ] Monitor API usage

---

## 🔗 Related Documentation

- [Production Deployment Guide](./PRODUCTION_DEPLOYMENT_GUIDE.md)
- [Lot Integration Status](./LOT_INTEGRATION_STATUS.md)
- [API Documentation](./API_DOCUMENTATION.md)

---

## 💡 Tips

1. **Cache Duration:** 24 hours is recommended, but adjust based on how often lots change
2. **Loading States:** Show skeleton loaders while fetching lots for better UX
3. **Retry Logic:** Implement exponential backoff for failed requests
4. **Analytics:** Track API call success/failure rates
5. **Fallback:** Consider keeping a minimal hardcoded list as fallback if API fails

---

## 🆘 Troubleshooting

### Issue: "Failed to load lots"

**Possible causes:**
1. No internet connection → Show offline message
2. API server down → Check https://admin.kowope.xyz/api/trpc/lots.list in browser
3. Timeout → Increase timeout duration or check network speed
4. JSON parsing error → Verify API response format hasn't changed

### Issue: "Lot dropdown is empty"

**Possible causes:**
1. API returned empty array → Check backend logs
2. JSON parsing failed → Add debug logging to see raw response
3. Filter logic hiding all lots → Review filtering code

### Issue: "Old lots still showing"

**Possible causes:**
1. Cache not cleared → Call `LotService.clearCache()`
2. Using old hardcoded list → Verify API fetch code is being called
3. App not updated → Check app version

---

## 📞 Support

For API issues, check:
- Backend logs: `pm2 logs mottainai-dashboard`
- Nginx logs: `/var/log/nginx/error.log`
- API endpoint: https://admin.kowope.xyz/api/trpc/lots.list

For mobile app issues:
- Check network connectivity
- Verify API URL is correct
- Review app logs for errors
