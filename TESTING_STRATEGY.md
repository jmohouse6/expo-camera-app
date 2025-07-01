# Testing Strategy & QA Documentation - Photo Timekeeping Mobile App

## Overview

This document outlines the comprehensive testing strategy for the Photo Timekeeping Mobile App, covering both the enhanced employee application and the new client application. The strategy ensures high-quality delivery through systematic testing at all levels.

---

## Testing Pyramid & Strategy

### Testing Levels
```
                 ┌─────────────────┐
                 │   E2E Tests     │  5%
                 │   (UI/Integration) │
                 └─────────────────┘
               ┌─────────────────────┐
               │  Integration Tests  │  15%
               │  (API/Services)     │
               └─────────────────────┘
         ┌─────────────────────────────────┐
         │        Unit Tests               │  80%
         │    (Components/Functions)       │
         └─────────────────────────────────┘
```

**Testing Distribution:**
- **Unit Tests:** 80% - Fast, isolated component/function testing
- **Integration Tests:** 15% - API endpoints, service interactions
- **End-to-End Tests:** 5% - Critical user journeys across apps

---

## Unit Testing Strategy

### Frontend (React Native) Unit Tests

#### Employee App - Core Components
```javascript
// TimeclockScreen.test.js
describe('TimeclockScreen', () => {
  beforeEach(() => {
    // Mock services
    jest.mock('../services/TimeclockService');
    jest.mock('../services/CameraService');
    jest.mock('../services/LocationService');
  });

  describe('Clock In/Out Functionality', () => {
    test('should display clock in button when not clocked in', async () => {
      const mockStatus = { clockedIn: false, todayHours: 0 };
      TimeclockService.getTodayStatus.mockResolvedValue(mockStatus);
      
      const { getByText } = render(<TimeclockScreen />);
      await waitFor(() => {
        expect(getByText('Clock In')).toBeTruthy();
      });
    });

    test('should require photo before clock in', async () => {
      const { getByText } = render(<TimeclockScreen />);
      const clockInButton = getByText('Clock In');
      
      CameraService.takeTimeclockPhoto.mockResolvedValue(null);
      
      fireEvent.press(clockInButton);
      
      expect(CameraService.takeTimeclockPhoto).toHaveBeenCalled();
      expect(TimeclockService.clockIn).not.toHaveBeenCalled();
    });

    test('should calculate overtime correctly', () => {
      const todayHours = 9.5;
      const weekHours = 45.0;
      
      const overtimeStatus = TimeclockService.calculateOvertimeStatus(todayHours, weekHours);
      
      expect(overtimeStatus.type).toBe('overtime');
      expect(overtimeStatus.dailyOvertime).toBe(1.5);
      expect(overtimeStatus.rate).toBe(1.5);
    });
  });

  describe('Work Cycle Management', () => {
    test('should start work cycle with photo', async () => {
      const mockPhoto = { id: 'photo_123', url: 'https://...' };
      CameraService.takeTimeclockPhoto.mockResolvedValue(mockPhoto);
      
      const { getByText } = render(<TimeclockScreen />);
      const startCycleButton = getByText('Start Work Cycle');
      
      fireEvent.press(startCycleButton);
      
      await waitFor(() => {
        expect(TimeclockService.recordWorkCycle).toHaveBeenCalledWith({
          type: 'cycle_start',
          photo: mockPhoto,
          // ... other params
        });
      });
    });

    test('should prevent starting new cycle without stopping current', () => {
      const currentStatus = { activeWorkCycle: { id: 'cycle_001' } };
      
      const { getByText, queryByText } = render(<TimeclockScreen />, {
        initialProps: { currentStatus }
      });
      
      expect(queryByText('Start Work Cycle')).toBeNull();
      expect(getByText('Stop Work Cycle')).toBeTruthy();
    });
  });

  describe('Location Validation', () => {
    test('should detect nearby job sites automatically', async () => {
      const mockLocation = { latitude: 37.7749, longitude: -122.4194 };
      const mockJobSite = { id: 'js_001', name: 'Downtown Office' };
      
      LocationService.getCurrentLocation.mockResolvedValue(mockLocation);
      LocationService.findNearbyJobSite.mockResolvedValue(mockJobSite);
      
      const { getByText } = render(<TimeclockScreen />);
      
      await waitFor(() => {
        expect(getByText('Downtown Office')).toBeTruthy();
      });
    });

    test('should show manual job selection when outside range', async () => {
      LocationService.findNearbyJobSite.mockResolvedValue(null);
      
      const { getByText } = render(<TimeclockScreen />);
      
      await waitFor(() => {
        expect(getByText('Select Job Site')).toBeTruthy();
      });
    });
  });
});
```

