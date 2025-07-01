# Technical Specifications - Photo Timekeeping Mobile App

## Overview

This document provides detailed technical specifications for the Photo Timekeeping Mobile App backend infrastructure and API design, building upon the existing Expo/React Native frontend applications.

---

## Database Schema Design

### Multi-Tenant Architecture

#### Organizations Collection
```javascript
{
  _id: ObjectId,
  name: String,
  slug: String, // unique identifier
  plan: String, // basic, pro, enterprise
  settings: {
    timezone: String,
    workWeekStart: String, // monday, sunday
    overtimeRules: {
      dailyThreshold: Number, // hours before daily OT
      weeklyThreshold: Number, // hours before weekly OT
      dailyDoubleThreshold: Number, // hours before double time
      overtimeRate: Number, // 1.5
      doubleTimeRate: Number // 2.0
    },
    locationAccuracy: Number, // meters for job site detection
    photoRequirements: {
      clockIn: Boolean,
      clockOut: Boolean,
      lunchBreak: Boolean,
      taskChange: Boolean,
      workCycle: Boolean
    }
  },
  subscription: {
    status: String, // active, suspended, cancelled
    planId: String,
    billingEmail: String,
    nextBillingDate: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### Users Collection
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  email: String,
  hashedPassword: String,
  firstName: String,
  lastName: String,
  role: String, // employee, supervisor, admin, client
  employeeId: String, // company employee ID
  supervisorId: ObjectId, // reference to supervisor user
  clientAccess: {
    projects: [ObjectId], // projects this client can view
    permissions: [String] // view_photos, view_reports, etc.
  },
  preferences: {
    notifications: {
      push: Boolean,
      email: Boolean,
      sms: Boolean
    },
    timezone: String,
    language: String
  },
  devices: [{
    deviceId: String,
    platform: String, // ios, android
    pushToken: String,
    lastSeen: Date
  }],
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

#### Projects Collection
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  name: String,
  description: String,
  clientId: ObjectId, // reference to client user
  status: String, // active, completed, paused, cancelled
  startDate: Date,
  estimatedEndDate: Date,
  actualEndDate: Date,
  jobSites: [{
    id: String,
    name: String,
    address: String,
    location: {
      type: "Point",
      coordinates: [Number, Number] // [longitude, latitude]
    },
    geofences: [{
      name: String,
      radius: Number, // meters
      coordinates: [Number, Number]
    }],
    tasks: [{
      id: String,
      name: String,
      description: String,
      estimatedHours: Number,
      actualHours: Number,
      status: String // pending, in_progress, completed
    }]
  }],
  assignedEmployees: [ObjectId],
  budget: {
    estimated: Number,
    actual: Number,
    currency: String
  },
  tags: [String],
  createdAt: Date,
  updatedAt: Date
}
```

#### Timecards Collection
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  userId: ObjectId,
  projectId: ObjectId,
  jobSiteId: String,
  taskId: String,
  type: String, // clock_in, clock_out, lunch_out, lunch_in, break_out, break_in, task_start, task_stop, cycle_start, cycle_stop
  timestamp: Date,
  date: String, // YYYY-MM-DD for easy querying
  location: {
    type: "Point",
    coordinates: [Number, Number],
    accuracy: Number,
    address: String
  },
  photo: {
    id: String,
    s3Key: String,
    url: String,
    thumbnailUrl: String,
    metadata: {
      deviceModel: String,
      osVersion: String,
      appVersion: String,
      cameraFacing: String, // front, back
      fileSize: Number,
      dimensions: {
        width: Number,
        height: Number
      }
    }
  },
  notes: String,
  status: String, // pending, approved, rejected, disputed
  approvedBy: ObjectId,
  approvedAt: Date,
  rejectionReason: String,
  hoursCalculated: Number, // calculated hours for this entry
  overtimeType: String, // regular, overtime, double_time
  syncStatus: String, // synced, pending, error
  createdAt: Date,
  updatedAt: Date
}
```

#### Photos Collection
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  userId: ObjectId,
  projectId: ObjectId,
  timecardId: ObjectId,
  s3Key: String,
  originalUrl: String,
  thumbnailUrl: String,
  mediumUrl: String,
  metadata: {
    fileSize: Number,
    mimeType: String,
    dimensions: {
      width: Number,
      height: Number
    },
    exif: {
      make: String,
      model: String,
      dateTime: Date,
      gps: {
        latitude: Number,
        longitude: Number,
        altitude: Number
      }
    },
    device: {
      platform: String,
      model: String,
      osVersion: String,
      appVersion: String
    }
  },
  tags: [String],
  isVisible: Boolean, // for client app visibility
  processingStatus: String, // pending, completed, failed
  createdAt: Date,
  updatedAt: Date
}
```

