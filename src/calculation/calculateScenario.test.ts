import { describe, expect, it } from 'vitest'
import { calculateScenario } from './calculateScenario'

describe('калькулятор экономики группы: эталонные сценарии', () => {
  it('сценарий 1: считает базовую группу с полной экономикой', () => {
    const result = calculateScenario({
      payingStudents: 10,
      averageNetPriceMinor: 300_000,
      otherRevenueMinor: 0,
      sessionsPerPeriod: 8,
      teacher: { method: 'perSession', amountMinor: 150_000 },
      rent: { method: 'perSession', amountMinor: 100_000 },
      variableCosts: { perStudentMinor: 10_000, perSessionMinor: 0 },
      acquiringFeeBasisPoints: 300,
      otherDirectCostsMinor: 0,
      overheadPools: [{
        id: 'branch-administration',
        name: 'Администрация филиала',
        poolMinor: 10_000_000,
        allocationBase: 'hours',
        groupBase: 8,
        totalBase: 200,
      }],
    })

    expect(result.validationMessages).toEqual([])
    expect(result.revenue.totalMinor).toBe(3_000_000)
    expect(result.directCosts).toMatchObject({
      variablePerStudentMinor: 100_000,
      acquiringFeeMinor: 90_000,
      teacherMinor: 1_200_000,
      rentMinor: 800_000,
    })
    expect(result.directContributionMinor).toBe(810_000)
    expect(result.overheads[0]).toMatchObject({ share: 0.04, allocatedMinor: 400_000 })
    expect(result.fullProfitMinor).toBe(410_000)
    expect(result.operationalBreakEven).toMatchObject({ status: 'reached', students: 8 })
    expect(result.fullBreakEven).toMatchObject({ status: 'reached', students: 9 })
  })

  it('сценарий 2: рассчитывает педагога как процент от выручки', () => {
    const result = calculateScenario({
      payingStudents: 12,
      averageNetPriceMinor: 250_000,
      otherRevenueMinor: 0,
      sessionsPerPeriod: 8,
      teacher: { method: 'percentOfRevenue', percentBasisPoints: 3_000 },
      rent: { method: 'perSession', amountMinor: 100_000 },
      variableCosts: { perStudentMinor: 15_000, perSessionMinor: 0 },
      acquiringFeeBasisPoints: 200,
      otherDirectCostsMinor: 0,
      overheadPools: [],
    })

    expect(result.revenue.totalMinor).toBe(3_000_000)
    expect(result.directCosts).toMatchObject({
      teacherMinor: 900_000,
      rentMinor: 800_000,
      variablePerStudentMinor: 180_000,
      acquiringFeeMinor: 60_000,
    })
    expect(result.directContributionMinor).toBe(1_060_000)
    expect(result.fullProfitMinor).toBe(1_060_000)
  })

  it('сценарий 3: использует заданное число занятий, а не четыре недели', () => {
    const result = calculateScenario({
      payingStudents: 10,
      averageNetPriceMinor: 300_000,
      otherRevenueMinor: 0,
      sessionsPerPeriod: 10,
      teacher: { method: 'perSession', amountMinor: 150_000 },
      rent: { method: 'perSession', amountMinor: 100_000 },
      variableCosts: { perStudentMinor: 0, perSessionMinor: 0 },
      acquiringFeeBasisPoints: 0,
      otherDirectCostsMinor: 0,
      overheadPools: [],
    })

    expect(result.directCosts).toMatchObject({ teacherMinor: 1_500_000, rentMinor: 1_000_000 })
    expect(result.directContributionMinor).toBe(500_000)
    expect(result.fullProfitMinor).toBe(500_000)
  })

  it('сценарий 4: не делит показатели на ученика на ноль', () => {
    const result = calculateScenario({
      payingStudents: 0,
      averageNetPriceMinor: 300_000,
      otherRevenueMinor: 0,
      sessionsPerPeriod: 8,
      teacher: { method: 'perSession', amountMinor: 150_000 },
      rent: { method: 'perSession', amountMinor: 100_000 },
      variableCosts: { perStudentMinor: 0, perSessionMinor: 0 },
      acquiringFeeBasisPoints: 0,
      otherDirectCostsMinor: 0,
      overheadPools: [],
    })

    expect(result.revenue.totalMinor).toBe(0)
    expect(result.directContributionMinor).toBe(-2_000_000)
    expect(result.fullProfitMinor).toBe(-2_000_000)
    expect(result.operationalBreakEven).toMatchObject({ status: 'reached', students: 7 })
  })

  it('сценарий 5: не показывает фиктивную безубыточность при отрицательном вкладе ученика', () => {
    const result = calculateScenario({
      payingStudents: 0,
      averageNetPriceMinor: 100_000,
      otherRevenueMinor: 0,
      sessionsPerPeriod: 0,
      teacher: { method: 'perPeriod', amountMinor: 0 },
      rent: { method: 'perPeriod', amountMinor: 0 },
      variableCosts: { perStudentMinor: 105_000, perSessionMinor: 0 },
      acquiringFeeBasisPoints: 0,
      otherDirectCostsMinor: 0,
      overheadPools: [],
    })

    expect(result.operationalBreakEven).toMatchObject({
      status: 'unreachable',
      students: null,
      contributionPerAdditionalStudentMinor: -5_000,
    })
    expect(result.fullBreakEven).toMatchObject({ status: 'unreachable', students: null })
  })

  it('сценарий 6: распределяет пул управляющей компании по плановой выручке сети', () => {
    const result = calculateScenario({
      payingStudents: 10,
      averageNetPriceMinor: 300_000,
      otherRevenueMinor: 0,
      sessionsPerPeriod: 0,
      teacher: { method: 'perPeriod', amountMinor: 2_000_000 },
      rent: { method: 'perPeriod', amountMinor: 0 },
      variableCosts: { perStudentMinor: 0, perSessionMinor: 0 },
      acquiringFeeBasisPoints: 0,
      otherDirectCostsMinor: 0,
      overheadPools: [{
        id: 'management-company',
        name: 'Управляющая компания',
        poolMinor: 6_000_000,
        allocationBase: 'revenue',
        totalBase: 30_000_000,
      }],
    })

    expect(result.overheads[0]).toMatchObject({
      groupBase: 3_000_000,
      totalBase: 30_000_000,
      share: 0.1,
      allocatedMinor: 600_000,
    })
    expect(result.directContributionMinor).toBe(1_000_000)
    expect(result.fullProfitMinor).toBe(400_000)
    expect(result.fullBreakEven).toMatchObject({ status: 'reached', students: 9 })
  })

  it('сценарий 7: считает прочую выручку и фиксированные расходы периода один раз', () => {
    const result = calculateScenario({
      payingStudents: 5,
      averageNetPriceMinor: 200_000,
      otherRevenueMinor: 100_000,
      sessionsPerPeriod: 4,
      teacher: { method: 'perPeriod', amountMinor: 500_000 },
      rent: { method: 'perPeriod', amountMinor: 200_000 },
      variableCosts: { perStudentMinor: 0, perSessionMinor: 20_000 },
      acquiringFeeBasisPoints: 0,
      otherDirectCostsMinor: 0,
      overheadPools: [],
    })

    expect(result.revenue.totalMinor).toBe(1_100_000)
    expect(result.directCosts).toMatchObject({
      teacherMinor: 500_000,
      rentMinor: 200_000,
      variablePerSessionMinor: 80_000,
    })
    expect(result.directContributionMinor).toBe(320_000)
    expect(result.fullProfitMinor).toBe(320_000)
  })
})