#### Client App - Core Components
```javascript
// ProjectDashboard.test.js
describe('ProjectDashboard', () => {
  describe('Real-time Updates', () => {
    test('should display new photos in timeline', async () => {
      const mockProject = { id: 'proj_001', name: 'Test Project' };
      const mockPhotos = [
        { id: 'photo_001', timestamp: '2024-07-01T10:00:00Z', employee: 'John Doe' }
      ];
      
      const { getByTestId } = render(<ProjectDashboard project={mockProject} />);
      
      // Simulate WebSocket photo update
      act(() => {
        mockWebSocket.emit('project:photo_added', {
          projectId: 'proj_001',
          photo: mockPhotos[0]
        });
      });
      
      await waitFor(() => {
        expect(getByTestId('photo-timeline')).toBeTruthy();
        expect(getByTestId('photo_001')).toBeTruthy();
      });
    });

    test('should update progress indicators', async () => {
      const progressUpdate = {
        projectId: 'proj_001',
        overallProgress: 45.5,
        taskProgress: { 'task_001': 80.0 }
      };
      
      const { getByTestId } = render(<ProjectDashboard />);
      
      act(() => {
        mockWebSocket.emit('project:progress_update', progressUpdate);
      });
      
      await waitFor(() => {
        expect(getByTestId('overall-progress')).toHaveTextContent('45.5%');
        expect(getByTestId('task_001_progress')).toHaveTextContent('80.0%');
      });
    });
  });

  describe('Filtering Functionality', () => {
    test('should filter photos by date range', async () => {
      const photos = [
        { id: 'photo_001', timestamp: '2024-07-01T10:00:00Z' },
        { id: 'photo_002', timestamp: '2024-07-02T10:00:00Z' },
        { id: 'photo_003', timestamp: '2024-07-03T10:00:00Z' }
      ];
      
      const { getByTestId, queryByTestId } = render(<ProjectDashboard />);
      
      // Apply date filter
      fireEvent.changeText(getByTestId('start-date-input'), '2024-07-01');
      fireEvent.changeText(getByTestId('end-date-input'), '2024-07-01');
      fireEvent.press(getByTestId('apply-filter-button'));
      
      await waitFor(() => {
        expect(getByTestId('photo_001')).toBeTruthy();
        expect(queryByTestId('photo_002')).toBeNull();
        expect(queryByTestId('photo_003')).toBeNull();
      });
    });

    test('should filter by employee', async () => {
      const { getByTestId } = render(<ProjectDashboard />);
      
      fireEvent.press(getByTestId('employee-filter'));
      fireEvent.press(getByTestId('employee-john-doe'));
      
      await waitFor(() => {
        // Verify only John Doe's photos are shown
        expect(mockAPI.getProjectPhotos).toHaveBeenCalledWith({
          projectId: 'proj_001',
          employeeId: 'emp_001'
        });
      });
    });
  });
});
```

### Backend Unit Tests

