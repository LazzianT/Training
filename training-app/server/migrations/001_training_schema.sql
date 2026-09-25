SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

CREATE TABLE dbo.training_ruang_acara (
    id int IDENTITY(1, 1) NOT NULL,
    legacy_id int NULL,
    nama_ruangan nvarchar(100) NOT NULL,
    is_active bit NOT NULL CONSTRAINT DF_training_ruang_acara_is_active DEFAULT (1),
    created_at datetime2(3) NOT NULL CONSTRAINT DF_training_ruang_acara_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at datetime2(3) NOT NULL CONSTRAINT DF_training_ruang_acara_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_training_ruang_acara PRIMARY KEY (id),
    CONSTRAINT UQ_training_ruang_acara_nama UNIQUE (nama_ruangan)
);

CREATE UNIQUE INDEX UX_training_ruang_acara_legacy_id ON dbo.training_ruang_acara (legacy_id) WHERE legacy_id IS NOT NULL;

CREATE TABLE dbo.training_acara (
    id int IDENTITY(1, 1) NOT NULL,
    legacy_id int NULL,
    judul nvarchar(200) NOT NULL,
    tgl date NOT NULL,
    sasaran nvarchar(max) NOT NULL,
    materi_pokok nvarchar(max) NULL,
    waktu_mulai time(0) NOT NULL,
    waktu_selesai time(0) NOT NULL,
    ruang_id int NULL,
    status varchar(20) NOT NULL CONSTRAINT DF_training_acara_status DEFAULT ('draft'),
    version int NOT NULL CONSTRAINT DF_training_acara_version DEFAULT (1),
    created_by_nip nvarchar(50) NULL,
    updated_by_nip nvarchar(50) NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_training_acara_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at datetime2(3) NOT NULL CONSTRAINT DF_training_acara_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_training_acara PRIMARY KEY (id),
    CONSTRAINT FK_training_acara_ruang FOREIGN KEY (ruang_id) REFERENCES dbo.training_ruang_acara (id),
    CONSTRAINT CK_training_acara_waktu CHECK (waktu_selesai > waktu_mulai),
    CONSTRAINT CK_training_acara_status CHECK (status IN ('draft', 'published', 'closed', 'archived'))
);

CREATE UNIQUE INDEX UX_training_acara_legacy_id ON dbo.training_acara (legacy_id) WHERE legacy_id IS NOT NULL;
CREATE INDEX IX_training_acara_tgl_status ON dbo.training_acara (tgl, status);
CREATE INDEX IX_training_acara_ruang ON dbo.training_acara (ruang_id);

CREATE TABLE dbo.training_acara_trainer (
    id int IDENTITY(1, 1) NOT NULL,
    event_id int NOT NULL,
    trainer_type varchar(10) NOT NULL,
    trainer_nip nvarchar(50) NULL,
    trainer_name nvarchar(200) NULL,
    organization_name nvarchar(200) NULL,
    email nvarchar(320) NULL,
    phone nvarchar(50) NULL,
    department_code nvarchar(50) NULL,
    position_name nvarchar(200) NULL,
    legacy_trainer_identifier nvarchar(100) NULL,
    is_primary bit NOT NULL CONSTRAINT DF_training_acara_trainer_is_primary DEFAULT (0),
    legacy_id int NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_training_acara_trainer_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_training_acara_trainer PRIMARY KEY (id),
    CONSTRAINT FK_training_acara_trainer_event FOREIGN KEY (event_id) REFERENCES dbo.training_acara (id),
    CONSTRAINT CK_training_acara_trainer_type CHECK (trainer_type IN ('internal', 'external')),
    CONSTRAINT CK_training_acara_trainer_source CHECK (
        (trainer_type = 'internal' AND trainer_nip IS NOT NULL)
        OR
        (trainer_type = 'external' AND trainer_nip IS NULL AND (trainer_name IS NOT NULL OR legacy_trainer_identifier IS NOT NULL))
    )
);

CREATE INDEX IX_training_acara_trainer_event ON dbo.training_acara_trainer (event_id);
CREATE INDEX IX_training_acara_trainer_nip ON dbo.training_acara_trainer (trainer_nip) WHERE trainer_nip IS NOT NULL;

