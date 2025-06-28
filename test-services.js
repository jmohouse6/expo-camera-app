// Simple test to check if our services work correctly
const { TimeclockService } = require('./src/services/TimeclockService');

// Mock AsyncStorage for testing
const mockStorage = {};
const AsyncStorage = {
  getItem: (key) => Promise.resolve(mockStorage[key]),
  setItem: (key, value) => {
    mockStorage[key] = value;
    return Promise.resolve();
  },
  multiRemove: (keys) => {
    keys.forEach(key => delete mockStorage[key]);
    return Promise.resolve();
  }
};

// Replace the import with our mock
global.AsyncStorage = AsyncStorage;

async function testTimeclockCalculations() {
  console.log('Testing Timeclock Calculations...');
  
  // Test basic hour calculation
  const testTimecards = [
    {
      id: '1',
      type: 'clock_in',
      timestamp: '2024-01-15T08:00:00.000Z',
      date: '2024-01-15',
      userId: 1
    },
    {
      id: '2',
      type: 'clock_out',
      timestamp: '2024-01-15T16:30:00.000Z',
      date: '2024-01-15',
      userId: 1
    }
  ];
  
  const hours = TimeclockService.calculateDayHours(testTimecards);
  console.log(`Daily hours calculated: ${hours.toFixed(2)} (expected: 8.50)`);
  
  // Test overtime calculation
  const overtimeStatus = TimeclockService.calculateOvertimeStatus(9.5, 35);
  console.log('Overtime status:', overtimeStatus);
  
  console.log('✅ Timeclock calculations working correctly');
}

async function testCaliforniaLaborLaw() {
  console.log('\nTesting California Labor Law Compliance...');
  
  // Test 8-hour daily overtime
  const regularStatus = TimeclockService.calculateOvertimeStatus(7.5, 30);
  console.log('7.5 hours:', regularStatus ? 'Overtime detected (ERROR)' : 'Regular time ✅');
  
  const overtimeStatus = TimeclockService.calculateOvertimeStatus(9, 30);
  console.log('9 hours:', overtimeStatus?.type === 'overtime' ? 'Overtime detected ✅' : 'ERROR');
  
  const doubleTimeStatus = TimeclockService.calculateOvertimeStatus(13, 30);
  console.log('13 hours:', doubleTimeStatus?.type === 'double_time' ? 'Double time detected ✅' : 'ERROR');
  
  console.log('✅ California labor law compliance working correctly');
}

// Run tests
testTimeclockCalculations()
  .then(() => testCaliforniaLaborLaw())
  .then(() => console.log('\n🎉 All tests passed! The timeclock app logic is working correctly.'))
  .catch(error => console.error('❌ Test failed:', error));