#### Service Layer Tests
```javascript
// TimeclockService.test.js
describe('TimeclockService', () => {
  describe('Overtime Calculations', () => {
    test('should calculate daily overtime correctly', () => {
      const timecards = [
        { type: 'clock_in', timestamp: '2024-07-01T08:00:00Z' },
        { type: 'clock_out', timestamp: '2024-07-01T18:30:00Z' }
      ];
      
      const hours = TimeclockService.calculateDayHours(timecards);
      expect(hours).toBe(10.5);
      
      const overtimeStatus = TimeclockService.calculateOvertimeStatus(hours, 35);
      expect(overtimeStatus.type).toBe('overtime');
      expect(overtimeStatus.dailyOvertime).toBe(2.5);
      expect(overtimeStatus.rate).toBe(1.5);
    });

    test('should handle lunch breaks in time calculations', () => {
      const timecards = [
        { type: 'clock_in', timestamp: '2024-07-01T08:00:00Z' },
        { type: 'lunch_out', timestamp: '2024-07-01T12:00:00Z' },
        { type: 'lunch_in', timestamp: '2024-07-01T13:00:00Z' },
        { type: 'clock_out', timestamp: '2024-07-01T17:00:00Z' }
      ];
      
      const hours = TimeclockService.calculateDayHours(timecards);
      expect(hours).toBe(8.0); // 9 hours minus 1 hour lunch
    });

    test('should calculate weekly overtime when daily rules don\'t apply', () => {
      const weekHours = 42.0;
      const todayHours = 7.0; // Under daily overtime threshold
      
      const overtimeStatus = TimeclockService.calculateOvertimeStatus(todayHours, weekHours);
      expect(overtimeStatus.type).toBe('overtime');
      expect(overtimeStatus.weeklyOvertime).toBe(2.0);
    });
  });

  describe('Validation Logic', () => {
    test('should require photo for clock in', async () => {
      const clockInData = {
        job: { id: 'job_001' },
        task: { id: 'task_001' },
        location: { latitude: 37.7749, longitude: -122.4194 }
        // Missing photo
      };
      
      await expect(TimeclockService.clockIn(clockInData))
        .rejects.toThrow('Photo is required for clock in');
    });

    test('should validate location proximity to job site', async () => {
      const mockLocation = { latitude: 37.7849, longitude: -122.4094 }; // Too far
      const mockJobSite = { 
        id: 'job_001', 
        location: { latitude: 37.7749, longitude: -122.4194 } 
      };
      
      const isValid = await LocationService.validateLocation(mockJobSite, mockLocation);
      expect(isValid).toBe(false);
    });
  });
});
```

#### API Controller Tests
```javascript
// timecards.controller.test.js
describe('Timecards Controller', () => {
  describe('POST /api/timecards/clock-in', () => {
    test('should create timecard with valid data', async () => {
      const mockUser = { id: 'user_001', organizationId: 'org_001' };
      const clockInData = {
        projectId: 'proj_001',
        jobSiteId: 'js_001',
        taskId: 'task_001',
        location: { latitude: 37.7749, longitude: -122.4194 }
      };
      
      const response = await request(app)
        .post('/api/timecards/clock-in')
        .set('Authorization', `Bearer ${validToken}`)
        .field('projectId', clockInData.projectId)
        .field('jobSiteId', clockInData.jobSiteId)
        .field('taskId', clockInData.taskId)
        .field('location', JSON.stringify(clockInData.location))
        .attach('photo', 'test/fixtures/sample-photo.jpg')
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.timecardId).toBeDefined();
      expect(response.body.data.photoUrl).toBeDefined();
    });

    test('should reject request without photo', async () => {
      await request(app)
        .post('/api/timecards/clock-in')
        .set('Authorization', `Bearer ${validToken}`)
        .field('projectId', 'proj_001')
        .expect(400);
    });

    test('should reject request with invalid location', async () => {
      await request(app)
        .post('/api/timecards/clock-in')
        .set('Authorization', `Bearer ${validToken}`)
        .field('location', JSON.stringify({ latitude: 'invalid' }))
        .attach('photo', 'test/fixtures/sample-photo.jpg')
        .expect(400);
    });
  });

  describe('GET /api/timecards/status', () => {
    test('should return current timecard status', async () => {
      const response = await request(app)
        .get('/api/timecards/status')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);
      
      expect(response.body.data).toHaveProperty('clockedIn');
      expect(response.body.data).toHaveProperty('todayHours');
      expect(response.body.data).toHaveProperty('weekHours');
      expect(response.body.data).toHaveProperty('overtimeStatus');
    });
  });
});
```

