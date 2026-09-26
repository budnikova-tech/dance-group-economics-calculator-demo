/** Денежная сумма в копейках. Все входные денежные значения должны быть целыми. */
export type MinorAmount = number

export type TeacherPaymentMethod = 'perSession' | 'perPeriod' | 'percentOfRevenue'
export type RentPaymentMethod = 'perSession' | 'perPeriod'
export type AllocationBase = 'hours' | 'revenue'

export interface TeacherCostInput {
  method: TeacherPaymentMethod
  /** Копейки; используется для оплаты за занятие или период. */
  amountMinor?: MinorAmount
  /** Десятитысячные доли: 300 = 3%. Используется для процента от выручки. */
  percentBasisPoints?: number
}

export interface RentCostInput {
  method: RentPaymentMethod
  /** Копейки; за занятие или период. */
  amountMinor: MinorAmount
}

export interface VariableCostsInput {
  perStudentMinor: MinorAmount
  perSessionMinor: MinorAmount
}

export interface OverheadPoolInput {
  id: string
  name: string
  poolMinor: MinorAmount
  allocationBase: AllocationBase
  /** Обязательна для базы «часы»; для «выручки» равна выручке группы автоматически. */
  groupBase?: number
  /** Общие часы или плановая общая выручка сети в копейках. */
  totalBase: number
}

export interface ScenarioInput {
  payingStudents: number
  averageNetPriceMinor: MinorAmount
  otherRevenueMinor: MinorAmount
  sessionsPerPeriod: number
  teacher: TeacherCostInput
  rent: RentCostInput
  variableCosts: VariableCostsInput
  /** Десятитысячные доли: 300 = 3%. */
  acquiringFeeBasisPoints: number
  otherDirectCostsMinor: MinorAmount
  overheadPools: OverheadPoolInput[]
}

export interface RevenueResult {
  studentRevenueMinor: MinorAmount
  otherRevenueMinor: MinorAmount
  totalMinor: MinorAmount
}

export interface DirectCostsResult {
  variablePerStudentMinor: MinorAmount
  variablePerSessionMinor: MinorAmount
  acquiringFeeMinor: MinorAmount
  teacherMinor: MinorAmount
  rentMinor: MinorAmount
  otherDirectCostsMinor: MinorAmount
  totalMinor: MinorAmount
}

export interface AllocatedOverheadResult {
  id: string
  name: string
  poolMinor: MinorAmount
  allocationBase: AllocationBase
  groupBase: number
  totalBase: number
  share: number | null
  allocatedMinor: MinorAmount | null
  status: 'calculated' | 'notCalculated'
  message?: string
}

export interface BreakEvenResult {
  status: 'reached' | 'alreadyCovered' | 'unreachable' | 'notCalculated'
  students: number | null
  contributionPerAdditionalStudentMinor: MinorAmount | null
  message?: string
}

export interface CalculationResult {
  revenue: RevenueResult
  directCosts: DirectCostsResult
  directContributionMinor: MinorAmount
  overheads: AllocatedOverheadResult[]
  allocatedOverheadMinor: MinorAmount | null
  fullProfitMinor: MinorAmount | null
  operationalBreakEven: BreakEvenResult
  fullBreakEven: BreakEvenResult
  validationMessages: string[]
}
