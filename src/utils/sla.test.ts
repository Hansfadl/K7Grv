/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSlaWorkdays,
  addWorkdays,
  calculateDueDate,
  evaluateCaseSla,
  calculateSlaCompliance,
  SJI_COMPANY_HOLIDAYS,
  isNonWorkingDay
} from './sla';
import { GrievanceCase } from '../types';

test('SLA Matrix Resolution Time follows SJI Mandate (Minor: 3, Major: 7, Critical: 14 workdays)', () => {
  assert.equal(getSlaWorkdays('Minor'), 3, 'Minor priority must have 3 workdays SLA');
  assert.equal(getSlaWorkdays('Major'), 7, 'Major priority must have 7 workdays SLA');
  assert.equal(getSlaWorkdays('Critical'), 14, 'Critical priority must have 14 workdays SLA');
});

test('WORKDAY calculation correctly adds working days and skips weekends and corporate holidays', () => {
  // Monday 2026-03-02
  const startMonday = '2026-03-02';
  // 3 workdays -> Tue 03-03 (1), Wed 03-04 (2), Thu 03-05 (3)
  assert.equal(addWorkdays(startMonday, 3), '2026-03-05');

  // Thursday 2026-03-05
  // 3 workdays -> Fri 03-06 (1), Sat/Sun skipped, Mon 03-09 (2), Tue 03-10 (3)
  assert.equal(addWorkdays('2026-03-05', 3), '2026-03-10');

  // Major 7 workdays from Monday 2026-03-02 -> Wed 2026-03-11
  assert.equal(addWorkdays('2026-03-02', 7), '2026-03-11');

  // Critical 14 workdays from Monday 2026-03-02 -> Fri 2026-03-20
  assert.equal(addWorkdays('2026-03-02', 14), '2026-03-20');
});

test('Corporate Holiday is skipped during workday addition', () => {
  // 2026-04-30 is Thursday.
  // 2026-05-01 is Friday (Hari Buruh Internasional - SJI Holiday).
  // 2026-05-02 (Sat) & 2026-05-03 (Sun) are weekends.
  // Adding 1 workday from 2026-04-30 must land on Monday 2026-05-04!
  const due = addWorkdays('2026-04-30', 1);
  assert.equal(due, '2026-05-04', 'Must skip holiday on Friday May 1 and weekend, landing on Monday May 4');
});

// SECTION 4 SIMULATION SCENARIOS 1-9
const SIMULATION_BASE_DATE = '2026-03-02'; // Monday

test('Simulation 1: Minor selesai dalam 2 hari kerja -> On Time', () => {
  const dueDate = calculateDueDate(SIMULATION_BASE_DATE, 'Minor'); // 3 workdays: 2026-03-05
  const closingDate = addWorkdays(SIMULATION_BASE_DATE, 2); // 2 workdays: 2026-03-04

  const testCase = {
    id: 'sim-1',
    ticketId: 'SIM-01',
    dateReceived: SIMULATION_BASE_DATE,
    dueDate,
    closingDate,
    status: 'Closed',
    priority: 'Minor',
  } as GrievanceCase;

  const result = evaluateCaseSla(testCase);
  assert.equal(result.classification, 'On Time');
  assert.equal(result.isOnTime, true);
  assert.equal(result.isOverdue, false);
});

test('Simulation 2: Minor selesai dalam 4 hari kerja -> Overdue', () => {
  const dueDate = calculateDueDate(SIMULATION_BASE_DATE, 'Minor'); // 3 workdays: 2026-03-05
  const closingDate = addWorkdays(SIMULATION_BASE_DATE, 4); // 4 workdays: 2026-03-06

  const testCase = {
    id: 'sim-2',
    ticketId: 'SIM-02',
    dateReceived: SIMULATION_BASE_DATE,
    dueDate,
    closingDate,
    status: 'Closed',
    priority: 'Minor',
  } as GrievanceCase;

  const result = evaluateCaseSla(testCase);
  assert.equal(result.classification, 'Overdue');
  assert.equal(result.isOnTime, false);
  assert.equal(result.isOverdue, true);
});

