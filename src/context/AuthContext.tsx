import React, { createContext, useContext, useState } from 'react';
import {
  DatabaseState,
  GenderKh,
  RoleName,
  RoleRecord,
  TeacherSubjectAssignmentRecord,
  UserRecord,
} from '../types/database';
import {
  authenticateStudentByIdOnly,
  authenticateUserCredentials,
  AuthenticationResult,
  hashPasswordSha256,
  PortalRoute,
  StudentIdAuthResult,
} from '../lib/domainRules';
import { DataService } from '../lib/centralizedDataService';

export interface AuthSession {
  user: UserRecord;
  role: RoleRecord;
  portalRoute: PortalRoute;
  sessionToken: string;
  authenticatedAt: string;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  rawPassword: string;
  fullNameKh: string;
  fullNameEn: string;
  gender: GenderKh;
  phone: string;
  roleId: string;
}

export interface AssignTeacherSubjectPayload {
  teacherId: string;
  subjectId: string;
  classId: string;
  academicYearId: string;
}

interface AuthContextValue {
  db: DatabaseState;
  session: AuthSession;
  activeUserId: string;
  setActiveUserId: (userId: string) => void;
  login: (identifier: string, rawPassword: string) => AuthenticationResult;
  loginStudentById: (studentIdInput: string) => StudentIdAuthResult;
  logout: () => void;
  createUserWithHashedPassword: (payload: CreateUserPayload) => UserRecord;
  toggleUserStatus: (userId: string) => void;
  assignTeacherSubject: (payload: AssignTeacherSubjectPayload) => TeacherSubjectAssignmentRecord;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  db: DatabaseState;
  setDb: React.Dispatch<React.SetStateAction<DatabaseState>>;
  activeUserId: string;
  setActiveUserId: (userId: string) => void;
  onLogout?: () => void;
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  db,
  setDb,
  activeUserId,
  setActiveUserId,
  onLogout,
  children,
}) => {
  const resolveSessionForUser = (userId: string, state: DatabaseState): AuthSession => {
    const user = DataService.findById(state, 'Users', userId) || state.Users[2];
    const role =
      DataService.findById(state, 'Roles', user.RoleID) || {
        RoleID: 'ROL-03',
        RoleName: 'TEACHER' as RoleName,
        Description: 'Teacher',
        Status: 'ACTIVE' as const,
      };

    const routeMap: Record<RoleName, PortalRoute> = {
      SUPER_ADMIN: 'ADMIN_PORTAL',
      ADMIN: 'ADMIN_PORTAL',
      TEACHER: 'TEACHER_PORTAL',
      HOMEROOM_TEACHER: 'TEACHER_PORTAL',
      STUDENT: 'STUDENT_PORTAL',
      VIEWER: 'VIEWER_PORTAL',
    };

    return {
      user,
      role,
      portalRoute: routeMap[role.RoleName] || 'VIEWER_PORTAL',
      sessionToken: `SES-${user.UserID}-2026`,
      authenticatedAt: user.LastLoginAt || new Date().toISOString(),
    };
  };

  const [lastAuthOverride, setLastAuthOverride] = useState<AuthSession | null>(null);

  const currentSession: AuthSession =
    lastAuthOverride && lastAuthOverride.user.UserID === activeUserId
      ? lastAuthOverride
      : resolveSessionForUser(activeUserId, db);

  const handleSetActiveUserId = (userId: string) => {
    setLastAuthOverride(null);
    setActiveUserId(userId);
  };

  const login = (identifier: string, rawPassword: string): AuthenticationResult => {
    const result = authenticateUserCredentials(
      identifier,
      rawPassword,
      db.Users,
      db.Roles,
      db.Students
    );

    const now = new Date().toISOString();

    if (result.ok && result.user && result.role && result.portalRoute && result.sessionToken) {
      const authenticatedUser = result.user;

      DataService.commitState(setDb, (prev) => {
        const exists = Boolean(DataService.findById(prev, 'Users', authenticatedUser.UserID));
        const userResult = exists
          ? DataService.updateRecord(prev, 'Users', authenticatedUser.UserID, {
              LastLoginAt: now,
            })
          : DataService.createRecord(prev, 'Users', {
              ...authenticatedUser,
              LastLoginAt: now,
            });
        const workingDb = userResult.ok ? userResult.db : prev;
        return DataService.appendAuditLog(workingDb, {
          UserID: authenticatedUser.UserID,
          Action: 'AUTH_LOGIN_SUCCESS',
          Module: 'Authentication.gs',
          RecordID: authenticatedUser.UserID,
          OldValueJSON: '{}',
          NewValueJSON: JSON.stringify({
            identifier,
            role: result.role?.RoleName,
            portalRoute: result.portalRoute,
          }),
          Timestamp: now,
          IPOrSessionReference: result.sessionToken || 'GAS-AUTH-SESSION',
          Description: `Authenticated ${authenticatedUser.FullNameKh} (${authenticatedUser.Username}) via SHA-256 + Salt`,
        });
      });

      setActiveUserId(authenticatedUser.UserID);
      setLastAuthOverride({
        user: authenticatedUser,
        role: result.role,
        portalRoute: result.portalRoute,
        sessionToken: result.sessionToken,
        authenticatedAt: now,
      });
    } else {
      DataService.commitState(setDb, (prev) =>
        DataService.appendAuditLog(prev, {
          UserID: activeUserId,
          Action: 'AUTH_LOGIN_FAILED',
          Module: 'Authentication.gs',
          RecordID: identifier || 'UNKNOWN',
          OldValueJSON: '{}',
          NewValueJSON: JSON.stringify({ identifier, reason: result.messageEn }),
          Timestamp: now,
          IPOrSessionReference: 'GAS-AUTH-GUARD',
          Description: `Failed login attempt for identifier "${identifier}": ${result.messageEn}`,
        })
      );
    }

    return result;
  };

  const loginStudentById = (studentIdInput: string): StudentIdAuthResult => {
    const result = authenticateStudentByIdOnly(
      studentIdInput,
      db.Students,
      db.Users,
      db.Roles
    );

    const now = new Date().toISOString();

    if (result.ok && result.user && result.role && result.portalRoute && result.sessionToken) {
      const authenticatedUser = result.user;

      DataService.commitState(setDb, (prev) => {
        const exists = Boolean(DataService.findById(prev, 'Users', authenticatedUser.UserID));
        const userResult = exists
          ? DataService.updateRecord(prev, 'Users', authenticatedUser.UserID, {
              LastLoginAt: now,
            })
          : DataService.createRecord(prev, 'Users', {
              ...authenticatedUser,
              LastLoginAt: now,
            });
        const workingDb = userResult.ok ? userResult.db : prev;
        return DataService.appendAuditLog(workingDb, {
          UserID: authenticatedUser.UserID,
          Action: 'AUTH_STUDENT_ID_LOGIN_SUCCESS',
          Module: 'Authentication.gs',
          RecordID: result.studentProfile?.StudentID || authenticatedUser.UserID,
          OldValueJSON: '{}',
          NewValueJSON: JSON.stringify({
            studentCode: result.studentProfile?.StudentCode,
            role: result.role?.RoleName,
            portalRoute: result.portalRoute,
          }),
          Timestamp: now,
          IPOrSessionReference: result.sessionToken || 'GAS-STUDENT-ID-AUTH',
          Description: `Verified Student ID #${result.studentProfile?.StudentCode} (${authenticatedUser.FullNameKh}) and routed to STUDENT_PORTAL`,
        });
      });

      setActiveUserId(authenticatedUser.UserID);
      setLastAuthOverride({
        user: authenticatedUser,
        role: result.role,
        portalRoute: result.portalRoute,
        sessionToken: result.sessionToken,
        authenticatedAt: now,
      });
    } else {
      DataService.commitState(setDb, (prev) =>
        DataService.appendAuditLog(prev, {
          UserID: activeUserId,
          Action: 'AUTH_STUDENT_ID_LOGIN_FAILED',
          Module: 'Authentication.gs',
          RecordID: studentIdInput.trim() || 'EMPTY_STUDENT_ID',
          OldValueJSON: '{}',
          NewValueJSON: JSON.stringify({
            studentIdInput: studentIdInput.trim(),
            reason: result.messageEn,
          }),
          Timestamp: now,
          IPOrSessionReference: 'GAS-STUDENT-ID-GUARD',
          Description: `Failed Student ID login attempt for "${studentIdInput.trim()}": ${result.messageEn}`,
        })
      );
    }

    return result;
  };

  const createUserWithHashedPassword = (payload: CreateUserPayload): UserRecord => {
    const now = new Date().toISOString();
    let seq = db.Users.length + 1;
    let randomSuffix = String(seq).padStart(2, '0');
    let userId = `USR-NEW-${randomSuffix}`;
    while (DataService.findById(db, 'Users', userId)) {
      seq += 1;
      randomSuffix = String(seq).padStart(2, '0');
      userId = `USR-NEW-${randomSuffix}`;
    }
    const salt = `SALT-TC-2026-${randomSuffix}`;
    const passwordHash = hashPasswordSha256(payload.rawPassword, salt);

    const newUser: UserRecord = {
      UserID: userId,
      Username: payload.username.trim(),
      Email: payload.email.trim(),
      PasswordHash: passwordHash,
      PasswordSalt: salt,
      FullNameKh: payload.fullNameKh.trim(),
      FullNameEn: payload.fullNameEn.trim(),
      Gender: payload.gender,
      Phone: payload.phone.trim(),
      RoleID: payload.roleId,
      ProfileImageID: '',
      Status: 'ACTIVE',
      CreatedAt: now,
      UpdatedAt: now,
      LastLoginAt: now,
    };

    DataService.commitState(setDb, (prev) => {
      const res = DataService.createRecord(prev, 'Users', newUser, {
        position: 'PREPEND',
        auditLog: {
          UserID: activeUserId,
          Action: 'CREATE_USER_SHA256',
          Module: 'UserService.gs',
          RecordID: newUser.UserID,
          OldValueJSON: '{}',
          NewValueJSON: JSON.stringify({
            Username: newUser.Username,
            RoleID: newUser.RoleID,
            PasswordSalt: newUser.PasswordSalt,
          }),
          Timestamp: now,
          IPOrSessionReference: 'GAS-USER-SVC',
          Description: `Created user ${newUser.FullNameKh} (${newUser.Username}) with salted SHA-256 hash`,
        },
      });
      return res.ok ? res.db : prev;
    });

    return newUser;
  };

  const toggleUserStatus = (userId: string) => {
    const now = new Date().toISOString();
    DataService.commitState(setDb, (prev) => {
      const res = DataService.updateRecord(prev, 'Users', userId, (u) => ({
        ...u,
        Status: u.Status === 'ACTIVE' ? ('INACTIVE' as const) : ('ACTIVE' as const),
        UpdatedAt: now,
      }));
      return res.ok ? res.db : prev;
    });
  };

  const assignTeacherSubject = (
    payload: AssignTeacherSubjectPayload
  ): TeacherSubjectAssignmentRecord => {
    const now = new Date().toISOString();
    const preCheck = DataService.assignTeacherSubjectRecord(
      db,
      { ...payload, assignmentIdPrefix: 'TSA' },
      activeUserId
    );

    const fallbackAssignment: TeacherSubjectAssignmentRecord = preCheck.record || {
      AssignmentID: `TSA-${String(db.TeacherSubjectAssignments.length + 1).padStart(2, '0')}`,
      TeacherID: payload.teacherId,
      SubjectID: payload.subjectId,
      ClassID: payload.classId,
      AcademicYearID: payload.academicYearId,
      AssignedByUserID: activeUserId,
      Status: 'ACTIVE',
      AssignedAt: now,
    };

    DataService.commitState(setDb, (prev) => {
      const res = DataService.assignTeacherSubjectRecord(
        prev,
        { ...payload, assignmentIdPrefix: 'TSA' },
        activeUserId
      );
      return res.ok ? res.db : prev;
    });

    return fallbackAssignment;
  };

  const logout = () => {
    const now = new Date().toISOString();
    const userToLogout = currentSession.user;
    DataService.commitState(setDb, (prev) =>
      DataService.appendAuditLog(prev, {
        UserID: userToLogout.UserID,
        Action: 'AUTH_LOGOUT',
        Module: 'Authentication.gs',
        RecordID: userToLogout.UserID,
        OldValueJSON: JSON.stringify({
          sessionToken: currentSession.sessionToken,
          role: currentSession.role.RoleName,
        }),
        NewValueJSON: '{}',
        Timestamp: now,
        IPOrSessionReference: currentSession.sessionToken,
        Description: `User ${userToLogout.FullNameKh} (${userToLogout.Username}) logged out of ${currentSession.portalRoute}`,
      })
    );
    setLastAuthOverride(null);
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        db,
        session: currentSession,
        activeUserId,
        setActiveUserId: handleSetActiveUserId,
        login,
        loginStudentById,
        logout,
        createUserWithHashedPassword,
        toggleUserStatus,
        assignTeacherSubject,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
