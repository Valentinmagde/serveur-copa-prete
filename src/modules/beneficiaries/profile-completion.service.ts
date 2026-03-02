// services/profile-completion.service.ts
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

  // async calculateAndUpdateCompletion(beneficiaryId: number): Promise<number> {
  //   const beneficiary = await this.beneficiaryRepository.findOne({
  //     where: { id: beneficiaryId },
  //     relations: [
  //       'user',
  //       'user.consents',
  //       'user.consents.consentType',
  //       'user.primaryAddress',
  //       'user.gender',
  //       'company',
  //     ],
  //   });

  //   if (!beneficiary) return 0;

  //   let percentage = 0;
  //   let lastStep = '';

  //   // Vérifier étape 1 (33%)
  //   if (this.isStep1Complete(beneficiary)) {
  //     percentage = 33;
  //     lastStep = 'STEP1';
  //   }

  //   // Vérifier étape 2 (67%)
  //   if (this.isStep2Complete(beneficiary)) {
  //     percentage = this.isStep1Complete(beneficiary) ? 67 : 33;
  //     lastStep = 'STEP2';
  //   }

  //   // Vérifier étape 3 (100%)
  //   if (this.isStep3Complete(beneficiary)) {
  //     percentage = this.isStep1Complete(beneficiary) && this.isStep2Complete(beneficiary) ? 100 : !this.isStep1Complete(beneficiary) && !this.isStep2Complete(beneficiary) ? 0 : this.isStep1Complete(beneficiary) || this.isStep2Complete(beneficiary) ? 67 : 33;
  //     lastStep = 'STEP3';

  //     // Si c'est la première fois que le profil est complet à 100%
  //     if (!beneficiary.profileCompletedAt) {
  //       beneficiary.profileCompletedAt = new Date();
  //     }
  //   }

  //   // Mettre à jour le bénéficiaire
  //   beneficiary.profileCompletionPercentage = percentage;
  //   beneficiary.profileCompletionStep = lastStep;

  //   await this.beneficiaryRepository.save(beneficiary);

  //   return percentage;
  // }

  async calculateAndUpdateCompletion(beneficiaryId: number): Promise<number> {
    // Optimisation 1: Sélectionner uniquement les champs nécessaires
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

    // Optimisation 2: Calculer une seule fois l'état des étapes
    const steps = {
      step1: this.isStep1Complete(beneficiary),
      step2: this.isStep2Complete(beneficiary),
      step3: this.isStep3Complete(beneficiary),
    };

    this.logger.log("=== ÉTAPE 2 ===", this.isStep2Complete(beneficiary));
    // Optimisation 3: Déterminer le pourcentage et l'étape de façon déclarative
    const { percentage, lastStep } = this.calculateCompletionPercentage(steps);

    // Optimisation 4: Gérer la date de complétion uniquement si nécessaire
    const shouldUpdateCompletedAt =
      percentage === 100 &&
      !beneficiary.profileCompletedAt &&
      steps.step1 &&
      steps.step2 &&
      steps.step3;

    if (shouldUpdateCompletedAt) {
      beneficiary.profileCompletedAt = new Date();
    }

    // Optimisation 5: Sauvegarder uniquement si des changements ont eu lieu
    const hasChanges =
      beneficiary.profileCompletionPercentage !== percentage ||
      beneficiary.profileCompletionStep !== lastStep ||
      shouldUpdateCompletedAt;

    if (hasChanges) {
      beneficiary.profileCompletionPercentage = percentage;
      beneficiary.profileCompletionStep = lastStep;
      await this.beneficiaryRepository.save(beneficiary);
    }

    return percentage;
  }

  private calculateCompletionPercentage(steps: {
    step1: boolean;
    step2: boolean;
    step3: boolean;
  }): { percentage: number; lastStep: string } {
    const { step1, step2, step3 } = steps;

    // Table de décision claire et maintenable
    if (step1 && step2 && step3) {
      return { percentage: 100, lastStep: 'STEP3' };
    }

    if (step1 && step3) {
      return { percentage: 67, lastStep: 'STEP1' };
    }

    if (step1 && step2) {
      return { percentage: 67, lastStep: 'STEP2' };
    }

    if (step1) {
      return { percentage: 33, lastStep: 'STEP1' };
    }

    if (step2) {
      return { percentage: 33, lastStep: 'STEP2' };
    }

    if (step3) {
      return { percentage: 33, lastStep: 'STEP1' };
    }

    return { percentage: 0, lastStep: '' };
  }

  private isStep1Complete(beneficiary: Beneficiary): boolean {
    const user = beneficiary.user;

    // Vérifier les champs obligatoires de l'étape 1
    return !!(
      user?.email &&
      user?.firstName &&
      user?.lastName &&
      user?.birthDate &&
      user?.genderId &&
      user?.phoneNumber &&
      user?.primaryAddressId
    );
  }

  private isStep2Complete(beneficiary: Beneficiary): boolean {
    // Si l'utilisateur n'a pas d'entreprise, l'étape 2 est considérée comme complète
    if (beneficiary.companyType === 'project') {
      return true;
    }

    // Si l'utilisateur a une entreprise, vérifier les champs
    if (beneficiary.company) {
      return !!(
        beneficiary.company.companyName &&
        beneficiary.company.taxIdNumber &&
        beneficiary.company.primarySectorId &&
        beneficiary.company.creationDate &&
        beneficiary.company.permanentEmployees &&
        beneficiary.company.activityDescription
      );
    }

    return false;
  }

  private isStep3Complete(beneficiary: Beneficiary): boolean {
    console.log('=== VÉRIFICATION ÉTAPE 3 ===');

    if (!beneficiary?.user) {
      console.log("❌ Pas d'utilisateur associé");
      return false;
    }

    const user = beneficiary.user;
    console.log('User ID:', user.id);
    console.log('cguAcceptedAt:', user.cguAcceptedAt);

    if (!user.consents || !Array.isArray(user.consents)) {
      console.log('❌ Pas de consentements');
      return false;
    }

    console.log('Nombre de consentements:', user.consents.length);

    // Afficher tous les consentements pour debug
    // user.consents.forEach((consent) => {
    //   console.log(
    //     `- ${consent.consentType.code}: ${consent.value} (givenAt: ${consent.givenAt})`,
    //   );
    // });

    // Vérifier les consentements requis
    const requiredConsents = [
      'TERMS_AND_CONDITIONS',
      'PRIVACY_POLICY',
      'CERTIFY_ACCURACY',
    ];

    const consentMap = new Map(
      user.consents.map((consent) => [consent.consentType.code, consent]),
    );

    let allRequiredValid = true;

    for (const requiredCode of requiredConsents) {
      const consent = consentMap.get(requiredCode);
      const isValid = consent?.value === true;

      console.log(`${requiredCode}: ${isValid ? '✅' : '❌'}`, {
        exists: !!consent,
        value: consent?.value,
        givenAt: consent?.givenAt,
      });

      if (!isValid) {
        allRequiredValid = false;
      }
    }

    const result = allRequiredValid && !!user.cguAcceptedAt;

    return result;
  }
}
