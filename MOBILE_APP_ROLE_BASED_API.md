# Mobile App Integration - Role-Based Lot Filtering API

## 🎯 Overview

The new role-based lot filtering API ensures that:
- **Regular users** can ONLY see lots from their assigned company
- **Cherry pickers** can see ALL lots from all companies
- **Admins** can see ALL lots from all companies

This prevents users from accessing other companies' data and enables the cherry picker feature.

---

## ✅ API Endpoint

**Base URL:** `https://admin.kowope.xyz/api/trpc/lots.list`

**Method:** GET

**Query Parameters:**
- `batch=1` (required for tRPC batch format)
- `input` (URL-encoded JSON with userId)

**Input Format:**
```json
{
  "0": {
    "json": {
      "userId": "USER_ID_FROM_DATABASE"
    }
  }
}
```

**Example Request:**
```
GET https://admin.kowope.xyz/api/trpc/lots.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22userId%22%3A%226622b0d1f9f81b0481c7e99f%22%7D%7D%7D
```

---

## 📊 Response Format

### Regular User Response (1 lot from their company)
```json
[
  {
    "result": {
      "data": {
        "json": {
          "lots": [
            {
              "id": "69185eebf21dfa8ce0f9a7aa_LOT-6",
              "lotCode": "LOT-6",
              "lotName": "G R A (Ikeja)",
              "paytWebhook": "https://upwork.kowope.xyz/survey/SPL_placeholder/SPL_placeholder",
              "monthlyWebhook": "https://upwork.kowope.xyz/survey/monthly/SPL_placeholder/SPL_placeholder",
              "companyId": "69185eebf21dfa8ce0f9a7aa",
              "companyName": "URBAN SPIRIT"
            }
          ],
          "totalCount": 1,
          "userRole": "user",
          "userCompanyId": "69185eebf21dfa8ce0f9a7aa",
          "message": "Showing 1 lots from your company"
        }
      }
    }
  }
]
```

### Admin/Cherry Picker Response (19 lots from all companies)
```json
[
  {
    "result": {
      "data": {
        "json": {
          "lots": [
            {
              "id": "69185eebf21dfa8ce0f9a7aa_LOT-6",
              "lotCode": "LOT-6",
              "lotName": "G R A (Ikeja)",
              "companyId": "69185eebf21dfa8ce0f9a7aa",
              "companyName": "URBAN SPIRIT",
              ...
            },
            {
              "id": "66212f85df2188147c7a81d8_WAS-061",
              "lotCode": "WAS-061",
              "lotName": "Wasimi",
              "companyId": "66212f85df2188147c7a81d8",
              "companyName": "ANOTHER COMPANY",
              ...
            },
            ... (17 more lots)
          ],
          "totalCount": 19,
          "userRole": "admin",
          "message": "Showing all 19 operational lots"
        }
      }
    }
  }
]
```

---

## 📱 Flutter/Dart Implementation

### 1. Lot Model Class

```dart
class Lot {
  final String id;
  final String lotCode;
  final String lotName;
  final String paytWebhook;
  final String monthlyWebhook;
  final String companyId;
  final String companyName;

  Lot({
    required this.id,
    required this.lotCode,
    required this.lotName,
    required this.paytWebhook,
    required this.monthlyWebhook,
    required this.companyId,
    required this.companyName,
  });

  factory Lot.fromJson(Map<String, dynamic> json) {
    return Lot(
      id: json['id'] ?? '',
      lotCode: json['lotCode'] ?? '',
      lotName: json['lotName'] ?? '',
      paytWebhook: json['paytWebhook'] ?? '',
      monthlyWebhook: json['monthlyWebhook'] ?? '',
      companyId: json['companyId'] ?? '',
      companyName: json['companyName'] ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'lotCode': lotCode,
      'lotName': lotName,
      'paytWebhook': paytWebhook,
      'monthlyWebhook': monthlyWebhook,
      'companyId': companyId,
      'companyName': companyName,
    };
  }
}
```

