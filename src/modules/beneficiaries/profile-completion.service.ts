import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Beneficiary } from './entities/beneficiary.entity';

@Injectable()
export class ProfileCompletionService {
  private readonly logger = new Logger(ProfileCompletionService.name);

  constructor(
    @InjectRepository(Beneficiary)
    private beneficiaryRepository: Repository<Beneficiary>,
  ) {}

  async calculateAndUpdateCompletion(beneficiaryId: number): Promise<number> {
    const beneficiary = await this.beneficiaryRepository.findOne({
      where: { id: beneficiaryId },
      relations: [
        'user',
        'user.consents',
        'user.consents.consentType',
        'user.primaryAddress',
        'user.gender',
        'company',
      ],
    });

    if (!beneficiary) return 0;

    // Calculer l'état de chaque étape
    const step1Complete = this.isStep1Complete(beneficiary);
    const step2Complete = this.isStep2Complete(beneficiary);
    const step3Complete = this.isStep3Complete(beneficiary);

    this.logger.log(
      `Étapes: STEP1=${step1Complete}, STEP2=${step2Complete}, STEP3=${step3Complete}`,
    );

    // Déterminer le pourcentage et l'étape en cours
    let percentage = 0;
    let lastStep = '';

    if (step1Complete) {
      percentage = 33;
      lastStep = 'STEP1';
    }

    if (step1Complete && step2Complete) {
      percentage = 67;
      lastStep = 'STEP2';
    }

    if (step1Complete && step2Complete && step3Complete) {
      percentage = 100;
      lastStep = 'STEP3';

      // Marquer le profil comme complet si ce n'est pas déjà fait
      if (!beneficiary.profileCompletedAt) {
        beneficiary.profileCompletedAt = new Date();
      }
    }

    // Mettre à jour le bénéficiaire si nécessaire
    const hasChanges =
      beneficiary.profileCompletionPercentage !== percentage ||
      beneficiary.profileCompletionStep !== lastStep;

    if (hasChanges) {
      beneficiary.profileCompletionPercentage = percentage;
      beneficiary.profileCompletionStep = lastStep;
      await this.beneficiaryRepository.save(beneficiary);
      this.logger.log(
        `Profil ${beneficiaryId} mis à jour: ${percentage}% (${lastStep})`,
      );
    }

    return percentage;
  }

  private isStep1Complete(beneficiary: Beneficiary): boolean {
    const user = beneficiary.user;

    if (!user) return false;

    // Champs obligatoires de l'étape 1
    const requiredFields = [
      user.email,
      user.firstName,
      user.lastName,
      user.birthDate,
      user.genderId,
      user.phoneNumber,
      user.primaryAddressId,
    ];

    const allFieldsPresent = requiredFields.every((field) => !!field);

    if (!allFieldsPresent) {
      this.logger.debug(`STEP1 incomplet: champs manquants`);
    }

    return allFieldsPresent;
  }

  private isStep2Complete(beneficiary: Beneficiary): boolean {
    // Si pas d'entreprise (project), l'étape 2 est considérée comme complète
    if (beneficiary.companyType === 'project') {
      return true;
    }

    const company = beneficiary.company;

    // Si l'utilisateur a une entreprise, vérifier les champs obligatoires
    if (company) {
      const requiredFields = [
        company.companyName,
        // company.taxIdNumber,
        // company.primarySectorId,
        company.creationDate,
        company.permanentEmployees,
        company.activityDescription,
      ];

      const allFieldsPresent = requiredFields.every((field) => !!field);

      if (!allFieldsPresent) {
        this.logger.debug(`STEP2 incomplet: champs entreprise manquants`);
      }

      return allFieldsPresent;
    }

    return false;
  }

  private isStep3Complete(beneficiary: Beneficiary): boolean {
    const user = beneficiary.user;

    if (!user) return false;

    // Vérifier que les consentements requis sont présents et valides
    const requiredConsents = [
      'TERMS_AND_CONDITIONS',
      'PRIVACY_POLICY',
      'CERTIFY_ACCURACY',
    ];

    if (!user.consents || user.consents.length === 0) {
      this.logger.debug('STEP3 incomplet: aucun consentement');
      return false;
    }

    const consentMap = new Map(
      user.consents.map((consent) => [consent.consentType.code, consent]),
    );

    const allConsentsValid = requiredConsents.every(
      (code) => consentMap.get(code)?.value === true,
    );

    if (!allConsentsValid) {
      this.logger.debug('STEP3 incomplet: consentements requis manquants');
    }

    // Vérifier que les CGU ont été acceptées
    const cguAccepted = !!user.cguAcceptedAt;

    const requiredFields = [
      beneficiary.projectTitle,
      beneficiary.projectObjective,
      beneficiary.projectSectors,
      beneficiary.mainActivities,
    ];

    const allFieldsPresent = requiredFields.every((field) => !!field);

    return allConsentsValid && cguAccepted && allFieldsPresent;
  }
}
