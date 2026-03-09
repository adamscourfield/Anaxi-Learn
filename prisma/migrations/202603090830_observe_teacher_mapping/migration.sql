-- Observe-compatible teacher/class/student mapping for Learn

CREATE TABLE IF NOT EXISTS "TeacherProfile" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "externalSource" TEXT NOT NULL DEFAULT 'anaxi_observe',
  "externalTeacherId" TEXT NOT NULL,
  "externalSchoolId" TEXT,
  "displayName" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "TeacherProfile_externalSource_externalTeacherId_key"
  ON "TeacherProfile"("externalSource", "externalTeacherId");

CREATE TABLE IF NOT EXISTS "StudentProfile" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "externalSource" TEXT NOT NULL DEFAULT 'anaxi_observe',
  "externalStudentId" TEXT NOT NULL,
  "externalSchoolId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentProfile_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudentProfile_externalSource_externalStudentId_key"
  ON "StudentProfile"("externalSource", "externalStudentId");

CREATE TABLE IF NOT EXISTS "Classroom" (
  "id" TEXT PRIMARY KEY,
  "externalSource" TEXT NOT NULL DEFAULT 'anaxi_observe',
  "externalClassId" TEXT NOT NULL,
  "externalSchoolId" TEXT,
  "name" TEXT NOT NULL,
  "yearGroup" TEXT,
  "subjectSlug" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Classroom_externalSource_externalClassId_key"
  ON "Classroom"("externalSource", "externalClassId");

CREATE TABLE IF NOT EXISTS "TeacherClassroom" (
  "id" TEXT PRIMARY KEY,
  "teacherProfileId" TEXT NOT NULL,
  "classroomId" TEXT NOT NULL,
  "roleLabel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherClassroom_teacherProfileId_fkey"
    FOREIGN KEY ("teacherProfileId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TeacherClassroom_classroomId_fkey"
    FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "TeacherClassroom_teacherProfileId_classroomId_key"
  ON "TeacherClassroom"("teacherProfileId", "classroomId");

CREATE TABLE IF NOT EXISTS "ClassroomEnrollment" (
  "id" TEXT PRIMARY KEY,
  "classroomId" TEXT NOT NULL,
  "studentUserId" TEXT NOT NULL,
  "studentProfileId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClassroomEnrollment_classroomId_fkey"
    FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClassroomEnrollment_studentUserId_fkey"
    FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ClassroomEnrollment_studentProfileId_fkey"
    FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "ClassroomEnrollment_classroomId_studentUserId_key"
  ON "ClassroomEnrollment"("classroomId", "studentUserId");
