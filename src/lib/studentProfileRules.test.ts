import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialDatabaseState, HONOR_PORTRAIT_URLS } from './seedData';
import {
  buildStudentPersonalProfileSummary,
  isDirectImageSource,
  resolveStudentProfilePhotoUrl,
  updateStudentSelfProfile,
  validateStudentProfilePhotoInput,
} from './studentProfileRules';
import { getStudentClassScopedResults } from './domainRules';

test('buildStudentPersonalProfileSummary resolves complete personal, family, address, and academic profile for student', () => {
  const db = createInitialDatabaseState();
  const profile = buildStudentPersonalProfileSummary(
    db,
    'USR-STD-6463',
    HONOR_PORTRAIT_URLS
  );

  assert.equal(profile.studentCode, '6463');
  assert.equal(profile.classId, 'CLS-12C');
  assert.equal(profile.className, '12C');
  assert.ok(profile.fullNameKh.length > 0);
  assert.ok(profile.homeroomTeacherNameKh.includes('ជួន លីរតនៈ'));
  assert.equal(profile.totalClassStudents, 56);
  assert.equal(isDirectImageSource(profile.profilePhotoUrl), true);
});

test('validateStudentProfilePhotoInput accepts data:image base64, https URLs, and preset IDs, and rejects invalid inputs', () => {
  const dataUrlCheck = validateStudentProfilePhotoInput(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  );
  assert.equal(dataUrlCheck.valid, true);

  const httpsCheck = validateStudentProfilePhotoInput(
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300'
  );
  assert.equal(httpsCheck.valid, true);

  const presetCheck = validateStudentProfilePhotoInput('DRV-PHOTO-RANK2');
  assert.equal(presetCheck.valid, true);

  const emptyCheck = validateStudentProfilePhotoInput('   ');
  assert.equal(emptyCheck.valid, false);

  const scriptCheck = validateStudentProfilePhotoInput('javascript:alert(1)');
  assert.equal(scriptCheck.valid, false);
});

test('updateStudentSelfProfile saves uploaded data:image profile photo and syncs StudentRecord, UserRecord, and Honor Roll', () => {
  const db = createInitialDatabaseState();
  const initialProfile = buildStudentPersonalProfileSummary(
    db,
    'USR-STD-6463',
    HONOR_PORTRAIT_URLS
  );

  const customDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  const result = updateStudentSelfProfile(db, {
    actorUserId: 'USR-STD-6463',
    studentId: initialProfile.studentId,
    profileImageId: customDataUrl,
    phone: '096 777 8888',
    currentVillage: 'ទឹកជោរ',
    currentCommune: 'ទឹកជោរ',
    currentDistrict: 'ព្រះនេត្រព្រះ',
    currentProvince: 'បន្ទាយមានជ័យ',
  });

  assert.equal(result.ok, true);
  assert.equal(result.updatedStudent?.ProfileImageID, customDataUrl);
  assert.equal(result.updatedStudent?.Phone, '096 777 8888');

  const updatedSummary = buildStudentPersonalProfileSummary(
    result.nextDb,
    'USR-STD-6463',
    HONOR_PORTRAIT_URLS
  );
  assert.equal(updatedSummary.profilePhotoUrl, customDataUrl);
  assert.equal(updatedSummary.hasCustomPhoto, true);
  assert.equal(updatedSummary.phone, '096 777 8888');
  assert.ok(updatedSummary.currentAddressFullKh.includes('ភូមិទឹកជោរ'));

  // Verify UserRecord is also synced
  const syncedUser = result.nextDb.Users.find(
    (u) => u.UserID === 'USR-STD-6463'
  );
  if (syncedUser) {
    assert.equal(syncedUser.ProfileImageID, customDataUrl);
  }

  // Verify getStudentClassScopedResults also resolves the uploaded data:image URL
  const scopedAfter = getStudentClassScopedResults(
    result.nextDb,
    'USR-STD-6463',
    HONOR_PORTRAIT_URLS
  );
  assert.equal(scopedAfter.myRankedEntry?.profileImageUrl, customDataUrl);

  // Verify resolveStudentProfilePhotoUrl works directly
  assert.equal(
    resolveStudentProfilePhotoUrl(customDataUrl, HONOR_PORTRAIT_URLS),
    customDataUrl
  );
});
