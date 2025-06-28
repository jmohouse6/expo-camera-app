import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import {
  Card,
  Title,
  Paragraph,
  Button,
  Text,
  Chip,
  FAB,
  SegmentedButtons,
  Avatar,
  List,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';

import { TimeclockService } from '../services/TimeclockService';
import { AuthService } from '../services/AuthService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SupervisorDashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [employeeList, setEmployeeList] = useState([]);
  const [selectedView, setSelectedView] = useState('pending');
  const [refreshing, setRefreshing] = useState(false);
  const [teamSummary, setTeamSummary] = useState({
    totalEmployees: 0,
    activeTodayCount: 0,
    pendingApprovalsCount: 0,
    overtimeEmployeesCount: 0,
  });

  useEffect(() => {
    loadSupervisorData();
  }, []);

  const loadSupervisorData = async () => {
    try {
      const user = await AuthService.getCurrentUser();
      setCurrentUser(user);

      if (user.role !== 'supervisor' && user.role !== 'admin') {
        Alert.alert('Access Denied', 'You do not have supervisor privileges');
        return;
      }

      await Promise.all([
        loadPendingApprovals(),
        loadEmployeeList(),
        loadTeamSummary(),
      ]);
    } catch (error) {
      console.error('Error loading supervisor data:', error);
      Alert.alert('Error', 'Failed to load supervisor dashboard');
    }
  };

  const loadPendingApprovals = async () => {
    try {
      // TODO: Implement actual API call to get pending approvals for supervisor
      // For now, we'll simulate with local data
      const allTimecards = await TimeclockService.getTimecards();
      const pending = allTimecards.filter(tc => tc.status === 'submitted');
      
      // Group by user and date
      const groupedPending = {};
      pending.forEach(tc => {
        const key = `${tc.userId}_${tc.date}`;
        if (!groupedPending[key]) {
          groupedPending[key] = {
            userId: tc.userId,
            date: tc.date,
            timecards: [],
            totalHours: 0,
          };
        }
        groupedPending[key].timecards.push(tc);
      });

      // Calculate hours for each group
      Object.keys(groupedPending).forEach(key => {
        const group = groupedPending[key];
        group.totalHours = TimeclockService.calculateDayHours(group.timecards);
      });

      setPendingApprovals(Object.values(groupedPending));
    } catch (error) {
      console.error('Error loading pending approvals:', error);
    }
  };

  const loadEmployeeList = async () => {
    try {
      // TODO: Implement actual API call to get employees under this supervisor
      // For now, we'll simulate with mock data
      const mockEmployees = [
        {
          id: 1,
          name: 'John Employee',
          email: 'employee@company.com',
          status: 'active',
          currentJob: 'Downtown Office Building',
          todayHours: 6.5,
          weekHours: 32.5,
          lastActivity: new Date().toISOString(),
        },
        {
          id: 3,
          name: 'Alice Worker',
          email: 'alice@company.com',
          status: 'clocked_out',
          currentJob: null,
          todayHours: 8.2,
          weekHours: 40.2,
          lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        },
        {
          id: 4,
          name: 'Bob Builder',
          email: 'bob@company.com',
          status: 'active',
          currentJob: 'Residential Complex',
          todayHours: 9.5,
          weekHours: 45.0,
          lastActivity: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
        },
      ];

      setEmployeeList(mockEmployees);
    } catch (error) {
      console.error('Error loading employee list:', error);
    }
  };

  const loadTeamSummary = async () => {
    try {
      // Calculate summary from employee data
      const activeTodayCount = employeeList.filter(emp => emp.status === 'active').length;
      const overtimeEmployeesCount = employeeList.filter(emp => emp.todayHours > 8 || emp.weekHours > 40).length;
      
      setTeamSummary({
        totalEmployees: employeeList.length,
        activeTodayCount,
        pendingApprovalsCount: pendingApprovals.length,
        overtimeEmployeesCount,
      });
    } catch (error) {
      console.error('Error loading team summary:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSupervisorData();
    setRefreshing(false);
  };

  const approveTimecard = async (approval) => {
    try {
      // TODO: Implement actual API call to approve timecard
      Alert.alert(
        'Approve Timecard',
        `Approve timecard for ${approval.date}?\n\nTotal Hours: ${approval.totalHours.toFixed(1)}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Approve',
            onPress: async () => {
              try {
                // Update timecard status
                const allTimecards = await TimeclockService.getTimecards();
                const updatedTimecards = allTimecards.map(tc => {
                  if (tc.userId === approval.userId && tc.date === approval.date) {
                    return { ...tc, status: 'approved', approvedBy: currentUser.id, approvedAt: new Date().toISOString() };
                  }
                  return tc;
                });
                
                await AsyncStorage.setItem('timecards', JSON.stringify(updatedTimecards));
                Alert.alert('Success', 'Timecard approved');
                await loadPendingApprovals();
              } catch (error) {
                Alert.alert('Error', 'Failed to approve timecard');
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to process approval');
    }
  };

  const rejectTimecard = async (approval) => {
    Alert.alert(
      'Reject Timecard',
      `Reject timecard for ${approval.date}? This will require the employee to resubmit.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              // Update timecard status
              const allTimecards = await TimeclockService.getTimecards();
              const updatedTimecards = allTimecards.map(tc => {
                if (tc.userId === approval.userId && tc.date === approval.date) {
                  return { ...tc, status: 'rejected', rejectedBy: currentUser.id, rejectedAt: new Date().toISOString() };
                }
                return tc;
              });
              
              await AsyncStorage.setItem('timecards', JSON.stringify(updatedTimecards));
              Alert.alert('Success', 'Timecard rejected');
              await loadPendingApprovals();
            } catch (error) {
              Alert.alert('Error', 'Failed to reject timecard');
            }
          },
        },
      ]
    );
  };

  const getEmployeeName = (userId) => {
    const employee = employeeList.find(emp => emp.id === userId);
    return employee ? employee.name : `Employee ${userId}`;
  };

  const getStatusColor = (status) => {
    const colorMap = {
      'active': '#4CAF50',
      'clocked_out': '#666',
      'overtime': '#FF9800',
    };
    return colorMap[status] || '#666';
  };

  const getStatusIcon = (status) => {
    const iconMap = {
      'active': 'work',
      'clocked_out': 'work-off',
      'overtime': 'access-time',
    };
    return iconMap[status] || 'person';
  };

  const viewButtons = [
    { value: 'pending', label: 'Pending' },
    { value: 'team', label: 'Team Status' },
    { value: 'reports', label: 'Reports' },
  ];

  if (!currentUser || (currentUser.role !== 'supervisor' && currentUser.role !== 'admin')) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Icon name="security" size={48} color="#999" />
          <Title style={styles.accessDeniedTitle}>Access Denied</Title>
          <Paragraph style={styles.accessDeniedText}>
            You do not have supervisor privileges to access this dashboard.
          </Paragraph>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Title style={styles.title}>Supervisor Dashboard</Title>
        <Paragraph style={styles.welcomeText}>Welcome, {currentUser.name}</Paragraph>
      </View>

      <SegmentedButtons
        value={selectedView}
        onValueChange={setSelectedView}
        buttons={viewButtons}
        style={styles.viewButtons}
      />

      {/* Team Summary Card */}
      <Card style={styles.summaryCard}>
        <Card.Content>
          <Title style={styles.summaryTitle}>Team Overview</Title>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{teamSummary.totalEmployees}</Text>
              <Text style={styles.summaryLabel}>Total Employees</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
                {teamSummary.activeTodayCount}
              </Text>
              <Text style={styles.summaryLabel}>Active Today</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#FF9800' }]}>
                {teamSummary.pendingApprovalsCount}
              </Text>
              <Text style={styles.summaryLabel}>Pending</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#F44336' }]}>
                {teamSummary.overtimeEmployeesCount}
              </Text>
              <Text style={styles.summaryLabel}>Overtime</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {selectedView === 'pending' && (
          <View>
            {pendingApprovals.length > 0 ? (
              pendingApprovals.map((approval, index) => (
                <Card key={`${approval.userId}_${approval.date}`} style={styles.approvalCard}>
                  <Card.Content>
                    <View style={styles.approvalHeader}>
                      <View style={styles.approvalInfo}>
                        <Title style={styles.employeeName}>
                          {getEmployeeName(approval.userId)}
                        </Title>
                        <Paragraph style={styles.approvalDate}>
                          {format(parseISO(approval.date), 'EEEE, MMMM d, yyyy')}
                        </Paragraph>
                        <Text style={styles.approvalHours}>
                          Total Hours: {approval.totalHours.toFixed(1)}
                          {approval.totalHours > 8 && (
                            <Text style={styles.overtimeText}> (Overtime)</Text>
                          )}
                        </Text>
                      </View>
                      <Chip
                        icon="hourglass-empty"
                        style={styles.pendingChip}
                      >
                        Pending
                      </Chip>
                    </View>

                    <View style={styles.timecardSummary}>
                      <Text style={styles.timecardSummaryTitle}>Timecard Entries:</Text>
                      {approval.timecards.map(tc => (
                        <Text key={tc.id} style={styles.timecardEntry}>
                          • {format(parseISO(tc.timestamp), 'h:mm a')} - {tc.type.replace('_', ' ').toUpperCase()}
                          {tc.job && ` at ${tc.job.name}`}
                        </Text>
                      ))}
                    </View>

                    <View style={styles.approvalActions}>
                      <Button
                        mode="outlined"
                        onPress={() => rejectTimecard(approval)}
                        style={styles.rejectButton}
                        textColor="#F44336"
                      >
                        Reject
                      </Button>
                      <Button
                        mode="contained"
                        onPress={() => approveTimecard(approval)}
                        style={styles.approveButton}
                      >
                        Approve
                      </Button>
                    </View>
                  </Card.Content>
                </Card>
              ))
            ) : (
              <Card style={styles.emptyCard}>
                <Card.Content>
                  <View style={styles.emptyContent}>
                    <Icon name="check-circle" size={48} color="#4CAF50" />
                    <Title style={styles.emptyTitle}>All Caught Up!</Title>
                    <Paragraph style={styles.emptyText}>
                      No pending timecard approvals at this time.
                    </Paragraph>
                  </View>
                </Card.Content>
              </Card>
            )}
          </View>
        )}

        {selectedView === 'team' && (
          <View>
            {employeeList.map(employee => (
              <Card key={employee.id} style={styles.employeeCard}>
                <Card.Content>
                  <View style={styles.employeeHeader}>
                    <Avatar.Icon
                      size={40}
                      icon="person"
                      style={[styles.employeeAvatar, { backgroundColor: getStatusColor(employee.status) }]}
                    />
                    <View style={styles.employeeInfo}>
                      <Title style={styles.employeeNameTitle}>{employee.name}</Title>
                      <Paragraph style={styles.employeeEmail}>{employee.email}</Paragraph>
                      {employee.currentJob && (
                        <Text style={styles.currentJob}>📍 {employee.currentJob}</Text>
                      )}
                    </View>
                    <Chip
                      icon={getStatusIcon(employee.status)}
                      style={[styles.statusChip, { backgroundColor: getStatusColor(employee.status) + '20' }]}
                    >
                      {employee.status === 'active' ? 'Active' : 'Clocked Out'}
                    </Chip>
                  </View>

                  <View style={styles.employeeStats}>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>{employee.todayHours.toFixed(1)}h</Text>
                      <Text style={styles.statLabel}>Today</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={[
                        styles.statValue,
                        employee.weekHours > 40 && { color: '#F44336' }
                      ]}>
                        {employee.weekHours.toFixed(1)}h
                      </Text>
                      <Text style={styles.statLabel}>This Week</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statValue}>
                        {format(parseISO(employee.lastActivity), 'h:mm a')}
                      </Text>
                      <Text style={styles.statLabel}>Last Activity</Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>
            ))}
          </View>
        )}

        {selectedView === 'reports' && (
          <Card style={styles.reportsCard}>
            <Card.Content>
              <Title style={styles.reportsTitle}>Reports & Analytics</Title>
              
              <List.Item
                title="Weekly Team Summary"
                description="Hours breakdown for all team members"
                left={() => <Icon name="bar-chart" size={24} color="#6200EE" />}
                right={() => <Icon name="arrow-forward-ios" size={16} color="#666" />}
                onPress={() => Alert.alert('Reports', 'Weekly summary report coming soon!')}
              />
              
              <List.Item
                title="Overtime Report"
                description="Employees exceeding daily/weekly limits"
                left={() => <Icon name="schedule" size={24} color="#6200EE" />}
                right={() => <Icon name="arrow-forward-ios" size={16} color="#666" />}
                onPress={() => Alert.alert('Reports', 'Overtime report coming soon!')}
              />
              
              <List.Item
                title="Job Site Productivity"
                description="Hours and progress by location"
                left={() => <Icon name="location-on" size={24} color="#6200EE" />}
                right={() => <Icon name="arrow-forward-ios" size={16} color="#666" />}
                onPress={() => Alert.alert('Reports', 'Productivity report coming soon!')}
              />
              
              <List.Item
                title="Export All Data"
                description="Download CSV reports for payroll"
                left={() => <Icon name="download" size={24} color="#6200EE" />}
                right={() => <Icon name="arrow-forward-ios" size={16} color="#666" />}
                onPress={() => Alert.alert('Export', 'Data export feature coming soon!')}
              />
            </Card.Content>
          </Card>
        )}
      </ScrollView>

      <FAB
        icon="refresh"
        style={styles.fab}
        onPress={onRefresh}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6200EE',
  },
  welcomeText: {
    color: '#666',
    marginTop: 4,
  },
  viewButtons: {
    margin: 16,
    marginTop: 8,
  },
  summaryCard: {
    margin: 16,
    marginTop: 0,
    elevation: 4,
  },
  summaryTitle: {
    fontSize: 16,
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6200EE',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  approvalCard: {
    margin: 16,
    marginTop: 8,
    elevation: 2,
  },
  approvalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  approvalInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 18,
  },
  approvalDate: {
    color: '#666',
    marginTop: 4,
  },
  approvalHours: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    color: '#333',
  },
  overtimeText: {
    color: '#F44336',
  },
  pendingChip: {
    backgroundColor: '#FFF3E0',
  },
  timecardSummary: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
  },
  timecardSummaryTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  timecardEntry: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  approvalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  rejectButton: {
    borderColor: '#F44336',
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  employeeCard: {
    margin: 16,
    marginTop: 8,
    elevation: 2,
  },
  employeeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  employeeAvatar: {
    marginRight: 12,
  },
  employeeInfo: {
    flex: 1,
  },
  employeeNameTitle: {
    fontSize: 16,
  },
  employeeEmail: {
    color: '#666',
    fontSize: 14,
    marginTop: 2,
  },
  currentJob: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
  },
  statusChip: {
    marginLeft: 8,
  },
  employeeStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  reportsCard: {
    margin: 16,
    elevation: 2,
  },
  reportsTitle: {
    fontSize: 18,
    marginBottom: 8,
  },
  emptyCard: {
    margin: 16,
    elevation: 2,
  },
  emptyContent: {
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    marginTop: 16,
    color: '#4CAF50',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 8,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  accessDeniedTitle: {
    marginTop: 16,
    color: '#999',
  },
  accessDeniedText: {
    textAlign: 'center',
    color: '#666',
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#6200EE',
  },
});