CREATE TABLE dbo.training_peserta_acara (
    id int IDENTITY(1, 1) NOT NULL,
    event_id int NOT NULL,
    participant_nip nvarchar(50) NOT NULL,
    participant_name nvarchar(200) NULL,
    department_code nvarchar(50) NULL,
    department_name nvarchar(200) NULL,
    attendance_status varchar(20) NOT NULL CONSTRAINT DF_training_peserta_acara_attendance DEFAULT ('not_recorded'),
    invitation_status varchar(20) NOT NULL CONSTRAINT DF_training_peserta_acara_invitation DEFAULT ('not_sent'),
    legacy_invitation_code tinyint NULL,
    legacy_id int NULL,
    joined_at datetime2(3) NOT NULL CONSTRAINT DF_training_peserta_acara_joined_at DEFAULT (SYSUTCDATETIME()),
    updated_at datetime2(3) NOT NULL CONSTRAINT DF_training_peserta_acara_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_training_peserta_acara PRIMARY KEY (id),
    CONSTRAINT FK_training_peserta_acara_event FOREIGN KEY (event_id) REFERENCES dbo.training_acara (id),
    CONSTRAINT UQ_training_peserta_acara_event_nip UNIQUE (event_id, participant_nip),
    CONSTRAINT CK_training_peserta_acara_attendance CHECK (attendance_status IN ('not_recorded', 'present', 'absent')),
    CONSTRAINT CK_training_peserta_acara_invitation CHECK (invitation_status IN ('not_sent', 'queued', 'sent', 'failed', 'skipped'))
);

CREATE UNIQUE INDEX UX_training_peserta_acara_legacy_id ON dbo.training_peserta_acara (legacy_id) WHERE legacy_id IS NOT NULL;
CREATE INDEX IX_training_peserta_acara_nip ON dbo.training_peserta_acara (participant_nip);
CREATE INDEX IX_training_peserta_acara_event_attendance ON dbo.training_peserta_acara (event_id, attendance_status);

CREATE TABLE dbo.training_absensi (
    id int IDENTITY(1, 1) NOT NULL,
    event_id int NOT NULL,
    participant_nip nvarchar(50) NOT NULL,
    photo_path nvarchar(1000) NOT NULL,
    photo_sha256 char(64) NULL,
    captured_at datetime2(3) NOT NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_training_absensi_created_at DEFAULT (SYSUTCDATETIME()),
    legacy_id int NULL,
    CONSTRAINT PK_training_absensi PRIMARY KEY (id),
    CONSTRAINT FK_training_absensi_event FOREIGN KEY (event_id) REFERENCES dbo.training_acara (id),
    CONSTRAINT FK_training_absensi_participant FOREIGN KEY (event_id, participant_nip) REFERENCES dbo.training_peserta_acara (event_id, participant_nip),
    CONSTRAINT UQ_training_absensi_event_nip UNIQUE (event_id, participant_nip)
);

CREATE UNIQUE INDEX UX_training_absensi_legacy_id ON dbo.training_absensi (legacy_id) WHERE legacy_id IS NOT NULL;
CREATE INDEX IX_training_absensi_event_time ON dbo.training_absensi (event_id, captured_at);

CREATE TABLE dbo.training_test_set (
    id int IDENTITY(1, 1) NOT NULL,
    event_id int NOT NULL,
    test_type varchar(20) NOT NULL,
    trainer_nip nvarchar(50) NULL,
    test_date date NOT NULL,
    question_count int NOT NULL,
    status varchar(20) NOT NULL CONSTRAINT DF_training_test_set_status DEFAULT ('draft'),
    legacy_id int NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_training_test_set_created_at DEFAULT (SYSUTCDATETIME()),
    published_at datetime2(3) NULL,
    CONSTRAINT PK_training_test_set PRIMARY KEY (id),
    CONSTRAINT UQ_training_test_set_event_id UNIQUE (event_id, id),
    CONSTRAINT FK_training_test_set_event FOREIGN KEY (event_id) REFERENCES dbo.training_acara (id),
    CONSTRAINT CK_training_test_set_type CHECK (test_type IN ('pg', 'essay', 'mixed')),
    CONSTRAINT CK_training_test_set_status CHECK (status IN ('draft', 'published', 'closed')),
    CONSTRAINT CK_training_test_set_question_count CHECK (question_count > 0)
);

CREATE UNIQUE INDEX UX_training_test_set_legacy_id ON dbo.training_test_set (legacy_id) WHERE legacy_id IS NOT NULL;
CREATE INDEX IX_training_test_set_event_status ON dbo.training_test_set (event_id, status);

