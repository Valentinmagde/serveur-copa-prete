import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';

config();

async function seed() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'copa_user',
    password: process.env.DB_PASSWORD || 'copa_password',
    database: process.env.DB_DATABASE || 'copa_db',
    entities: ['dist/**/*.entity.js'],
  });

  await dataSource.initialize();
  console.log('Database connected');

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.startTransaction();

  try {
    // Seed Genders - sans ON CONFLICT
    const gendersExist = await queryRunner.manager.query(
      `SELECT COUNT(*) FROM genders`,
    );
    if (gendersExist[0].count === '0') {
      await queryRunner.manager.query(`
        INSERT INTO genders (code, label) VALUES
        ('M', 'Male'),
        ('F', 'Female');
      `);
      console.log('Genders seeded');
    }

    // Seed Roles - sans ON CONFLICT
    const rolesExist = await queryRunner.manager.query(
      `SELECT COUNT(*) FROM roles`,
    );
    if (rolesExist[0].count === '0') {
      await queryRunner.manager.query(`
        INSERT INTO roles (code, name, description, level, is_internal) VALUES
        ('SUPER_ADMIN', 'Super Administrateur', 'Full system access', 100, true),
        ('ADMIN', 'Administrateur', 'Platform administration', 90, true),
        ('COPA_MANAGER', 'Gestionnaire COPA', 'Manage COPA editions and processes', 80, true),
        ('EVALUATOR', 'Évaluateur', 'Evaluate business plans', 70, false),
        ('TRAINER', 'Formateur', 'Deliver training sessions', 60, false),
        ('MENTOR', 'Mentor', 'Provide mentorship to beneficiaries', 60, false),
        ('PARTNER', 'Partenaire', 'Partner organization representative', 50, false),
        ('BENEFICIARY', 'Bénéficiaire', 'MPME beneficiary', 10, false);
      `);
      console.log('Roles seeded');
    }

    // Seed Statuses - sans ON CONFLICT
    const statusesExist = await queryRunner.manager.query(
      `SELECT COUNT(*) FROM statuses`,
    );

    if (statusesExist[0].count === '0') {
      await queryRunner.manager.query(`
    INSERT INTO statuses (code, name, name_fr, entity_type, display_order) VALUES
    ('ACTIVE', 'Active', 'Actif', 'USER', 1),
    ('INACTIVE', 'Inactive', 'Inactif', 'USER', 2),
    ('BLOCKED', 'Blocked', 'Bloqué', 'USER', 3),

    ('PENDING_VALIDATION', 'Pending Validation', 'En attente de validation', 'COMPANY', 1),
    ('VALIDATED', 'Validated', 'Validé', 'COMPANY', 2),
    ('REJECTED', 'Rejected', 'Rejeté', 'COMPANY', 3),

    ('REGISTERED', 'Registered', 'Inscrit', 'BENEFICIARY', 1),
    ('PRE_SELECTED', 'Pre-selected', 'Pré-sélectionné', 'BENEFICIARY', 2),
    ('SELECTED', 'Selected', 'Sélectionné', 'BENEFICIARY', 3),
    ('REJECTED', 'Rejected', 'Rejeté', 'BENEFICIARY', 4),

    ('DRAFT', 'Draft', 'Brouillon', 'BUSINESS_PLAN', 1),
    ('SUBMITTED', 'Submitted', 'Soumis', 'BUSINESS_PLAN', 2),
    ('UNDER_EVALUATION', 'Under Evaluation', 'En cours d''évaluation', 'BUSINESS_PLAN', 3),
    ('EVALUATED', 'Evaluated', 'Évalué', 'BUSINESS_PLAN', 4),
    ('SELECTED', 'Selected', 'Sélectionné', 'BUSINESS_PLAN', 5),
    ('REJECTED', 'Rejected', 'Rejeté', 'BUSINESS_PLAN', 6),

    ('PENDING', 'Pending', 'En attente', 'SUBSCRIPTION', 1),
    ('CONFIRMED', 'Confirmed', 'Confirmé', 'SUBSCRIPTION', 2),
    ('CANCELLED', 'Cancelled', 'Annulé', 'SUBSCRIPTION', 3),

    ('RECEIVED', 'Received', 'Reçu', 'COMPLAINT', 1),
    ('IN_PROGRESS', 'In Progress', 'En cours', 'COMPLAINT', 2),
    ('RESOLVED', 'Resolved', 'Résolu', 'COMPLAINT', 3),
    ('REJECTED', 'Rejected', 'Rejeté', 'COMPLAINT', 4),

    ('SIGNED', 'Signed', 'Signé', 'SUBVENTION', 1),
    ('ACTIVE', 'Active', 'Actif', 'SUBVENTION', 2),
    ('COMPLETED', 'Completed', 'Terminé', 'SUBVENTION', 3),
    ('CANCELLED', 'Cancelled', 'Annulé', 'SUBVENTION', 4),

    ('PLANNED', 'Planned', 'Planifié', 'TRAINING_SESSION', 1),
    ('ONGOING', 'Ongoing', 'En cours', 'TRAINING_SESSION', 2),
    ('COMPLETED', 'Completed', 'Terminé', 'TRAINING_SESSION', 3),
    ('CANCELLED', 'Cancelled', 'Annulé', 'TRAINING_SESSION', 4);
  `);

      console.log('Statuses seeded');
    }

    // Seed Business Plan Section Types
    const sectionTypesExist = await queryRunner.manager.query(
      `SELECT COUNT(*) FROM business_plan_section_types`,
    );
    if (sectionTypesExist[0].count === '0') {
      await queryRunner.manager.query(`
        INSERT INTO business_plan_section_types (name, description, display_order, is_mandatory) VALUES
        ('Executive Summary', 'Overview of the business project', 1, true),
        ('Company Description', 'Details about the company', 2, true),
        ('Market Analysis', 'Market research and analysis', 3, true),
        ('Products and Services', 'Description of products/services offered', 4, true),
        ('Marketing Strategy', 'Marketing and sales strategy', 5, true),
        ('Operational Plan', 'Operations and implementation plan', 6, true),
        ('Management Team', 'Team composition and qualifications', 7, true),
        ('Financial Plan', 'Financial projections and analysis', 8, true),
        ('Risk Analysis', 'Risk assessment and mitigation', 9, true),
        ('Environmental and Social Impact', 'Impact assessment', 10, true);
      `);
      console.log('Business plan section types seeded');
    }

    // Seed Consent Types
    const consentTypesExist = await queryRunner.manager.query(
      `SELECT COUNT(*) FROM consent_types`,
    );
    if (consentTypesExist[0].count === '0') {
      await queryRunner.manager.query(`
        INSERT INTO consent_types (code, name, description, is_mandatory) VALUES
        ('DATA_PROCESSING', 'Data Processing Consent', 'Consent for personal data processing', true),
        ('COMMUNICATIONS', 'Communications Consent', 'Consent to receive communications', false),
        ('THIRD_PARTY_SHARING', 'Third Party Sharing', 'Consent to share data with partners', false),
        ('COOKIES', 'Cookies Consent', 'Consent for website cookies', true),
        ('TERMS_AND_CONDITIONS', 'Terms and Conditions', 'Acceptance of terms and conditions', true),
        ('PRIVACY_POLICY', 'Privacy Policy', 'Acceptance of the privacy policy', true),
        ('CERTIFY_ACCURACY', 'Certification of Accuracy', 'Certification that the provided information is accurate and truthful', true)
      `);
      console.log('Consent types seeded');
    }

    // Seed Document Types
    const documentTypesExist = await queryRunner.manager.query(
      `SELECT COUNT(*) FROM document_types`,
    );
    if (documentTypesExist[0].count === '0') {
      await queryRunner.manager.query(`
        INSERT INTO document_types (name, description, is_required_for_company, is_required_for_business_plan, is_required_for_beneficiary, allowed_formats, max_size_mb) VALUES
        -- Documents d'identité de base
        ('Carte d''identité / Passeport', 'Carte d''identité nationale, passeport ou carte de réfugié', true, false, true, '["pdf", "jpg", "png"]'::jsonb, 5),
        
        -- Documents pour entreprises formelles
        ('Casier judiciaire', 'Casier judiciaire datant de moins de 3 mois', true, false, true, '["pdf"]'::jsonb, 5),
        ('Acte de nomination du gérant', 'Acte de nomination si différent du RC', true, false, false, '["pdf"]'::jsonb, 5),
        ('Registre de commerce (RCCM)', 'Registre de commerce et du crédit mobilier', true, false, false, '["pdf"]'::jsonb, 10),
        ('NIF', 'Numéro d''identification fiscale', true, false, false, '["pdf"]'::jsonb, 5),
        ('Relevés bancaires', 'Relevés bancaires des 6 derniers mois', true, true, false, '["pdf"]'::jsonb, 10),
        
        -- Documents pour entreprises informelles
        ('Attestation communale', 'Attestation de reconnaissance communale ou zonale (entreprise d''au moins 1 an)', true, false, false, '["pdf"]'::jsonb, 5),
        
        -- Documents projet
        ('Plan d''affaires', 'Document complet du plan d''affaires', false, true, false, '["pdf", "doc", "docx"]'::jsonb, 20),
        ('Devis', 'Devis pour les équipements demandés', false, true, false, '["pdf"]'::jsonb, 5),
        
        -- Photos
        ('Photo d''identité', 'Photo d''identité du représentant', false, false, true, '["jpg", "png"]'::jsonb, 2),
        ('Photos du projet', 'Photos de l''entreprise ou des produits', false, true, false, '["jpg", "png"]'::jsonb, 10),
        
        -- Documents administratifs
        ('Convention de subvention', 'Convention de subvention signée', false, false, true, '["pdf"]'::jsonb, 10),
        ('Attestation de formation', 'Attestation de formation COPA', false, false, true, '["pdf"]'::jsonb, 5);
      `);
      console.log('Document types seeded');
    }

    // Seed Complaint Types
    const complaintTypesExist = await queryRunner.manager.query(
      `SELECT COUNT(*) FROM complaint_types`,
    );
    if (complaintTypesExist[0].count === '0') {
      await queryRunner.manager.query(`
        INSERT INTO complaint_types (name, description, processing_days, requires_confidentiality, is_priority) VALUES
        ('Technical Issue', 'Problem with the platform', 7, false, false),
        ('Process Irregularity', 'Irregularity in selection process', 15, true, false),
        ('Staff Misconduct', 'Inappropriate behavior by staff', 10, true, true),
        ('Corruption', 'Request for bribe or corruption', 5, true, true),
        ('GBV/EAS-HS', 'Gender-based violence or harassment', 3, true, true),
        ('Other', 'Other complaints', 15, false, false);
      `);
      console.log('Complaint types seeded');
    }

    // Seed Monitoring Indicators
    const indicatorsExist = await queryRunner.manager.query(
      `SELECT COUNT(*) FROM monitoring_indicators`,
    );
    if (indicatorsExist[0].count === '0') {
      await queryRunner.manager.query(`
        INSERT INTO monitoring_indicators (code, name, category, measurement_frequency, requires_gender_disaggregation, requires_province_disaggregation, requires_refugee_disaggregation, unit) VALUES
        ('KPI-01', 'Number of registered MPMEs', 'OUTPUT', 'MONTHLY', true, true, true, 'count'),
        ('KPI-02', 'Number of MPMEs completing training', 'OUTCOME', 'QUARTERLY', true, true, true, 'count'),
        ('KPI-03', 'Number of business plans submitted', 'OUTPUT', 'MONTHLY', false, true, true, 'count'),
        ('KPI-04', 'Number of beneficiary MPMEs', 'OUTCOME', 'QUARTERLY', true, true, true, 'count'),
        ('KPI-05', 'Total subventions disbursed', 'OUTPUT', 'QUARTERLY', false, true, true, 'BIF'),
        ('KPI-06', 'Jobs created', 'IMPACT', 'QUARTERLY', true, true, true, 'count'),
        ('KPI-07', 'Jobs maintained', 'IMPACT', 'QUARTERLY', true, true, true, 'count'),
        ('KPI-08', 'Companies with revenue increase', 'IMPACT', 'ANNUAL', true, true, true, 'count'),
        ('KPI-09', 'Climate-resilient investments', 'OUTCOME', 'ANNUAL', false, true, false, 'count'),
        ('KPI-10', 'Complaints received and resolved', 'PROCESS', 'MONTHLY', true, true, true, 'count');
      `);
      console.log('Monitoring indicators seeded');
    }

    // Seed Provinces & Communes
    const provincesExist = await queryRunner.manager.query(
      `SELECT COUNT(*) FROM provinces`,
    );

    if (provincesExist[0].count === '0') {
      // Insert Provinces
      await queryRunner.manager.query(`
        INSERT INTO provinces (name, region, is_active) VALUES
        ('Buhumuza', 'Ouest', true),
        ('Bujumbura', 'Centre', true),
        ('Burunga', 'Nord', true),
        ('Butanyerera', 'Nord', true),
        ('Gitega', 'Sud-Ouest', true);
      `);

      console.log('Provinces seeded');

      // Insert Communes (42 communes – Loi organique n°1/05 du 16 mars 2023)
      await queryRunner.manager.query(`
        INSERT INTO communes (name, province_id, is_active)
        SELECT c.name, p.id, true
        FROM (
          VALUES 
          -- BUHUMUZA (7 communes)
          ('Commune Butaganzwa', 'Buhumuza'),
          ('Commune Butihinda',  'Buhumuza'),
          ('Commune Cankuzo',    'Buhumuza'),
          ('Commune Gisagara',   'Buhumuza'),
          ('Commune Gisuru',     'Buhumuza'),
          ('Commune Muyinga',    'Buhumuza'),
          ('Commune Ruyigi',     'Buhumuza'),

          -- BUJUMBURA (11 communes)
          ('Commune Bubanza',      'Bujumbura'),
          ('Commune Bukinanyana',  'Bujumbura'),
          ('Commune Cibitoke',     'Bujumbura'),
          ('Commune Isare',        'Bujumbura'),
          ('Commune Mpanda',       'Bujumbura'),
          ('Commune Mugere',       'Bujumbura'),
          ('Commune Mugina',       'Bujumbura'),
          ('Commune Muhuta',       'Bujumbura'),
          ('Commune Mukaza',       'Bujumbura'),
          ('Commune Ntahangwa',    'Bujumbura'),
          ('Commune Rwibaga',      'Bujumbura'),

          -- BURUNGA (7 communes)
          ('Commune Bururi',     'Burunga'),
          ('Commune Makamba',    'Burunga'),
          ('Commune Matana',     'Burunga'),
          ('Commune Musongati',  'Burunga'),
          ('Commune Nyanza',     'Burunga'),
          ('Commune Rumonge',    'Burunga'),
          ('Commune Rutana',     'Burunga'),

          -- BUTANYERERA (8 communes)
          ('Commune Busoni',    'Butanyerera'),
          ('Commune Kayanza',   'Butanyerera'),
          ('Commune Kiremba',   'Butanyerera'),
          ('Commune Kirundo',   'Butanyerera'),
          ('Commune Matongo',   'Butanyerera'),
          ('Commune Muhanga',   'Butanyerera'),
          ('Commune Ngozi',     'Butanyerera'),
          ('Commune Tangara',   'Butanyerera'),

          -- GITEGA (9 communes)
          ('Commune Bugendana',  'Gitega'),
          ('Commune Gishubi',    'Gitega'),
          ('Commune Gitega',     'Gitega'),
          ('Commune Karusi',     'Gitega'),
          ('Commune Kiganda',    'Gitega'),
          ('Commune Muramvya',   'Gitega'),
          ('Commune Mwaro',      'Gitega'),
          ('Commune Nyabihanga', 'Gitega'),
          ('Commune Shombo',     'Gitega')
        ) AS c(name, province_name)
        JOIN provinces p ON p.name = c.province_name;
      `);

      console.log('Communes seeded');
    }

    // Seed Business Sectors (FR + RN)
    const sectorsExist = await queryRunner.manager.query(
      `SELECT COUNT(*) FROM business_sectors`,
    );

    if (sectorsExist[0].count === '0') {
      await queryRunner.manager.query(`
        INSERT INTO business_sectors 
        (name_fr, name_rn, description_fr, description_rn, is_copa_eligible, is_active) 
        VALUES

        -- ✅ SECTEURS ELIGIBLES
        (
          'Agriculture',
          'Uburimyi',
          'Production agricole, élevage et pêche',
          'Uburimyi, ubworozi n’uburovyi',
          true, true
        ),
        (
          'Transformation agroalimentaire',
          'Ihindurwa ry’ibiribwa',
          'Transformation des produits agricoles',
          'Guhindura no gutunganya umwimbu w’uburimyi',
          true, true
        ),
        (
          'Artisanat',
          'Ubugeni',
          'Activités artisanales et production locale',
          'Ibikorwa vy’ubugeni n’ibikorwa vy’amaboko',
          true, true
        ),
        (
          'Commerce',
          'Ubucuruzi',
          'Commerce de gros et de détail',
          'Ubucuruzi bwo kugurisha no gusubiragurisha',
          true, true
        ),
        (
          'Services',
          'Serivisi',
          'Services professionnels et personnels',
          'Serivisi zitandukanye ku bantu no ku mashirahamwe',
          true, true
        ),
        (
          'Technologies et Innovation',
          'Ikoranabuhanga n’udushya',
          'Services numériques et innovation',
          'Ikoranabuhanga rigezweho n’udushya',
          true, true
        ),
        (
          'Tourisme et Hôtellerie',
          'Ubukerarugendo n’amahoteli',
          'Tourisme, hébergement et restauration',
          'Ibikorwa vy’ubukerarugendo n’amahoteli',
          true, true
        ),
        (
          'Énergies renouvelables',
          'Ingufu zisubira',
          'Énergie solaire et solutions vertes',
          'Ingufu zituruka ku zuba n’izindi zisubira',
          true, true
        ),
        (
          'Économie verte',
          'Ubutunzi bubungabunga ibidukikije',
          'Activités respectueuses de l’environnement',
          'Ibikorwa bikingira ibidukikije',
          true, true
        ),

        -- ❌ SECTEURS EXCLUS
        (
          'Activités illicites',
          'Ibikorwa bibujijwe n’amategeko',
          'Activités interdites par la loi',
          'Ibikorwa bibujijwe n’amategeko y’igihugu',
          false, true
        ),
        (
          'Activités nuisibles à l’environnement',
          'Ibikorwa vyangiza ibidukikije',
          'Activités causant des dommages environnementaux',
          'Ibikorwa vyangiza ibidukikije',
          false, true
        ),
        (
          'Armes et munitions',
          'Intwaro n’amasasu',
          'Production ou commerce d’armes',
          'Gukora canke gucuruza intwaro',
          false, true
        ),
        (
          'Tabac et drogues',
          'Itabi n’ibiyayura mutwe',
          'Production ou commerce de substances nocives',
          'Gukora canke gucuruza ibiyayura mutwe',
          false, true
        ),
        (
          'Jeux de hasard non réglementés',
          'Imikino y’akabembe itagenzurwa',
          'Activités de jeu non autorisées',
          'Imikino y’akabembe itaremewe n’amategeko',
          false, true
        );
      `);

      console.log('Business sectors seeded (FR + RN)');
    }

    // Create admin user
    const adminExists = await queryRunner.manager.query(
      `SELECT COUNT(*) FROM users WHERE email = 'admin@copa-platform.bi'`,
    );

    if (adminExists[0].count === '0') {
      const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
      const adminPassword = await bcrypt.hash('Admin@123', saltRounds);

      await queryRunner.manager.query(
        `
        INSERT INTO users (email, password_hash, first_name, last_name, is_active, is_verified)
        VALUES ($1, $2, 'Admin', 'User', true, true);
      `,
        ['admin@copa-platform.bi', adminPassword],
      );

      // Assign admin role
      await queryRunner.manager.query(`
        INSERT INTO user_roles (user_id, role_id, is_active)
        SELECT u.id, r.id, true
        FROM users u, roles r
        WHERE u.email = 'admin@copa-platform.bi' AND r.code = 'SUPER_ADMIN';
      `);

      console.log('Admin user created');
    }

    // Vérifier si les données existent déjà
    const editionsExist = await queryRunner.manager.query(
      `SELECT COUNT(*) FROM copa_editions`,
    );

    if (editionsExist[0].count === '0') {
      // Insérer les éditions COPA
      await queryRunner.manager.query(`
        INSERT INTO copa_editions 
        (code, name, name_fr, name_rn, year, registration_start_date, registration_end_date, 
        submission_start_date, submission_end_date, evaluation_start_date, evaluation_end_date,
        selection_committee_date, results_publication_date, total_budget, expected_winners_count,
        regulations_url, is_active) 
        VALUES
        (
          'COPA-2026-FIRST-ROUND',
          'COPA 2026 FIRST ROUND - Business Plan Competition',
          'COPA 2026 PREMIERE COHORTE - Concours des Plans d''Affaires',
          'COPA 2026 Icohorte ca mbere - Amarushanwa y’Imishinga y’Ubucuruzi',
          2026,
          '2026-03-16', '2026-04-06',
          '2026-04-16', '2026-05-30',
          '2026-06-01', '2026-07-15',
          '2026-07-20', '2026-07-31',
          500000000, 50,
          '/uploads/regulations/copa-2026-first-round.pdf',
          true
        )
      `);

      console.log('Copa editions seeded');
    }

    // Vérifier si les phases existent déjà
    const phasesExist = await queryRunner.manager.query(
      `SELECT COUNT(*) FROM copa_phases`,
    );

    if (phasesExist[0].count === '0') {
      // Récupérer les IDs des éditions
      const editions = await queryRunner.manager.query(`
        SELECT id, code FROM copa_editions
      `);

      const editionsMap = new Map();
      editions.forEach((edition) => {
        editionsMap.set(edition.code, edition.id);
      });

      // Insérer les phases pour COPA-2026
      const copa2026Id = editionsMap.get('COPA-2026-FIRST-ROUND');
      if (copa2026Id) {
        await queryRunner.manager.query(`
          INSERT INTO copa_phases 
          (copa_edition_id, phase_code, phase_name, phase_name_fr, phase_name_rn, 
          phase_description, phase_description_fr, phase_description_rn,
          start_date, end_date, is_active, display_order, 
          requires_approval, auto_transition, transition_days, metadata)
          VALUES
          (
            ${copa2026Id}, 'REGISTRATION',
            'Registration', 'Inscription', 'Kwiyandikisha',
            'Beneficiary registration and application submission',
            'Inscription des bénéficiaires et soumission des candidatures',
            'Kwiyandikisha n’ugutanga amakuru y’ishirahamwe',
            '2026-03-16', '2026-04-06', true, 1,
            false, true, 0,
            '{"requiresCompanyProfile": true, "requiresBeneficiaryProfile": true, "maxApplicants": 500}'::jsonb
          ),
          (
            ${copa2026Id}, 'BUSINESS_PLAN_SUBMISSION',
            'Business Plan Submission', 'Soumission du plan d''affaires', 'Gutanga umushinga w’ubucuruzi',
            'Submission of detailed business plan',
            'Soumission du plan d''affaires détaillé',
            'Gutanga umushinga w’ubucuruzi mu buryo burambuye',
            '2026-04-16', '2026-05-30', false, 2,
            false, true, 0,
            '{"requiresBusinessPlan": true, "maxPages": 30, "requiredSections": ["executive_summary", "market_analysis", "financial_projections"]}'::jsonb
          ),
          (
            ${copa2026Id}, 'EVALUATION',
            'Evaluation', 'Évaluation', 'Isuzuma',
            'Business plan evaluation by technical committee',
            'Évaluation des plans d''affaires par le comité technique',
            'Isuzuma ry’imishinga y’ubucuruzi n’abagize komite y’ubuhanga',
            '2026-06-01', '2026-07-15', false, 3,
            true, false, NULL,
            '{"minEvaluators": 2, "maxEvaluators": 3, "evaluationCriteria": [{"name": "economic_viability", "weight": 30}, {"name": "innovation", "weight": 25}, {"name": "social_impact", "weight": 20}, {"name": "environmental_impact", "weight": 15}, {"name": "implementation_capacity", "weight": 10}]}'::jsonb
          ),
          (
            ${copa2026Id}, 'SELECTION',
            'Selection', 'Sélection', 'Gutoranya',
            'Final selection by the selection committee',
            'Sélection finale par le comité de sélection',
            'Gutoranya mu mukino wa nyuma n’abagize komite y’itoranywa',
            '2026-07-16', '2026-07-31', false, 4,
            true, false, NULL,
            '{"selectionCommitteeMembers": 7, "quorumRequired": 5, "selectionCriteria": [{"name": "evaluation_score", "weight": 70}, {"name": "committee_vote", "weight": 30}]}'::jsonb
          ),
          (
            ${copa2026Id}, 'AWARDING',
            'Awarding', 'Attribution', 'Itangwa ry’impano',
            'Agreement signing and subsidy disbursement',
            'Signature des conventions et versement des subventions',
            'Gusinyisha amasezerano no gutanga inkunga',
            '2026-08-01', '2026-10-31', false, 5,
            true, false, NULL,
            '{"requiresAgreementSignature": true, "requiresBankAccount": true, "disbursementSchedule": [{"percentage": 40, "condition": "signature_convention"}, {"percentage": 30, "condition": "rapport_trimestriel"}, {"percentage": 30, "condition": "rapport_final"}]}'::jsonb
          ),
          (
            ${copa2026Id}, 'MENTORING',
            'Mentoring', 'Accompagnement', 'Ubuyobozi',
            'Beneficiary mentoring and support',
            'Accompagnement des bénéficiaires par des mentors',
            'Ubuyobozi n’inkunga ku banywanyi',
            '2026-08-01', '2027-07-31', false, 6,
            false, true, 0,
            '{"mentorRatio": 5, "minMentoringSessions": 6, "sessionFrequency": "monthly"}'::jsonb
          ),
          (
            ${copa2026Id}, 'MONITORING',
            'Monitoring', 'Suivi', 'Gukurikirana',
            'Project monitoring and evaluation',
            'Suivi et évaluation des projets financés',
            'Gukurikirana n’isuzuma ry’imishinga y’inkunga',
            '2026-08-01', '2027-12-31', false, 7,
            false, true, 0,
            '{"reportingFrequency": "quarterly", "monitoringIndicators": ["jobs_created", "revenue_growth", "social_impact", "environmental_impact"], "siteVisitsRequired": true}'::jsonb
          );
        `);
      }

      console.log('Copa phases seeded');
    }

    await queryRunner.commitTransaction();
    console.log('Seeding completed successfully');
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('Seeding failed:', error);
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

seed();