### 2. Lot Service with Role-Based Filtering

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class LotService {
  static const String baseUrl = 'https://admin.kowope.xyz/api/trpc/lots.list';
  static const String cacheKey = 'cached_lots';
  static const String cacheTimestampKey = 'lots_cache_timestamp';
  static const Duration cacheExpiry = Duration(hours: 24);

  /// Fetch lots for the current user with role-based filtering
  /// 
  /// Parameters:
  /// - userId: MongoDB ObjectId of the logged-in user
  /// 
  /// Returns:
  /// - List of lots based on user's role and company assignment
  /// - Regular users get only their company's lots
  /// - Cherry pickers and admins get all lots
  static Future<List<Lot>> fetchLots(String userId) async {
    try {
      // Check cache first
      final cachedLots = await _getCachedLots(userId);
      if (cachedLots != null) {
        print('[LotService] Returning ${cachedLots.length} lots from cache');
        return cachedLots;
      }

      // Build tRPC batch input
      final inputData = {
        '0': {
          'json': {
            'userId': userId,
          }
        }
      };

      // URL encode the input
      final encodedInput = Uri.encodeComponent(json.encode(inputData));
      final url = '$baseUrl?batch=1&input=$encodedInput';

      print('[LotService] Fetching lots for user: $userId');
      
      final response = await http.get(
        Uri.parse(url),
        headers: {
          'Content-Type': 'application/json',
        },
      ).timeout(Duration(seconds: 30));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        
        // Parse tRPC batch response
        final result = data[0]['result']['data']['json'];
        final lotsJson = result['lots'] as List;
        final userRole = result['userRole'] as String;
        final totalCount = result['totalCount'] as int;
        final message = result['message'] as String;

        print('[LotService] Success: $message');
        print('[LotService] User role: $userRole');
        print('[LotService] Total lots: $totalCount');

        final lots = lotsJson.map((lot) => Lot.fromJson(lot)).toList();

        // Cache the results
        await _cacheLots(userId, lots);

        return lots;
      } else {
        throw Exception('Failed to load lots: ${response.statusCode} - ${response.body}');
      }
    } catch (e) {
      print('[LotService] Error fetching lots: $e');
      
      // Try to return cached data even if expired
      final cachedLots = await _getCachedLots(userId, ignoreExpiry: true);
      if (cachedLots != null) {
        print('[LotService] Returning expired cache due to error');
        return cachedLots;
      }
      
      rethrow;
    }
  }

  /// Validate if user can access a specific lot
  /// Call this before submitting a pickup to prevent abuse
  static Future<bool> validateLotAccess(String userId, String lotCode, String companyId) async {
    try {
      final inputData = {
        '0': {
          'json': {
            'userId': userId,
            'lotCode': lotCode,
            'companyId': companyId,
          }
        }
      };

      final encodedInput = Uri.encodeComponent(json.encode(inputData));
      final url = 'https://admin.kowope.xyz/api/trpc/lots.validateAccess?batch=1&input=$encodedInput';

      final response = await http.get(Uri.parse(url)).timeout(Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        final result = data[0]['result']['data']['json'];
        final hasAccess = result['hasAccess'] as bool;
        final reason = result['reason'] as String;

        print('[LotService] Access validation: $hasAccess - $reason');
        return hasAccess;
      }

      return false;
    } catch (e) {
      print('[LotService] Error validating lot access: $e');
      return false;
    }
  }

  /// Cache lots to local storage
  static Future<void> _cacheLots(String userId, List<Lot> lots) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cacheData = {
        'userId': userId,
        'lots': lots.map((lot) => lot.toJson()).toList(),
      };
      await prefs.setString(cacheKey, json.encode(cacheData));
      await prefs.setInt(cacheTimestampKey, DateTime.now().millisecondsSinceEpoch);
      print('[LotService] Cached ${lots.length} lots for user $userId');
    } catch (e) {
      print('[LotService] Error caching lots: $e');
    }
  }

  /// Get cached lots if available and not expired
  static Future<List<Lot>?> _getCachedLots(String userId, {bool ignoreExpiry = false}) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cachedJson = prefs.getString(cacheKey);
      final timestamp = prefs.getInt(cacheTimestampKey);

      if (cachedJson == null || timestamp == null) {
        return null;
      }

      // Check expiry
      if (!ignoreExpiry) {
        final cacheAge = DateTime.now().millisecondsSinceEpoch - timestamp;
        if (cacheAge > cacheExpiry.inMilliseconds) {
          print('[LotService] Cache expired (${cacheAge ~/ 1000 ~/ 60} minutes old)');
          return null;
        }
      }

      final cacheData = json.decode(cachedJson);
      
      // Verify cache is for the current user
      if (cacheData['userId'] != userId) {
        print('[LotService] Cache is for different user, ignoring');
        return null;
      }

      final lotsJson = cacheData['lots'] as List;
      final lots = lotsJson.map((lot) => Lot.fromJson(lot)).toList();

      return lots;
    } catch (e) {
      print('[LotService] Error reading cache: $e');
      return null;
    }
  }

  /// Clear cached lots (call on logout or role change)
  static Future<void> clearCache() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(cacheKey);
      await prefs.remove(cacheTimestampKey);
      print('[LotService] Cache cleared');
    } catch (e) {
      print('[LotService] Error clearing cache: $e');
    }
  }
}
```

### 3. Usage in Pickup Form

```dart
class PickupFormPage extends StatefulWidget {
  final String userId; // Get from authentication/session

  const PickupFormPage({required this.userId});

  @override
  _PickupFormPageState createState() => _PickupFormPageState();
}

