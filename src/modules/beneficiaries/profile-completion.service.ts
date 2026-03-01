// services/profile-completion.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Beneficiary } from './entities/beneficiary.entity';

@Injectable()
export class ProfileCompletionService {
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

    let percentage = 0;
    let lastStep = '';

    // Vérifier étape 1 (33%)
    if (this.isStep1Complete(beneficiary)) {
      percentage = 33;
      lastStep = 'STEP1';
    }

    // Vérifier étape 2 (67%)
    if (this.isStep2Complete(beneficiary)) {
      percentage = 67;
      lastStep = 'STEP2';
    }

    // Vérifier étape 3 (100%)
    if (this.isStep3Complete(beneficiary)) {
      percentage = 100;
      lastStep = 'STEP3';

      // Si c'est la première fois que le profil est complet à 100%
      if (!beneficiary.profileCompletedAt) {
        beneficiary.profileCompletedAt = new Date();
      }
    }

    // Mettre à jour le bénéficiaire
    beneficiary.profileCompletionPercentage = percentage;
    beneficiary.profileCompletionStep = lastStep;

    await this.beneficiaryRepository.save(beneficiary);

    return percentage;
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
    if (!beneficiary.company) {
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