---

## Integration Testing Strategy

### API Integration Tests
```javascript
// integration/timeclock.integration.test.js
describe('Timeclock Integration', () => {
  beforeEach(async () => {
    // Set up test database
    await setupTestDatabase();
    await seedTestData();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  describe('Complete Clock In/Out Flow', () => {
    test('should handle full workday cycle', async () => {
      const user = await createTestUser();
      const project = await createTestProject();
      const token = generateToken(user);
      
      // Clock In
      const clockInResponse = await request(app)
        .post('/api/timecards/clock-in')
        .set('Authorization', `Bearer ${token}`)
        .field('projectId', project.id)
        .field('jobSiteId', project.jobSites[0].id)
        .field('taskId', project.jobSites[0].tasks[0].id)
        .field('location', JSON.stringify({ latitude: 37.7749, longitude: -122.4194 }))
        .attach('photo', 'test/fixtures/clock-in-photo.jpg')
        .expect(201);
      
      expect(clockInResponse.body.data.status).toBe('clocked_in');
      
      // Take Lunch Break
      const lunchOutResponse = await request(app)
        .post('/api/timecards/lunch-break')
        .set('Authorization', `Bearer ${token}`)
        .field('type', 'lunch_out')
        .field('location', JSON.stringify({ latitude: 37.7749, longitude: -122.4194 }))
        .attach('photo', 'test/fixtures/lunch-out-photo.jpg')
        .expect(201);
      
      // Return from Lunch
      const lunchInResponse = await request(app)
        .post('/api/timecards/lunch-break')
        .set('Authorization', `Bearer ${token}`)
        .field('type', 'lunch_in')
        .field('location', JSON.stringify({ latitude: 37.7749, longitude: -122.4194 }))
        .attach('photo', 'test/fixtures/lunch-in-photo.jpg')
        .expect(201);
      
      // Clock Out
      const clockOutResponse = await request(app)
        .post('/api/timecards/clock-out')
        .set('Authorization', `Bearer ${token}`)
        .field('location', JSON.stringify({ latitude: 37.7749, longitude: -122.4194 }))
        .attach('photo', 'test/fixtures/clock-out-photo.jpg')
        .expect(201);
      
      expect(clockOutResponse.body.data.hoursWorked).toBeGreaterThan(0);
      expect(clockOutResponse.body.data.status).toBe('clocked_out');
      
      // Verify photos were uploaded and processed
      const photos = await PhotoModel.find({ userId: user.id });
      expect(photos).toHaveLength(4);
      photos.forEach(photo => {
        expect(photo.thumbnailUrl).toBeDefined();
        expect(photo.processingStatus).toBe('completed');
      });
    });
  });

  describe('Real-time Updates', () => {
    test('should broadcast timecard updates to connected clients', async () => {
      const clientSocket = io('http://localhost:3000');
      const employee = await createTestUser({ role: 'employee' });
      const client = await createTestUser({ role: 'client' });
      const project = await createTestProject({ clientId: client.id });
      
      // Client connects and joins project room
      clientSocket.emit('authenticate', { token: generateToken(client) });
      clientSocket.emit('join:project', { projectId: project.id });
      
      const updatePromise = new Promise(resolve => {
        clientSocket.on('project:update', resolve);
      });
      
      // Employee clocks in
      await request(app)
        .post('/api/timecards/clock-in')
        .set('Authorization', `Bearer ${generateToken(employee)}`)
        .field('projectId', project.id)
        .attach('photo', 'test/fixtures/clock-in-photo.jpg');
      
      const update = await updatePromise;
      expect(update.type).toBe('timecard_created');
      expect(update.projectId).toBe(project.id);
      
      clientSocket.close();
    });
  });

  describe('Photo Processing Pipeline', () => {
    test('should process uploaded photos automatically', async () => {
      const user = await createTestUser();
      const token = generateToken(user);
      
      // Upload large photo
      const response = await request(app)
        .post('/api/timecards/clock-in')
        .set('Authorization', `Bearer ${token}`)
        .attach('photo', 'test/fixtures/large-photo.jpg') // 5MB photo
        .expect(201);
      
      const photoId = response.body.data.photoId;
      
      // Wait for processing to complete
      await waitFor(async () => {
        const photo = await PhotoModel.findById(photoId);
        return photo.processingStatus === 'completed';
      }, { timeout: 10000 });
      
      const photo = await PhotoModel.findById(photoId);
      expect(photo.thumbnailUrl).toBeDefined();
      expect(photo.mediumUrl).toBeDefined();
      expect(photo.originalUrl).toBeDefined();
      
      // Verify image sizes
      const thumbnailResponse = await request(photo.thumbnailUrl).expect(200);
      expect(thumbnailResponse.headers['content-type']).toContain('image');
    });
  });
});
```

