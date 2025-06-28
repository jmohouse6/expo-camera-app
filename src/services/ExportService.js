import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { format, parseISO } from 'date-fns';

export class ExportService {
  static async exportTimecardData(timecards, options = {}) {
    try {
      const {
        format: exportFormat = 'csv',
        includePhotos = false,
        startDate = null,
        endDate = null,
        userId = null,
      } = options;

      // Filter timecards based on options
      let filteredTimecards = timecards;

      if (startDate) {
        filteredTimecards = filteredTimecards.filter(tc => parseISO(tc.date) >= startDate);
      }

      if (endDate) {
        filteredTimecards = filteredTimecards.filter(tc => parseISO(tc.date) <= endDate);
      }

      if (userId) {
        filteredTimecards = filteredTimecards.filter(tc => tc.userId === userId);
      }

      switch (exportFormat) {
        case 'csv':
          return await this.exportToCSV(filteredTimecards);
        case 'json':
          return await this.exportToJSON(filteredTimecards);
        case 'pdf':
          return await this.exportToPDF(filteredTimecards);
        default:
          throw new Error('Unsupported export format');
      }
    } catch (error) {
      throw new Error('Failed to export timecard data: ' + error.message);
    }
  }

  static async exportToCSV(timecards) {
    try {
      // Define CSV headers
      const headers = [
        'Date',
        'User ID',
        'Type',
        'Timestamp',
        'Job Site',
        'Task',
        'Latitude',
        'Longitude',
        'Status',
        'Hours Worked',
        'Regular Hours',
        'Overtime Hours',
        'Double Time Hours',
        'Photo Path',
      ];

      // Group timecards by date and user for daily summaries
      const dailySummaries = this.calculateDailySummaries(timecards);

      const csvRows = [headers.join(',')];

      // Add timecard entries
      timecards.forEach(tc => {
        const dailySummary = dailySummaries[`${tc.userId}_${tc.date}`] || {};
        
        const row = [
          tc.date,
          tc.userId || '',
          tc.type || '',
          tc.timestamp ? format(parseISO(tc.timestamp), 'yyyy-MM-dd HH:mm:ss') : '',
          tc.job?.name || '',
          tc.task?.name || '',
          tc.location?.latitude?.toFixed(6) || '',
          tc.location?.longitude?.toFixed(6) || '',
          tc.status || 'draft',
          dailySummary.totalHours?.toFixed(2) || '0.00',
          dailySummary.regularHours?.toFixed(2) || '0.00',
          dailySummary.overtimeHours?.toFixed(2) || '0.00',
          dailySummary.doubleTimeHours?.toFixed(2) || '0.00',
          tc.photo?.uri || '',
        ];

        // Escape commas and quotes in CSV
        const escapedRow = row.map(field => {
          const str = String(field);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        });

        csvRows.push(escapedRow.join(','));
      });

      const csvContent = csvRows.join('\n');
      const fileName = `timecard_export_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, csvContent);

      // Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Timecard Data',
        });
      }

      return {
        success: true,
        fileName,
        fileUri,
        recordCount: timecards.length,
      };
    } catch (error) {
      throw new Error('Failed to export CSV: ' + error.message);
    }
  }

  static async exportToJSON(timecards) {
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        recordCount: timecards.length,
        timecards: timecards.map(tc => ({
          ...tc,
          exportedAt: new Date().toISOString(),
        })),
        dailySummaries: this.calculateDailySummaries(timecards),
      };

      const jsonContent = JSON.stringify(exportData, null, 2);
      const fileName = `timecard_export_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.json`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, jsonContent);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Export Timecard Data',
        });
      }

      return {
        success: true,
        fileName,
        fileUri,
        recordCount: timecards.length,
      };
    } catch (error) {
      throw new Error('Failed to export JSON: ' + error.message);
    }
  }

  static async exportToPDF(timecards) {
    try {
      // For now, we'll export as HTML and let the user convert to PDF
      const htmlContent = this.generateHTMLReport(timecards);
      const fileName = `timecard_report_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.html`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, htmlContent);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/html',
          dialogTitle: 'Export Timecard Report',
        });
      }

      return {
        success: true,
        fileName,
        fileUri,
        recordCount: timecards.length,
      };
    } catch (error) {
      throw new Error('Failed to export PDF: ' + error.message);
    }
  }

  static calculateDailySummaries(timecards) {
    const summaries = {};

    // Group by user and date
    const groups = {};
    timecards.forEach(tc => {
      const key = `${tc.userId}_${tc.date}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(tc);
    });

    // Calculate hours for each group
    Object.keys(groups).forEach(key => {
      const dayTimecards = groups[key];
      const totalHours = this.calculateDayHours(dayTimecards);
      
      // Calculate overtime breakdown
      let regularHours = 0;
      let overtimeHours = 0;
      let doubleTimeHours = 0;

      if (totalHours > 12) {
        regularHours = 8;
        overtimeHours = 4; // hours 8-12
        doubleTimeHours = totalHours - 12; // hours 12+
      } else if (totalHours > 8) {
        regularHours = 8;
        overtimeHours = totalHours - 8; // hours 8-12
      } else {
        regularHours = totalHours;
      }

      summaries[key] = {
        date: dayTimecards[0].date,
        userId: dayTimecards[0].userId,
        totalHours,
        regularHours,
        overtimeHours,
        doubleTimeHours,
        entryCount: dayTimecards.length,
      };
    });