describe('калькулятор экономики группы: защитные проверки', () => {
  it('не требует базу распределения для нулевого пула расходов', () => {
    const result = calculateScenario({
      payingStudents: 3,
      averageNetPriceMinor: 300_000,
      otherRevenueMinor: 0,
      sessionsPerPeriod: 2,
      teacher: { method: 'perPeriod', amountMinor: 100_000 },
      rent: { method: 'perPeriod', amountMinor: 0 },
      variableCosts: { perStudentMinor: 0, perSessionMinor: 0 },
      acquiringFeeBasisPoints: 0,
      otherDirectCostsMinor: 0,
      overheadPools: [{
        id: 'empty-pool',
        name: 'Пустой пул',
        poolMinor: 0,
        allocationBase: 'hours',
        groupBase: 0,
        totalBase: 0,
      }],
    })

    expect(result.overheads[0]).toMatchObject({ status: 'calculated', allocatedMinor: 0 })
    expect(result.fullProfitMinor).toBe(800_000)
  })

  it('не вычисляет полную прибыль и полную безубыточность при нулевой базе распределения', () => {
    const result = calculateScenario({
      payingStudents: 3,
      averageNetPriceMinor: 300_000,
      otherRevenueMinor: 0,
      sessionsPerPeriod: 2,
      teacher: { method: 'perPeriod', amountMinor: 100_000 },
      rent: { method: 'perPeriod', amountMinor: 0 },
      variableCosts: { perStudentMinor: 0, perSessionMinor: 0 },
      acquiringFeeBasisPoints: 0,
      otherDirectCostsMinor: 0,
      overheadPools: [{
        id: 'invalid-hours-pool',
        name: 'Пул с нулевой базой',
        poolMinor: 100_000,
        allocationBase: 'hours',
        groupBase: 2,
        totalBase: 0,
      }],
    })

    expect(result.overheads[0]).toMatchObject({ status: 'notCalculated', allocatedMinor: null })
    expect(result.fullProfitMinor).toBeNull()
    expect(result.fullBreakEven).toMatchObject({ status: 'notCalculated', students: null })
  })
})