CREATE TABLE dbo.training_test_session (
    id int IDENTITY(1, 1) NOT NULL,
    event_id int NOT NULL,
    test_set_id int NOT NULL,
    participant_nip nvarchar(50) NOT NULL,
    phase varchar(4) NOT NULL,
    status varchar(20) NOT NULL CONSTRAINT DF_training_test_session_status DEFAULT ('not_started'),
    started_at datetime2(3) NULL,
    submitted_at datetime2(3) NULL,
    locked_at datetime2(3) NULL,
    CONSTRAINT PK_training_test_session PRIMARY KEY (id),
    CONSTRAINT UQ_training_test_session_id_set UNIQUE (id, test_set_id),
    CONSTRAINT UQ_training_test_session_set_nip_phase UNIQUE (test_set_id, participant_nip, phase),
    CONSTRAINT FK_training_test_session_event FOREIGN KEY (event_id) REFERENCES dbo.training_acara (id),
    CONSTRAINT FK_training_test_session_set FOREIGN KEY (event_id, test_set_id) REFERENCES dbo.training_test_set (event_id, id),
    CONSTRAINT FK_training_test_session_participant FOREIGN KEY (event_id, participant_nip) REFERENCES dbo.training_peserta_acara (event_id, participant_nip),
    CONSTRAINT CK_training_test_session_phase CHECK (phase IN ('pre', 'post')),
    CONSTRAINT CK_training_test_session_status CHECK (status IN ('not_started', 'in_progress', 'submitted', 'locked'))
);

CREATE INDEX IX_training_test_session_event_phase ON dbo.training_test_session (event_id, phase, status);

CREATE TABLE dbo.training_question_pg (
    id int IDENTITY(1, 1) NOT NULL,
    test_set_id int NOT NULL,
    question_no int NOT NULL,
    question_text nvarchar(2000) NOT NULL,
    option_a nvarchar(1000) NOT NULL,
    option_b nvarchar(1000) NOT NULL,
    option_c nvarchar(1000) NOT NULL,
    option_d nvarchar(1000) NOT NULL,
    correct_answer char(1) NOT NULL,
    image_path nvarchar(1000) NULL,
    point decimal(8, 2) NOT NULL,
    legacy_id int NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_training_question_pg_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_training_question_pg PRIMARY KEY (id),
    CONSTRAINT UQ_training_question_pg_set_id UNIQUE (test_set_id, id),
    CONSTRAINT UQ_training_question_pg_set_number UNIQUE (test_set_id, question_no),
    CONSTRAINT FK_training_question_pg_set FOREIGN KEY (test_set_id) REFERENCES dbo.training_test_set (id),
    CONSTRAINT CK_training_question_pg_answer CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
    CONSTRAINT CK_training_question_pg_point CHECK (point >= 0)
);

CREATE UNIQUE INDEX UX_training_question_pg_legacy_id ON dbo.training_question_pg (legacy_id) WHERE legacy_id IS NOT NULL;

CREATE TABLE dbo.training_question_essay (
    id int IDENTITY(1, 1) NOT NULL,
    test_set_id int NOT NULL,
    question_no int NOT NULL,
    question_text nvarchar(2000) NOT NULL,
    instructions nvarchar(max) NULL,
    answer_guide nvarchar(max) NULL,
    image_path nvarchar(1000) NULL,
    max_point decimal(8, 2) NULL,
    legacy_id int NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_training_question_essay_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_training_question_essay PRIMARY KEY (id),
    CONSTRAINT UQ_training_question_essay_set_id UNIQUE (test_set_id, id),
    CONSTRAINT UQ_training_question_essay_set_number UNIQUE (test_set_id, question_no),
    CONSTRAINT FK_training_question_essay_set FOREIGN KEY (test_set_id) REFERENCES dbo.training_test_set (id),
    CONSTRAINT CK_training_question_essay_point CHECK (max_point IS NULL OR max_point > 0)
);

CREATE UNIQUE INDEX UX_training_question_essay_legacy_id ON dbo.training_question_essay (legacy_id) WHERE legacy_id IS NOT NULL;

CREATE TABLE dbo.training_answer_pg (
    id int IDENTITY(1, 1) NOT NULL,
    session_id int NOT NULL,
    test_set_id int NOT NULL,
    question_id int NOT NULL,
    answer char(1) NOT NULL,
    legacy_answer_key char(1) NULL,
    legacy_point decimal(8, 2) NULL,
    submitted_at datetime2(3) NOT NULL,
    legacy_id int NULL,
    CONSTRAINT PK_training_answer_pg PRIMARY KEY (id),
    CONSTRAINT UQ_training_answer_pg_session_question UNIQUE (session_id, question_id),
    CONSTRAINT FK_training_answer_pg_session FOREIGN KEY (session_id, test_set_id) REFERENCES dbo.training_test_session (id, test_set_id),
    CONSTRAINT FK_training_answer_pg_question FOREIGN KEY (test_set_id, question_id) REFERENCES dbo.training_question_pg (test_set_id, id),
    CONSTRAINT CK_training_answer_pg_answer CHECK (answer IN ('A', 'B', 'C', 'D'))
);