test('Simulation 3: Major selesai dalam 6 hari kerja -> On Time', () => {
  const dueDate = calculateDueDate(SIMULATION_BASE_DATE, 'Major'); // 7 workdays: 2026-03-11
  const closingDate = addWorkdays(SIMULATION_BASE_DATE, 6); // 6 workdays: 2026-03-10

  const testCase = {
    id: 'sim-3',
    ticketId: 'SIM-03',
    dateReceived: SIMULATION_BASE_DATE,
    dueDate,
    closingDate,
    status: 'Closed',
    priority: 'Major',
  } as GrievanceCase;

  const result = evaluateCaseSla(testCase);
  assert.equal(result.classification, 'On Time');
  assert.equal(result.isOnTime, true);
  assert.equal(result.isOverdue, false);
});

test('Simulation 4: Major selesai dalam 8 hari kerja -> Overdue', () => {
  const dueDate = calculateDueDate(SIMULATION_BASE_DATE, 'Major'); // 7 workdays: 2026-03-11
  const closingDate = addWorkdays(SIMULATION_BASE_DATE, 8); // 8 workdays: 2026-03-12

  const testCase = {
    id: 'sim-4',
    ticketId: 'SIM-04',
    dateReceived: SIMULATION_BASE_DATE,
    dueDate,
    closingDate,
    status: 'Closed',
    priority: 'Major',
  } as GrievanceCase;

  const result = evaluateCaseSla(testCase);
  assert.equal(result.classification, 'Overdue');
  assert.equal(result.isOnTime, false);
  assert.equal(result.isOverdue, true);
});

test('Simulation 5: Critical selesai dalam 10 hari kerja -> On Time', () => {
  const dueDate = calculateDueDate(SIMULATION_BASE_DATE, 'Critical'); // 14 workdays: 2026-03-20
  const closingDate = addWorkdays(SIMULATION_BASE_DATE, 10); // 10 workdays: 2026-03-16

  const testCase = {
    id: 'sim-5',
    ticketId: 'SIM-05',
    dateReceived: SIMULATION_BASE_DATE,
    dueDate,
    closingDate,
    status: 'Closed',
    priority: 'Critical',
  } as GrievanceCase;

  const result = evaluateCaseSla(testCase);
  assert.equal(result.classification, 'On Time');
  assert.equal(result.isOnTime, true);
  assert.equal(result.isOverdue, false);
});

test('Simulation 6: Critical selesai dalam 15 hari kerja -> Overdue', () => {
  const dueDate = calculateDueDate(SIMULATION_BASE_DATE, 'Critical'); // 14 workdays: 2026-03-20
  const closingDate = addWorkdays(SIMULATION_BASE_DATE, 15); // 15 workdays: 2026-03-24

  const testCase = {
    id: 'sim-6',
    ticketId: 'SIM-06',
    dateReceived: SIMULATION_BASE_DATE,
    dueDate,
    closingDate,
    status: 'Closed',
    priority: 'Critical',
  } as GrievanceCase;

  const result = evaluateCaseSla(testCase);
  assert.equal(result.classification, 'Overdue');
  assert.equal(result.isOnTime, false);
  assert.equal(result.isOverdue, true);
});

test('Simulation 7: Kasus belum selesai dan belum melewati Due Date -> Pending', () => {
  const testCase = {
    id: 'sim-7',
    ticketId: 'SIM-07',
    dateReceived: '2026-03-02',
    dueDate: '2026-03-11',
    status: 'Investigation',
    priority: 'Major',
  } as GrievanceCase;

  // Evaluated on 2026-03-05 (which is <= dueDate 2026-03-11)
  const result = evaluateCaseSla(testCase, '2026-03-05');
  assert.equal(result.classification, 'Pending');
  assert.equal(result.isPending, true);
  assert.equal(result.isOnTime, false);
  assert.equal(result.isOverdue, false);
});