describe('калькулятор экономики группы: обезличенная сверка с пилотом', () => {
  it('воспроизводит полный результат группы после округления исходных ставок до копеек и базисных пунктов', () => {
    const result = calculateScenario({
      payingStudents: 37,
      // 37 × 21,62 ₽ = 799,94 ₽. Шесть копеек — округление средней цены из источника.
      averageNetPriceMinor: 2_162,
      otherRevenueMinor: 6,
      sessionsPerPeriod: 1,
      teacher: { method: 'perPeriod', amountMinor: 122_077 },
      rent: { method: 'perPeriod', amountMinor: 179_477 },
      variableCosts: { perStudentMinor: 0, perSessionMinor: 0 },
      // Фактическая ставка 2,2759% округлена до 2,28%.
      acquiringFeeBasisPoints: 228,
      otherDirectCostsMinor: 0,
      overheadPools: [
        {
          id: 'branch-administration',
          name: 'Администрация филиала',
          poolMinor: 24_314_397,
          allocationBase: 'hours',
          groupBase: 1,
          totalBase: 175.75,
        },
        {
          id: 'management-company',
          name: 'Управляющая компания',
          poolMinor: 78_361_009,
          allocationBase: 'revenue',
          totalBase: 247_544_348,
        },
      ],
    })

    expect(result.validationMessages).toEqual([])
    expect(result.revenue.totalMinor).toBe(80_000)
    expect(result.directCosts).toMatchObject({
      teacherMinor: 122_077,
      rentMinor: 179_477,
      acquiringFeeMinor: 1_824,
    })
    expect(result.overheads.map(({ allocatedMinor }) => allocatedMinor)).toEqual([138_346, 25_324])
    // Источник после более точных промежуточных ставок показывает −3 870,45 ₽.
    // Отклонение в 3 копейки объясняется допустимым округлением входов MVP.
    expect(result.fullProfitMinor).toBe(-387_048)
  })
})
