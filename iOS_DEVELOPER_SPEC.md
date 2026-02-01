# iOS App — Service Booking Client Implementation Specification

## 📋 Overview

Implement an iOS app client for the ServiceBooking system that allows users to:
- Register their device and receive an API token
- Browse available car wash services
- View available time slots for each post
- Book services
- View their bookings

---

## 🔑 API Endpoints

**Base URL:** `https://example.com/api/v1` (user configurable from QR scan or manual entry)

### 1. Device Registration
**POST** `/clients/register`

Register device on first launch to get `client_id` and `api_key`.

**Request:**
```json
{
  "device_id": "UUID-string-here",
  "platform": "iOS 17.0",
  "app_version": "1.0.0"
}
```

**Response:**
```json
{
  "client_id": "usr_1234567890",
  "api_key": "abc123def456..."
}
```

**Implementation Notes:**
- Generate `device_id` on first launch using `UUID()` → store in Keychain
- Store returned `api_key` in Keychain securely (never in UserDefaults)
- Store `client_id` for future requests
- If QR scan happens: extract base_url + device_id from QR payload, then call this endpoint

---

### 2. Get Services List
**GET** `/services`

**Response:**
```json
[
  {
    "_id": "svc_1",
    "name": "Премиальная чистка салона",
    "description": "Глубокая чистка и санитизация салона автомобиля.",
    "price": 4500,
    "duration": 60,
    "category": "Чистка",
    "image_url": null,
    "is_active": true
  },
  ...
]
```

**Implementation:**
- Display as list/collection with service name, price, duration
- Show only active services (`is_active: true`)
- On tap → go to booking flow for that service

---

### 3. Get Available Slots for Service
**GET** `/slots?service_id={serviceId}&date={YYYY-MM-DD}&post_id=post_1`

Returns available time slots for a specific service on a specific date and post.

**Response:**
```json
[
  {
    "time": "2026-02-01T09:00:00.000Z",
    "is_available": true
  },
  {
    "time": "2026-02-01T09:30:00.000Z",
    "is_available": false
  },
  ...
]
```

**Implementation:**
- Parse ISO 8601 timestamps
- Filter to show only `is_available: true` slots
- Display in user's local timezone
- Format time as HH:MM (e.g., "09:00", "09:30")
- Let user pick a date (calendar picker or date selector)
- Default `post_id=post_1` (can be made selectable in future)
- Dynamically load slots as user changes date/post

---

### 4. Get Posts (Car Wash Bays)
**GET** `/posts`

**Response:**
```json
[
  {
    "_id": "post_1",
    "name": "Пост 1",
    "is_enabled": true,
    "use_custom_hours": false,
    "start_time": "09:00",
    "end_time": "18:00",
    "interval_minutes": 30
  },
  ...
]
```

**Implementation:**
- Use to display available posts in UI
- Show only `is_enabled: true` posts
- Let user select which post (optional for MVP, default to post_1)

---

### 5. Create Booking
**POST** `/bookings`

Create a booking for the authenticated user.

**Request:**
```json
{
  "service_id": "svc_1",
  "date_time": "2026-02-01T09:30:00.000Z",
  "post_id": "post_1",
  "notes": "Optional notes from user"
}
```

**Response:**
```json
{
  "_id": "bkg_1234567890",
  "service_id": "svc_1",
  "service_name": "Премиальная чистка салона",
  "user_id": "usr_1234567890",
  "user_name": "Device Owner",
  "post_id": "post_1",
  "date_time": "2026-02-01T09:30:00.000Z",
  "status": "pending",
  "price": 4500,
  "duration": 60,
  "notes": null,
  "created_at": "2026-01-31T12:00:00Z"
}
```