### Database Integration Tests
```javascript
// integration/database.integration.test.js
describe('Database Integration', () => {
  describe('Multi-tenant Data Isolation', () => {
    test('should isolate data between organizations', async () => {
      const org1 = await OrganizationModel.create({ name: 'Company A', slug: 'company-a' });
      const org2 = await OrganizationModel.create({ name: 'Company B', slug: 'company-b' });
      
      const user1 = await UserModel.create({ 
        email: 'user@company-a.com', 
        organizationId: org1._id 
      });
      const user2 = await UserModel.create({ 
        email: 'user@company-b.com', 
        organizationId: org2._id 
      });
      
      const project1 = await ProjectModel.create({ 
        name: 'Project A', 
        organizationId: org1._id 
      });
      const project2 = await ProjectModel.create({ 
        name: 'Project B', 
        organizationId: org2._id 
      });
      
      // User 1 should only see their organization's data
      const user1Projects = await ProjectModel.find({ organizationId: org1._id });
      expect(user1Projects).toHaveLength(1);
      expect(user1Projects[0].name).toBe('Project A');
      
      // User 2 should only see their organization's data
      const user2Projects = await ProjectModel.find({ organizationId: org2._id });
      expect(user2Projects).toHaveLength(1);
      expect(user2Projects[0].name).toBe('Project B');
    });
  });

  describe('Data Consistency', () => {
    test('should maintain referential integrity', async () => {
      const organization = await createTestOrganization();
      const user = await createTestUser({ organizationId: organization._id });
      const project = await createTestProject({ organizationId: organization._id });
      
      // Create timecard
      const timecard = await TimecardModel.create({
        userId: user._id,
        projectId: project._id,
        organizationId: organization._id,
        type: 'clock_in',
        timestamp: new Date()
      });
      
      // Delete project should cascade properly
      await ProjectModel.findByIdAndDelete(project._id);
      
      // Timecard should still exist but project reference should be handled
      const timecardAfterDelete = await TimecardModel.findById(timecard._id);
      expect(timecardAfterDelete).toBeTruthy();
      
      // But queries joining with project should handle missing reference
      const timecardWithProject = await TimecardModel.findById(timecard._id)
        .populate('projectId');
      expect(timecardWithProject.projectId).toBeNull();
    });
  });
});
```

---

## End-to-End Testing Strategy

### Critical User Journeys

