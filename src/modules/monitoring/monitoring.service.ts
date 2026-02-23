import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';

import { MonitoringIndicator } from './entities/monitoring-indicator.entity';
import { IndicatorMeasurement } from './entities/indicator-measurement.entity';
import {
  CreateIndicatorDto,
  RecordMeasurementDto,
  DashboardDto,
  ReportRequestDto,
} from './dto';
import { BeneficiariesService } from '../beneficiaries/beneficiaries.service';
import { BusinessPlansService } from '../business-plans/business-plans.service';
import { SubventionsService } from '../subventions/subventions.service';
import { ComplaintsService } from '../complaints/complaints.service';

@Injectable()
export class MonitoringService {
  constructor(
    @InjectRepository(MonitoringIndicator)
    private readonly indicatorRepository: Repository<MonitoringIndicator>,
    @InjectRepository(IndicatorMeasurement)
    private readonly measurementRepository: Repository<IndicatorMeasurement>,
    private readonly beneficiariesService: BeneficiariesService,
    private readonly businessPlansService: BusinessPlansService,
    private readonly subventionsService: SubventionsService,
    private readonly complaintsService: ComplaintsService,
  ) {}

  async createIndicator(
    createDto: CreateIndicatorDto,
  ): Promise<MonitoringIndicator> {
    const indicator = this.indicatorRepository.create(createDto);
    return this.indicatorRepository.save(indicator);
  }

  async getIndicators(
    activeOnly: boolean = true,
  ): Promise<MonitoringIndicator[]> {
    return await this.indicatorRepository.find({
      where: activeOnly ? { isActive: true } : {},
      order: { code: 'ASC' },
    });
  }

  async recordMeasurement(
    recordDto: RecordMeasurementDto,
  ): Promise<IndicatorMeasurement> {
    const indicator = await this.indicatorRepository.findOne({
      where: { id: recordDto.indicatorId },
    });

    if (!indicator) {
      throw new BadRequestException('Indicator not found');
    }

    const measurement = this.measurementRepository.create(recordDto);
    return this.measurementRepository.save(measurement);
  }

  async getDashboard(dashboardDto: DashboardDto): Promise<any> {
    const { copaEditionId, startDate, endDate } = dashboardDto;

    // Get key statistics
    const [
      beneficiaryStats,
      businessPlanStats,
      subventionStats,
      complaintStats,
      jobsStats,
    ] = await Promise.all([
      this.getBeneficiaryStats(copaEditionId, startDate, endDate),
      this.getBusinessPlanStats(copaEditionId, startDate, endDate),
      this.getSubventionStats(copaEditionId, startDate, endDate),
      this.getComplaintStats(copaEditionId, startDate, endDate),
      this.getJobsStats(copaEditionId, startDate, endDate),
    ]);

    // Get indicator measurements
    const indicators = await this.getIndicatorMeasurements(
      copaEditionId,
      startDate,
      endDate,
    );

    return {
      summary: {
        beneficiaries: beneficiaryStats,
        businessPlans: businessPlanStats,
        subventions: subventionStats,
        complaints: complaintStats,
        jobs: jobsStats,
      },
      indicators,
    };
  }