CREATE UNIQUE INDEX UX_training_answer_pg_legacy_id ON dbo.training_answer_pg (legacy_id) WHERE legacy_id IS NOT NULL;
CREATE INDEX IX_training_answer_pg_session ON dbo.training_answer_pg (session_id);

CREATE TABLE dbo.training_answer_essay (
    id int IDENTITY(1, 1) NOT NULL,
    session_id int NOT NULL,
    test_set_id int NOT NULL,
    question_id int NOT NULL,
    answer_text nvarchar(max) NOT NULL,
    legacy_result varchar(10) NULL,
    submitted_at datetime2(3) NOT NULL,
    legacy_id int NULL,
    CONSTRAINT PK_training_answer_essay PRIMARY KEY (id),
    CONSTRAINT UQ_training_answer_essay_session_question UNIQUE (session_id, question_id),
    CONSTRAINT FK_training_answer_essay_session FOREIGN KEY (session_id, test_set_id) REFERENCES dbo.training_test_session (id, test_set_id),
    CONSTRAINT FK_training_answer_essay_question FOREIGN KEY (test_set_id, question_id) REFERENCES dbo.training_question_essay (test_set_id, id)
);

CREATE UNIQUE INDEX UX_training_answer_essay_legacy_id ON dbo.training_answer_essay (legacy_id) WHERE legacy_id IS NOT NULL;
CREATE INDEX IX_training_answer_essay_session ON dbo.training_answer_essay (session_id);

CREATE TABLE dbo.training_answer_grade_pg (
    answer_id int NOT NULL,
    score decimal(8, 2) NULL,
    is_correct bit NULL,
    graded_by_nip nvarchar(50) NULL,
    graded_at datetime2(3) NULL,
    grader_note nvarchar(max) NULL,
    CONSTRAINT PK_training_answer_grade_pg PRIMARY KEY (answer_id),
    CONSTRAINT FK_training_answer_grade_pg_answer FOREIGN KEY (answer_id) REFERENCES dbo.training_answer_pg (id),
    CONSTRAINT CK_training_answer_grade_pg_score CHECK (score IS NULL OR score >= 0)
);

CREATE TABLE dbo.training_answer_grade_essay (
    answer_id int NOT NULL,
    score decimal(8, 2) NULL,
    graded_by_nip nvarchar(50) NULL,
    graded_at datetime2(3) NULL,
    grader_note nvarchar(max) NULL,
    CONSTRAINT PK_training_answer_grade_essay PRIMARY KEY (answer_id),
    CONSTRAINT FK_training_answer_grade_essay_answer FOREIGN KEY (answer_id) REFERENCES dbo.training_answer_essay (id),
    CONSTRAINT CK_training_answer_grade_essay_score CHECK (score IS NULL OR score >= 0)
);

CREATE TABLE dbo.training_feedback (
    id int IDENTITY(1, 1) NOT NULL,
    event_id int NOT NULL,
    participant_nip nvarchar(50) NOT NULL,
    feedback_type varchar(20) NOT NULL,
    aspect_code nvarchar(100) NOT NULL,
    score decimal(3, 1) NULL,
    comment nvarchar(max) NULL,
    submitted_at datetime2(3) NOT NULL CONSTRAINT DF_training_feedback_submitted_at DEFAULT (SYSUTCDATETIME()),
    legacy_id int NULL,
    CONSTRAINT PK_training_feedback PRIMARY KEY (id),
    CONSTRAINT FK_training_feedback_event FOREIGN KEY (event_id) REFERENCES dbo.training_acara (id),
    CONSTRAINT FK_training_feedback_participant FOREIGN KEY (event_id, participant_nip) REFERENCES dbo.training_peserta_acara (event_id, participant_nip),
    CONSTRAINT UQ_training_feedback_event_nip_type_aspect UNIQUE (event_id, participant_nip, feedback_type, aspect_code),
    CONSTRAINT CK_training_feedback_type CHECK (feedback_type IN ('user', 'trainer')),
    CONSTRAINT CK_training_feedback_score CHECK (score IS NULL OR (score >= 1 AND score <= 5))
);