#### Employee App E2E Tests
```javascript
// e2e/employee-app.e2e.test.js
describe('Employee App E2E', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  describe('Complete Workday Flow', () => {
    test('should complete full workday cycle', async () => {
      // Login
      await element(by.id('email-input')).typeText('employee@company.com');
      await element(by.id('password-input')).typeText('password123');
      await element(by.id('login-button')).tap();
      
      // Wait for main screen
      await waitFor(element(by.id('timeclock-screen')))
        .toBeVisible()
        .withTimeout(5000);
      
      // Verify initial state
      await expect(element(by.id('clock-in-button'))).toBeVisible();
      await expect(element(by.text('Clocked Out'))).toBeVisible();
      
      // Clock In with Photo
      await element(by.id('clock-in-button')).tap();
      
      // Camera should open
      await waitFor(element(by.id('camera-view')))
        .toBeVisible()
        .withTimeout(3000);
      
      // Take photo
      await element(by.id('capture-button')).tap();
      
      // Confirm photo
      await element(by.id('confirm-photo-button')).tap();
      
      // Wait for clock in to complete
      await waitFor(element(by.text('Clocked In')))
        .toBeVisible()
        .withTimeout(5000);
      
      // Verify clock out button is now visible
      await expect(element(by.id('clock-out-button'))).toBeVisible();
      
      // Verify hours are tracking
      await expect(element(by.id('today-hours'))).toHaveText('0.0');
      
      // Start Work Cycle
      await element(by.id('start-cycle-button')).tap();
      await element(by.id('cycle-name-input')).typeText('Foundation Pour');
      await element(by.id('confirm-cycle-button')).tap();
      
      // Take work cycle photo
      await waitFor(element(by.id('camera-view'))).toBeVisible();
      await element(by.id('capture-button')).tap();
      await element(by.id('confirm-photo-button')).tap();
      
      // Verify work cycle started
      await waitFor(element(by.text('Foundation Pour - In Progress')))
        .toBeVisible()
        .withTimeout(5000);
      
      // Take Lunch Break
      await element(by.id('lunch-out-button')).tap();
      await waitFor(element(by.id('camera-view'))).toBeVisible();
      await element(by.id('capture-button')).tap();
      await element(by.id('confirm-photo-button')).tap();
      
      // Return from Lunch
      await element(by.id('lunch-in-button')).tap();
      await waitFor(element(by.id('camera-view'))).toBeVisible();
      await element(by.id('capture-button')).tap();
      await element(by.id('confirm-photo-button')).tap();
      
      // Stop Work Cycle
      await element(by.id('stop-cycle-button')).tap();
      await element(by.id('cycle-progress-input')).typeText('100');
      await element(by.id('confirm-stop-cycle-button')).tap();
      
      // Take cycle completion photo
      await waitFor(element(by.id('camera-view'))).toBeVisible();
      await element(by.id('capture-button')).tap();
      await element(by.id('confirm-photo-button')).tap();
      
      // Clock Out
      await element(by.id('clock-out-button')).tap();
      await waitFor(element(by.id('camera-view'))).toBeVisible();
      await element(by.id('capture-button')).tap();
      await element(by.id('confirm-photo-button')).tap();
      
      // Verify clocked out
      await waitFor(element(by.text('Clocked Out')))
        .toBeVisible()
        .withTimeout(5000);
      
      // Check that hours were recorded
      await expect(element(by.id('today-hours'))).not.toHaveText('0.0');
    });
  });

  describe('Offline Functionality', () => {
    test('should work offline and sync when online', async () => {
      // Login first
      await loginAsEmployee();
      
      // Disable network
      await device.setConnectivity(false);
      
      // Clock in while offline
      await element(by.id('clock-in-button')).tap();
      await takePhoto();
      
      // Verify offline indicator
      await expect(element(by.id('offline-indicator'))).toBeVisible();
      
      // Verify clock in worked locally
      await expect(element(by.text('Clocked In'))).toBeVisible();
      
      // Re-enable network
      await device.setConnectivity(true);
      
      // Wait for sync
      await waitFor(element(by.id('sync-complete-indicator')))
        .toBeVisible()
        .withTimeout(10000);
      
      // Verify data synced
      await expect(element(by.id('offline-indicator'))).not.toBeVisible();
    });
  });
});
```