class _PickupFormPageState extends State<PickupFormPage> {
  List<Lot> availableLots = [];
  Lot? selectedLot;
  bool isLoading = true;
  String? errorMessage;

  @override
  void initState() {
    super.initState();
    _loadLots();
  }

  Future<void> _loadLots() async {
    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      final lots = await LotService.fetchLots(widget.userId);
      
      if (lots.isEmpty) {
        setState(() {
          errorMessage = 'No operational lots available for your account. Please contact your administrator.';
        });
      } else {
        setState(() {
          availableLots = lots;
        });
      }
    } catch (e) {
      setState(() {
        errorMessage = 'Failed to load lots: $e';
      });
    } finally {
      setState(() {
        isLoading = false;
      });
    }
  }

  Future<void> _submitPickup() async {
    if (selectedLot == null) {
      // Show error
      return;
    }

    // Validate lot access before submission
    final hasAccess = await LotService.validateLotAccess(
      widget.userId,
      selectedLot!.lotCode,
      selectedLot!.companyId,
    );

    if (!hasAccess) {
      // Show error: "You don't have permission to access this lot"
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Access denied: You cannot submit pickups for this lot')),
      );
      return;
    }

    // Proceed with pickup submission...
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('New Pickup')),
      body: isLoading
          ? Center(child: CircularProgressIndicator())
          : errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.error_outline, size: 64, color: Colors.red),
                      SizedBox(height: 16),
                      Text(errorMessage!, textAlign: TextAlign.center),
                      SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadLots,
                        child: Text('Retry'),
                      ),
                    ],
                  ),
                )
              : Column(
                  children: [
                    // Lot selector dropdown
                    DropdownButton<Lot>(
                      value: selectedLot,
                      hint: Text('Select Operational Lot'),
                      items: availableLots.map((lot) {
                        return DropdownMenuItem<Lot>(
                          value: lot,
                          child: Text('${lot.lotCode} - ${lot.lotName} (${lot.companyName})'),
                        );
                      }).toList(),
                      onChanged: (lot) {
                        setState(() {
                          selectedLot = lot;
                        });
                      },
                    ),
                    // Rest of the form...
                  ],
                ),
    );
  }
}
```

---

## 🔐 Security Features

1. **Role-Based Access Control**: API automatically filters lots based on user role
2. **Company Isolation**: Regular users can ONLY see their company's lots
3. **Access Validation**: `validateLotAccess` endpoint prevents unauthorized submissions
4. **Server-Side Enforcement**: Filtering happens on the backend, not client-side

---

## 🧪 Testing

### Test Regular User
```bash
# User: adey adewuyi (ID: 6622b0d1f9f81b0481c7e99f)
# Expected: 1 lot from URBAN SPIRIT

curl 'https://admin.kowope.xyz/api/trpc/lots.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22userId%22%3A%226622b0d1f9f81b0481c7e99f%22%7D%7D%7D'
```

### Test Admin User
```bash
# User: Admin (ID: 66212f85df2188147c7a81d7)
# Expected: 19 lots from all companies

curl 'https://admin.kowope.xyz/api/trpc/lots.list?batch=1&input=%7B%220%22%3A%7B%22json%22%3A%7B%22userId%22%3A%2266212f85df2188147c7a81d7%22%7D%7D%7D'
```

---

## 📝 Migration Checklist

- [ ] Replace hardcoded lot lists with `LotService.fetchLots(userId)`
- [ ] Update Lot model to use new field names (lotCode, lotName, companyId, companyName)
- [ ] Add `validateLotAccess` check before pickup submission
- [ ] Update UI to show company name with lot selection
- [ ] Add error handling for "No lots available" scenario
- [ ] Clear cache on logout: `LotService.clearCache()`
- [ ] Test with regular user account (should see limited lots)
- [ ] Test with admin/cherry_picker account (should see all lots)
- [ ] Build and deploy new APK version

---

## 🚀 Next Steps

1. Update mobile app code with the new LotService
2. Test with both regular users and cherry pickers
3. Build new APK (v2.9.2 or v3.0.0)
4. Deploy to users
5. Monitor for "No operational lots available" errors

---

## ❓ Troubleshooting

**Problem**: "No operational lots available"
- **Cause**: User has no company assigned or company has no lots
- **Solution**: Assign user to a company in admin dashboard

**Problem**: "Failed to load lots: 400"
- **Cause**: Invalid userId format
- **Solution**: Ensure userId is a valid MongoDB ObjectId

**Problem**: Lots not updating after company changes
- **Cause**: Cache is stale
- **Solution**: Call `LotService.clearCache()` or wait 24 hours

---

## 📞 Support

For issues or questions, contact the backend team or check the admin dashboard at https://admin.kowope.xyz
