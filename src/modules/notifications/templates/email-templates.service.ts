import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export enum EmailTemplateType {
  CONFIRMATION_INSCRIPTION = 'confirmation_inscription',
  PLAN_AFFAIRES_SOUMIS = 'plan_affaires_soumis',
  LAUREAT = 'laureat',
  NON_RETENU = 'non_retenu',
}

export enum SmsTemplateType {
  INSCRIPTION = 'inscription',
  RAPPEL_FORMATION = 'rappel_formation',
  SOUMISSION = 'soumission',
  LAUREAT = 'laureat',
  EQUIPEMENTS = 'equipements',
}

export interface TemplateData {
  // Données communes
  firstName?: string;
  lastName?: string;
  fullName?: string;

  // Email confirmation
  activationLink?: string;

  // Confirmation de profil
  dateEnregistrement?: string;
  datePreselection?: string;
  email?: string;
  dateSoumissionPlan?: string;
  dateResultatsPreselection?: string;

  // Plan d'affaires
  dossierNumero?: string;
  dateSoumission?: string;
  secteur?: string;
  montantDemande?: string;
  dateResultats?: string;

  // Résultats lauréat
  score?: string;
  montantSubvention?: string;

  // Résultats non retenu
  seuilSelection?: string;
  pointsForts?: string;
  axesAmelioration?: string;

  // Formations
  nomFormation?: string;
  dateFormation?: string;
  heureFormation?: string;
  lieuFormation?: string;

  // Équipements
  lotNumero?: string;
  montantEquipement?: string;

  // Génériques
  code?: string;
  telephone?: string;
  annee?: string;
}

@Injectable()
export class EmailTemplatesService {
  private readonly logger = new Logger(EmailTemplatesService.name);
  private readonly baseUrl: string;
  private readonly telephoneSupport: string;

  constructor(private configService: ConfigService) {
    this.baseUrl =
      this.configService.get('APP_URL') || 'https://copa.prete.gov.bi';
    this.telephoneSupport =
      this.configService.get('SUPPORT_PHONE') || '+257XXXXXXXX';
  }

  // ==================== EMAILS TRANSACTIONNELS ====================

