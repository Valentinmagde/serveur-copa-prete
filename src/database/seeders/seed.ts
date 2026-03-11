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
        ('SUPER_ADMIN', 'Super Administrator', 'Full system access', 100, true),
        ('ADMIN', 'Administrator', 'Platform administration', 90, true),
        ('COPA_MANAGER', 'COPA Manager', 'Manage COPA editions and processes', 80, true),
        ('EVALUATOR', 'Evaluator', 'Evaluate business plans', 70, false),
        ('TRAINER', 'Trainer', 'Deliver training sessions', 60, false),
        ('MENTOR', 'Mentor', 'Provide mentorship to beneficiaries', 60, false),
        ('PARTNER', 'Partner', 'Partner organization representative', 50, false),
        ('BENEFICIARY', 'Beneficiary', 'MPME beneficiary', 10, false);
      `);
      console.log('Roles seeded');
    }

    // Seed Statuses - sans ON CONFLICT
    const statusesExist = await queryRunner.manager.query(
      `SELECT COUNT(*) FROM statuses`,
    );
    if (statusesExist[0].count === '0') {
      await queryRunner.manager.query(`
        INSERT INTO statuses (code, name, entity_type, display_order) VALUES
        ('ACTIVE', 'Active', 'USER', 1),
        ('INACTIVE', 'Inactive', 'USER', 2),
        ('BLOCKED', 'Blocked', 'USER', 3),
        ('PENDING_VALIDATION', 'Pending Validation', 'COMPANY', 1),
        ('VALIDATED', 'Validated', 'COMPANY', 2),
        ('REJECTED', 'Rejected', 'COMPANY', 3),
        ('REGISTERED', 'Registered', 'BENEFICIARY', 1),
        ('PRE_SELECTED', 'Pre-selected', 'BENEFICIARY', 2),
        ('SELECTED', 'Selected', 'BENEFICIARY', 3),
        ('REJECTED', 'Rejected', 'BENEFICIARY', 4),
        ('DRAFT', 'Draft', 'BUSINESS_PLAN', 1),
        ('SUBMITTED', 'Submitted', 'BUSINESS_PLAN', 2),
        ('UNDER_EVALUATION', 'Under Evaluation', 'BUSINESS_PLAN', 3),
        ('EVALUATED', 'Evaluated', 'BUSINESS_PLAN', 4),
        ('SELECTED', 'Selected', 'BUSINESS_PLAN', 5),
        ('REJECTED', 'Rejected', 'BUSINESS_PLAN', 6),
        ('PENDING', 'Pending', 'SUBSCRIPTION', 1),
        ('CONFIRMED', 'Confirmed', 'SUBSCRIPTION', 2),
        ('CANCELLED', 'Cancelled', 'SUBSCRIPTION', 3),
        ('RECEIVED', 'Received', 'COMPLAINT', 1),
        ('IN_PROGRESS', 'In Progress', 'COMPLAINT', 2),
        ('RESOLVED', 'Resolved', 'COMPLAINT', 3),
        ('REJECTED', 'Rejected', 'COMPLAINT', 4),
        ('SIGNED', 'Signed', 'SUBVENTION', 1),
        ('ACTIVE', 'Active', 'SUBVENTION', 2),
        ('COMPLETED', 'Completed', 'SUBVENTION', 3),
        ('CANCELLED', 'Cancelled', 'SUBVENTION', 4),
        ('PLANNED', 'Planned', 'TRAINING_SESSION', 1),
        ('ONGOING', 'Ongoing', 'TRAINING_SESSION', 2),
        ('COMPLETED', 'Completed', 'TRAINING_SESSION', 3),
        ('CANCELLED', 'Cancelled', 'TRAINING_SESSION', 4);
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
        ('TERMS_AND_CONDITIONS', 'Terms and Conditions', 'Acceptance of terms and conditions', true);
        ('PRIVACY_POLICY', 'Privacy Policy', 'Acceptance of the privacy policy', true);
        ('CERTIFY_ACCURACY', 'Certification of Accuracy', 'Certification that the provided information is accurate and truthful', true);
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
        ('Bujumbura', 'Ouest', true),
        ('Gitega', 'Centre', true),
        ('Kirundo', 'Nord', true),
        ('Ngozi', 'Nord', true),
        ('Rumonge', 'Sud-Ouest', true);
      `);

      console.log('Provinces seeded');

      // Insert Communes (42 communes – réforme 2022)
      await queryRunner.manager.query(`
        INSERT INTO communes (name, province_id, is_active)
        SELECT c.name, p.id, true
        FROM (
          VALUES
          -- BUJUMBURA
          ('Ntahangwa', 'Bujumbura'),
          ('Mukaza', 'Bujumbura'),
          ('Muha', 'Bujumbura'),
          ('Isale', 'Bujumbura'),
          ('Kanyosha', 'Bujumbura'),
          ('Mutimbuzi', 'Bujumbura'),
          ('Mubimbi', 'Bujumbura'),
          ('Nyabiraba', 'Bujumbura'),

          -- GITEGA
          ('Gitega', 'Gitega'),
          ('Giheta', 'Gitega'),
          ('Makebuko', 'Gitega'),
          ('Mutaho', 'Gitega'),
          ('Nyarusange', 'Gitega'),
          ('Ryansoro', 'Gitega'),
          ('Bugendana', 'Gitega'),
          ('Itaba', 'Gitega'),
          ('Bukirasazi', 'Gitega'),

          -- KIRUNDO
          ('Kirundo', 'Kirundo'),
          ('Busoni', 'Kirundo'),
          ('Bwambarangwe', 'Kirundo'),
          ('Gitobe', 'Kirundo'),
          ('Ntega', 'Kirundo'),
          ('Vumbi', 'Kirundo'),

          -- NGOZI
          ('Ngozi', 'Ngozi'),
          ('Busiga', 'Ngozi'),
          ('Gashikanwa', 'Ngozi'),
          ('Kiremba', 'Ngozi'),
          ('Marangara', 'Ngozi'),
          ('Mwumba', 'Ngozi'),
          ('Nyamurenza', 'Ngozi'),
          ('Ruhororo', 'Ngozi'),
          ('Tangara', 'Ngozi'),

          -- RUMONGE
          ('Rumonge', 'Rumonge'),
          ('Burambi', 'Rumonge'),
          ('Buyengero', 'Rumonge'),
          ('Muhuta', 'Rumonge'),
          ('Mabanda', 'Rumonge'),
          ('Nyanza-Lac', 'Rumonge'),
          ('Kayogoro', 'Rumonge'),
          ('Gitanga', 'Rumonge')
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