test('Simulation 8: Kasus belum selesai dan telah melewati Due Date -> Overdue', () => {
  const testCase = {
    id: 'sim-8',
    ticketId: 'SIM-08',
    dateReceived: '2026-03-02',
    dueDate: '2026-03-05',
    status: 'Open',
    priority: 'Minor',
  } as GrievanceCase;

  // Evaluated on 2026-03-09 (which is > dueDate 2026-03-05)
  const result = evaluateCaseSla(testCase, '2026-03-09');
  assert.equal(result.classification, 'Overdue');
  assert.equal(result.isOverdue, true);
  assert.equal(result.isOnTime, false);
  assert.equal(result.isPending, false);
});

test('Simulation 9: Kasus tanpa Due Date -> Data Incomplete (tidak otomatis On Time)', () => {
  const testCase = {
    id: 'sim-9',
    ticketId: 'SIM-09',
    dateReceived: '2026-03-02',
    dueDate: '',
    status: 'Investigation',
    priority: 'Major',
  } as GrievanceCase;

  const result = evaluateCaseSla(testCase, '2026-03-05');
  assert.equal(result.classification, 'Data Incomplete');
  assert.equal(result.isDataIncomplete, true);
  assert.equal(result.isOnTime, false);
  assert.equal(result.isOverdue, false);
  assert.equal(result.isPending, false);
});

test('SLA Compliance Formula: (On Time / (On Time + Overdue)) * 100%, Pending and Incomplete excluded', () => {
  const cases: GrievanceCase[] = [
    // 2 On Time
    { id: '1', dueDate: '2026-03-05', closingDate: '2026-03-04', status: 'Closed' } as GrievanceCase,
    { id: '2', dueDate: '2026-03-11', closingDate: '2026-03-11', status: 'Closed' } as GrievanceCase,
    // 1 Overdue (Closed)
    { id: '3', dueDate: '2026-03-05', closingDate: '2026-03-08', status: 'Closed' } as GrievanceCase,
    // 1 Overdue (Active)
    { id: '4', dueDate: '2026-03-05', status: 'Investigation' } as GrievanceCase,
    // 2 Pending
    { id: '5', dueDate: '2026-03-25', status: 'Open' } as GrievanceCase,
    { id: '6', dueDate: '2026-03-25', status: 'Investigation' } as GrievanceCase,
    // 1 Data Incomplete
    { id: '7', dueDate: '', status: 'Open' } as GrievanceCase,
  ];

  const summary = calculateSlaCompliance(cases, '2026-03-10');
  assert.equal(summary.total, 7);
  assert.equal(summary.onTime, 2);
  assert.equal(summary.overdue, 2); // 1 closed late + 1 active past due
  assert.equal(summary.pending, 2);
  assert.equal(summary.dataIncomplete, 1);
  assert.equal(summary.evaluableCount, 4); // 2 onTime + 2 overdue
  // Compliance Rate = (2 / (2 + 2)) * 100% = 50%
  assert.equal(summary.complianceRate, 50);
});

test('SLA Compliance 100% only appears when all evaluable cases are strictly On Time', () => {
  const allOnTimeCases: GrievanceCase[] = [
    { id: '1', dueDate: '2026-03-05', closingDate: '2026-03-04', status: 'Closed' } as GrievanceCase,
    { id: '2', dueDate: '2026-03-11', closingDate: '2026-03-10', status: 'Closed' } as GrievanceCase,
    // Pending case does not reduce compliance
    { id: '3', dueDate: '2026-03-25', status: 'Open' } as GrievanceCase,
  ];

  const summary = calculateSlaCompliance(allOnTimeCases, '2026-03-10');
  assert.equal(summary.complianceRate, 100, 'Compliance must be 100% when all evaluable cases are On Time');

  // If there are ONLY pending or data incomplete cases, compliance rate should be 0 (no evaluable cases completed/overdue)
  const onlyPendingCases: GrievanceCase[] = [
    { id: '1', dueDate: '2026-03-25', status: 'Open' } as GrievanceCase,
    { id: '2', dueDate: '', status: 'Open' } as GrievanceCase,
  ];
  const summaryPending = calculateSlaCompliance(onlyPendingCases, '2026-03-10');
  assert.equal(summaryPending.complianceRate, 0, 'No evaluable cases should yield 0%');
});