  /**
   * Template: Confirmation d'inscription
   */
  getConfirmationInscription(data: TemplateData): {
    subject: string;
    html: string;
    text: string;
  } {
    const subject = 'Bienvenue sur la plateforme COPA – Confirmez votre email';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenue sur COPA</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1F4E79; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background-color: #f9f9f9; }
          .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #1F4E79; 
            color: white !important; 
            text-decoration: none; 
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer { 
            margin-top: 30px; 
            padding: 20px; 
            font-size: 12px; 
            color: #666;
            border-top: 1px solid #ddd;
          }
          .steps { margin: 20px 0; }
          .step { margin-bottom: 15px; padding-left: 25px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Bienvenue sur COPA</h1>
          </div>
          
          <div class="content">
            <p>Bonjour <strong>${data.firstName || ''}</strong>,</p>
            
            <p>Nous sommes ravis de vous accueillir sur la plateforme du <strong>Concours de Plans d'Affaires (COPA)</strong>.</p>
            
            <p>Pour activer votre compte et commencer votre parcours, veuillez confirmer votre adresse email en cliquant sur le lien ci-dessous :</p>
            
            <div style="text-align: center;">
              <a href="${data.activationLink}" class="button">Confirmer mon email</a>
            </div>
            
            <p><small>Ce lien est valable 48 heures.</small></p>
            
            <div class="steps">
              <h3>Prochaines étapes :</h3>
              <div class="step">✓ Compléter votre profil d'entrepreneur</div>
              <div class="step">✓ Vous inscrire aux formations disponibles</div>
              <div class="step">✓ Rédiger et soumettre votre plan d'affaires</div>
            </div>
            
            <p>Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
            <a href="${data.activationLink}">${data.activationLink}</a></p>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} COPA - Concours de Plans d'Affaires du Burundi. Tous droits réservés.</p>
            <p>Pour toute assistance, contactez-nous au <strong>${this.telephoneSupport}</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Bienvenue sur la plateforme COPA – Confirmez votre email

      Bonjour ${data.firstName || ''},

      Nous sommes ravis de vous accueillir sur la plateforme du Concours de Plans d'Affaires (COPA).

      Pour activer votre compte et commencer votre parcours, veuillez confirmer votre adresse email en cliquant sur le lien ci-dessous :
      ${data.activationLink}

      (Ce lien est valable 48 heures)

      Prochaines étapes :
      - Compléter votre profil d'entrepreneur
      - Vous inscrire aux formations disponibles
      - Rédiger et soumettre votre plan d'affaires

      © ${new Date().getFullYear()} COPA - Concours de Plans d'Affaires du Burundi
      Pour toute assistance, contactez-nous au ${this.telephoneSupport}
    `;

    return { subject, html, text };
  }

  /**
   * Template: Confirmation d'enregistrement du profil entrepreneur
   */
  getConfirmationProfilEnregistre(data: TemplateData): {
    subject: string;
    html: string;
    text: string;
  } {
    const subject = `Candidature reçue - N° ${data.code || '00001'}`;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Profil enregistré - COPA</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #1F4E79; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px 20px; background-color: #f9f9f9; }
        .info-box {
          background-color: #e9ecef;
          padding: 20px;
          border-radius: 5px;
          margin: 20px 0;
        }
        .info-row {
          margin-bottom: 10px;
          border-bottom: 1px dashed #dee2e6;
          padding-bottom: 8px;
        }
        .info-row:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        .label {
          font-weight: bold;
          display: inline-block;
          width: 150px;
        }
        .button { 
          display: inline-block; 
          padding: 12px 24px; 
          background-color: #1F4E79; 
          color: white !important; 
          text-decoration: none; 
          border-radius: 5px;
          margin: 20px 0;
        }
        .footer { 
          margin-top: 30px; 
          padding: 20px; 
          font-size: 12px; 
          color: #666;
          border-top: 1px solid #ddd;
        }
        .steps { margin: 20px 0; }
        .step { margin-bottom: 15px; padding-left: 25px; }
        .badge {
          background-color: #1F4E79;
          color: white;
          padding: 5px 10px;
          border-radius: 3px;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Profil enregistré</h1>
        </div>
        
        <div class="content">
          <p>Bonjour <strong>${data.firstName || ''} ${data.lastName || ''}</strong>,</p>
          
          <p>Nous sommes ravis de vous confirmer que votre <strong>profil d'entrepreneur</strong> a bien été enregistré sur la plateforme du Concours de Plans d'Affaires (COPA).</p>

          <div class="info-box">
            <div class="info-row"><span class="label">Code :</span> ${data.code || ''}</div>
            <div class="info-row"><span class="label">Date d'enregistrement :</span> ${data.dateEnregistrement || new Date().toLocaleDateString('fr-FR')}</div>
            <div class="info-row"><span class="label">Statut :</span> <span style="color: #1F4E79; font-weight: bold;">En attente de pré-sélection</span></div>
            <div class="info-row"><span class="label">Email :</span> ${data.email || ''}</div>
          </div>
          
          <div class="steps">
            <h3>Prochaines étapes :</h3>
            <div class="step">✓ <strong>Pré-sélection des profils</strong> – ${data.datePreselection || '15-30 avril 2026'}</div>
            <div class="step">✓ <strong>Formation</strong> (si pré-sélectionné) – ${data.dateFormation || '10-25 mai 2026'}</div>
            <div class="step">✓ <strong>Soumission du plan d'affaires</strong> – ${data.dateSoumissionPlan || 'Juin 2026'}</div>
          </div>
          
          <p>Vous serez notifié(e) par <strong>email et SMS</strong> dès la publication des résultats de pré-sélection.</p>
          <p><strong>Date estimée des résultats :</strong> ${data.dateResultatsPreselection || '30 avril 2026'}</p>
          
          <div style="text-align: center;">
            <a href="#" class="button">Accéder à mon espace</a>
          </div>
          
          <p style="margin-top: 20px;"><small>Votre numéro de dossier vous sera communiqué après la soumission de votre plan d'affaires.</small></p>
          
          // <p>Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
          // <a href="${this.baseUrl}/espace-mpme/tableau-de-bord">${this.baseUrl}/espace-mpme/tableau-de-bord</a></p>
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} COPA - Concours de Plans d'Affaires du Burundi. Tous droits réservés.</p>
          <p>Pour toute assistance, contactez-nous au <strong>${this.telephoneSupport}</strong> ou par email à <strong>contact@copa-prete.bi</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;

    const text = `
    Profil entrepreneur enregistré – COPA ${data.annee || '2026'}

    Bonjour ${data.firstName || ''} ${data.lastName || ''},

    Nous sommes ravis de vous confirmer que votre profil d'entrepreneur a bien été enregistré sur la plateforme du Concours de Plans d'Affaires (COPA).

    RÉCAPITULATIF :
    Date d'enregistrement : ${data.dateEnregistrement || new Date().toLocaleDateString('fr-FR')}
    Statut : En attente de pré-sélection
    Email : ${data.email || ''}

    Prochaines étapes :
    - Pré-sélection des profils : ${data.datePreselection || '15-30 avril 2026'}
    - Formation (si pré-sélectionné) : ${data.dateFormation || '10-25 mai 2026'}
    - Soumission du plan d'affaires : ${data.dateSoumissionPlan || 'Juin 2026'}

    Vous serez notifié(e) par email et SMS dès la publication des résultats de pré-sélection.
    Date estimée des résultats : ${data.dateResultatsPreselection || '30 avril 2026'}

    Accédez à votre espace personnel :
    ${this.baseUrl}/espace-mpme/tableau-de-bord

    Votre numéro de dossier vous sera communiqué après la soumission de votre plan d'affaires.

    © ${new Date().getFullYear()} COPA - Concours de Plans d'Affaires du Burundi
    Pour toute assistance, contactez-nous au ${this.telephoneSupport} ou par email à support@copa.bi
  `;

    return { subject, html, text };
  }

  /**
   * Template: Plan d'affaires soumis
   */
  getPlanAffairesSoumis(data: TemplateData): {
    subject: string;
    html: string;
    text: string;
  } {
    const subject = `Votre plan d'affaires a bien été soumis – Dossier N°${data.dossierNumero || 'XXXXX'}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Confirmation de soumission</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background-color: #f9f9f9; }
          .info-box { 
            background-color: #e9ecef; 
            padding: 20px; 
            border-radius: 5px;
            margin: 20px 0;
          }
          .info-row { margin-bottom: 10px; }
          .label { font-weight: bold; display: inline-block; width: 150px; }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #28a745;
            color: white !important;
            text-decoration: none;
            border-radius: 5px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Soumission confirmée</h1>
          </div>
          
          <div class="content">
            <p>Bonjour <strong>${data.firstName || ''}</strong>,</p>
            
            <p>Nous vous confirmons la réception de votre plan d'affaires.</p>
            
            <div class="info-box">
              <div class="info-row"><span class="label">N° de dossier :</span> ${data.dossierNumero || 'N/A'}</div>
              <div class="info-row"><span class="label">Date de soumission :</span> ${data.dateSoumission || new Date().toLocaleDateString('fr-FR')}</div>
              <div class="info-row"><span class="label">Secteur :</span> ${data.secteur || 'Non spécifié'}</div>
              <div class="info-row"><span class="label">Montant demandé :</span> ${data.montantDemande || 'N/A'} BIF</div>
              <div class="info-row"><span class="label">Date des résultats :</span> ${data.dateResultats || 'À déterminer'}</div>
            </div>
            
            <p>Vous pouvez suivre l'évolution de votre dossier à tout moment :</p>
            
            <div style="text-align: center;">
              <a href="${this.baseUrl}/suivi/${data.dossierNumero}" class="button">Suivre mon dossier</a>
            </div>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} COPA - Concours de Plans d'Affaires du Burundi</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Votre plan d'affaires a bien été soumis – Dossier N°${data.dossierNumero || 'XXXXX'}

