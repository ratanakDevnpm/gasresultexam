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
    const user = state.Users.find((u) => u.UserID === userId) || state.Users[2];
    const role =
      state.Roles.find((r) => r.RoleID === user.RoleID) || {
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

      // Ensure linked student user exists in db.Users if logged in via StudentCode (e.g., 6386, 6648)
      setDb((prev) => {
        const exists = prev.Users.some((u) => u.UserID === authenticatedUser.UserID);
        const nextUsers = exists
          ? prev.Users.map((u) =>
              u.UserID === authenticatedUser.UserID ? { ...u, LastLoginAt: now } : u
            )
          : [...prev.Users, { ...authenticatedUser, LastLoginAt: now }];

        return {
          ...prev,
          Users: nextUsers,
          AuditLogs: [
            {
              LogID: `LOG-${String(prev.AuditLogs.length + 1).padStart(4, '0')}`,
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
            },
            ...prev.AuditLogs,
          ],
        };
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
      setDb((prev) => ({
        ...prev,
        AuditLogs: [
          {
            LogID: `LOG-${String(prev.AuditLogs.length + 1).padStart(4, '0')}`,
            UserID: activeUserId,
            Action: 'AUTH_LOGIN_FAILED',
            Module: 'Authentication.gs',
            RecordID: identifier || 'UNKNOWN',
            OldValueJSON: '{}',
            NewValueJSON: JSON.stringify({ identifier, reason: result.messageEn }),
            Timestamp: now,
            IPOrSessionReference: 'GAS-AUTH-GUARD',
            Description: `Failed login attempt for identifier "${identifier}": ${result.messageEn}`,
          },
          ...prev.AuditLogs,
        ],
      }));
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

      setDb((prev) => {
        const exists = prev.Users.some((u) => u.UserID === authenticatedUser.UserID);
        const nextUsers = exists
          ? prev.Users.map((u) =>
              u.UserID === authenticatedUser.UserID ? { ...u, LastLoginAt: now } : u
            )
          : [...prev.Users, { ...authenticatedUser, LastLoginAt: now }];

        return {
          ...prev,
          Users: nextUsers,
          AuditLogs: [
            {
              LogID: `LOG-${String(prev.AuditLogs.length + 1).padStart(4, '0')}`,
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
            },
            ...prev.AuditLogs,
          ],
        };
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
      setDb((prev) => ({
        ...prev,
        AuditLogs: [
          {
            LogID: `LOG-${String(prev.AuditLogs.length + 1).padStart(4, '0')}`,
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
          },
          ...prev.AuditLogs,
        ],
      }));
    }

    return result;
  };

  const createUserWithHashedPassword = (payload: CreateUserPayload): UserRecord => {
    const now = new Date().toISOString();
    const randomSuffix = String(db.Users.length + 1).padStart(2, '0');
    const userId = `USR-NEW-${randomSuffix}`;
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

    setDb((prev) => ({
      ...prev,
      Users: [newUser, ...prev.Users],
      AuditLogs: [
        {
          LogID: `LOG-${String(prev.AuditLogs.length + 1).padStart(4, '0')}`,
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
        ...prev.AuditLogs,
      ],
    }));

    return newUser;
  };

  const toggleUserStatus = (userId: string) => {
    const now = new Date().toISOString();
    setDb((prev) => ({
      ...prev,
      Users: prev.Users.map((u) =>
        u.UserID === userId
          ? {
              ...u,
              Status: u.Status === 'ACTIVE' ? ('INACTIVE' as const) : ('ACTIVE' as const),
              UpdatedAt: now,
            }
          : u
      ),
    }));
  };

  const assignTeacherSubject = (
    payload: AssignTeacherSubjectPayload
  ): TeacherSubjectAssignmentRecord => {
    const now = new Date().toISOString();
    const newAssignment: TeacherSubjectAssignmentRecord = {
      AssignmentID: `TSA-${String(db.TeacherSubjectAssignments.length + 1).padStart(2, '0')}`,
      TeacherID: payload.teacherId,
      SubjectID: payload.subjectId,
      ClassID: payload.classId,
      AcademicYearID: payload.academicYearId,
      AssignedByUserID: activeUserId,
      Status: 'ACTIVE',
      AssignedAt: now,
    };

    setDb((prev) => ({
      ...prev,
      TeacherSubjectAssignments: [newAssignment, ...prev.TeacherSubjectAssignments],
      AuditLogs: [
        {
          LogID: `LOG-${String(prev.AuditLogs.length + 1).padStart(4, '0')}`,
          UserID: activeUserId,
          Action: 'ASSIGN_TEACHER_SUBJECT',
          Module: 'TeacherAssignmentService.gs',
          RecordID: newAssignment.AssignmentID,
          OldValueJSON: '{}',
          NewValueJSON: JSON.stringify(newAssignment),
          Timestamp: now,
          IPOrSessionReference: 'GAS-ASSIGNMENT-SVC',
          Description: `Assigned TeacherID=${payload.teacherId} to SubjectID=${payload.subjectId} (${payload.classId})`,
        },
        ...prev.AuditLogs,
      ],
    }));

    return newAssignment;
  };

  const logout = () => {
    const now = new Date().toISOString();
    const userToLogout = currentSession.user;
    setDb((prev) => ({
      ...prev,
      AuditLogs: [
        {
          LogID: `LOG-${String(prev.AuditLogs.length + 1).padStart(4, '0')}`,
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
        },
        ...prev.AuditLogs,
      ],
    }));
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