#### ProjectLogs Collection
```javascript
{
  _id: ObjectId,
  organizationId: ObjectId,
  projectId: ObjectId,
  userId: ObjectId,
  type: String, // time_entry, photo_update, task_completion, milestone
  title: String,
  description: String,
  timestamp: Date,
  data: {
    timecardId: ObjectId,
    photoIds: [ObjectId],
    taskId: String,
    hoursWorked: Number,
    location: String
  },
  visibility: String, // client, internal, supervisor
  isHighlight: Boolean, // featured update for clients
  createdAt: Date
}
```

---

## API Endpoints Specification

### Authentication Endpoints

#### POST /api/auth/login
```javascript
// Request
{
  email: "user@company.com",
  password: "password123",
  deviceInfo: {
    platform: "ios",
    model: "iPhone 14",
    osVersion: "16.0",
    appVersion: "1.0.0"
  }
}

// Response
{
  success: true,
  data: {
    user: {
      id: "64a1b2c3d4e5f6789",
      email: "user@company.com",
      firstName: "John",
      lastName: "Doe",
      role: "employee",
      organizationId: "64a1b2c3d4e5f6788"
    },
    tokens: {
      accessToken: "jwt_access_token",
      refreshToken: "jwt_refresh_token",
      expiresIn: 3600
    }
  }
}
```

#### POST /api/auth/refresh
```javascript
// Request
{
  refreshToken: "jwt_refresh_token"
}

// Response
{
  success: true,
  data: {
    accessToken: "new_jwt_access_token",
    expiresIn: 3600
  }
}
```

### Timecard Endpoints

#### GET /api/timecards/status
```javascript
// Response
{
  success: true,
  data: {
    clockedIn: true,
    currentProject: {
      id: "64a1b2c3d4e5f6789",
      name: "Downtown Office Building",
      jobSiteId: "js_001",
      taskId: "task_001"
    },
    todayHours: 6.5,
    weekHours: 32.5,
    lastClockTime: "2024-07-01T14:30:00Z",
    overtimeStatus: {
      type: "approaching",
      message: "Approaching overtime (8 hour limit)",
      rate: 1.0
    }
  }
}
```

#### POST /api/timecards/clock-in
```javascript
// Request (multipart/form-data)
{
  projectId: "64a1b2c3d4e5f6789",
  jobSiteId: "js_001",
  taskId: "task_001",
  location: {
    latitude: 37.7749,
    longitude: -122.4194,
    accuracy: 5.0,
    address: "123 Main St, San Francisco, CA"
  },
  photo: File, // image file
  notes: "Starting morning shift"
}

// Response
{
  success: true,
  data: {
    timecardId: "64a1b2c3d4e5f6790",
    timestamp: "2024-07-01T08:00:00Z",
    photoUrl: "https://cdn.example.com/photos/thumb_abc123.jpg",
    status: "clocked_in"
  }
}
```

#### POST /api/timecards/clock-out
```javascript
// Request (multipart/form-data)
{
  location: {
    latitude: 37.7749,
    longitude: -122.4194,
    accuracy: 5.0
  },
  photo: File,
  notes: "End of shift"
}

// Response
{
  success: true,
  data: {
    timecardId: "64a1b2c3d4e5f6791",
    timestamp: "2024-07-01T17:00:00Z",
    hoursWorked: 8.5,
    overtimeHours: 0.5,
    photoUrl: "https://cdn.example.com/photos/thumb_def456.jpg",
    status: "clocked_out"
  }
}
```

#### POST /api/timecards/work-cycle
```javascript
// Request
{
  type: "cycle_start", // or cycle_stop
  projectId: "64a1b2c3d4e5f6789",
  taskId: "task_001",
  location: {...},
  photo: File,
  cycleName: "Foundation Pour Phase 1"
}

// Response
{
  success: true,
  data: {
    timecardId: "64a1b2c3d4e5f6792",
    cycleId: "cycle_001",
    timestamp: "2024-07-01T09:30:00Z",
    status: "cycle_started"
  }
}
```