    return summaries;
  }

  static calculateDayHours(timecards) {
    let totalHours = 0;
    let clockInTime = null;
    let lunchOutTime = null;

    // Sort by timestamp
    const sortedTimecards = timecards.sort((a, b) => 
      new Date(a.timestamp) - new Date(b.timestamp)
    );

    for (const entry of sortedTimecards) {
      const entryTime = parseISO(entry.timestamp);

      switch (entry.type) {
        case 'clock_in':
          clockInTime = entryTime;
          break;
        case 'clock_out':
          if (clockInTime) {
            const hoursWorked = (entryTime - clockInTime) / (1000 * 60 * 60);
            totalHours += hoursWorked;
            clockInTime = null;
          }
          break;
        case 'lunch_out':
          lunchOutTime = entryTime;
          break;
        case 'lunch_in':
          if (lunchOutTime) {
            const lunchHours = (entryTime - lunchOutTime) / (1000 * 60 * 60);
            totalHours -= lunchHours; // Subtract lunch time
            lunchOutTime = null;
          }
          break;
      }
    }

    return Math.max(0, totalHours);
  }

  static generateHTMLReport(timecards) {
    const dailySummaries = this.calculateDailySummaries(timecards);
    const summaryArray = Object.values(dailySummaries);
    
    // Calculate totals
    const grandTotals = summaryArray.reduce((totals, day) => ({
      totalHours: totals.totalHours + day.totalHours,
      regularHours: totals.regularHours + day.regularHours,
      overtimeHours: totals.overtimeHours + day.overtimeHours,
      doubleTimeHours: totals.doubleTimeHours + day.doubleTimeHours,
    }), { totalHours: 0, regularHours: 0, overtimeHours: 0, doubleTimeHours: 0 });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Timecard Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #6200EE;
            padding-bottom: 20px;
        }
        .company-name {
            font-size: 24px;
            font-weight: bold;
            color: #6200EE;
        }
        .report-title {
            font-size: 18px;
            margin-top: 10px;
        }
        .report-date {
            color: #666;
            margin-top: 5px;
        }
        .summary-section {
            margin-bottom: 30px;
        }
        .summary-title {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 15px;
            color: #6200EE;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .summary-item {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            border: 1px solid #e9ecef;
        }
        .summary-value {
            font-size: 24px;
            font-weight: bold;
            color: #6200EE;
        }
        .summary-label {
            font-size: 14px;
            color: #666;
            margin-top: 5px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #6200EE;
            color: white;
            font-weight: bold;
        }
        tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
        .overtime {
            color: #FF9800;
            font-weight: bold;
        }
        .double-time {
            color: #F44336;
            font-weight: bold;
        }
        @media print {
            body { margin: 0; }
            .header { page-break-after: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="company-name">Timeclock App</div>
        <div class="report-title">Timecard Report</div>
        <div class="report-date">Generated on ${format(new Date(), 'MMMM d, yyyy \'at\' h:mm a')}</div>
    </div>

    <div class="summary-section">
        <div class="summary-title">Summary</div>
        <div class="summary-grid">
            <div class="summary-item">
                <div class="summary-value">${grandTotals.totalHours.toFixed(1)}</div>
                <div class="summary-label">Total Hours</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${grandTotals.regularHours.toFixed(1)}</div>
                <div class="summary-label">Regular Hours</div>
            </div>
            <div class="summary-item">
                <div class="summary-value overtime">${grandTotals.overtimeHours.toFixed(1)}</div>
                <div class="summary-label">Overtime Hours</div>
            </div>
            <div class="summary-item">
                <div class="summary-value double-time">${grandTotals.doubleTimeHours.toFixed(1)}</div>
                <div class="summary-label">Double Time Hours</div>
            </div>
        </div>
    </div>

    <div class="summary-section">
        <div class="summary-title">Daily Breakdown</div>
        <table>
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Total Hours</th>
                    <th>Regular Hours</th>
                    <th>Overtime Hours</th>
                    <th>Double Time Hours</th>
                    <th>Entries</th>
                </tr>
            </thead>
            <tbody>
                ${summaryArray.map(day => `
                    <tr>
                        <td>${format(parseISO(day.date), 'EEEE, MMM d, yyyy')}</td>
                        <td>${day.totalHours.toFixed(2)}</td>
                        <td>${day.regularHours.toFixed(2)}</td>
                        <td class="${day.overtimeHours > 0 ? 'overtime' : ''}">${day.overtimeHours.toFixed(2)}</td>
                        <td class="${day.doubleTimeHours > 0 ? 'double-time' : ''}">${day.doubleTimeHours.toFixed(2)}</td>
                        <td>${day.entryCount}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="footer">
        <p>This report complies with California Labor Law requirements for overtime tracking.</p>
        <p>Generated by Timeclock App - ${format(new Date(), 'yyyy')}</p>
    </div>
</body>
</html>`;
  }

  static async getExportDirectory() {
    try {
      const directory = FileSystem.documentDirectory + 'exports/';
      const dirInfo = await FileSystem.getInfoAsync(directory);
      
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      }
      
      return directory;
    } catch (error) {
      console.error('Error creating export directory:', error);
      return FileSystem.documentDirectory;
    }
  }

  static async cleanupOldExports(daysToKeep = 30) {
    try {
      const directory = await this.getExportDirectory();
      const files = await FileSystem.readDirectoryAsync(directory);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      let deletedCount = 0;
      for (const file of files) {
        const filePath = directory + file;
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        
        if (fileInfo.modificationTime && fileInfo.modificationTime < cutoffDate.getTime()) {
          try {
            await FileSystem.deleteAsync(filePath);
            deletedCount++;
          } catch (error) {
            console.warn('Could not delete old export file:', file);
          }
        }
      }

      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old exports:', error);
      return 0;
    }
  }
}