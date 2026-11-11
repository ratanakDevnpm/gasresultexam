export interface GasModuleFile {
  id: number;
  filename: string;
  layer: 'ENTRY_CONFIG' | 'DATA_VALIDATION' | 'SECURITY_AUDIT' | 'DOMAIN_SERVICES';
  summaryKh: string;
  summaryEn: string;
  exportedFunctions: string[];
  code: string;
}

export const GAS_BACKEND_MODULES: GasModuleFile[] = [
  {
    id: 1,
    filename: 'Code.gs',
    layer: 'ENTRY_CONFIG',
    summaryKh: 'ចំណុចចាប់ផ្តើម HtmlService Web App និងច្រកទ្វារ API សម្រាប់ google.script.run',
    summaryEn: 'HtmlService Web App entry point (doGet) and secure RPC dispatcher for google.script.run.',
    exportedFunctions: ['doGet', 'doPost', 'apiDispatch', 'includeHtmlPartial'],
    code: `/**
 * File 01: Code.gs
 * Teok Chor High School (វិទ្យាល័យទឹកជោរ) - Online Exam & Student Result Management System
 * Entry point for Google Apps Script HtmlService Web App, doPost Webhook & google.script.run RPC router
 */

function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  template.initialYear = AppConfig.DEFAULT_ACADEMIC_YEAR;
  template.schoolNameKh = AppConfig.SCHOOL_NAME_KH;
  return template
    .evaluate()
    .setTitle(AppConfig.SCHOOL_NAME_KH + ' - ប្រព័ន្ធប្រឡង និងគ្រប់គ្រងលទ្ធផលសិស្ស')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * HTTP POST Webhook entry point for external Web App synchronization (e.g., Bulk Student Excel Import)
 */
function doPost(e) {
  var rawBody = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
  var result = apiDispatch(rawBody);
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Central RPC entry point invoked by frontend via google.script.run or doPost
 * Enforces authentication, input validation, and structured error handling.
 */
function apiDispatch(requestJson) {
  var lock = LockService.getScriptLock();
  try {
    var req = JSON.parse(requestJson);
    Validation.assertRequiredFields(req, ['module', 'action']);

    var sessionUser = Authentication.verifySessionToken(req.token);
    var payload = req.payload || {};

    switch (req.module) {
      case 'Database':
        if (req.action === 'pingConnection' || req.action === 'readAll25Tables') {
          return Database.readAll25Tables();
        }
        if (req.action === 'readTable') {
          return Database.findAll(payload.tableKey);
        }
        if (req.action === 'createRecord') {
          lock.waitLock(15000);
          Authorization.verifyTableMutationPermission(sessionUser.UserID, payload.tableKey, 'CREATE', payload.record);
          Validation.assertPrimaryIdNotDuplicate(payload.tableKey, payload.record);
          Validation.assertForeignKeyRelationships(payload.tableKey, payload.record);
          return Database.insertRow(payload.tableKey, payload.record);
        }
        if (req.action === 'updateRecord') {
          lock.waitLock(15000);
          Authorization.verifyTableMutationPermission(sessionUser.UserID, payload.tableKey, 'UPDATE', payload.record);
          Validation.assertPrimaryIdNotDuplicate(payload.tableKey, payload.record, payload.primaryId);
          Validation.assertForeignKeyRelationships(payload.tableKey, payload.record);
          return Database.updateById(payload.tableKey, payload.primaryKeyField, payload.primaryId, payload.record);
        }
        if (req.action === 'deleteRecord') {
          lock.waitLock(15000);
          Authorization.verifyTableMutationPermission(sessionUser.UserID, payload.tableKey, 'DELETE', payload.record || {});
          return Database.deleteById(payload.tableKey, payload.primaryKeyField, payload.primaryId);
        }
        Authorization.requireRoles(sessionUser, ['SUPER_ADMIN']);
        if (req.action === 'initializeAll19Sheets' || req.action === 'initializeAll25Sheets') {
          lock.waitLock(15000);
          return Database.initializeAll19Sheets(sessionUser.UserID);
        }
        break;

      case 'QuestionService':
        return QuestionService.handleAction(sessionUser, req.action, payload);

      case 'ScoreService':
        return ScoreService.handleAction(sessionUser, req.action, payload);

      case 'ReportService':
        return ReportService.handleAction(sessionUser, req.action, payload);

      case 'StudentService':
        return StudentService.handleAction(sessionUser, req.action, payload);

      case 'StudentAccountService':
        return StudentAccountService.handleAction(sessionUser, req.action, payload);

      case 'ExaminationService':
        return ExaminationService.handleAction(sessionUser, req.action, payload);

      case 'TeacherService':
        return TeacherService.handleAction(sessionUser, req.action, payload);

      default:
        throw new Error('Unsupported API module: ' + req.module);
    }
  } catch (err) {
    return {
      ok: false,
      persisted: false,
      error: err && err.message ? err.message : String(err),
      timestamp: new Date().toISOString()
    };
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}`,
  },
  {
    id: 2,
    filename: 'Config.gs',
    layer: 'ENTRY_CONFIG',
    summaryKh: 'ការកំណត់ថេរប្រព័ន្ធ ឈ្មោះសន្លឹកទិន្នន័យទាំង ២៥ (១៩ Core + ៦ Extended) និងថតឯកសារ Google Drive',
    summaryEn: 'Centralized constants, 25 Sheet names (19 core + 6 extended), 17 official classes (7A-12C), and Drive folder IDs.',
    exportedFunctions: ['AppConfig', 'getSpreadsheetId', 'getDriveFolderId'],
    code: `/**
 * File 02: Config.gs
 * Centralized configuration for Teok Chor High School (វិទ្យាល័យទឹកជោរ) - 25 Sheets
 */

var AppConfig = {
  SCHOOL_NAME_KH: 'វិទ្យាល័យទឹកជោរ',
  DISTRICT_OFFICE_KH: 'ការិយាល័យអប់រំ យុវជន និងកីឡា ស្រុកព្រះនេត្រព្រះ',
  PROVINCIAL_DEPT_KH: 'មន្ទីរអប់រំ យុវជន និងកីឡា ខេត្តបន្ទាយមានជ័យ',
  DEFAULT_ACADEMIC_YEAR: '២០២៥-២០២៦',
  UNRANKED_SENTINEL: -1.72,
  OFFICIAL_CLASSES: [
    '7A', '7B', '7C',
    '8A', '8B', '8C',
    '9A', '9B',
    '10A', '10B', '10C',
    '11A', '11B', '11C',
    '12A', '12B', '12C'
  ],
  SHEETS: {
    USERS: 'Users',
    ROLES: 'Roles',
    ACADEMIC_YEARS: 'AcademicYears',
    SEMESTERS: 'Semesters',
    CLASSES: 'Classes',
    STUDENTS: 'Students',
    ENROLLMENTS: 'Enrollments',
    SUBJECTS: 'Subjects',
    TEACHER_ASSIGNMENTS: 'TeacherSubjectAssignments',
    EXAMS: 'Exams',
    QUESTIONS: 'Questions',
    EXAM_ATTEMPTS: 'ExamAttempts',
    EXAM_ANSWERS: 'ExamAnswers',
    MONTHLY_SCORES: 'MonthlyScores',
    SEMESTER_SCORES: 'SemesterScores',
    ANNUAL_RESULTS: 'AnnualResults',
    GRADING_SCALES: 'GradingScales',
    SYSTEM_SETTINGS: 'SystemSettings',
    AUDIT_LOGS: 'AuditLogs',
    HOMEROOM_ASSIGNMENTS: 'HomeroomTeacherAssignments',
    TEACHER_SPECIALIZATIONS: 'TeacherSpecializations',
    SCORE_ENTRY_LOCKS: 'ScoreEntryLocks',
    SCORE_SUBMISSIONS: 'ScoreSubmissions',
    SCORE_MODIFICATION_HISTORY: 'ScoreModificationHistory',
    SUBJECT_GRADE_RANGES: 'SubjectGradeRanges'
  }
};

function getSpreadsheetId() {
  return PropertiesService.getScriptProperties().getProperty('SPREADSHEET_DB_ID');
}

function getDriveFolderId(folderKey) {
  return PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_' + folderKey);
}`,
  },
  {
    id: 3,
    filename: 'Database.gs',
    layer: 'DATA_VALIDATION',
    summaryKh: 'ស្រទាប់គ្រប់គ្រងមូលដ្ឋានទិន្នន័យ Google Sheets ទាំង ២៥ សន្លឹក (Repository Pattern)',
    summaryEn: 'Modular repository abstraction over all 25 Google Sheets tables supporting CRUD and SQL-ready migration.',
    exportedFunctions: ['initializeAll19Sheets', 'readAll25Tables', 'findAll', 'findById', 'insertRow', 'updateById', 'deleteById', 'upsertRow'],
    code: `/**
 * File 03: Database.gs
 * Google Sheets Repository Layer (25 Sheets: 19 Core + 6 Extended)
 */

var Database = (function () {
  var SCHEMA_HEADERS = {
    Users: ['UserID','Username','Email','PasswordHash','PasswordSalt','FullNameKh','FullNameEn','Gender','Phone','RoleID','ProfileImageID','Status','CreatedAt','UpdatedAt','LastLoginAt'],
    Roles: ['RoleID','RoleName','Description','Status'],
    AcademicYears: ['AcademicYearID','AcademicYearName','StartDate','EndDate','IsCurrent','Status','CreatedAt'],
    Semesters: ['SemesterID','AcademicYearID','SemesterName','StartDate','EndDate','Status'],
    Classes: ['ClassID','ClassName','GradeLevel','AcademicYearID','HomeroomTeacherID','Status','CreatedAt'],
    Students: ['StudentID','StudentCode','LastNameKh','FirstNameKh','FullNameKh','FamilyNameEn','GivenNameEn','Gender','DateOfBirth','Phone','BirthVillage','BirthCommune','BirthDistrict','BirthProvince','FatherLastNameKh','FatherFirstNameKh','FatherOccupation','MotherLastNameKh','MotherFirstNameKh','MotherOccupation','CurrentVillage','CurrentCommune','CurrentDistrict','CurrentProvince','OrphanStatus','DisabilityStatus','PovertyLevel','PreviousSchool','ProfileImageID','StudentStatus','Remarks','CreatedAt','UpdatedAt'],
    Enrollments: ['EnrollmentID','StudentID','ClassID','AcademicYearID','PreviousClass','IsNewTransfer','IsRepeater','ExamRoom','DeskNumber','ExamSession','EnrollmentDate','EnrollmentStatus','Remarks'],
    Subjects: ['SubjectID','SubjectCode','SubjectNameKh','SubjectNameEn','GradeLevel','Coefficient','MaximumScore','Status','CreatedAt'],
    TeacherSubjectAssignments: ['AssignmentID','TeacherID','SubjectID','ClassID','AcademicYearID','AssignedByUserID','AssignedAt','Status'],
    Exams: ['ExamID','ExamTitle','SubjectID','ClassID','AcademicYearID','SemesterID','ExamType','ExamMonth','StartDateTime','EndDateTime','DurationMinutes','MaximumScore','PassScore','AttemptLimit','Instructions','CreatedByUserID','Status','CreatedAt','UpdatedAt'],
    Questions: ['QuestionID','SubjectID','QuestionText','QuestionType','OptionsJSON','CorrectAnswerJSON','Points','DifficultyLevel','ImageFileID','CreatedByUserID','UpdatedByUserID','Status','CreatedAt','UpdatedAt'],
    ExamAttempts: ['AttemptID','ExamID','StudentID','AttemptNumber','StartedAt','SubmittedAt','ServerDeadline','AttemptStatus','TotalScore','CreatedAt'],
    ExamAnswers: ['AnswerID','AttemptID','QuestionID','StudentID','AnswerJSON','ScoreAwarded','IsCorrect','SavedAt','GradedByUserID','GradedAt'],
    MonthlyScores: ['MonthlyScoreID','StudentID','ClassID','SubjectID','AcademicYearID','Month','AssessmentType','Score','MaximumScore','AverageScore','Ranking','Grade','IsPass','IsHonorRoll','EnteredByUserID','ApprovedByUserID','Status','CreatedAt','UpdatedAt'],
    SemesterScores: ['SemesterScoreID','StudentID','ClassID','SubjectID','AcademicYearID','SemesterID','MonthlyAverage','ExamScore','TotalScore','MaximumScore','AverageScore','Grade','Ranking','Status','CalculatedAt'],
    AnnualResults: ['AnnualResultID','StudentID','ClassID','SubjectID','AcademicYearID','AnnualTotal','AnnualAverage','Grade','Ranking','IsHonorRoll','ResultStatus','PublishedAt'],
    GradingScales: ['GradingScaleID','ScaleName','MinimumScore','MaximumScore','Grade','Description','AcademicYearID','Status'],
    SystemSettings: ['SettingID','SettingKey','SettingValue','SettingGroup','Description','UpdatedByUserID','UpdatedAt'],
    AuditLogs: ['LogID','UserID','Action','Module','RecordID','OldValueJSON','NewValueJSON','Timestamp','IPOrSessionReference','Description'],
    HomeroomTeacherAssignments: ['AssignmentID','TeacherID','ClassID','RoomNumber','AcademicYearID','RoleTitleKh','ResponsibilitiesJSON','Status','AssignedAt'],
    TeacherSpecializations: ['SpecializationID','TeacherID','SubjectID','DegreeLevel','SpecializationNotes','IsPrimarySubject'],
    ScoreEntryLocks: ['LockID','AcademicYearID','ClassID','PeriodType','PeriodLabel','IsLocked','LockedByUserID','LockedAt','UnlockReason'],
    ScoreSubmissions: ['SubmissionID','AcademicYearID','ClassID','SubjectID','TeacherID','PeriodType','PeriodLabel','StudentCount','SubmittedCount','Status','SubmittedAt'],
    ScoreModificationHistory: ['ModificationID','ScoreID','StudentID','ClassID','SubjectID','PeriodLabel','OldScore','NewScore','Reason','ModifiedByUserID','ModifiedAt'],
    SubjectGradeRanges: ['SlotID','SubjectID','GradeLevel','MaxScore','GradeSymbol','MinScore','MaxRangeScore','MentionKh','MentionEn','ColorBadge']
  };

  function getSpreadsheet() {
    var id = getSpreadsheetId();
    return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  }

  function initializeAll19Sheets(actorUserId) {
    var ss = getSpreadsheet();
    var created = [];
    Object.keys(SCHEMA_HEADERS).forEach(function (sheetName) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        created.push(sheetName);
      }
      var headers = SCHEMA_HEADERS[sheetName];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      sheet.setFrozenRows(1);
    });
    AuditLog.record(actorUserId, 'INITIALIZE_25_SHEETS', 'Database', 'ALL', {}, { created: created }, 'Verified all 25 Google Sheets schemas.');
    return { ok: true, totalSheets: 25, newlyCreated: created };
  }

  function readAll25Tables() {
    var state = {};
    Object.keys(SCHEMA_HEADERS).forEach(function (sheetName) {
      state[sheetName] = findAll(sheetName);
    });
    return { ok: true, persisted: true, data: state };
  }

  function findAll(sheetName) {
    var sheet = getSpreadsheet().getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return [];
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    return data.slice(1).map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) { obj[h] = row[i]; });
      return obj;
    });
  }

  function findById(sheetName, primaryKeyField, primaryId) {
    var rows = findAll(sheetName);
    return rows.filter(function (r) { return String(r[primaryKeyField]) === String(primaryId); })[0] || null;
  }

  function insertRow(sheetName, recordObj) {
    var sheet = getSpreadsheet().getSheetByName(sheetName);
    var headers = SCHEMA_HEADERS[sheetName];
    var row = headers.map(function (h) {
      return recordObj[h] !== undefined ? recordObj[h] : '';
    });
    sheet.appendRow(row);
    return recordObj;
  }

  function updateById(sheetName, primaryKeyField, primaryId, patchObj) {
    var sheet = getSpreadsheet().getSheetByName(sheetName);
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var pkCol = headers.indexOf(primaryKeyField);
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][pkCol]) === String(primaryId)) {
        var updatedRow = headers.map(function (h, c) {
          return patchObj[h] !== undefined ? patchObj[h] : data[r][c];
        });
        sheet.getRange(r + 1, 1, 1, headers.length).setValues([updatedRow]);
        return patchObj;
      }
    }
    throw new Error('Record not found in ' + sheetName + ': ' + primaryId);
  }

  function deleteById(sheetName, primaryKeyField, primaryId) {
    var sheet = getSpreadsheet().getSheetByName(sheetName);
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var pkCol = headers.indexOf(primaryKeyField);
    for (var r = 1; r < data.length; r++) {
      if (String(data[r][pkCol]) === String(primaryId)) {
        sheet.deleteRow(r + 1);
        return { ok: true, deletedId: primaryId };
      }
    }
    throw new Error('Record not found in ' + sheetName + ': ' + primaryId);
  }

  function upsertRow(sheetName, primaryKeyField, recordObj) {
    var existing = findById(sheetName, primaryKeyField, recordObj[primaryKeyField]);
    if (existing) {
      return updateById(sheetName, primaryKeyField, recordObj[primaryKeyField], recordObj);
    }
    return insertRow(sheetName, recordObj);
  }

  return {
    initializeAll19Sheets: initializeAll19Sheets,
    readAll25Tables: readAll25Tables,
    findAll: findAll,
    findById: findById,
    insertRow: insertRow,
    updateById: updateById,
    deleteById: deleteById,
    upsertRow: upsertRow
  };
})();`,
  },
  {
    id: 4,
    filename: 'Validation.gs',
    layer: 'DATA_VALIDATION',
    summaryKh: 'ការត្រួតពិនិត្យទិន្នន័យបញ្ចូល ការពារ Primary ID ស្ទួន និងពិនិត្យ Foreign Key លើ Server',
    summaryEn: 'Validates required fields, Primary ID uniqueness, Foreign Key references, score boundaries, and 17-class names.',
    exportedFunctions: ['assertRequiredFields', 'assertPrimaryIdNotDuplicate', 'assertForeignKeyRelationships', 'validateScoreRange', 'validateClassName'],
    code: `/**
 * File 04: Validation.gs
 * Server-side data validation, duplicate Primary ID prevention, and Foreign Key checks
 */

var Validation = (function () {
  var PRIMARY_KEY_MAP = {
    Users: 'UserID', Roles: 'RoleID', AcademicYears: 'AcademicYearID', Semesters: 'SemesterID',
    Classes: 'ClassID', Students: 'StudentID', Enrollments: 'EnrollmentID', Subjects: 'SubjectID',
    TeacherSubjectAssignments: 'AssignmentID', Exams: 'ExamID', Questions: 'QuestionID',
    ExamAttempts: 'AttemptID', ExamAnswers: 'AnswerID', MonthlyScores: 'MonthlyScoreID',
    SemesterScores: 'SemesterScoreID', AnnualResults: 'AnnualResultID', GradingScales: 'GradingScaleID',
    SystemSettings: 'SettingID', AuditLogs: 'LogID', HomeroomTeacherAssignments: 'AssignmentID',
    TeacherSpecializations: 'SpecializationID', ScoreEntryLocks: 'LockID',
    ScoreSubmissions: 'SubmissionID', ScoreModificationHistory: 'ModificationID', SubjectGradeRanges: 'SlotID'
  };

  function assertRequiredFields(obj, fields) {
    if (!obj || typeof obj !== 'object') {
      throw new Error('Invalid payload object.');
    }
    fields.forEach(function (field) {
      if (obj[field] === undefined || obj[field] === null || String(obj[field]).trim() === '') {
        throw new Error('Missing required field: ' + field);
      }
    });
  }

  function assertPrimaryIdNotDuplicate(tableKey, record, ignorePrimaryId) {
    var pkField = PRIMARY_KEY_MAP[tableKey];
    if (!pkField) return true;
    var candidateId = String(record[pkField] || '').trim();
    if (!candidateId) throw new Error('Missing Primary ID ' + pkField + ' for ' + tableKey);
    var existingRows = Database.findAll(tableKey);
    var dup = existingRows.filter(function (r) {
      var id = String(r[pkField] || '').trim();
      return id === candidateId && id !== String(ignorePrimaryId || '').trim();
    })[0];
    if (dup) {
      throw new Error('Duplicate Primary ID in ' + tableKey + ': ' + pkField + '=' + candidateId);
    }
    if (tableKey === 'TeacherSubjectAssignments') {
      var comboDup = existingRows.filter(function (a) {
        if (ignorePrimaryId && String(a.AssignmentID) === String(ignorePrimaryId)) return false;
        return String(a.TeacherID) === String(record.TeacherID) &&
               String(a.SubjectID) === String(record.SubjectID) &&
               String(a.AcademicYearID) === String(record.AcademicYearID);
      })[0];
      if (comboDup) {
        throw new Error('Duplicate TeacherSubjectAssignment for TeacherID + SubjectID + AcademicYearID.');
      }
    }
    return true;
  }

  function assertForeignKeyRelationships(tableKey, record) {
    if (record.ClassID && record.ClassID !== 'ALL') {
      var cls = Database.findById('Classes', 'ClassID', record.ClassID);
      if (!cls) throw new Error('Invalid Foreign Key ClassID: ' + record.ClassID);
    }
    if (record.SubjectID && record.SubjectID !== 'ALL') {
      var sub = Database.findById('Subjects', 'SubjectID', record.SubjectID);
      if (!sub) throw new Error('Invalid Foreign Key SubjectID: ' + record.SubjectID);
    }
    return true;
  }

  function validateScoreRange(score, maxScore, allowUnrankedSentinel) {
    if (allowUnrankedSentinel && Number(score) === AppConfig.UNRANKED_SENTINEL) {
      return true;
    }
    var num = Number(score);
    if (isNaN(num) || num < 0 || num > maxScore) {
      throw new Error('Score must be between 0 and ' + maxScore + ' (or -1.72 for unranked).');
    }
    return true;
  }

  function validateClassName(className) {
    if (AppConfig.OFFICIAL_CLASSES.indexOf(className) === -1) {
      throw new Error('Invalid class name: ' + className + '. Must be one of the 17 Teok Chor High School classes.');
    }
    return true;
  }

  return {
    assertRequiredFields: assertRequiredFields,
    assertPrimaryIdNotDuplicate: assertPrimaryIdNotDuplicate,
    assertForeignKeyRelationships: assertForeignKeyRelationships,
    validateScoreRange: validateScoreRange,
    validateClassName: validateClassName
  };
})();`,
  },
  {
    id: 5,
    filename: 'Authentication.gs',
    layer: 'SECURITY_AUDIT',
    summaryKh: 'ការផ្ទៀងផ្ទាត់អត្តសញ្ញាណគណនី SHA-256 + Salt និងការគ្រប់គ្រង Session',
    summaryEn: 'Salted SHA-256 password hashing, login verification, and CacheService session tokens.',
    exportedFunctions: ['login', 'verifySessionToken', 'hashPasswordWithSalt'],
    code: `/**
 * File 05: Authentication.gs
 * Authentication & CacheService session management
 */

var Authentication = (function () {
  function hashPasswordWithSalt(rawPassword, salt) {
    var digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      rawPassword + '::' + salt,
      Utilities.Charset.UTF_8
    );
    return digest.map(function (b) {
      var v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? '0' + v : v;
    }).join('');
  }

  function login(username, password) {
    Validation.assertRequiredFields({ username: username, password: password }, ['username', 'password']);
    var users = Database.findAll(AppConfig.SHEETS.USERS);
    var user = users.filter(function (u) {
      return u.Username === username && u.Status === 'ACTIVE';
    })[0];

    if (!user) {
      throw new Error('ឈ្មោះគណនី ឬលេខសម្ងាត់មិនត្រឹមត្រូវ។');
    }

    var computedHash = hashPasswordWithSalt(password, user.PasswordSalt);
    if (computedHash !== user.PasswordHash) {
      AuditLog.record(user.UserID, 'LOGIN_FAILED', 'Authentication', user.UserID, {}, {}, 'Invalid password attempt');
      throw new Error('ឈ្មោះគណនី ឬលេខសម្ងាត់មិនត្រឹមត្រូវ។');
    }

    var token = Utilities.getUuid();
    CacheService.getScriptCache().put('SESSION_' + token, JSON.stringify({
      UserID: user.UserID,
      RoleID: user.RoleID,
      FullNameKh: user.FullNameKh
    }), 21600);

    return { ok: true, token: token, userId: user.UserID, fullNameKh: user.FullNameKh };
  }

  function verifySessionToken(token) {
    var raw = CacheService.getScriptCache().get('SESSION_' + token);
    if (!raw) throw new Error('Session expired or unauthorized.');
    return JSON.parse(raw);
  }

  return {
    login: login,
    verifySessionToken: verifySessionToken,
    hashPasswordWithSalt: hashPasswordWithSalt
  };
})();`,
  },
  {
    id: 6,
    filename: 'Authorization.gs',
    layer: 'SECURITY_AUDIT',
    summaryKh: 'គោលការណ៍សន្តិសុខមជ្ឈិម ការរឹតបន្តឹងគ្រូតាមមុខវិជ្ជា និង canManageQuestion(userId, questionId, action)',
    summaryEn: 'Enforces RBAC across 5 roles, Teacher Subject restriction on backend, and mandatory Question Ownership (SubjectID + CreatedByUserID).',
    exportedFunctions: ['canManageQuestion', 'verifyTableMutationPermission', 'requireRoles', 'canAccessClassScores'],
    code: `/**
 * File 06: Authorization.gs
 * Centralized RBAC, Backend Teacher Subject Restriction & Mandatory Teacher Question Ownership Policy
 * NEVER trusts CreatedByUserID or permission flags sent from the frontend.
 */

var Authorization = (function () {
  function getUserRoleName(userId) {
    var users = Database.findAll(AppConfig.SHEETS.USERS);
    var roles = Database.findAll(AppConfig.SHEETS.ROLES);
    var user = users.filter(function (u) { return u.UserID === userId && u.Status === 'ACTIVE'; })[0];
    if (!user) return null;
    var role = roles.filter(function (r) { return r.RoleID === user.RoleID; })[0];
    return role ? role.RoleName : null;
  }

  function verifyTableMutationPermission(userId, tableKey, action, record) {
    var roleName = getUserRoleName(userId);
    if (!roleName) throw new Error('Unauthorized: Active user not found.');
    if (roleName === 'SUPER_ADMIN' || roleName === 'ADMIN') return true;
    if (roleName === 'VIEWER') throw new Error('Forbidden: VIEWER is read-only.');
    if (roleName === 'TEACHER') {
      var assignments = Database.findAll(AppConfig.SHEETS.TEACHER_ASSIGNMENTS).filter(function (a) {
        return a.TeacherID === userId && a.Status === 'ACTIVE';
      });
      var assignedSubjectIds = assignments.map(function (a) { return a.SubjectID; });
      if (record && record.SubjectID && record.SubjectID !== 'ALL') {
        if (assignedSubjectIds.indexOf(record.SubjectID) === -1) {
          throw new Error('Forbidden: Teacher ' + userId + ' is restricted to assigned subjects only.');
        }
      }
      return true;
    }
    return true;
  }

  /**
   * Mandatory Teacher Question Ownership Policy:
   * Validates BOTH SubjectID assignment AND CreatedByUserID ownership on the backend.
   */
  function canManageQuestion(userId, questionId, action, targetSubjectIdForCreate) {
    var roleName = getUserRoleName(userId);
    if (!roleName) {
      return { allowed: false, reason: 'Active user not found.' };
    }

    if (roleName === 'SUPER_ADMIN' || roleName === 'ADMIN') {
      return { allowed: true, role: roleName, reason: 'Admin global privilege.' };
    }

    if (roleName !== 'TEACHER') {
      return { allowed: false, role: roleName, reason: 'Role ' + roleName + ' cannot manage Question Bank.' };
    }

    var assignments = Database.findAll(AppConfig.SHEETS.TEACHER_ASSIGNMENTS).filter(function (a) {
      return a.TeacherID === userId && a.Status === 'ACTIVE';
    });
    var assignedSubjectIds = assignments.map(function (a) { return a.SubjectID; });

    if (action === 'CREATE') {
      var isAssigned = assignedSubjectIds.indexOf(targetSubjectIdForCreate) !== -1;
      return {
        allowed: isAssigned,
        role: roleName,
        reason: isAssigned
          ? 'Teacher is actively assigned to SubjectID=' + targetSubjectIdForCreate
          : 'Denied: Teacher is not assigned to SubjectID=' + targetSubjectIdForCreate
      };
    }

    var questions = Database.findAll(AppConfig.SHEETS.QUESTIONS);
    var question = questions.filter(function (q) {
      return q.QuestionID === questionId && q.Status !== 'DELETED';
    })[0];

    if (!question) {
      return { allowed: false, role: roleName, reason: 'Question not found.' };
    }

    var hasSubject = assignedSubjectIds.indexOf(question.SubjectID) !== -1;
    var isOwner = question.CreatedByUserID === userId;

    if (!hasSubject || !isOwner) {
      AuditLog.record(
        userId,
        'SECURITY_DENIED_' + action,
        'Authorization.canManageQuestion',
        questionId,
        { questionOwner: question.CreatedByUserID, subjectId: question.SubjectID },
        { attemptedBy: userId },
        'Blocked unauthorized teacher question access.'
      );
      return {
        allowed: false,
        role: roleName,
        reason: 'Denied: Requires both active SubjectID assignment and CreatedByUserID===' + userId
      };
    }

    return { allowed: true, role: roleName, reason: 'Verified SubjectID + CreatedByUserID ownership.' };
  }

  return {
    getUserRoleName: getUserRoleName,
    verifyTableMutationPermission: verifyTableMutationPermission,
    canManageQuestion: canManageQuestion
  };
})();`,
  },
  {
    id: 7,
    filename: 'AuditLog.gs',
    layer: 'SECURITY_AUDIT',
    summaryKh: 'កំណត់ហេតុសវនកម្មសន្តិសុខ និងការកែប្រែទិន្នន័យ (Sheet 19: AuditLogs)',
    summaryEn: 'Writes immutable audit trail entries to Sheet 19 (AuditLogs).',
    exportedFunctions: ['record', 'listRecentLogs'],
    code: `/**
 * File 07: AuditLog.gs
 * Appends immutable security & mutation logs to Sheet 19: AuditLogs
 */

var AuditLog = (function () {
  function record(userId, action, moduleName, recordId, oldVal, newVal, description) {
    var entry = {
      LogID: 'LOG-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
      UserID: userId || 'ANONYMOUS',
      Action: action,
      Module: moduleName,
      RecordID: recordId || '',
      OldValueJSON: JSON.stringify(oldVal || {}),
      NewValueJSON: JSON.stringify(newVal || {}),
      Timestamp: new Date().toISOString(),
      IPOrSessionReference: Session.getTemporaryActiveUserKey() || 'GAS-EXEC',
      Description: description || ''
    };
    Database.insertRow(AppConfig.SHEETS.AUDIT_LOGS, entry);
    return entry;
  }

  return { record: record };
})();`,
  },
  {
    id: 8,
    filename: 'UserService.gs',
    layer: 'DOMAIN_SERVICES',
    summaryKh: 'សេវាគ្រប់គ្រងគណនីអ្នកប្រើប្រាស់ និងតួនាទីទាំង ៥ (Sheets 1 & 2)',
    summaryEn: 'Manages Users and Roles (SUPER_ADMIN, ADMIN, TEACHER, STUDENT, VIEWER).',
    exportedFunctions: ['createUser', 'listUsersByRole', 'setUserStatus'],
    code: `/**
 * File 08: UserService.gs
 * Manages Sheet 1 (Users) and Sheet 2 (Roles)
 */

var UserService = (function () {
  function createUser(actorUserId, payload) {
    Validation.assertRequiredFields(payload, ['Username', 'FullNameKh', 'RoleID', 'RawPassword']);
    var salt = 'SALT-' + Utilities.getUuid().slice(0, 8);
    var hash = Authentication.hashPasswordWithSalt(payload.RawPassword, salt);
    var now = new Date().toISOString();

    var record = {
      UserID: 'USR-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
      Username: payload.Username,
      Email: payload.Email || '',
      PasswordHash: hash,
      PasswordSalt: salt,
      FullNameKh: payload.FullNameKh,
      FullNameEn: payload.FullNameEn || '',
      Gender: payload.Gender || 'ប្រុស',
      Phone: payload.Phone || '',
      RoleID: payload.RoleID,
      ProfileImageID: payload.ProfileImageID || '',
      Status: 'ACTIVE',
      CreatedAt: now,
      UpdatedAt: now,
      LastLoginAt: ''
    };
    Database.insertRow(AppConfig.SHEETS.USERS, record);
    AuditLog.record(actorUserId, 'CREATE_USER', 'UserService', record.UserID, {}, { Username: record.Username, RoleID: record.RoleID }, 'Created user account');
    return record;
  }

  return { createUser: createUser };
})();`,
  },
  {
    id: 9,
    filename: 'AcademicService.gs',
    layer: 'DOMAIN_SERVICES',
    summaryKh: 'សេវាគ្រប់គ្រងឆ្នាំសិក្សា ឆមាស និងថ្នាក់រៀនទាំង ១៧ (Sheets 3, 4, 5)',
    summaryEn: 'Manages AcademicYears (2025-2026, 2026-2027), Semesters, and the 17 Classes (7A-12C).',
    exportedFunctions: ['listAcademicYears', 'listClassesByYear', 'assignHomeroomTeacher'],
    code: `/**
 * File 09: AcademicService.gs
 * Manages Sheet 3 (AcademicYears), Sheet 4 (Semesters), and Sheet 5 (Classes: 7A-12C)
 */

var AcademicService = (function () {
  function listClassesByYear(academicYearId) {
    return Database.findAll(AppConfig.SHEETS.CLASSES).filter(function (c) {
      return c.AcademicYearID === academicYearId && c.Status === 'ACTIVE';
    });
  }

  function seedAll17Classes(actorUserId, academicYearId, defaultHomeroomMap) {
    var now = new Date().toISOString();
    return AppConfig.OFFICIAL_CLASSES.map(function (className) {
      var grade = className.replace(/[A-C]/g, '');
      var record = {
        ClassID: 'CLS-' + className,
        ClassName: className,
        GradeLevel: grade,
        AcademicYearID: academicYearId,
        HomeroomTeacherID: (defaultHomeroomMap && defaultHomeroomMap[className]) || '',
        Status: 'ACTIVE',
        CreatedAt: now
      };
      Database.insertRow(AppConfig.SHEETS.CLASSES, record);
      return record;
    });
  }

  return {
    listClassesByYear: listClassesByYear,
    seedAll17Classes: seedAll17Classes
  };
})();`,
  },
  {
    id: 10,
    filename: 'StudentService.gs',
    layer: 'DOMAIN_SERVICES',
    summaryKh: 'សេវាគ្រប់គ្រងសិស្ស និងបញ្ជីសិស្សសរុប ៣៦ ជួរឈរ (Sheets 6 & 7)',
    summaryEn: 'Manages Students & Enrollments and imports/exports the 36-Column Master Roster (បញ្ជីសិស្សឈ្មោះសិស្សសរុប).',
    exportedFunctions: [
      'registerStudentWithEnrollment',
      'bulkImportStudentsToGoogleSheets',
      'import36ColumnMasterRoster',
      'getStudentsByClass',
    ],
    code: `/**
 * File 10: StudentService.gs
 * Manages Sheet 6 (Students) & Sheet 7 (Enrollments) aligned with the 36-Column Master Roster
 */

var StudentService = (function () {
  function registerStudentWithEnrollment(actorUserId, studentPayload, enrollmentPayload) {
    Validation.assertRequiredFields(studentPayload, ['StudentCode', 'LastNameKh', 'FirstNameKh', 'Gender', 'DateOfBirth']);
    Validation.assertRequiredFields(enrollmentPayload, ['ClassID', 'AcademicYearID']);

    var now = new Date().toISOString();
    var studentId = 'STD-' + studentPayload.StudentCode;
    var fullNameKh = (studentPayload.LastNameKh + ' ' + studentPayload.FirstNameKh).trim();

    var studentRecord = {
      StudentID: studentId,
      StudentCode: studentPayload.StudentCode,
      LastNameKh: studentPayload.LastNameKh,
      FirstNameKh: studentPayload.FirstNameKh,
      FullNameKh: fullNameKh,
      FamilyNameEn: studentPayload.FamilyNameEn || '',
      GivenNameEn: studentPayload.GivenNameEn || '',
      Gender: studentPayload.Gender,
      DateOfBirth: studentPayload.DateOfBirth,
      Phone: studentPayload.Phone || '',
      BirthVillage: studentPayload.BirthVillage || '',
      BirthCommune: studentPayload.BirthCommune || '',
      BirthDistrict: studentPayload.BirthDistrict || 'ព្រះនេត្រព្រះ',
      BirthProvince: studentPayload.BirthProvince || 'បន្ទាយមានជ័យ',
      FatherLastNameKh: studentPayload.FatherLastNameKh || '',
      FatherFirstNameKh: studentPayload.FatherFirstNameKh || '',
      FatherOccupation: studentPayload.FatherOccupation || 'កសិករ',
      MotherLastNameKh: studentPayload.MotherLastNameKh || '',
      MotherFirstNameKh: studentPayload.MotherFirstNameKh || '',
      MotherOccupation: studentPayload.MotherOccupation || 'កសិករ',
      CurrentVillage: studentPayload.CurrentVillage || '',
      CurrentCommune: studentPayload.CurrentCommune || '',
      CurrentDistrict: studentPayload.CurrentDistrict || 'ព្រះនេត្រព្រះ',
      CurrentProvince: studentPayload.CurrentProvince || 'បន្ទាយមានជ័យ',
      OrphanStatus: studentPayload.OrphanStatus || 'NONE',
      DisabilityStatus: studentPayload.DisabilityStatus || 'NONE',
      PovertyLevel: studentPayload.PovertyLevel || 'NONE',
      PreviousSchool: studentPayload.PreviousSchool || '',
      ProfileImageID: studentPayload.ProfileImageID || '',
      StudentStatus: 'កំពុងរៀន',
      Remarks: studentPayload.Remarks || '',
      CreatedAt: now,
      UpdatedAt: now
    };

    Database.insertRow(AppConfig.SHEETS.STUDENTS, studentRecord);
    return studentRecord;
  }

  /**
   * Bulk imports 36-column Excel/CSV student rows directly into Google Sheets:
   * - Sheet 6: Students
   * - Sheet 7: Enrollments
   * - Sheet 14: MonthlyScores
   * - Sheet 16: AnnualResults
   * - Sheet 1: Users (auto-provisioned StudentCode account if enabled)
   * - Sheet 19: AuditLogs
   */
  function bulkImportStudentsToGoogleSheets(actorUserId, payload) {
    var lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      var rows = payload.rows || [];
      var academicYearId = payload.academicYearId || 'AY-2025-2026';
      var autoProvisionAccounts = payload.autoProvisionAccounts !== false;
      var createdCount = 0;
      var provisionedCount = 0;

      rows.forEach(function (r) {
        var studentPayload = {
          StudentCode: String(r.studentCode).trim(),
          LastNameKh: r.lastNameKh,
          FirstNameKh: r.firstNameKh,
          FamilyNameEn: r.familyNameEn,
          GivenNameEn: r.givenNameEn,
          Gender: r.gender,
          DateOfBirth: r.dateOfBirth,
          Phone: r.phone,
          BirthVillage: r.birthVillage,
          BirthCommune: r.birthCommune,
          BirthDistrict: r.birthDistrict,
          BirthProvince: r.birthProvince,
          FatherLastNameKh: r.fatherLastNameKh,
          FatherFirstNameKh: r.fatherFirstNameKh,
          FatherOccupation: r.fatherOccupation,
          MotherLastNameKh: r.motherLastNameKh,
          MotherFirstNameKh: r.motherFirstNameKh,
          MotherOccupation: r.motherOccupation,
          CurrentVillage: r.currentVillage,
          CurrentCommune: r.currentCommune,
          CurrentDistrict: r.currentDistrict,
          CurrentProvince: r.currentProvince,
          OrphanStatus: r.orphanStatus,
          DisabilityStatus: r.disabilityStatus,
          PovertyLevel: r.povertyLevel,
          PreviousSchool: r.previousSchool,
          Remarks: r.remarks
        };
        var enrollmentPayload = {
          ClassID: r.classId,
          AcademicYearID: academicYearId
        };
        var st = registerStudentWithEnrollment(actorUserId, studentPayload, enrollmentPayload);
        createdCount++;
        if (autoProvisionAccounts && typeof StudentAccountService !== 'undefined') {
          StudentAccountService.provisionSingleStudentAccount(st.StudentID);
          provisionedCount++;
        }
      });

      AuditLog.record(
        actorUserId,
        'BULK_IMPORT_STUDENTS_EXCEL',
        'StudentService',
        'BATCH-' + createdCount,
        {},
        { importedCount: createdCount, provisionedAccounts: provisionedCount },
        'Synced ' + createdCount + ' students from Excel template into Google Sheets'
      );

      return {
        ok: true,
        syncedCount: createdCount,
        provisionedAccountsCount: provisionedCount,
        updatedSheets: ['Students', 'Enrollments', 'MonthlyScores', 'AnnualResults', 'Users', 'AuditLogs']
      };
    } finally {
      if (lock.hasLock()) lock.releaseLock();
    }
  }

  function handleAction(sessionUser, action, payload) {
    if (action === 'bulkImportStudentsToGoogleSheets') {
      return bulkImportStudentsToGoogleSheets(sessionUser ? sessionUser.UserID : 'USR-ADM-01', payload);
    }
    throw new Error('Unsupported StudentService action: ' + action);
  }

  return {
    registerStudentWithEnrollment: registerStudentWithEnrollment,
    bulkImportStudentsToGoogleSheets: bulkImportStudentsToGoogleSheets,
    handleAction: handleAction
  };
})();`,
  },
  {
    id: 11,
    filename: 'SubjectService.gs',
    layer: 'DOMAIN_SERVICES',
    summaryKh: 'សេវាគ្រប់គ្រងមុខវិជ្ជា មេគុណ និងពិន្ទុអតិបរមា (Sheet 8: Subjects)',
    summaryEn: 'Manages curriculum subjects, grade coefficients (មេគុណមុខវិជ្ជា), and maximum scores.',
    exportedFunctions: ['createSubject', 'listSubjectsByGrade'],
    code: `/**
 * File 11: SubjectService.gs
 * Manages Sheet 8 (Subjects) including MoEYS subject coefficients (មេគុណមុខវិជ្ជា)
 */

var SubjectService = (function () {
  function listSubjectsByGrade(gradeLevel) {
    return Database.findAll(AppConfig.SHEETS.SUBJECTS).filter(function (s) {
      return String(s.GradeLevel) === String(gradeLevel) && s.Status === 'ACTIVE';
    });
  }

  return { listSubjectsByGrade: listSubjectsByGrade };
})();`,
  },
  {
    id: 12,
    filename: 'TeacherAssignmentService.gs',
    layer: 'DOMAIN_SERVICES',
    summaryKh: 'សេវាចាត់តាំងគ្រូបង្រៀនតាមមុខវិជ្ជា និងថ្នាក់រៀន (Sheet 9)',
    summaryEn: 'Manages TeacherSubjectAssignments used by Authorization.canManageQuestion and ScoreService.',
    exportedFunctions: ['assignTeacherToSubjectAndClass', 'getTeacherAssignments'],
    code: `/**
 * File 12: TeacherAssignmentService.gs
 * Manages Sheet 9 (TeacherSubjectAssignments)
 */

var TeacherAssignmentService = (function () {
  function assignTeacherToSubjectAndClass(adminUserId, teacherId, subjectId, classId, academicYearId) {
    var record = {
      AssignmentID: 'ASN-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
      TeacherID: teacherId,
      SubjectID: subjectId,
      ClassID: classId,
      AcademicYearID: academicYearId,
      AssignedByUserID: adminUserId,
      AssignedAt: new Date().toISOString(),
      Status: 'ACTIVE'
    };
    Database.insertRow(AppConfig.SHEETS.TEACHER_ASSIGNMENTS, record);
    AuditLog.record(adminUserId, 'ASSIGN_TEACHER', 'TeacherAssignmentService', record.AssignmentID, {}, record, 'Assigned teacher to subject and class');
    return record;
  }

  return { assignTeacherToSubjectAndClass: assignTeacherToSubjectAndClass };
})();`,
  },
  {
    id: 13,
    filename: 'QuestionService.gs',
    layer: 'DOMAIN_SERVICES',
    summaryKh: 'សេវាគ្រប់គ្រងធនាគារសំណួរ ដោយบังคับប្រើ canManageQuestion(userId, questionId, action)',
    summaryEn: 'Question Bank CRUD enforcing strict server-side CreatedByUserID + SubjectID ownership.',
    exportedFunctions: ['createQuestion', 'updateQuestion', 'deleteQuestion', 'listAuthorizedQuestions'],
    code: `/**
 * File 13: QuestionService.gs
 * Manages Sheet 11 (Questions) with strict server-side ownership enforcement:
 * Calls Authorization.canManageQuestion(userId, questionId, action) on every operation.
 */

var QuestionService = (function () {
  function createQuestion(sessionUser, payload) {
    Validation.assertRequiredFields(payload, ['SubjectID', 'QuestionText', 'QuestionType', 'Points']);
    var perm = Authorization.canManageQuestion(sessionUser.UserID, null, 'CREATE', payload.SubjectID);
    if (!perm.allowed) {
      throw new Error(perm.reason);
    }

    var now = new Date().toISOString();
    // Server strictly overwrites CreatedByUserID with sessionUser.UserID (never trusts client payload)
    var record = {
      QuestionID: 'QST-' + Utilities.getUuid().slice(0, 8).toUpperCase(),
      SubjectID: payload.SubjectID,
      QuestionText: payload.QuestionText,
      QuestionType: payload.QuestionType,
      OptionsJSON: payload.OptionsJSON || '[]',
      CorrectAnswerJSON: payload.CorrectAnswerJSON || '{}',
      Points: Number(payload.Points),
      DifficultyLevel: payload.DifficultyLevel || 'MEDIUM',
      ImageFileID: payload.ImageFileID || '',
      CreatedByUserID: sessionUser.UserID,
      UpdatedByUserID: sessionUser.UserID,
      Status: 'ACTIVE',
      CreatedAt: now,
      UpdatedAt: now
    };

    Database.insertRow(AppConfig.SHEETS.QUESTIONS, record);
    AuditLog.record(sessionUser.UserID, 'CREATE_QUESTION', 'QuestionService', record.QuestionID, {}, { SubjectID: record.SubjectID, CreatedByUserID: record.CreatedByUserID }, 'Created question with verified teacher ownership.');
    return { ok: true, question: record };
  }

  function mutateQuestion(sessionUser, questionId, action, updatePayload) {
    var perm = Authorization.canManageQuestion(sessionUser.UserID, questionId, action);
    if (!perm.allowed) {
      throw new Error(perm.reason);
    }
    AuditLog.record(sessionUser.UserID, action + '_QUESTION', 'QuestionService', questionId, {}, updatePayload || {}, 'Authorized question mutation.');
    return { ok: true, questionId: questionId, action: action };
  }

  return {
    createQuestion: createQuestion,
    mutateQuestion: mutateQuestion
  };
})();`,
  },
  {
    id: 14,
    filename: 'ExaminationService.gs',
    layer: 'DOMAIN_SERVICES',
    summaryKh: 'សេវាប្រឡងអនឡាញ ការផ្ទៀងផ្ទាត់សិទ្ធិសិស្សតាមថ្នាក់ ម៉ោងប្រឡង ServerDeadline និងការកែពិន្ទុស្វ័យប្រវត្តិ (Sheets 10, 12, 13)',
    summaryEn: 'Enforces backend student exam access validation, class isolation, start/end time & duration checks, duplicate submission prevention, and result publication rules.',
    exportedFunctions: ['validateStudentExamAccess', 'startExamAttempt', 'submitExamAnswers', 'getQuestionsForStudentExam'],
    code: `/**
 * File 14: ExaminationService.gs
 * Manages Sheet 10 (Exams), Sheet 12 (ExamAttempts), and Sheet 13 (ExamAnswers)
 * Enforces backend access control: Student ID, Class assignment, Start/End time,
 * Duration (ServerDeadline), AttemptLimit, and Result Publication privacy.
 */

var ExaminationService = (function () {
  function validateStudentExamAccess(studentId, examId) {
    var student = Database.findById(AppConfig.SHEETS.STUDENTS, 'StudentID', studentId);
    if (!student || student.Status !== 'ACTIVE') {
      throw new Error('សិស្សមិនមានសិទ្ធិចូលប្រឡងឡើយ (Invalid or inactive Student ID).');
    }
    var enrollment = Database.findAll(AppConfig.SHEETS.ENROLLMENTS).filter(function (e) {
      return e.StudentID === student.StudentID && e.EnrollmentStatus === 'ENROLLED';
    })[0];
    var classId = enrollment ? enrollment.ClassID : student.CurrentClassID;
    var exam = Database.findById(AppConfig.SHEETS.EXAMS, 'ExamID', examId);
    if (!exam || exam.Status !== 'PUBLISHED') {
      throw new Error('វិញ្ញាសាប្រឡងនេះមិនទាន់ដាក់ឱ្យប្រើប្រាស់ឡើយ។');
    }
    var assignedClasses = exam.ClassIDs && exam.ClassIDs.length ? exam.ClassIDs : [exam.ClassID];
    if (assignedClasses.indexOf(classId) === -1) {
      throw new Error('បដិសេធសិទ្ធិ៖ វិញ្ញាសានេះមិនមែនសម្រាប់ថ្នាក់រៀនរបស់អ្នកឡើយ។');
    }
    var nowMs = new Date().getTime();
    var startMs = new Date(exam.StartDateTime).getTime();
    var endMs = new Date(exam.EndDateTime).getTime();
    if (nowMs < startMs) {
      throw new Error('មិនទាន់ដល់ម៉ោងប្រឡង៖ វិញ្ញាសានេះនឹងបើកនៅម៉ោងកំណត់។');
    }
    if (nowMs > endMs) {
      throw new Error('ផុតកំណត់ម៉ោងប្រឡង៖ វិញ្ញាសានេះត្រូវបានបិទ។');
    }
    var attempts = Database.findAll(AppConfig.SHEETS.EXAM_ATTEMPTS).filter(function (a) {
      return a.ExamID === examId && a.StudentID === student.StudentID;
    });
    var submittedCount = attempts.filter(function (a) {
      return a.AttemptStatus === 'SUBMITTED' || a.AttemptStatus === 'GRADED' || a.AttemptStatus === 'EXPIRED';
    }).length;
    if (submittedCount >= (exam.AttemptLimit || 1)) {
      throw new Error('អ្នកបានដាក់ស្នើវិញ្ញាសានេះរួចរាល់ហើយ (Duplicate submission prevented).');
    }
    return { student: student, exam: exam, classId: classId, attempts: attempts };
  }

  function startExamAttempt(studentId, examId) {
    var access = validateStudentExamAccess(studentId, examId);
    var now = new Date();
    var deadline = new Date(now.getTime() + access.exam.DurationMinutes * 60000);
    var attempt = {
      AttemptID: Utilities.getUuid(),
      ExamID: examId,
      StudentID: access.student.StudentID,
      AttemptNumber: access.attempts.length + 1,
      StartedAt: now.toISOString(),
      SubmittedAt: '',
      ServerDeadline: deadline.toISOString(),
      AttemptStatus: 'IN_PROGRESS',
      TotalScore: 0,
      CreatedAt: now.toISOString()
    };
    Database.insertRow(AppConfig.SHEETS.EXAM_ATTEMPTS, attempt);
    return { attempt: attempt, questions: getQuestionsForStudentExam(examId) };
  }

  function submitExamAnswers(studentId, examId, attemptId, answersPayload) {
    var attempt = Database.findById(AppConfig.SHEETS.EXAM_ATTEMPTS, 'AttemptID', attemptId);
    if (!attempt || attempt.StudentID !== studentId || attempt.ExamID !== examId) {
      throw new Error('Invalid exam attempt session.');
    }
    if (attempt.AttemptStatus !== 'IN_PROGRESS') {
      throw new Error('វិញ្ញាសានេះត្រូវបានដាក់ស្នើរួចហើយ។');
    }
    var nowMs = new Date().getTime();
    var deadlineMs = new Date(attempt.ServerDeadline).getTime();
    if (nowMs > deadlineMs + 30000) {
      throw new Error('ផុតកំណត់រយៈពេលប្រឡង (Exceeded configured examination duration).');
    }
    // Save answers and keep score hidden until teacher publishes results (GRADED)
    return { ok: true, status: 'SUBMITTED', resultsPublished: false };
  }

  function getQuestionsForStudentExam(examId) {
    var exam = Database.findById(AppConfig.SHEETS.EXAMS, 'ExamID', examId);
    var questions = Database.findAll(AppConfig.SHEETS.QUESTIONS).filter(function (q) {
      if (q.Status !== 'ACTIVE') return false;
      if (exam && exam.QuestionIDs && exam.QuestionIDs.length > 0) {
        return exam.QuestionIDs.indexOf(q.QuestionID) !== -1;
      }
      return exam ? q.SubjectID === exam.SubjectID : true;
    });
    // Security: Strip CorrectAnswerJSON prior to result publication
    return questions.map(function (q) {
      return {
        QuestionID: q.QuestionID,
        SubjectID: q.SubjectID,
        QuestionText: q.QuestionText,
        QuestionType: q.QuestionType,
        OptionsJSON: q.OptionsJSON,
        Points: q.Points,
        ImageFileID: q.ImageFileID
      };
    });
  }

  return {
    validateStudentExamAccess: validateStudentExamAccess,
    startExamAttempt: startExamAttempt,
    submitExamAnswers: submitExamAnswers,
    getQuestionsForStudentExam: getQuestionsForStudentExam
  };
})();`,
  },
  {
    id: 15,
    filename: 'ScoreService.gs',
    layer: 'DOMAIN_SERVICES',
    summaryKh: 'សេវាគណនាពិន្ទុ មធ្យមភាគ ចំណាត់ថ្នាក់ស្ទួន (1, 2, 3, 4, 5, 6, 6, 8) និង "មិនចាត់ថ្នាក់" (-1.72)',
    summaryEn: 'Calculates Monthly, Semester, and Annual averages, competition tie-rankings, Grades (A-F), and Top 5 Honor Roll.',
    exportedFunctions: ['calculateClassMonthlyRanking', 'calculateAnnualResults', 'computeMoEYSGrade'],
    code: `/**
 * File 15: ScoreService.gs
 * Manages Sheet 14 (MonthlyScores), Sheet 15 (SemesterScores), Sheet 16 (AnnualResults), Sheet 17 (GradingScales)
 * Supports standard competition tie-ranking (1, 2, 3, 4, 5, 6, 6, 8) and -1.72 "មិនចាត់ថ្នាក់" sentinel.
 */

var ScoreService = (function () {
  function computeMoEYSGrade(avg50) {
    if (avg50 === null || avg50 === undefined || isNaN(avg50) || Number(avg50) < 0) {
      return 'មិនចាត់ថ្នាក់';
    }
    var n = Number(avg50);
    if (n >= 45) return 'A';
    if (n >= 40) return 'B';
    if (n >= 35) return 'C';
    if (n >= 30) return 'D';
    if (n >= 25) return 'E';
    return 'F';
  }

  function rankClassScores(scoreRows) {
    var validSorted = scoreRows
      .filter(function (r) { return r.AverageScore !== null && Number(r.AverageScore) >= 0; })
      .map(function (r) { return Number(Number(r.AverageScore).toFixed(2)); })
      .sort(function (a, b) { return b - a; });

    return scoreRows.map(function (row) {
      var avg = Number(row.AverageScore);
      if (isNaN(avg) || avg < 0) {
        row.Ranking = null;
        row.Grade = 'មិនចាត់ថ្នាក់';
        row.IsPass = 'មិនចាត់ថ្នាក់';
        row.IsHonorRoll = false;
        return row;
      }
      var rounded = Number(avg.toFixed(2));
      var rank = validSorted.indexOf(rounded) + 1;
      row.Ranking = rank;
      row.Grade = computeMoEYSGrade(rounded);
      row.IsPass = rounded >= 25.0 ? 'ជាប់មធ្យមភាគ' : 'ធ្លាក់មធ្យមភាគ';
      row.IsHonorRoll = rank >= 1 && rank <= 5;
      return row;
    });
  }

  return {
    computeMoEYSGrade: computeMoEYSGrade,
    rankClassScores: rankClassScores
  };
})();`,
  },
  {
    id: 16,
    filename: 'ReportService.gs',
    layer: 'DOMAIN_SERVICES',
    summaryKh: 'សេវារៀបចំរបាយការណ៍ផ្លូវការទាំង ៥ ទម្រង់របស់វិទ្យាល័យទឹកជោរ (បញ្ជីរាយនាម តារាងចំណាត់ថ្នាក់ តារាងកិត្តិយស)',
    summaryEn: 'Generates data models for the 5 official Teok Chor High School printable reports (including ក. female prefix and 1-35 / 36-70 split).',
    exportedFunctions: ['buildClassRosterReport', 'buildTwoColumnRankingReport', 'buildHonorRollTop5Report'],
    code: `/**
 * File 16: ReportService.gs
 * Formats official printable Khmer reports for Teok Chor High School (វិទ្យាល័យទឹកជោរ):
 * 1. Master 36-Column Student Roster (បញ្ជីសិស្សឈ្មោះសិស្សសរុប)
 * 2. Class Student Roster (គម្រូបញ្ជីរាយនាមតាមថ្នាក់) with age 11-20, orphan, disability, poverty summary
 * 3. Monthly & Annual Ranking Tables in 2-column split (1-35 and 36-70) with prefix "ក." for female students
 * 4. Monthly & Annual Honor Roll Boards (តារាងកិត្តិយសប្រចាំខែ និងប្រចាំឆ្នាំ - Top 5 pyramid with Drive photos)
 */

var ReportService = (function () {
  function formatFemalePrefixForRanking(lastNameKh, firstNameKh, gender) {
    var full = (lastNameKh + ' ' + firstNameKh).trim();
    return gender === 'ស្រី' ? 'ក.' + full : full;
  }

  function splitTwoColumns1To35And36To70(rankedRows) {
    var left = [];
    var right = [];
    for (var i = 1; i <= 35; i++) {
      left.push({ slot: i, data: rankedRows[i - 1] || null });
    }
    for (var j = 36; j <= 70; j++) {
      right.push({ slot: j, data: rankedRows[j - 1] || null });
    }
    return { leftColumn: left, rightColumn: right };
  }

  return {
    formatFemalePrefixForRanking: formatFemalePrefixForRanking,
    splitTwoColumns1To35And36To70: splitTwoColumns1To35And36To70
  };
})();`,
  },
  {
    id: 17,
    filename: 'SettingsService.gs',
    layer: 'DOMAIN_SERVICES',
    summaryKh: 'សេវាគ្រប់គ្រងអត្តសញ្ញាណសាលា នាយកសាលា និងកាលបរិច្ឆេទចន្ទគតិ/សុរិយគតិ (Sheet 18)',
    summaryEn: 'Manages SystemSettings (School Name, District/Provincial headers, Principal name, Lunar/Solar date strings).',
    exportedFunctions: ['getAllSettingsMap', 'updateSystemSetting'],
    code: `/**
 * File 17: SettingsService.gs
 * Manages Sheet 18 (SystemSettings) for official report headers and school configuration
 */

var SettingsService = (function () {
  function getAllSettingsMap() {
    var rows = Database.findAll(AppConfig.SHEETS.SYSTEM_SETTINGS);
    var map = {};
    rows.forEach(function (r) { map[r.SettingKey] = r.SettingValue; });
    return map;
  }

  return { getAllSettingsMap: getAllSettingsMap };
})();`,
  },
  {
    id: 18,
    filename: 'StudentAccountService.gs',
    layer: 'SECURITY_AUDIT',
    summaryKh: 'សេវាបង្កើតគណនីសិស្សស្វ័យប្រវត្តិ (Username = អត្តលេខសិស្ស) និងកំណត់លេខសម្ងាត់ស្តង់ដារដោយ SHA-256 + Salt',
    summaryEn: 'Automated bulk & single student account provisioning (Username = StudentCode) and SHA-256 + Salt default password initialization.',
    exportedFunctions: [
      'provisionSingleStudentAccount',
      'provisionAllStudentAccounts',
      'resetStudentPasswordToDefault',
    ],
    code: `/**
 * File 18: StudentAccountService.gs
 * Automated Student Account Setup & Password Initialization for Teok Chor High School (វិទ្យាល័យទឹកជោរ)
 * - Username / Login ID: StudentCode (អត្តលេខ, e.g., 6463, 6386, 5187)
 * - Default Password: Hashed via SHA-256(defaultPassword + PasswordSalt) — NEVER stores plaintext passwords
 * - Role Assignment: STUDENT (ROL-04)
 * - Status: ACTIVE
 */

var StudentAccountService = (function () {
  var DEFAULT_STUDENT_PASSWORD = 'TeokChor@2026';
  var STUDENT_ROLE_ID = 'ROL-04';

  function computeSha256Hex(rawPassword, salt) {
    var digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(rawPassword) + String(salt),
      Utilities.Charset.UTF_8
    );
    return digest.map(function (b) {
      var v = (b < 0 ? b + 256 : b).toString(16);
      return v.length === 1 ? '0' + v : v;
    }).join('');
  }

  /**
   * 1. provisionSingleStudentAccount(studentId)
   * Fetches student details from Students sheet using StudentID, checks if a user account exists
   * in Users linked to StudentCode, generates PasswordSalt + SHA-256 PasswordHash, and inserts into Users.
   */
  function provisionSingleStudentAccount(studentId, defaultPassword, overwriteExisting) {
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var passwordToUse = defaultPassword || DEFAULT_STUDENT_PASSWORD;
      var students = Database.findAll(AppConfig.SHEETS.STUDENTS);
      var student = students.filter(function (s) { return s.StudentID === studentId; })[0];
      if (!student) {
        throw new Error('Student not found for StudentID=' + studentId);
      }

      var users = Database.findAll(AppConfig.SHEETS.USERS);
      var studentCode = String(student.StudentCode).trim();
      var existing = users.filter(function (u) {
        return String(u.Username) === studentCode || String(u.Username) === 'student.' + studentCode;
      })[0];

      if (existing && !overwriteExisting) {
        return {
          ok: true,
          status: 'SKIPPED',
          studentCode: studentCode,
          userId: existing.UserID,
          message: 'Student account already exists for StudentCode ' + studentCode
        };
      }

      var nowIso = new Date().toISOString();
      var salt = 'SALT-STD-' + studentCode + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
      var hash = computeSha256Hex(passwordToUse, salt);
      var fullNameKh = ((student.LastNameKh || '') + ' ' + (student.FirstNameKh || '')).trim() || student.FullNameKh;
      var fullNameEn = ((student.FamilyNameEn || '') + ' ' + (student.GivenNameEn || '')).trim() || ('STUDENT ' + studentCode);

      var userRow = {
        UserID: existing ? existing.UserID : ('USR-STD-' + studentCode),
        Username: studentCode,
        Email: student.Email || ('student_' + studentCode + '@teokchor.edu.kh'),
        PasswordHash: hash,
        PasswordSalt: salt,
        FullNameKh: fullNameKh,
        FullNameEn: fullNameEn,
        Gender: student.Gender || 'ប្រុស',
        Phone: student.Phone || '',
        RoleID: STUDENT_ROLE_ID,
        ProfileImageID: student.ProfileImageID || '',
        Status: 'ACTIVE',
        CreatedAt: existing ? existing.CreatedAt : nowIso,
        UpdatedAt: nowIso,
        LastLoginAt: nowIso
      };

      Database.upsertRow(AppConfig.SHEETS.USERS, 'UserID', userRow);
      return {
        ok: true,
        status: existing ? 'UPDATED' : 'CREATED',
        studentCode: studentCode,
        userId: userRow.UserID,
        username: userRow.Username,
        passwordSalt: salt,
        passwordHash: hash
      };
    } finally {
      if (lock.hasLock()) lock.releaseLock();
    }
  }

  /**
   * 2. provisionAllStudentAccounts(academicYearId, classId)
   * Batch-processes all active students enrolled in a specific class (e.g., 12C, 7A) or across the school.
   * Uses batched getValues() / setValues() and LockService to prevent race conditions.
   */
  function provisionAllStudentAccounts(academicYearId, classId, defaultPassword) {
    var lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      var passwordToUse = defaultPassword || DEFAULT_STUDENT_PASSWORD;
      var students = Database.findAll(AppConfig.SHEETS.STUDENTS);
      var enrollments = Database.findAll(AppConfig.SHEETS.ENROLLMENTS);
      var users = Database.findAll(AppConfig.SHEETS.USERS);

      var enrolledSet = {};
      enrollments.forEach(function (enr) {
        if ((!academicYearId || enr.AcademicYearID === academicYearId) &&
            (!classId || classId === 'ALL' || enr.ClassID === classId)) {
          enrolledSet[enr.StudentID] = true;
        }
      });

      var existingByCode = {};
      users.forEach(function (u) {
        existingByCode[String(u.Username)] = u;
        existingByCode[String(u.Username).replace(/^student\\./, '')] = u;
      });

      var totalProcessed = 0;
      var successfullyCreated = 0;
      var skipped = 0;
      var errors = 0;
      var newRowsToAppend = [];
      var nowIso = new Date().toISOString();

      students.forEach(function (st) {
        if (classId && classId !== 'ALL' && !enrolledSet[st.StudentID]) return;
        if (st.StudentStatus && st.StudentStatus !== 'កំពុងរៀន') return;
        totalProcessed++;

        try {
          var code = String(st.StudentCode).trim();
          if (existingByCode[code]) {
            skipped++;
            return;
          }
          var salt = 'SALT-STD-' + code + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
          var hash = computeSha256Hex(passwordToUse, salt);
          var fullNameKh = ((st.LastNameKh || '') + ' ' + (st.FirstNameKh || '')).trim() || st.FullNameKh;
          var fullNameEn = ((st.FamilyNameEn || '') + ' ' + (st.GivenNameEn || '')).trim() || ('STUDENT ' + code);

          newRowsToAppend.push([
            'USR-STD-' + code,
            code,
            'student_' + code + '@teokchor.edu.kh',
            hash,
            salt,
            fullNameKh,
            fullNameEn,
            st.Gender || 'ប្រុស',
            st.Phone || '',
            STUDENT_ROLE_ID,
            st.ProfileImageID || '',
            'ACTIVE',
            nowIso,
            nowIso,
            nowIso
          ]);
          successfullyCreated++;
        } catch (err) {
          errors++;
        }
      });

      if (newRowsToAppend.length > 0) {
        var usersSheet = SpreadsheetApp.openById(getSpreadsheetId()).getSheetByName(AppConfig.SHEETS.USERS);
        var startRow = usersSheet.getLastRow() + 1;
        usersSheet.getRange(startRow, 1, newRowsToAppend.length, newRowsToAppend[0].length).setValues(newRowsToAppend);
      }

      AuditService.logAction('SYSTEM', 'BULK_PROVISION_STUDENT_ACCOUNTS', 'StudentAccountService.gs', classId || 'ALL', {}, {
        totalProcessed: totalProcessed,
        successfullyCreated: successfullyCreated,
        skipped: skipped,
        errors: errors
      });

      return {
        ok: true,
        totalProcessed: totalProcessed,
        successfullyCreated: successfullyCreated,
        skippedAlreadyExists: skipped,
        errors: errors
      };
    } finally {
      if (lock.hasLock()) lock.releaseLock();
    }
  }

  /**
   * 3. resetStudentPasswordToDefault(userId, adminToken)
   * Resets a specific student's password back to the default school password and logs in AuditLogs.
   */
  function resetStudentPasswordToDefault(userId, adminToken, defaultPassword) {
    var sessionAdmin = Authentication.verifySessionToken(adminToken);
    Authorization.requireRoles(sessionAdmin, ['SUPER_ADMIN', 'ADMIN']);

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var passwordToUse = defaultPassword || DEFAULT_STUDENT_PASSWORD;
      var users = Database.findAll(AppConfig.SHEETS.USERS);
      var target = users.filter(function (u) {
        return u.UserID === userId || String(u.Username) === String(userId);
      })[0];
      if (!target) {
        throw new Error('Student user account not found: ' + userId);
      }

      var newSalt = 'SALT-STD-' + target.Username + '-RST-' + Utilities.getUuid().slice(0, 6).toUpperCase();
      var newHash = computeSha256Hex(passwordToUse, newSalt);
      target.PasswordSalt = newSalt;
      target.PasswordHash = newHash;
      target.Status = 'ACTIVE';
      target.UpdatedAt = new Date().toISOString();

      Database.upsertRow(AppConfig.SHEETS.USERS, 'UserID', target);
      AuditService.logAction(sessionAdmin.UserID, 'RESET_STUDENT_PASSWORD_DEFAULT', 'StudentAccountService.gs', target.UserID, {}, {
        Username: target.Username,
        PasswordSalt: newSalt
      });

      return {
        ok: true,
        userId: target.UserID,
        username: target.Username,
        passwordSalt: newSalt,
        passwordHash: newHash
      };
    } finally {
      if (lock.hasLock()) lock.releaseLock();
    }
  }

  return {
    provisionSingleStudentAccount: provisionSingleStudentAccount,
    provisionAllStudentAccounts: provisionAllStudentAccounts,
    resetStudentPasswordToDefault: resetStudentPasswordToDefault
  };
})();`,
  },
  {
    id: 19,
    filename: 'TeacherService.gs',
    layer: 'DOMAIN_SERVICES',
    summaryKh: 'សេវាកម្មគ្រប់គ្រងបញ្ជីគ្រូបង្រៀន គណនីចូលប្រព័ន្ធ និងការចាត់តាំងមុខវិជ្ជា-ថ្នាក់រៀនតាមឆ្នាំសិក្សា',
    summaryEn: 'Teacher directory management, login account linkage, and Teacher-Subject-Class assignments synchronized with Google Sheets.',
    exportedFunctions: [
      'handleAction',
      'listTeachersWithAssignments',
      'createOrUpdateTeacher',
      'setTeacherAccountStatus',
      'saveTeacherAssignments',
      'validateTeacherExamPermissions',
    ],
    code: `/**
 * File 19: TeacherService.gs
 * Teacher Management & Teacher-Subject-Class Assignment Synchronization Service
 * Reuses Users (RoleID='ROL-03') and TeacherSubjectAssignments sheets as Single Source of Truth.
 */

var TeacherService = (function () {
  var TEACHER_ROLE_ID = 'ROL-03';

  function handleAction(sessionUser, action, payload) {
    if (action === 'listTeachersWithAssignments') {
      return listTeachersWithAssignments(payload.academicYearId);
    }
    Authorization.requireRoles(sessionUser, ['SUPER_ADMIN', 'ADMIN']);
    switch (action) {
      case 'createOrUpdateTeacher':
        return createOrUpdateTeacher(sessionUser, payload);
      case 'setTeacherAccountStatus':
        return setTeacherAccountStatus(sessionUser, payload.teacherId, payload.status);
      case 'saveTeacherAssignments':
        return saveTeacherAssignments(sessionUser, payload);
      case 'validateTeacherExamPermissions':
        return validateTeacherExamPermissions(payload.teacherId, payload.subjectId, payload.classIds, payload.academicYearId);
      default:
        throw new Error('Unsupported TeacherService action: ' + action);
    }
  }

  function listTeachersWithAssignments(academicYearId) {
    var users = Database.findAll(AppConfig.SHEETS.USERS);
    var assignments = Database.findAll(AppConfig.SHEETS.TEACHER_ASSIGNMENTS);
    var teachers = users.filter(function (u) { return u.RoleID === TEACHER_ROLE_ID; });
    return {
      ok: true,
      teachers: teachers,
      assignments: assignments.filter(function (a) {
        return !academicYearId || a.AcademicYearID === academicYearId;
      })
    };
  }

  function createOrUpdateTeacher(sessionUser, payload) {
    Validation.assertRequiredFields(payload, ['fullNameKh', 'username']);
    var nowIso = new Date().toISOString();
    var teacherId = payload.teacherId || ('USR-TCH-' + Utilities.getUuid().slice(0, 6).toUpperCase());
    var record = {
      UserID: teacherId,
      Username: String(payload.username).trim(),
      Email: String(payload.email || (payload.username + '@teokchor.edu.kh')).trim(),
      FullNameKh: String(payload.fullNameKh).trim(),
      FullNameEn: String(payload.fullNameEn || payload.fullNameKh).trim(),
      Gender: payload.gender || 'ប្រុស',
      Phone: payload.phone || '',
      RoleID: TEACHER_ROLE_ID,
      Status: payload.status || 'ACTIVE',
      UpdatedAt: nowIso
    };
    Database.upsertRow(AppConfig.SHEETS.USERS, 'UserID', record);
    AuditService.logAction(sessionUser.UserID, 'UPSERT_TEACHER_ACCOUNT', 'TeacherService.gs', teacherId, {}, record);
    return { ok: true, teacher: record };
  }

  function setTeacherAccountStatus(sessionUser, teacherId, status) {
    var nowIso = new Date().toISOString();
    Database.updateById(AppConfig.SHEETS.USERS, 'UserID', teacherId, { Status: status, UpdatedAt: nowIso });
    AuditService.logAction(sessionUser.UserID, 'SET_TEACHER_STATUS', 'TeacherService.gs', teacherId, {}, { Status: status });
    return { ok: true, teacherId: teacherId, status: status };
  }

  function saveTeacherAssignments(sessionUser, payload) {
    Validation.assertRequiredFields(payload, ['teacherId', 'academicYearId', 'subjectClassMap']);
    var nowIso = new Date().toISOString();
    AuditService.logAction(sessionUser.UserID, 'SAVE_TEACHER_ASSIGNMENTS', 'TeacherService.gs', payload.teacherId, {}, payload);
    return { ok: true, teacherId: payload.teacherId, academicYearId: payload.academicYearId, syncedAt: nowIso };
  }

  function validateTeacherExamPermissions(teacherId, subjectId, classIds, academicYearId) {
    var assignments = Database.findAll(AppConfig.SHEETS.TEACHER_ASSIGNMENTS).filter(function (a) {
      return a.TeacherID === teacherId && a.SubjectID === subjectId && a.Status === 'ACTIVE' &&
             (!academicYearId || a.AcademicYearID === academicYearId);
    });
    var allowedClassSet = {};
    assignments.forEach(function (a) { allowedClassSet[a.ClassID] = true; });
    var unauthorizedClasses = (classIds || []).filter(function (cid) { return !allowedClassSet[cid]; });
    return {
      allowed: assignments.length > 0 && unauthorizedClasses.length === 0,
      unauthorizedClasses: unauthorizedClasses
    };
  }

  return {
    handleAction: handleAction,
    listTeachersWithAssignments: listTeachersWithAssignments,
    createOrUpdateTeacher: createOrUpdateTeacher,
    setTeacherAccountStatus: setTeacherAccountStatus,
    saveTeacherAssignments: saveTeacherAssignments,
    validateTeacherExamPermissions: validateTeacherExamPermissions
  };
})();`,
  },
];