#### GET /api/timecards/history
```javascript
// Query Parameters
// ?startDate=2024-06-01&endDate=2024-06-30&status=all

// Response
{
  success: true,
  data: {
    timecards: [{
      id: "64a1b2c3d4e5f6790",
      type: "clock_in",
      timestamp: "2024-07-01T08:00:00Z",
      project: {
        name: "Downtown Office Building",
        jobSite: "Main Entrance"
      },
      task: "General Construction",
      hoursWorked: 8.0,
      overtimeHours: 0.0,
      status: "approved",
      photoUrl: "https://cdn.example.com/photos/thumb_abc123.jpg"
    }],
    pagination: {
      page: 1,
      limit: 20,
      total: 45,
      totalPages: 3
    },
    summary: {
      totalHours: 160.5,
      regularHours: 152.0,
      overtimeHours: 8.5,
      doubleTimeHours: 0.0
    }
  }
}
```

### Project & Job Site Endpoints

#### GET /api/projects
```javascript
// Response
{
  success: true,
  data: {
    projects: [{
      id: "64a1b2c3d4e5f6789",
      name: "Downtown Office Building",
      description: "15-story commercial building",
      status: "active",
      startDate: "2024-06-01",
      estimatedEndDate: "2024-12-31",
      progress: {
        overallPercent: 35.5,
        tasksCompleted: 12,
        tasksTotal: 34
      },
      jobSites: [{
        id: "js_001",
        name: "Main Building Site",
        address: "123 Main St, San Francisco, CA",
        location: {
          latitude: 37.7749,
          longitude: -122.4194
        },
        tasks: [{
          id: "task_001",
          name: "Foundation Work",
          status: "in_progress",
          progress: 65.0
        }]
      }]
    }]
  }
}
```

#### GET /api/projects/:projectId/nearby
```javascript
// Query: ?lat=37.7749&lng=-122.4194&radius=500

// Response
{
  success: true,
  data: {
    nearbyJobSites: [{
      id: "js_001",
      name: "Main Building Site",
      distance: 25.7, // meters
      isInRange: true,
      tasks: [...]
    }],
    autoDetected: {
      jobSiteId: "js_001",
      confidence: 0.95
    }
  }
}
```

### Client App Endpoints

#### GET /api/client/projects
```javascript
// Response for client users
{
  success: true,
  data: {
    projects: [{
      id: "64a1b2c3d4e5f6789",
      name: "Downtown Office Building",
      status: "active",
      progress: {
        overallPercent: 35.5,
        lastUpdate: "2024-07-01T17:00:00Z",
        nextMilestone: "Foundation Completion",
        milestoneDue: "2024-07-15"
      },
      recentActivity: [{
        timestamp: "2024-07-01T16:45:00Z",
        type: "task_completion",
        description: "Concrete pour completed",
        employee: "John Doe",
        photoUrl: "https://cdn.example.com/photos/thumb_xyz789.jpg"
      }],
      teamSize: 8,
      hoursToday: 64.0,
      hoursWeek: 312.5
    }]
  }
}
```

#### GET /api/client/projects/:projectId/timeline
```javascript
// Query: ?startDate=2024-06-01&endDate=2024-07-01&filter=photos

// Response
{
  success: true,
  data: {
    timeline: [{
      id: "log_001",
      timestamp: "2024-07-01T16:45:00Z",
      type: "work_completion",
      title: "Foundation Pour Completed",
      description: "Section A foundation pour completed successfully",
      employee: {
        name: "John Doe",
        id: "emp_001"
      },
      location: "Main Building Site",
      photos: [{
        id: "photo_001",
        url: "https://cdn.example.com/photos/medium_abc123.jpg",
        thumbnailUrl: "https://cdn.example.com/photos/thumb_abc123.jpg",
        timestamp: "2024-07-01T16:45:00Z"
      }],
      metadata: {
        hoursWorked: 2.5,
        taskProgress: 85.0
      }
    }],
    filters: {
      available: ["all", "photos", "milestones", "employee"],
      applied: ["photos"]
    },
    pagination: {
      page: 1,
      limit: 25,
      total: 156
    }
  }
}
```

#### GET /api/client/projects/:projectId/photos
```javascript
// Query: ?date=2024-07-01&employee=emp_001&task=task_001

// Response
{
  success: true,
  data: {
    photos: [{
      id: "photo_001",
      url: "https://cdn.example.com/photos/medium_abc123.jpg",
      thumbnailUrl: "https://cdn.example.com/photos/thumb_abc123.jpg",
      timestamp: "2024-07-01T16:45:00Z",
      employee: "John Doe",
      location: "Main Building Site",
      task: "Foundation Work",
      type: "work_completion",
      metadata: {
        weather: "Sunny",
        temperature: "72°F",
        equipment: ["Concrete Mixer", "Pump Truck"]
      }
    }],
    grouping: {
      byDate: true,
      byEmployee: false,
      byTask: false
    },
    summary: {
      totalPhotos: 45,
      dateRange: {
        start: "2024-07-01",
        end: "2024-07-01"
      }
    }
  }
}
```

