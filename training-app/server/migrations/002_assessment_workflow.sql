SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

IF COL_LENGTH('dbo.training_question_pg', 'image_data') IS NULL
  ALTER TABLE dbo.training_question_pg ADD image_data nvarchar(max) NULL;

IF COL_LENGTH('dbo.training_question_essay', 'image_data') IS NULL
  ALTER TABLE dbo.training_question_essay ADD image_data nvarchar(max) NULL;

IF COL_LENGTH('dbo.training_absensi', 'signature_data') IS NULL
  ALTER TABLE dbo.training_absensi ADD signature_data nvarchar(max) NULL;

ALTER TABLE dbo.training_qr_access
  DROP CONSTRAINT CK_training_qr_access_purpose;

ALTER TABLE dbo.training_qr_access
  ADD CONSTRAINT CK_training_qr_access_purpose
      CHECK (purpose IN ('assessment', 'pre_test', 'post_test', 'feedback', 'attendance'));

COMMIT TRANSACTION;