CREATE UNIQUE INDEX UX_training_feedback_legacy_id ON dbo.training_feedback (legacy_id) WHERE legacy_id IS NOT NULL;
CREATE INDEX IX_training_feedback_event_type ON dbo.training_feedback (event_id, feedback_type);

CREATE TABLE dbo.training_certificate (
    id int IDENTITY(1, 1) NOT NULL,
    event_id int NOT NULL,
    participant_nip nvarchar(50) NOT NULL,
    verification_code nvarchar(100) NOT NULL,
    issued_at datetime2(3) NOT NULL,
    expires_at datetime2(3) NOT NULL,
    status varchar(20) NOT NULL CONSTRAINT DF_training_certificate_status DEFAULT ('valid'),
    revoked_at datetime2(3) NULL,
    revoked_by_nip nvarchar(50) NULL,
    legacy_certificate_no nvarchar(100) NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_training_certificate_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_training_certificate PRIMARY KEY (id),
    CONSTRAINT UQ_training_certificate_event_nip UNIQUE (event_id, participant_nip),
    CONSTRAINT UQ_training_certificate_verification_code UNIQUE (verification_code),
    CONSTRAINT FK_training_certificate_event FOREIGN KEY (event_id) REFERENCES dbo.training_acara (id),
    CONSTRAINT FK_training_certificate_participant FOREIGN KEY (event_id, participant_nip) REFERENCES dbo.training_peserta_acara (event_id, participant_nip),
    CONSTRAINT CK_training_certificate_status CHECK (status IN ('valid', 'expired', 'revoked')),
    CONSTRAINT CK_training_certificate_dates CHECK (expires_at > issued_at)
);

CREATE UNIQUE INDEX UX_training_certificate_legacy_no ON dbo.training_certificate (legacy_certificate_no) WHERE legacy_certificate_no IS NOT NULL;

CREATE TABLE dbo.training_notification_outbox (
    id bigint IDENTITY(1, 1) NOT NULL,
    event_id int NULL,
    channel varchar(30) NOT NULL,
    recipient nvarchar(320) NOT NULL,
    template_code nvarchar(100) NOT NULL,
    payload nvarchar(max) NOT NULL,
    status varchar(20) NOT NULL CONSTRAINT DF_training_notification_outbox_status DEFAULT ('queued'),
    idempotency_key nvarchar(400) NOT NULL,
    attempts int NOT NULL CONSTRAINT DF_training_notification_outbox_attempts DEFAULT (0),
    available_at datetime2(3) NOT NULL CONSTRAINT DF_training_notification_outbox_available_at DEFAULT (SYSUTCDATETIME()),
    sent_at datetime2(3) NULL,
    provider_message_id nvarchar(200) NULL,
    error_message nvarchar(max) NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_training_notification_outbox_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_training_notification_outbox PRIMARY KEY (id),
    CONSTRAINT UQ_training_notification_outbox_idempotency UNIQUE (idempotency_key),
    CONSTRAINT FK_training_notification_outbox_event FOREIGN KEY (event_id) REFERENCES dbo.training_acara (id),
    CONSTRAINT CK_training_notification_outbox_status CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'failed', 'skipped')),
    CONSTRAINT CK_training_notification_outbox_attempts CHECK (attempts >= 0)
);

CREATE INDEX IX_training_notification_outbox_queue ON dbo.training_notification_outbox (status, available_at);

CREATE TABLE dbo.training_audit_log (
    id bigint IDENTITY(1, 1) NOT NULL,
    actor_nip nvarchar(50) NULL,
    action nvarchar(200) NOT NULL,
    entity_type nvarchar(100) NOT NULL,
    entity_id nvarchar(100) NULL,
    correlation_id nvarchar(100) NULL,
    result varchar(20) NOT NULL,
    metadata nvarchar(max) NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_training_audit_log_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_training_audit_log PRIMARY KEY (id),
    CONSTRAINT CK_training_audit_log_result CHECK (result IN ('success', 'failure'))
);

CREATE INDEX IX_training_audit_log_actor_time ON dbo.training_audit_log (actor_nip, created_at);
CREATE INDEX IX_training_audit_log_entity ON dbo.training_audit_log (entity_type, entity_id, created_at);