      Bonjour ${data.firstName || ''},

      Nous vous confirmons la réception de votre plan d'affaires.

      RÉCAPITULATIF :
      N° de dossier : ${data.dossierNumero || 'N/A'}
      Date de soumission : ${data.dateSoumission || new Date().toLocaleDateString('fr-FR')}
      Secteur : ${data.secteur || 'Non spécifié'}
      Montant demandé : ${data.montantDemande || 'N/A'} BIF
      Date des résultats : ${data.dateResultats || 'À déterminer'}

      Suivez votre dossier : ${this.baseUrl}/suivi/${data.dossierNumero}
    `;

    return { subject, html, text };
  }

  /**
   * Template: Lauréat
   */
  getLaureat(data: TemplateData): {
    subject: string;
    html: string;
    text: string;
  } {
    const subject = `Félicitations ! Vous êtes lauréat(e) du COPA ${data.annee || '2026'}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Félicitations !</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ffd700, #ffa500); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px 20px; background-color: #f9f9f9; }
          .score-box { 
            background-color: #ffd700; 
            color: #333;
            padding: 15px; 
            border-radius: 5px;
            text-align: center;
            font-size: 24px;
            font-weight: bold;
            margin: 20px 0;
          }
          .subvention-box {
            background-color: #28a745;
            color: white;
            padding: 20px;
            border-radius: 5px;
            text-align: center;
            margin: 20px 0;
          }
          .subvention-amount {
            font-size: 32px;
            font-weight: bold;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #1F4E79;
            color: white !important;
            text-decoration: none;
            border-radius: 5px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏆 FÉLICITATIONS ! 🏆</h1>
          </div>
          
          <div class="content">
            <p>Cher(e) <strong>${data.firstName || ''} ${data.lastName || ''}</strong>,</p>
            
            <p>C'est avec une immense fierté que nous vous annonçons votre sélection comme <strong>lauréat(e) du COPA ${data.annee || '2026'}</strong>.</p>
            
            <div class="score-box">
              Votre score : ${data.score || 'N/A'}/100
            </div>
            
            <div class="subvention-box">
              <div>Montant de la subvention accordée</div>
              <div class="subvention-amount">${data.montantSubvention || '0'} BIF</div>
            </div>
            
            <h3>Prochaines étapes :</h3>
            <ol>
              <li><strong>Signature de la convention</strong> - Vous recevrez un lien pour signer électroniquement votre convention de subvention</li>
              <li><strong>Versement de la contribution</strong> - Instructions pour le versement de votre part de contribution</li>
              <li><strong>Calendrier de décaissement</strong> - Planification des versements selon l'avancement du projet</li>
            </ol>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${this.baseUrl}/subvention/${data.dossierNumero}" class="button">Accéder à mon espace subvention</a>
            </div>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} COPA - Concours de Plans d'Affaires du Burundi</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Félicitations ! Vous êtes lauréat(e) du COPA ${data.annee || '2026'}