  async generateReport(reportDto: ReportRequestDto): Promise<any> {
    const { indicatorIds, copaEditionId, startDate, endDate, format } =
      reportDto;

    let indicators: MonitoringIndicator[];

    if (indicatorIds && indicatorIds.length > 0) {
      indicators = await this.indicatorRepository.findByIds(indicatorIds);
    } else {
      indicators = await this.getIndicators(true);
    }

    const measurements = await this.measurementRepository.find({
      where: {
        indicatorId: In(indicators.map((i) => i.id)),
        measurementDate: Between(startDate, endDate),
        ...(copaEditionId ? { copaEditionId } : {}),
      },
      relations: ['indicator'],
      order: { measurementDate: 'ASC' },
    });

    // Group by indicator
    const reportData = indicators.map((indicator) => {
      const indicatorMeasurements = measurements.filter(
        (m) => m.indicatorId === indicator.id,
      );

      return {
        indicator: {
          code: indicator.code,
          name: indicator.name,
          unit: indicator.unit,
        },
        measurements: indicatorMeasurements.map((m) => ({
          date: m.measurementDate,
          value: m.value,
          disaggregation: m.disaggregationDimension
            ? { [m.disaggregationDimension]: m.disaggregationValue }
            : null,
        })),
        summary: {
          total: indicatorMeasurements.reduce(
            (sum, m) => sum + (m.value || 0),
            0,
          ),
          average:
            indicatorMeasurements.length > 0
              ? indicatorMeasurements.reduce(
                  (sum, m) => sum + (m.value || 0),
                  0,
                ) / indicatorMeasurements.length
              : 0,
          min:
            indicatorMeasurements.length > 0
              ? Math.min(...indicatorMeasurements.map((m) => m.value || 0))
              : 0,
          max:
            indicatorMeasurements.length > 0
              ? Math.max(...indicatorMeasurements.map((m) => m.value || 0))
              : 0,
        },
      };
    });

    return {
      report: {
        generatedAt: new Date(),
        period: { startDate, endDate },
        copaEdition: copaEditionId,
        format,
      },
      data: reportData,
    };
  }