---

## Real-Time WebSocket Events

### Connection Management
```javascript
// Client connects with JWT token
socket.emit('authenticate', { token: 'jwt_token' });

// Server responds with authentication status
socket.emit('authenticated', { 
  userId: 'user_id',
  organizationId: 'org_id',
  role: 'employee'
});
```

### Employee App Events
```javascript
// Time tracking events
socket.emit('timecard:created', {
  timecardId: 'tc_001',
  type: 'clock_in',
  timestamp: '2024-07-01T08:00:00Z',
  projectId: 'proj_001',
  userId: 'user_001'
});

socket.emit('photo:uploaded', {
  photoId: 'photo_001',
  timecardId: 'tc_001',
  url: 'https://cdn.example.com/photos/thumb_abc123.jpg',
  timestamp: '2024-07-01T08:00:00Z'
});

// Location updates
socket.emit('location:update', {
  userId: 'user_001',
  location: {
    latitude: 37.7749,
    longitude: -122.4194,
    accuracy: 5.0
  },
  nearbyJobSites: ['js_001']
});
```

### Client App Events
```javascript
// Real-time project updates
socket.emit('project:update', {
  projectId: 'proj_001',
  type: 'timeline_entry',
  data: {
    logId: 'log_001',
    timestamp: '2024-07-01T16:45:00Z',
    title: 'Foundation Pour Completed',
    employee: 'John Doe',
    photoUrl: 'https://cdn.example.com/photos/thumb_abc123.jpg'
  }
});

socket.emit('project:photo_added', {
  projectId: 'proj_001',
  photoId: 'photo_001',
  employee: 'John Doe',
  timestamp: '2024-07-01T16:45:00Z',
  thumbnailUrl: 'https://cdn.example.com/photos/thumb_abc123.jpg'
});

// Progress updates
socket.emit('project:progress_update', {
  projectId: 'proj_001',
  overallProgress: 36.2,
  taskProgress: {
    'task_001': 90.0,
    'task_002': 45.0
  },
  hoursToday: 68.5,
  teamStatus: {
    'user_001': 'active',
    'user_002': 'lunch_break'
  }
});
```

---

## Photo Processing Pipeline

### Upload Flow
1. **Client Upload:** Mobile app uploads photo to signed S3 URL
2. **Webhook Trigger:** S3 event triggers Lambda function
3. **Processing Queue:** Lambda adds job to Redis queue
4. **Background Processing:** Worker processes photo (resize, optimize)
5. **Database Update:** Store processed URLs and metadata
6. **Real-time Notification:** Notify clients via WebSocket

### Image Variants
```javascript
{
  original: "https://s3.amazonaws.com/bucket/photos/original_abc123.jpg",
  large: "https://cdn.example.com/photos/large_abc123.jpg", // 1200px max
  medium: "https://cdn.example.com/photos/medium_abc123.jpg", // 800px max
  thumbnail: "https://cdn.example.com/photos/thumb_abc123.jpg", // 300px max
  avatar: "https://cdn.example.com/photos/avatar_abc123.jpg" // 150px square
}
```

---

## Security Implementation

### Authentication & Authorization
- **JWT Tokens:** Access tokens (15 min) + Refresh tokens (30 days)
- **Role-based Access:** Employee, Supervisor, Admin, Client roles
- **Organization Isolation:** All data scoped to organization
- **API Rate Limiting:** Per-user and per-endpoint limits

### Data Encryption
- **At Rest:** AES-256 encryption for sensitive fields
- **In Transit:** TLS 1.3 for all API communications
- **Photo Storage:** S3 server-side encryption with KMS

### Privacy Controls
- **GDPR Compliance:** Data export and deletion endpoints
- **Photo Consent:** Employee consent tracking for photo usage
- **Client Visibility:** Granular controls for what clients can see
- **Audit Logging:** All data access and modifications logged

This technical specification provides the foundation for implementing the backend infrastructure that will support both the enhanced employee app and the new client application while maintaining security, scalability, and compliance requirements.