      Cher(e) ${data.firstName || ''} ${data.lastName || ''},

      C'est avec une immense fierté que nous vous annonçons votre sélection comme lauréat(e) du COPA ${data.annee || '2026'}.

      Votre score : ${data.score || 'N/A'}/100

      MONTANT DE LA SUBVENTION : ${data.montantSubvention || '0'} BIF

      Prochaines étapes :
      1. Signature de la convention
      2. Versement de la contribution
      3. Calendrier de décaissement

      Accédez à votre espace subvention : ${this.baseUrl}/subvention/${data.dossierNumero}
    `;

    return { subject, html, text };
  }

  /**
   * Template: Non retenu
   */
  getNonRetenu(data: TemplateData): {
    subject: string;
    html: string;
    text: string;
  } {
    const subject = `Résultats de votre candidature au COPA ${data.annee || '2026'}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Résultats de votre candidature</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #6c757d; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background-color: #f9f9f9; }
          .score-box { 
            background-color: #e9ecef; 
            padding: 20px; 
            border-radius: 5px;
            text-align: center;
            margin: 20px 0;
          }
          .feedback-box {
            background-color: #d4edda;
            border: 1px solid #c3e6cb;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .improvement-box {
            background-color: #fff3cd;
            border: 1px solid #ffeeba;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #1F4E79;
            color: white !important;
            text-decoration: none;
            border-radius: 5px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Résultats COPA ${data.annee || '2026'}</h1>
          </div>
          
          <div class="content">
            <p>Bonjour <strong>${data.firstName || ''} ${data.lastName || ''}</strong>,</p>
            
            <p>Nous vous remercions chaleureusement pour votre participation au Concours de Plans d'Affaires (COPA) ${data.annee || '2026'}.</p>
            
            <div class="score-box">
              <strong>Votre score : ${data.score || 'N/A'}/100</strong><br>
              <small>Seuil de sélection : ${data.seuilSelection || 'N/A'}/100</small>
            </div>
            
            <div class="feedback-box">
              <h3>🌟 Points forts de votre dossier</h3>
              <p>${data.pointsForts || 'Votre dossier présente des qualités notables que nous encourageons à développer.'}</p>
            </div>
            
            <div class="improvement-box">
              <h3>📈 Axes d'amélioration pour la prochaine édition</h3>
              <p>${data.axesAmelioration || 'Voici quelques pistes pour renforcer votre prochaine candidature.'}</p>
            </div>
            
            <p>Nous vous encourageons vivement à participer à la prochaine édition du COPA. Votre détermination et votre projet méritent d'être retravaillés pour atteindre l'excellence.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${this.baseUrl}/formations" class="button">Découvrir nos formations</a>
            </div>
            
            <p>Des sessions de formation et d'accompagnement sont disponibles pour vous aider à perfectionner votre projet.</p>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} COPA - Concours de Plans d'Affaires du Burundi</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Résultats de votre candidature au COPA ${data.annee || '2026'}

      Bonjour ${data.firstName || ''} ${data.lastName || ''},

      Nous vous remercions pour votre participation au COPA ${data.annee || '2026'}.

      Votre score : ${data.score || 'N/A'}/100
      Seuil de sélection : ${data.seuilSelection || 'N/A'}/100

      POINTS FORTS :
      ${data.pointsForts || 'Votre dossier présente des qualités notables.'}

      AXES D'AMÉLIORATION :
      ${data.axesAmelioration || 'Voici des pistes pour renforcer votre prochaine candidature.'}

      Nous vous encourageons à participer à la prochaine édition.
      Des formations sont disponibles : ${this.baseUrl}/formations
    `;

    return { subject, html, text };
  }

  // ==================== TEMPLATES SMS ====================

  /**
   * Génère un SMS (max 160 caractères)
   */
  getSms(templateType: SmsTemplateType, data: TemplateData): string {
    switch (templateType) {
      case SmsTemplateType.INSCRIPTION:
        return `COPA: Votre compte est créé! Connectez-vous sur ${this.baseUrl} pour compléter votre profil. Code: ${data.code || '[XXXX]'}`.substring(
          0,
          160,
        );

      case SmsTemplateType.RAPPEL_FORMATION:
        return `COPA: Rappel - Formation ${data.nomFormation || '[Nom]'} demain ${data.dateFormation || '[Date]'} à ${data.heureFormation || '[Heure]'} à ${data.lieuFormation || '[Lieu]'}. Confirmez votre présence sur ${this.baseUrl}`.substring(
          0,
          160,
        );

      case SmsTemplateType.SOUMISSION:
        return `COPA: Votre plan d'affaires N°${data.dossierNumero || '[XXXXX]'} est bien reçu. Résultats prévus le ${data.dateResultats || '[Date]'}. Suivi: ${this.baseUrl}`.substring(
          0,
          160,
        );

      case SmsTemplateType.LAUREAT:
        return `COPA: Félicitations! Vous êtes lauréat(e)! Subvention: ${data.montantSubvention || '[X]'} BIF. Détails: ${this.baseUrl} ou appelez ${this.telephoneSupport}`.substring(
          0,
          160,
        );

      case SmsTemplateType.EQUIPEMENTS:
        return `COPA: Équipements lot ${data.lotNumero || '[X]'} de ${data.montantEquipement || '[Y]'} BIF livrés. Vérifiez la réception. Questions: ${this.telephoneSupport}`.substring(
          0,
          160,
        );

      default:
        this.logger.warn(`Template SMS inconnu: ${templateType}`);
        return '';
    }
  }

  // ==================== MÉTHODES UTILITAIRES ====================

  /**
   * Génère un code de vérification aléatoire
   */
  generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Formate un montant en BIF
   */
  formatMontant(montant: number): string {
    return new Intl.NumberFormat('fr-BI', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(montant);
  }

  /**
   * Formate une date au format burundais
   */
  formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  /**
   * Génère un numéro de dossier unique
   */
  generateDossierNumero(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(10000 + Math.random() * 90000);
    return `COPA-${year}-${random}`;
  }
}