**Implementation:**
- Send ISO 8601 formatted date_time (from user's selected slot)
- Include post_id from selection (default: post_1)
- Show confirmation screen after successful booking
- Display booking details: service name, time, price, duration

---

## 🎨 UI Flow

### 1. **Launch Screen / QR Scanner**
```
┌─────────────────────┐
│  ServiceBooking     │
│                     │
│  [Scan QR Code]     │  ← Camera/QR scanner
│  OR                 │
│  [Enter URL Manually]
│                     │
│  URL: [_________]   │
│  [Connect]          │
└─────────────────────┘
```

**QR Payload Example:**
```json
{
  "base_url": "https://example.com/api/v1",
  "token": "dev_1234567890_abcdef123456"
}
```

After QR scan:
- Extract `base_url` and `device_id` from QR
- Call `POST /clients/register` with device info
- Store returned `api_key` in Keychain
- Proceed to Services List

---

### 2. **Services List**
```
┌─────────────────────┐
│ Доступные услуги    │
├─────────────────────┤
│ □ Премиальная чистка │
│   Чистка • 60 мин   │
│   4500 ₽            │
├─────────────────────┤
│ □ Экспресс мойка    │
│   Мойка • 30 мин    │
│   1500 ₽            │
├─────────────────────┤
│ □ Полировка лака    │
│   Полировка • 45 мин│
│   2500 ₽            │
└─────────────────────┘
```

On tap → go to Date & Time Picker

---

### 3. **Date & Time Picker**
```
┌─────────────────────────────┐
│ Премиальная чистка (4500 ₽) │
│ Длительность: 60 мин        │
├─────────────────────────────┤
│ Выберите дату:              │
│ [Jan 31 ▼] (calendar)       │
│                             │
│ Выберите время:             │
│ 09:00  09:30  10:00         │
│ 10:30  11:00  11:30         │
│ 12:00  12:30  ✗ 01:00       │
│ (grey = unavailable)        │
│                             │
│ Пост: [Пост 1 ▼]            │
│                             │
│ Примечание:                 │
│ [________________]          │
│                             │
│ [Забронировать]             │
└─────────────────────────────┘
```

---

### 4. **Confirmation Screen**
```
┌─────────────────────────────┐
│ ✓ Бронирование создано      │
├─────────────────────────────┤
│ Услуга:                     │
│ Премиальная чистка          │
│                             │
│ Дата и время:               │
│ 01.02.2026, 09:30           │
│                             │
│ Пост: Пост 1                │
│                             │
│ Стоимость: 4500 ₽           │
│ Статус: Ожидает подтверждения
│                             │
│ [← Назад] [Мои брони]       │
└─────────────────────────────┘
```

---

### 5. **My Bookings / History** (Optional MVP+)
```
┌──────────────────────────────┐
│ Мои бронирования             │
├──────────────────────────────┤
│ ✓ Премиальная чистка         │
│ 01.02.2026, 09:30            │
│ Статус: Подтверждена         │
│ 4500 ₽                       │
├──────────────────────────────┤
│ ⏳ Экспресс мойка            │
│ 03.02.2026, 14:00            │
│ Статус: Ожидает подтверждения│
│ 1500 ₽                       │
└──────────────────────────────┘
```

---

## 🔐 Authentication & Headers

**All requests (except /clients/register)** should include:

```
Authorization: Bearer {api_key}
Content-Type: application/json
```

Where `{api_key}` is the value returned from `/clients/register` response, stored securely in Keychain.

**Example:**
```swift
var request = URLRequest(url: url)
request.setValue("Bearer abc123def456...", forHTTPHeaderField: "Authorization")
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
```

---

## 📱 Implementation Checklist

### Phase 1: Core Setup
- [ ] Create URL session configuration with custom headers
- [ ] Implement Keychain storage for `device_id`, `api_key`, `client_id`
- [ ] Create API client layer with error handling
- [ ] Implement QR scanner (using AVFoundation or third-party lib)
- [ ] Parse QR payload JSON

### Phase 2: Device Registration & Initial Setup
- [ ] Generate/retrieve `device_id` from Keychain
- [ ] Implement device registration flow
- [ ] Store `api_key` securely after registration
- [ ] Error handling for registration failures

### Phase 3: Services & Browsing
- [ ] Fetch and display services list
- [ ] Show service details (price, duration, category)
- [ ] Navigate to booking flow on service selection
- [ ] Date picker (native or calendar library)

### Phase 4: Slots & Availability
- [ ] Fetch available slots for selected date/service
- [ ] Parse ISO 8601 timestamps, convert to local timezone
- [ ] Display time slots in grid/list format
- [ ] Disable unavailable slots UI
- [ ] Handle loading states and errors

### Phase 5: Booking & Confirmation
- [ ] Create booking request with user selections
- [ ] Show confirmation screen with booking details
- [ ] Display booking status (pending/confirmed/etc.)
- [ ] Navigate to services list after confirmation

### Phase 6: Enhancements
- [ ] My Bookings / History screen
- [ ] Edit booking (optional, needs backend support)
- [ ] Cancel booking
- [ ] Post selection UI (if supporting multiple posts)
- [ ] Settings screen (change API URL, logout)

---

## ⚠️ Error Handling

Handle these HTTP responses gracefully:

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process response |
| 400 | Bad request (validation) | Show user-friendly error message |
| 404 | Not found (service/slot) | Show "Not available" message |
| 409 | Conflict (post disabled) | Show "This post is currently unavailable" |
| 500 | Server error | Show "Server error, please try again later" |
| Network error | No connection | Show "No internet connection" |

---

## 🎯 Key Notes for iOS Developer

1. **Timestamp Format:** All dates are ISO 8601 (`2026-02-01T09:30:00.000Z`). Convert to user's local timezone for display.

2. **Posts:** Currently system supports 4 posts. Default to `post_1` for MVP. In future, allow post selection.

3. **Slots Generation:** Slots are generated dynamically based on:
   - Post working hours (09:00-18:00 default, or custom per post)
   - Interval minutes (30/60/90/120)
   - Existing bookings (unavailable if overlapping)
   - Admin-closed slots (explicitly marked as unavailable)

4. **Status Meanings:**
   - `pending` = Awaiting confirmation
   - `confirmed` = Admin confirmed
   - `in_progress` = Service in progress
   - `completed` = Service finished
   - `cancelled` = User/admin cancelled

5. **No User Registration:** Client registers via device UUID, not username/password. System automatically creates user profile on first registration.

6. **Offline Support (Optional):** Consider local caching of services list and available slots for better UX.

7. **Cars / Avatars:** Папки с фото для аватара профиля. По умолчанию фото «01» — фото профиля.

---

### 6. Cars / Avatars (фото профиля)

**GET** `/cars/folders` — список папок (без авторизации для iOS).

**GET** `/cars/folders/name/:name` — папка по имени.

**GET** `/cars/folders/:id` — папка по ID.

**Ответ (папка):**
```json
{
  "_id": "car_xxx",
  "name": "Седан",
  "default_photo_name": "01",
  "images": [
    {
      "name": "01.jpg",
      "url": "data:image/jpeg;base64,...",
      "thumbnail_url": "data:image/jpeg;base64,..."
    },
    {
      "name": "02.jpg",
      "url": "data:image/jpeg;base64,...",
      "thumbnail_url": "data:image/jpeg;base64,..."
    }
  ]
}
```

- **thumbnail_url** — миниатюра для отображения в списке (обязательно использовать для быстрой загрузки).
- **Фото «01»** (01.jpg, 01.png) — фото профиля по умолчанию. При выборе папки показывать это фото как аватар.
- При выборе папки отображать все изображения; использовать `thumbnail_url` для миниатюр.

---

## 🧪 Testing Endpoints

Use Postman/curl to test before iOS implementation:

```bash
# 1. Register device
curl -X POST https://example.com/api/v1/clients/register \
  -H "Content-Type: application/json" \
  -d '{"device_id":"test-uuid-123","platform":"iOS 17.0","app_version":"1.0.0"}'

# Response: {"client_id":"usr_...", "api_key":"abc..."}

# 2. Get services
curl https://example.com/api/v1/services \
  -H "Authorization: Bearer abc..."

# 3. Get slots
curl 'https://example.com/api/v1/slots?service_id=svc_1&date=2026-02-01&post_id=post_1' \
  -H "Authorization: Bearer abc..."

# 4. Create booking
curl -X POST https://example.com/api/v1/bookings \
  -H "Authorization: Bearer abc..." \
  -H "Content-Type: application/json" \
  -d '{"service_id":"svc_1","date_time":"2026-02-01T09:30:00Z","post_id":"post_1"}'
```

---

## 📞 Support & Questions

- Backend API base URL is configurable per deployment
- All timestamps are UTC; convert to local timezone on client
- Device registration is one-time per device
- API key must be kept secure (Keychain always)
- Contact backend team for API changes or new endpoints

**Good luck! 🚀**