CREATE TABLE dbo.training_user_credential (
    nip nvarchar(50) NOT NULL,
    password_hash varchar(255) NOT NULL,
    must_change_password bit NOT NULL CONSTRAINT DF_training_user_credential_must_change DEFAULT (1),
    status varchar(20) NOT NULL CONSTRAINT DF_training_user_credential_status DEFAULT ('active'),
    created_at datetime2(3) NOT NULL CONSTRAINT DF_training_user_credential_created_at DEFAULT (SYSUTCDATETIME()),
    updated_at datetime2(3) NOT NULL CONSTRAINT DF_training_user_credential_updated_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_training_user_credential PRIMARY KEY (nip),
    CONSTRAINT CK_training_user_credential_status CHECK (status IN ('active', 'disabled', 'locked'))
);

CREATE TABLE dbo.training_refresh_session (
    id uniqueidentifier NOT NULL,
    nip nvarchar(50) NOT NULL,
    token_hash char(64) NOT NULL,
    expires_at datetime2(3) NOT NULL,
    revoked_at datetime2(3) NULL,
    last_used_at datetime2(3) NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_training_refresh_session_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_training_refresh_session PRIMARY KEY (id),
    CONSTRAINT UQ_training_refresh_session_token UNIQUE (token_hash),
    CONSTRAINT FK_training_refresh_session_credential FOREIGN KEY (nip) REFERENCES dbo.training_user_credential (nip)
);

CREATE INDEX IX_training_refresh_session_nip_expiry ON dbo.training_refresh_session (nip, expires_at);

CREATE TABLE dbo.training_qr_access (
    id uniqueidentifier NOT NULL,
    event_id int NOT NULL,
    token_hash char(64) NOT NULL,
    purpose varchar(30) NOT NULL CONSTRAINT DF_training_qr_access_purpose DEFAULT ('assessment'),
    expires_at datetime2(3) NOT NULL,
    max_uses int NOT NULL CONSTRAINT DF_training_qr_access_max_uses DEFAULT (1),
    used_count int NOT NULL CONSTRAINT DF_training_qr_access_used_count DEFAULT (0),
    revoked_at datetime2(3) NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_training_qr_access_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_training_qr_access PRIMARY KEY (id),
    CONSTRAINT UQ_training_qr_access_token UNIQUE (token_hash),
    CONSTRAINT FK_training_qr_access_event FOREIGN KEY (event_id) REFERENCES dbo.training_acara (id),
    CONSTRAINT CK_training_qr_access_counts CHECK (max_uses > 0 AND used_count >= 0 AND used_count <= max_uses),
    CONSTRAINT CK_training_qr_access_purpose CHECK (purpose IN ('assessment'))
);

CREATE INDEX IX_training_qr_access_event ON dbo.training_qr_access (event_id, expires_at);

CREATE TABLE dbo.training_legacy_history (
    id int IDENTITY(1, 1) NOT NULL,
    history_type varchar(30) NOT NULL,
    legacy_id int NULL,
    event_id int NULL,
    participant_nip nvarchar(50) NULL,
    history_date date NULL,
    history_text nvarchar(max) NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_training_legacy_history_created_at DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_training_legacy_history PRIMARY KEY (id),
    CONSTRAINT FK_training_legacy_history_event FOREIGN KEY (event_id) REFERENCES dbo.training_acara (id),
    CONSTRAINT CK_training_legacy_history_type CHECK (history_type IN ('employee_training', 'general_feedback', 'legacy_other'))
);

CREATE INDEX IX_training_legacy_history_event ON dbo.training_legacy_history (event_id, history_type);

CREATE TABLE dbo.training_migration_map (
    id bigint IDENTITY(1, 1) NOT NULL,
    source_table nvarchar(128) NOT NULL,
    source_id nvarchar(128) NOT NULL,
    target_table nvarchar(128) NOT NULL,
    target_id nvarchar(128) NULL,
    source_checksum char(64) NULL,
    status varchar(20) NOT NULL CONSTRAINT DF_training_migration_map_status DEFAULT ('pending'),
    error_message nvarchar(max) NULL,
    created_at datetime2(3) NOT NULL CONSTRAINT DF_training_migration_map_created_at DEFAULT (SYSUTCDATETIME()),
    completed_at datetime2(3) NULL,
    CONSTRAINT PK_training_migration_map PRIMARY KEY (id),
    CONSTRAINT UQ_training_migration_map_source UNIQUE (source_table, source_id),
    CONSTRAINT CK_training_migration_map_status CHECK (status IN ('pending', 'mapped', 'rejected', 'completed'))
);

CREATE INDEX IX_training_migration_map_status ON dbo.training_migration_map (status, source_table);

COMMIT TRANSACTION;
