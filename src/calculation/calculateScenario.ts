import type {
  AllocatedOverheadResult,
  BreakEvenResult,
  CalculationResult,
  MinorAmount,
  OverheadPoolInput,
  ScenarioInput,
} from './types'

const BASIS_POINTS = 10_000

function roundedPercentOf(amountMinor: MinorAmount, basisPoints: number): MinorAmount {
  return Math.round((amountMinor * basisPoints) / BASIS_POINTS)
}

function valueOrZero(value: number | null | undefined): number {
  return value ?? 0
}

function isWholeNonNegative(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

function validateInput(input: ScenarioInput): string[] {
  const messages: string[] = []
  const amounts = [
    input.averageNetPriceMinor,
    input.otherRevenueMinor,
    input.variableCosts.perStudentMinor,
    input.variableCosts.perSessionMinor,
    input.otherDirectCostsMinor,
    input.rent.amountMinor,
    valueOrZero(input.teacher.amountMinor),
  ]

  if (!Number.isSafeInteger(input.payingStudents) || input.payingStudents < 0) {
    messages.push('Количество платящих учеников должно быть целым неотрицательным числом.')
  }

  if (!Number.isSafeInteger(input.sessionsPerPeriod) || input.sessionsPerPeriod < 0) {
    messages.push('Количество занятий должно быть целым неотрицательным числом.')
  }

  if (amounts.some((amount) => !isWholeNonNegative(amount))) {
    messages.push('Все денежные значения должны быть целыми неотрицательными суммами в копейках.')
  }

  const rates = [input.acquiringFeeBasisPoints]
  if (input.teacher.method === 'percentOfRevenue') {
    rates.push(valueOrZero(input.teacher.percentBasisPoints))
  }

  if (rates.some((rate) => !Number.isSafeInteger(rate) || rate < 0 || rate > BASIS_POINTS)) {
    messages.push('Процентные ставки должны быть целыми значениями от 0 до 10 000 базисных пунктов.')
  }

  for (const overhead of input.overheadPools) {
    if (!isWholeNonNegative(overhead.poolMinor)) {
      messages.push(`Пул «${overhead.name}» должен быть целой неотрицательной суммой в копейках.`)
    }
    if (!Number.isFinite(overhead.totalBase) || overhead.totalBase < 0) {
      messages.push(`Общая база «${overhead.name}» не может быть отрицательной.`)
    }
    if (overhead.allocationBase === 'hours' && (!Number.isFinite(overhead.groupBase) || valueOrZero(overhead.groupBase) < 0)) {
      messages.push(`Для распределения «${overhead.name}» по часам нужна неотрицательная база группы.`)
    }
  }

  return messages
}

function calculateOverhead(
  overhead: OverheadPoolInput,
  revenueMinor: MinorAmount,
): AllocatedOverheadResult {
  const groupBase = overhead.allocationBase === 'revenue' ? revenueMinor : valueOrZero(overhead.groupBase)

  if (overhead.poolMinor === 0) {
    return {
      id: overhead.id,
      name: overhead.name,
      poolMinor: overhead.poolMinor,
      allocationBase: overhead.allocationBase,
      groupBase,
      totalBase: overhead.totalBase,
      share: overhead.totalBase === 0 ? 0 : groupBase / overhead.totalBase,
      allocatedMinor: 0,
      status: 'calculated',
      message: 'Пул равен нулю: распределение не требуется.',
    }
  }

  if (overhead.totalBase === 0) {
    return {
      id: overhead.id,
      name: overhead.name,
      poolMinor: overhead.poolMinor,
      allocationBase: overhead.allocationBase,
      groupBase,
      totalBase: overhead.totalBase,
      share: null,
      allocatedMinor: null,
      status: 'notCalculated',
      message: `Нельзя распределить «${overhead.name}»: общая база равна нулю.`,
    }
  }

  const share = groupBase / overhead.totalBase
  return {
    id: overhead.id,
    name: overhead.name,
    poolMinor: overhead.poolMinor,
    allocationBase: overhead.allocationBase,
    groupBase,
    totalBase: overhead.totalBase,
    share,
    allocatedMinor: Math.round(overhead.poolMinor * share),
    status: 'calculated',
  }
}

function rateForRevenueAllocatedOverhead(overheads: OverheadPoolInput[]): number | null {
  let rate = 0

  for (const overhead of overheads) {
    if (overhead.allocationBase !== 'revenue') {
      continue
    }
    if (overhead.poolMinor === 0) {
      continue
    }
    if (overhead.totalBase <= 0) {
      return null
    }
    rate += overhead.poolMinor / overhead.totalBase
  }

  return rate
}

function makeBreakEven(
  fixedCostsMinor: MinorAmount,
  otherRevenueMinor: MinorAmount,
  priceMinor: MinorAmount,
  variablePerStudentMinor: MinorAmount,
  revenueRate: number,
): BreakEvenResult {
  const contributionPerStudent = Math.round(priceMinor * (1 - revenueRate)) - variablePerStudentMinor
  const contributionWithoutStudents = Math.round(otherRevenueMinor * (1 - revenueRate)) - fixedCostsMinor

  if (contributionPerStudent <= 0) {
    return {
      status: 'unreachable',
      students: null,
      contributionPerAdditionalStudentMinor: contributionPerStudent,
      message: 'Недостижима: дополнительный ученик не увеличивает вклад.',
    }
  }

  if (contributionWithoutStudents >= 0) {
    return {
      status: 'alreadyCovered',
      students: 0,
      contributionPerAdditionalStudentMinor: contributionPerStudent,
      message: 'Уже покрыта без платящих учеников при текущей прочей выручке.',
    }
  }

  return {
    status: 'reached',
    students: Math.ceil(-contributionWithoutStudents / contributionPerStudent),
    contributionPerAdditionalStudentMinor: contributionPerStudent,
  }
}

export function calculateScenario(input: ScenarioInput): CalculationResult {
  const validationMessages = validateInput(input)
  const studentRevenueMinor = input.payingStudents * input.averageNetPriceMinor
  const revenueMinor = studentRevenueMinor + input.otherRevenueMinor
  const teacherMinor = input.teacher.method === 'percentOfRevenue'
    ? roundedPercentOf(revenueMinor, valueOrZero(input.teacher.percentBasisPoints))
    : input.teacher.method === 'perSession'
      ? valueOrZero(input.teacher.amountMinor) * input.sessionsPerPeriod
      : valueOrZero(input.teacher.amountMinor)
  const rentMinor = input.rent.method === 'perSession'
    ? input.rent.amountMinor * input.sessionsPerPeriod
    : input.rent.amountMinor
  const variablePerStudentMinor = input.variableCosts.perStudentMinor * input.payingStudents
  const variablePerSessionMinor = input.variableCosts.perSessionMinor * input.sessionsPerPeriod
  const acquiringFeeMinor = roundedPercentOf(revenueMinor, input.acquiringFeeBasisPoints)
  const directCostsMinor = variablePerStudentMinor
    + variablePerSessionMinor
    + acquiringFeeMinor
    + teacherMinor
    + rentMinor
    + input.otherDirectCostsMinor
  const directContributionMinor = revenueMinor - directCostsMinor
  const overheads = input.overheadPools.map((overhead) => calculateOverhead(overhead, revenueMinor))
  const incompleteOverhead = overheads.some((overhead) => overhead.status === 'notCalculated')
  const allocatedOverheadMinor = incompleteOverhead
    ? null
    : overheads.reduce((total, overhead) => total + valueOrZero(overhead.allocatedMinor), 0)
  const fullProfitMinor = allocatedOverheadMinor === null
    ? null
    : directContributionMinor - allocatedOverheadMinor
  const fixedDirectCostsMinor = variablePerSessionMinor
    + (input.teacher.method === 'percentOfRevenue' ? 0 : teacherMinor)
    + rentMinor
    + input.otherDirectCostsMinor
  const directRevenueRate = input.acquiringFeeBasisPoints / BASIS_POINTS
    + (input.teacher.method === 'percentOfRevenue'
      ? valueOrZero(input.teacher.percentBasisPoints) / BASIS_POINTS
      : 0)
  const operationalBreakEven = makeBreakEven(
    fixedDirectCostsMinor,
    input.otherRevenueMinor,
    input.averageNetPriceMinor,
    input.variableCosts.perStudentMinor,
    directRevenueRate,
  )
  const overheadRevenueRate = rateForRevenueAllocatedOverhead(input.overheadPools)
  const fixedHoursOverheadMinor = overheads
    .filter((overhead) => overhead.allocationBase === 'hours')
    .reduce((total, overhead) => total + valueOrZero(overhead.allocatedMinor), 0)
  const fullBreakEven = incompleteOverhead || overheadRevenueRate === null
    ? {
        status: 'notCalculated' as const,
        students: null,
        contributionPerAdditionalStudentMinor: null,
        message: 'Полная безубыточность не рассчитана: требуется ненулевая база распределения общих расходов.',
      }
    : makeBreakEven(
        fixedDirectCostsMinor + fixedHoursOverheadMinor,
        input.otherRevenueMinor,
        input.averageNetPriceMinor,
        input.variableCosts.perStudentMinor,
        directRevenueRate + overheadRevenueRate,
      )

  return {
    revenue: {
      studentRevenueMinor,
      otherRevenueMinor: input.otherRevenueMinor,
      totalMinor: revenueMinor,
    },
    directCosts: {
      variablePerStudentMinor,
      variablePerSessionMinor,
      acquiringFeeMinor,
      teacherMinor,
      rentMinor,
      otherDirectCostsMinor: input.otherDirectCostsMinor,
      totalMinor: directCostsMinor,
    },
    directContributionMinor,
    overheads,
    allocatedOverheadMinor,
    fullProfitMinor,
    operationalBreakEven,
    fullBreakEven,
    validationMessages,
  }
}