#### Client App E2E Tests
```javascript
// e2e/client-app.e2e.test.js
describe('Client App E2E', () => {
  describe('Project Monitoring Flow', () => {
    test('should view real-time project updates', async () => {
      // Login as client
      await element(by.id('email-input')).typeText('client@company.com');
      await element(by.id('password-input')).typeText('password123');
      await element(by.id('login-button')).tap();
      
      // Select project
      await waitFor(element(by.id('project-list'))).toBeVisible();
      await element(by.id('project-downtown-office')).tap();
      
      // Verify project dashboard
      await expect(element(by.id('project-progress'))).toBeVisible();
      await expect(element(by.id('photo-timeline'))).toBeVisible();
      
      // Test filtering
      await element(by.id('filter-button')).tap();
      await element(by.id('date-filter')).tap();
      await element(by.id('today-filter')).tap();
      
      // Apply filter
      await element(by.id('apply-filter-button')).tap();
      
      // Verify filtered results
      await waitFor(element(by.id('filtered-photos'))).toBeVisible();
      
      // Test photo viewing
      await element(by.id('photo-timeline-item-0')).tap();
      await expect(element(by.id('photo-detail-view'))).toBeVisible();
      await expect(element(by.id('photo-metadata'))).toBeVisible();
      
      // Close photo view
      await element(by.id('close-photo-button')).tap();
      
      // Test export functionality
      await element(by.id('export-button')).tap();
      await element(by.id('export-pdf-option')).tap();
      
      // Wait for export completion
      await waitFor(element(by.text('Export completed')))
        .toBeVisible()
        .withTimeout(10000);
    });
  });

  describe('Real-time Updates', () => {
    test('should receive live project updates', async () => {
      await loginAsClient();
      await selectProject('downtown-office');
      
      // Count initial photos
      const initialPhotoCount = await element(by.id('photo-timeline'))
        .getAttributes().then(attrs => 
          attrs.children ? attrs.children.length : 0
        );
      
      // Simulate employee taking photo (via API call)
      await simulateEmployeePhoto({
        projectId: 'downtown-office',
        type: 'work_progress',
        employee: 'John Doe'
      });
      
      // Wait for real-time update
      await waitFor(element(by.id('new-photo-notification')))
        .toBeVisible()
        .withTimeout(5000);
      
      // Verify photo appears in timeline
      const finalPhotoCount = await element(by.id('photo-timeline'))
        .getAttributes().then(attrs => 
          attrs.children ? attrs.children.length : 0
        );
      
      expect(finalPhotoCount).toBe(initialPhotoCount + 1);
    });
  });
});
```

---

## Performance Testing Strategy

### Load Testing
```javascript
// performance/load.test.js
import { check, sleep } from 'k6';
import http from 'k6/http';

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    http_req_failed: ['rate<0.1'],    // Error rate must be below 10%
  },
};

const BASE_URL = 'https://api.timeclock-app.com';

export function setup() {
  // Create test users and get auth tokens
  const response = http.post(`${BASE_URL}/api/auth/login`, {
    email: 'loadtest@company.com',
    password: 'password123'
  });
  
  return { authToken: response.json('data.tokens.accessToken') };
}

export default function(data) {
  const headers = {
    'Authorization': `Bearer ${data.authToken}`,
    'Content-Type': 'application/json',
  };
  
  // Test timecard status endpoint
  let response = http.get(`${BASE_URL}/api/timecards/status`, { headers });
  check(response, {
    'status endpoint responds': (r) => r.status === 200,
    'status response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(1);
  
  // Test project list endpoint
  response = http.get(`${BASE_URL}/api/projects`, { headers });
  check(response, {
    'projects endpoint responds': (r) => r.status === 200,
    'projects response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  
  sleep(2);
  
  // Test photo timeline endpoint (more intensive)
  response = http.get(`${BASE_URL}/api/client/projects/proj_001/photos`, { headers });
  check(response, {
    'photos endpoint responds': (r) => r.status === 200,
    'photos response time < 2000ms': (r) => r.timings.duration < 2000,
  });
  
  sleep(3);
}

export function teardown(data) {
  // Cleanup test data
  console.log('Load test completed');
}
```