  private async getBeneficiaryStats(
    copaEditionId?: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    const queryBuilder =
      this.beneficiariesService['beneficiaryRepository'].createQueryBuilder(
        'b',
      );

    if (copaEditionId) {
      queryBuilder.innerJoin(
        'b.businessPlans',
        'bp',
        'bp.copaEditionId = :copaEditionId',
        {
          copaEditionId,
        },
      );
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('b.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const total = await queryBuilder.getCount();

    const byGender = await queryBuilder
      .clone()
      .leftJoin('b.user', 'u')
      .leftJoin('u.gender', 'g')
      .select('g.code', 'gender')
      .addSelect('COUNT(*)', 'count')
      .groupBy('g.code')
      .getRawMany();

    const byStatus = await queryBuilder
      .clone()
      .leftJoin('b.status', 's')
      .select('s.code', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('s.code')
      .getRawMany();

    return {
      total,
      byGender,
      byStatus,
    };
  }

  private async getBusinessPlanStats(
    copaEditionId?: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    const queryBuilder =
      this.businessPlansService['businessPlanRepository'].createQueryBuilder(
        'bp',
      );

    if (copaEditionId) {
      queryBuilder.andWhere('bp.copaEditionId = :copaEditionId', {
        copaEditionId,
      });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('bp.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const total = await queryBuilder.getCount();
    const submitted = await queryBuilder
      .clone()
      .andWhere('bp.submittedAt IS NOT NULL')
      .getCount();

    const byStatus = await queryBuilder
      .clone()
      .leftJoin('bp.status', 's')
      .select('s.code', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('s.code')
      .getRawMany();

    const totalFunding = await queryBuilder
      .clone()
      .select('SUM(bp.requestedFundingAmount)', 'total')
      .getRawOne();

    const averageScore = await queryBuilder
      .clone()
      .leftJoin('bp.evaluations', 'e', 'e.isFinalEvaluation = true')
      .select('AVG(e.totalScore)', 'average')
      .getRawOne();

    return {
      total,
      submitted,
      byStatus,
      totalRequestedFunding: totalFunding?.total || 0,
      averageScore: averageScore?.average || 0,
    };
  }

  private async getSubventionStats(
    copaEditionId?: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    const queryBuilder =
      this.subventionsService['subventionRepository'].createQueryBuilder('s');

    if (copaEditionId) {
      queryBuilder.andWhere('s.copaEditionId = :copaEditionId', {
        copaEditionId,
      });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('s.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const total = await queryBuilder.getCount();
    const totalAmount = await queryBuilder
      .clone()
      .select('SUM(s.awardedAmount)', 'total')
      .getRawOne();

    const byStatus = await queryBuilder
      .clone()
      .leftJoin('s.status', 'st')
      .select('st.code', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('st.code')
      .getRawMany();

    const disbursedAmount = await queryBuilder
      .clone()
      .leftJoin('s.tranches', 't')
      .where('t.status = :status', { status: 'RELEASED' })
      .select('SUM(t.amount)', 'total')
      .getRawOne();

    return {
      total,
      totalAwarded: totalAmount?.total || 0,
      totalDisbursed: disbursedAmount?.total || 0,
      byStatus,
    };
  }

  private async getComplaintStats(
    copaEditionId?: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    const queryBuilder =
      this.complaintsService['complaintRepository'].createQueryBuilder('c');

    if (copaEditionId) {
      // Complaints might be linked to COPA edition through context
      queryBuilder.andWhere("c.context->>'copaEditionId' = :copaEditionId", {
        copaEditionId,
      });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('c.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const total = await queryBuilder.getCount();

    const byType = await queryBuilder
      .clone()
      .leftJoin('c.complaintType', 'ct')
      .select('ct.name', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('ct.name')
      .getRawMany();

    const byStatus = await queryBuilder
      .clone()
      .leftJoin('c.status', 's')
      .select('s.code', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('s.code')
      .getRawMany();

    const vbgCount = await queryBuilder
      .clone()
      .andWhere('c.generatedVbgAlert = :vbg', { vbg: true })
      .getCount();

    return {
      total,
      vbgAlerts: vbgCount,
      byType,
      byStatus,
    };
  }

  private async getJobsStats(
    copaEditionId?: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    const queryBuilder = this.subventionsService['createdJobRepository']
      .createQueryBuilder('j')
      .leftJoin('j.subvention', 's');

    if (copaEditionId) {
      queryBuilder.andWhere('s.copaEditionId = :copaEditionId', {
        copaEditionId,
      });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere('j.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    const total = await queryBuilder.getCount();

    const byGender = await queryBuilder
      .clone()
      .leftJoin('j.employeeGender', 'g')
      .select('g.code', 'gender')
      .addSelect('COUNT(*)', 'count')
      .groupBy('g.code')
      .getRawMany();

    const refugeeCount = await queryBuilder
      .clone()
      .andWhere('j.isRefugee = :refugee', { refugee: true })
      .getCount();

    const maintainedCount = await queryBuilder
      .clone()
      .andWhere('j.jobStillMaintained = :maintained', { maintained: true })
      .getCount();

    return {
      total,
      refugeeCount,
      maintainedCount,
      byGender,
    };
  }

  private async getIndicatorMeasurements(
    copaEditionId?: number,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any[]> {
    const queryBuilder = this.measurementRepository
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.indicator', 'i')
      .orderBy('m.measurementDate', 'DESC');

    if (copaEditionId) {
      queryBuilder.andWhere('m.copaEditionId = :copaEditionId', {
        copaEditionId,
      });
    }

    if (startDate && endDate) {
      queryBuilder.andWhere(
        'm.measurementDate BETWEEN :startDate AND :endDate',
        { startDate, endDate },
      );
    }

    const measurements = await queryBuilder.limit(100).getMany();

    // Group by indicator
    const grouped = {};
    measurements.forEach((m) => {
      if (!grouped[m.indicatorId]) {
        grouped[m.indicatorId] = {
          indicator: {
            id: m.indicator.id,
            code: m.indicator.code,
            name: m.indicator.name,
            unit: m.indicator.unit,
          },
          measurements: [],
        };
      }
      grouped[m.indicatorId].measurements.push({
        date: m.measurementDate,
        value: m.value,
        disaggregation: m.disaggregationDimension
          ? {
              dimension: m.disaggregationDimension,
              value: m.disaggregationValue,
            }
          : null,
      });
    });

    return Object.values(grouped);
  }
}