### Mobile Performance Testing
```javascript
// performance/mobile.performance.test.js
describe('Mobile Performance', () => {
  describe('App Launch Performance', () => {
    test('should launch within 3 seconds', async () => {
      const startTime = Date.now();
      
      await device.launchApp();
      await waitFor(element(by.id('main-screen'))).toBeVisible();
      
      const launchTime = Date.now() - startTime;
      expect(launchTime).toBeLessThan(3000);
    });
  });

  describe('Photo Capture Performance', () => {
    test('should capture photo within 2 seconds', async () => {
      await loginAsEmployee();
      
      const startTime = Date.now();
      
      await element(by.id('clock-in-button')).tap();
      await waitFor(element(by.id('camera-view'))).toBeVisible();
      await element(by.id('capture-button')).tap();
      await waitFor(element(by.id('photo-preview'))).toBeVisible();
      
      const captureTime = Date.now() - startTime;
      expect(captureTime).toBeLessThan(2000);
    });
  });

  describe('Photo Timeline Performance', () => {
    test('should load 100 photos smoothly', async () => {
      await loginAsClient();
      await selectProject('large-project'); // Project with 100+ photos
      
      const startTime = Date.now();
      
      await waitFor(element(by.id('photo-timeline'))).toBeVisible();
      
      // Scroll through timeline
      for (let i = 0; i < 10; i++) {
        await element(by.id('photo-timeline')).scroll(300, 'down');
        await sleep(100);
      }
      
      const scrollTime = Date.now() - startTime;
      expect(scrollTime).toBeLessThan(5000);
    });
  });
});
```

---

## Quality Assurance Processes

### Code Quality Gates
```yaml
# .github/workflows/quality-gates.yml
name: Quality Gates

on: [push, pull_request]

jobs:
  code-quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: ESLint
        run: npm run lint
        
      - name: TypeScript Check
        run: npm run type-check
        
      - name: Security Audit
        run: npm audit --audit-level moderate
        
      - name: Test Coverage
        run: npm run test:coverage
        
      - name: Coverage Gate
        run: |
          COVERAGE=$(cat coverage/lcov.info | grep -E '^SF:' | wc -l)
          THRESHOLD=80
          if [ $COVERAGE -lt $THRESHOLD ]; then
            echo "Coverage $COVERAGE% is below threshold $THRESHOLD%"
            exit 1
          fi

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Snyk Security Scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high
          
      - name: OWASP Dependency Check
        uses: dependency-check/Dependency-Check_Action@main
        with:
          project: 'timeclock-app'
          path: '.'
          format: 'HTML'
```

### Test Automation Pipeline
```yaml
# Test Execution Strategy
Unit Tests:
  Trigger: Every commit
  Execution: Parallel across components
  Coverage: 80% minimum
  Duration: < 5 minutes

Integration Tests:
  Trigger: Pull requests to main
  Execution: Sequential with test database
  Coverage: Critical API endpoints
  Duration: < 15 minutes

E2E Tests:
  Trigger: Nightly + pre-release
  Execution: Parallel across devices
  Coverage: Critical user journeys
  Duration: < 45 minutes

Performance Tests:
  Trigger: Weekly + pre-release
  Execution: Dedicated load test environment
  Metrics: Response time, throughput, error rate
  Duration: < 30 minutes
```

### Bug Triage Process
```yaml
Bug Severity Levels:
  Critical (P0):
    - App crashes
    - Data loss
    - Security vulnerabilities
    - Complete feature failure
    SLA: Fix within 24 hours
    
  High (P1):
    - Major feature not working
    - Performance degradation
    - Incorrect calculations
    SLA: Fix within 3 days
    
  Medium (P2):
    - Minor feature issues
    - UI inconsistencies
    - Edge case failures
    SLA: Fix within 1 week
    
  Low (P3):
    - Cosmetic issues
    - Nice-to-have improvements
    - Non-critical edge cases
    SLA: Fix in next release cycle

Quality Metrics:
  - Defect Density: < 5 defects per 1000 lines of code
  - Defect Escape Rate: < 5% to production
  - Customer-Reported Bugs: < 2% of total bugs
  - Mean Time to Resolution: < 48 hours for P0/P1
```

This comprehensive testing strategy ensures high-quality delivery through systematic testing at all levels, automated quality gates, and robust performance validation.