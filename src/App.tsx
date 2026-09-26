import { useMemo, useState, type ReactNode } from 'react'
import { calculateScenario, type AllocationBase, type CalculationResult, type ScenarioInput } from './calculation'

type TeacherMethod = 'perSession' | 'perPeriod' | 'percentOfRevenue'
type RentMethod = 'perSession' | 'perPeriod'

interface OverheadDraft {
  id: string
  name: string
  allocationBase: AllocationBase
  poolRubles: number
  groupHours: number
  totalBase: number
}

interface ScenarioDraft {
  id: string
  groupName: string
  month: string
  scenarioName: string
  payingStudents: number
  capacity: number
  averageNetPriceRubles: number
  otherRevenueRubles: number
  sessionsPerPeriod: number
  teacherMethod: TeacherMethod
  teacherValue: number
  rentMethod: RentMethod
  rentValueRubles: number
  variablePerStudentRubles: number
  variablePerSessionRubles: number
  acquiringFeePercent: number
  otherDirectCostsRubles: number
  overheads: OverheadDraft[]
}

const currency = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })
const integer = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 })

const initialScenario: ScenarioDraft = {
  id: 'current', groupName: 'Новая группа', month: '2026-09', scenarioName: 'Текущий вариант',
  payingStudents: 0, capacity: 0, averageNetPriceRubles: 0, otherRevenueRubles: 0, sessionsPerPeriod: 0,
  teacherMethod: 'perSession', teacherValue: 0, rentMethod: 'perSession', rentValueRubles: 0,
  variablePerStudentRubles: 0, variablePerSessionRubles: 0, acquiringFeePercent: 0, otherDirectCostsRubles: 0,
  overheads: [
    { id: 'hall', name: 'Общие расходы зала или филиала', allocationBase: 'hours', poolRubles: 0, groupHours: 0, totalBase: 0 },
    { id: 'administration', name: 'Администрация филиала', allocationBase: 'hours', poolRubles: 0, groupHours: 0, totalBase: 0 },
    { id: 'management', name: 'Управляющая компания', allocationBase: 'revenue', poolRubles: 0, groupHours: 0, totalBase: 0 },
  ],
}

const nonNegativeNumber = (value: string) => {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : 0
}
const toMinor = (rubles: number) => Math.round(rubles * 100)
const toBasisPoints = (percent: number) => Math.round(percent * 100)
const money = (minor: number | null) => minor === null ? '—' : currency.format(minor / 100)
const percentage = (value: number | null) => value === null ? '—' : new Intl.NumberFormat('ru-RU', { style: 'percent', maximumFractionDigits: 1 }).format(value)

function scenarioInput(draft: ScenarioDraft): ScenarioInput {
  return {
    payingStudents: Math.round(draft.payingStudents),
    averageNetPriceMinor: toMinor(draft.averageNetPriceRubles),
    otherRevenueMinor: toMinor(draft.otherRevenueRubles),
    sessionsPerPeriod: Math.round(draft.sessionsPerPeriod),
    teacher: draft.teacherMethod === 'percentOfRevenue'
      ? { method: 'percentOfRevenue', percentBasisPoints: toBasisPoints(draft.teacherValue) }
      : { method: draft.teacherMethod, amountMinor: toMinor(draft.teacherValue) },
    rent: { method: draft.rentMethod, amountMinor: toMinor(draft.rentValueRubles) },
    variableCosts: { perStudentMinor: toMinor(draft.variablePerStudentRubles), perSessionMinor: toMinor(draft.variablePerSessionRubles) },
    acquiringFeeBasisPoints: toBasisPoints(draft.acquiringFeePercent),
    otherDirectCostsMinor: toMinor(draft.otherDirectCostsRubles),
    overheadPools: draft.overheads.map((overhead) => ({
      id: overhead.id, name: overhead.name, poolMinor: toMinor(overhead.poolRubles), allocationBase: overhead.allocationBase,
      groupBase: overhead.allocationBase === 'hours' ? overhead.groupHours : undefined,
      totalBase: overhead.allocationBase === 'hours' ? overhead.totalBase : toMinor(overhead.totalBase),
    })),
  }
}

function breakEvenText(result: CalculationResult['operationalBreakEven']): string {
  if (result.status === 'reached') return `${result.students} уч.`
  if (result.status === 'alreadyCovered') return 'уже покрыта'
  if (result.status === 'unreachable') return 'недостижима'
  return 'нужна база'
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{hint !== undefined && <small>{hint}</small>}</label>
}

function ResultCard({ label, value, tone = 'default', note }: { label: string; value: string; tone?: 'default' | 'positive' | 'negative'; note?: string }) {
  return <article className={`result-card result-card--${tone}`}><p>{label}</p><strong>{value}</strong>{note !== undefined && <small>{note}</small>}</article>
}

function App() {
  const [scenarios, setScenarios] = useState<ScenarioDraft[]>([initialScenario])
  const [selectedScenarioId, setSelectedScenarioId] = useState(initialScenario.id)
  const current = scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? scenarios[0]
  const calculations = useMemo(() => scenarios.map((scenario) => ({ scenario, result: calculateScenario(scenarioInput(scenario)) })), [scenarios])
  const currentResult = calculations.find((item) => item.scenario.id === current.id)?.result ?? calculateScenario(scenarioInput(current))
  const baselineResult = calculations[0].result

  const updateCurrent = (change: Partial<ScenarioDraft>) => setScenarios((previous) => previous.map((scenario) => scenario.id === current.id ? { ...scenario, ...change } : scenario))
  const updateOverhead = (id: string, change: Partial<OverheadDraft>) => updateCurrent({ overheads: current.overheads.map((overhead) => overhead.id === id ? { ...overhead, ...change } : overhead) })

  function addAlternative() {
    if (scenarios.length >= 3) return
    const alternative: ScenarioDraft = {
      ...current,
      id: `alternative-${Date.now()}`,
      scenarioName: scenarios.length === 1 ? 'Альтернатива 1' : 'Альтернатива 2',
      overheads: current.overheads.map((overhead) => ({ ...overhead })),
    }
    setScenarios((previous) => [...previous, alternative])
    setSelectedScenarioId(alternative.id)
  }

  function sensitivityResult(payingStudents: number, priceRubles: number) {
    return calculateScenario(scenarioInput({ ...current, payingStudents, averageNetPriceRubles: priceRubles }))
  }

  const studentPoints = Array.from(new Set([Math.max(0, current.payingStudents - 2), Math.max(0, current.payingStudents - 1), current.payingStudents, current.payingStudents + 1, current.payingStudents + 2]))
  const pricePoints = Array.from(new Set([Math.max(0, current.averageNetPriceRubles - 500), current.averageNetPriceRubles, current.averageNetPriceRubles + 500]))
  const occupancy = current.capacity > 0 ? current.payingStudents / current.capacity : null
  const additionalStudentsNeeded = currentResult.fullBreakEven.students === null ? null : Math.max(0, currentResult.fullBreakEven.students - current.payingStudents)
  const fullProfitTone = currentResult.fullProfitMinor === null ? 'default' : currentResult.fullProfitMinor >= 0 ? 'positive' : 'negative'
  const hasScenarioInputs = [
    current.averageNetPriceRubles,
    current.otherRevenueRubles,
    current.sessionsPerPeriod,
    current.teacherValue,
    current.rentValueRubles,
    current.variablePerStudentRubles,
    current.variablePerSessionRubles,
    current.acquiringFeePercent,
    current.otherDirectCostsRubles,
  ].some((value) => value > 0) || current.overheads.some((overhead) => overhead.poolRubles > 0)

  return (
    <main className="app-shell">
      <header className="topbar"><div><p className="eyebrow">Локальный черновик · этап 3</p><h1>Экономика группы</h1></div><p className="topbar-note">Данные существуют только в открытом окне браузера.</p></header>
      <nav className="scenario-tabs" aria-label="Сценарии">
        {scenarios.map((scenario) => <button className={scenario.id === current.id ? 'scenario-tab is-active' : 'scenario-tab'} key={scenario.id} onClick={() => setSelectedScenarioId(scenario.id)} type="button">{scenario.scenarioName}</button>)}
        {scenarios.length < 3 && <button className="scenario-tab scenario-tab--add" onClick={addAlternative} type="button">+ Альтернатива</button>}
      </nav>

      <section className="scenario-heading" aria-label="Параметры сценария">
        <Field label="Название группы" hint="Например: K-POP 14–17 продолжающие"><input value={current.groupName} onChange={(event) => updateCurrent({ groupName: event.target.value })} /></Field>
        <Field label="Месяц расчёта" hint="Период, за который сравниваем доходы и расходы"><input type="month" value={current.month} onChange={(event) => updateCurrent({ month: event.target.value })} /></Field>
        <Field label="Название сценария" hint="Например: текущий вариант или цена +300 ₽"><input value={current.scenarioName} onChange={(event) => updateCurrent({ scenarioName: event.target.value })} /></Field>
        <div className="draft-badge">Черновик · не сохранён в облако</div>
      </section>

      <section className="workspace">
        <aside className="input-panel" aria-label="Ввод параметров">
          <div className="section-heading"><div><p className="eyebrow">Шаг 1</p><h2>Быстрый ввод</h2></div><p>Поля со значением 0 можно заполнить позже.</p></div>
          <div className="field-grid">
            <Field label="Платящие ученики" hint={occupancy === null ? 'Например: 18 учеников, которые оплатили период' : `Загрузка: ${percentage(occupancy)}`}><input min="0" type="number" value={current.payingStudents} onChange={(event) => updateCurrent({ payingStudents: nonNegativeNumber(event.target.value) })} /></Field>
            <Field label="Вместимость группы" hint="Например: 20 мест; нужна только для оценки загрузки"><input min="0" type="number" value={current.capacity} onChange={(event) => updateCurrent({ capacity: nonNegativeNumber(event.target.value) })} /></Field>
            <Field label="Средняя чистая цена, ₽" hint="Сколько в среднем фактически платит один ученик за период; например 3 000"><input min="0" step="1" type="number" value={current.averageNetPriceRubles} onChange={(event) => updateCurrent({ averageNetPriceRubles: nonNegativeNumber(event.target.value) })} /></Field>
            <Field label="Прочая выручка, ₽" hint="Доход группы помимо оплат учеников; например 5 000 за месяц"><input min="0" step="1" type="number" value={current.otherRevenueRubles} onChange={(event) => updateCurrent({ otherRevenueRubles: nonNegativeNumber(event.target.value) })} /></Field>
            <Field label="Занятия в месяце" hint="Фактически проведённые занятия; например 8"><input min="0" type="number" value={current.sessionsPerPeriod} onChange={(event) => updateCurrent({ sessionsPerPeriod: nonNegativeNumber(event.target.value) })} /></Field>
            <Field label="Переменные на ученика, ₽" hint="Расход на одного ученика за период; например 100 на материалы"><input min="0" step="1" type="number" value={current.variablePerStudentRubles} onChange={(event) => updateCurrent({ variablePerStudentRubles: nonNegativeNumber(event.target.value) })} /></Field>
          </div>
          <div className="cost-pair">
            <Field label="Оплата педагога" hint="Выберите, как задана сумма: за одно занятие, за период или процент"><select value={current.teacherMethod} onChange={(event) => updateCurrent({ teacherMethod: event.target.value as TeacherMethod })}><option value="perSession">За занятие</option><option value="perPeriod">За период</option><option value="percentOfRevenue">% от выручки</option></select></Field>
            <Field label={current.teacherMethod === 'percentOfRevenue' ? 'Ставка, %' : 'Сумма, ₽'} hint={current.teacherMethod === 'percentOfRevenue' ? 'Например: 30% от выручки' : current.teacherMethod === 'perSession' ? 'Например: 1 500 ₽ за одно занятие' : 'Например: 12 000 ₽ за месяц'}><input min="0" step={current.teacherMethod === 'percentOfRevenue' ? '0.1' : '1'} type="number" value={current.teacherValue} onChange={(event) => updateCurrent({ teacherValue: nonNegativeNumber(event.target.value) })} /></Field>
          </div>
          <div className="cost-pair">
            <Field label="Аренда" hint="Выберите, как задана аренда: за одно занятие или за период"><select value={current.rentMethod} onChange={(event) => updateCurrent({ rentMethod: event.target.value as RentMethod })}><option value="perSession">За занятие</option><option value="perPeriod">За период</option></select></Field>
            <Field label="Сумма, ₽" hint={current.rentMethod === 'perSession' ? 'Например: 1 000 ₽ за одно занятие' : 'Например: 8 000 ₽ за месяц'}><input min="0" step="1" type="number" value={current.rentValueRubles} onChange={(event) => updateCurrent({ rentValueRubles: nonNegativeNumber(event.target.value) })} /></Field>
          </div>
          <details className="details-panel"><summary>Дополнительные прямые расходы</summary><div className="field-grid details-content">
            <Field label="Переменные на занятие, ₽" hint="Расход, который возникает на каждое занятие; например 300"><input min="0" step="1" type="number" value={current.variablePerSessionRubles} onChange={(event) => updateCurrent({ variablePerSessionRubles: nonNegativeNumber(event.target.value) })} /></Field>
            <Field label="Эквайринг, %" hint="Комиссия за приём оплаты; например 2,3"><input min="0" max="100" step="0.1" type="number" value={current.acquiringFeePercent} onChange={(event) => updateCurrent({ acquiringFeePercent: nonNegativeNumber(event.target.value) })} /></Field>
            <Field label="Прочие прямые за период, ₽" hint="Расходы только этой группы; например 1 000 за месяц"><input min="0" step="1" type="number" value={current.otherDirectCostsRubles} onChange={(event) => updateCurrent({ otherDirectCostsRubles: nonNegativeNumber(event.target.value) })} /></Field>
          </div></details>
          <details className="details-panel" open><summary>Общие расходы и базы распределения</summary><div className="overhead-list">
            {current.overheads.map((overhead) => <article className="overhead-editor" key={overhead.id}><h3>{overhead.name}</h3><div className="field-grid overhead-fields">
              <Field label="Пул, ₽" hint="Все расходы этой статьи за период; например 315 430 для зала филиала"><input min="0" step="1" type="number" value={overhead.poolRubles} onChange={(event) => updateOverhead(overhead.id, { poolRubles: nonNegativeNumber(event.target.value) })} /></Field>
              <Field label="База" hint="По чему делим общий пул между группами"><select value={overhead.allocationBase} onChange={(event) => updateOverhead(overhead.id, { allocationBase: event.target.value as AllocationBase })}><option value="hours">Часы занятий</option><option value="revenue">Выручка</option></select></Field>
              {overhead.allocationBase === 'hours' ? <><Field label="Часы группы" hint="Часы этой группы за период; например 8"><input min="0" step="0.5" type="number" value={overhead.groupHours} onChange={(event) => updateOverhead(overhead.id, { groupHours: nonNegativeNumber(event.target.value) })} /></Field><Field label="Часы сети / филиала" hint="Все часы групп в общей базе; например 175,75"><input min="0" step="0.5" type="number" value={overhead.totalBase} onChange={(event) => updateOverhead(overhead.id, { totalBase: nonNegativeNumber(event.target.value) })} /></Field></> : <Field label="Плановая выручка сети, ₽" hint="Общая выручка, на которую распределяется пул; например 2 475 443"><input min="0" step="1" type="number" value={overhead.totalBase} onChange={(event) => updateOverhead(overhead.id, { totalBase: nonNegativeNumber(event.target.value) })} /></Field>}
            </div></article>)}
          </div></details>
        </aside>

        <section className="results-panel" aria-live="polite">
          <div className="section-heading"><div><p className="eyebrow">Шаг 2</p><h2>Результат: {current.groupName || 'без названия'}</h2></div><p>{current.month || 'Месяц не выбран'}</p></div>
          {!hasScenarioInputs ? <div className="empty-state"><strong>Введите параметры группы, чтобы увидеть финансовый результат.</strong><p>Для первого расчёта достаточно указать учеников, цену, занятия, схему и сумму оплаты педагога, а также схему и сумму аренды.</p></div> : <>
          {currentResult.validationMessages.length > 0 && <div className="validation-message">{currentResult.validationMessages.map((message) => <p key={message}>{message}</p>)}</div>}
          <div className="results-grid">
            <ResultCard label="Выручка" value={money(currentResult.revenue.totalMinor)} note="За период занятий" />
            <ResultCard label="Прямой вклад" value={money(currentResult.directContributionMinor)} tone={currentResult.directContributionMinor >= 0 ? 'positive' : 'negative'} note="До общих расходов" />
            <ResultCard label="Полная прибыль" value={money(currentResult.fullProfitMinor)} tone={fullProfitTone} note="После распределения общих расходов" />
            <ResultCard label="Безубыточность" value={`Опер.: ${breakEvenText(currentResult.operationalBreakEven)}`} note={`Полная: ${breakEvenText(currentResult.fullBreakEven)}`} />
          </div>
          <details className="result-details explanation-panel" open><summary>Как читать расчёт</summary><div className="explanation-grid">
            <article><h3>1. Выручка</h3><p><strong>Ученики × средняя чистая цена + прочая выручка.</strong></p><p>Чистая цена — сумма, которая остаётся после скидки. Прочая выручка вводится отдельно и не умножается на число учеников.</p></article>
            <article><h3>2. Прямой вклад</h3><p><strong>Выручка − расходы, связанные с этой группой.</strong></p><p>Сюда входят педагог, аренда, переменные расходы, эквайринг и прочие прямые расходы. Это деньги, которые группа оставляет до общих расходов.</p></article>
            <article><h3>3. Полная прибыль</h3><p><strong>Прямой вклад − назначенная доля общих расходов.</strong></p><p>Общие расходы распределяются по часам или по выручке. Калькулятор показывает исходный пул, базу, долю и сумму, назначенную группе.</p></article>
            <article><h3>4. Безубыточность</h3><p><strong>Минимальное число учеников, при котором результат не отрицательный.</strong></p><p>Операционная учитывает только прямые расходы. Полная учитывает также распределённую долю общих расходов.</p></article>
          </div><div className="explanation-note"><strong>Важно:</strong> результат относится к выбранному периоду и зависит от введённых допущений. Если общая база равна нулю, полная прибыль и полная безубыточность не рассчитываются, чтобы не создавать ложный вывод.</div></details>
          <div className={`conclusion conclusion--${fullProfitTone}`}>{currentResult.fullProfitMinor === null ? 'Полный результат пока не рассчитан: заполните ненулевую общую базу для каждого ненулевого пула расходов.' : currentResult.fullProfitMinor >= 0 ? 'Группа покрывает прямые и распределённые общие расходы при текущих допущениях.' : additionalStudentsNeeded === null ? 'При текущих параметрах полная безубыточность недостижима: дополнительный ученик не увеличивает вклад.' : `Для полного покрытия расходов не хватает ${additionalStudentsNeeded} ${additionalStudentsNeeded === 1 ? 'ученика' : 'учеников'}.`}</div>
          <details className="result-details" open><summary>Как получился результат</summary><div className="table-wrap"><table><thead><tr><th>Показатель</th><th>Формула и параметры</th><th>Сумма</th><th>Зачем смотреть</th></tr></thead><tbody>
            <tr><td>Выручка учеников</td><td>{integer.format(current.payingStudents)} × {currency.format(current.averageNetPriceRubles)}</td><td>{money(currentResult.revenue.studentRevenueMinor)}</td><td>Поступления от платящих учеников за период</td></tr>
            <tr><td>Прочая выручка</td><td>Отдельная сумма периода</td><td>{money(currentResult.revenue.otherRevenueMinor)}</td><td>Не умножается на число учеников</td></tr>
            <tr><td>Педагог</td><td>{current.teacherMethod === 'percentOfRevenue' ? `${current.teacherValue}% от выручки` : `${current.teacherMethod === 'perSession' ? 'За занятие' : 'За период'}: ${currency.format(current.teacherValue)}`}</td><td>{money(currentResult.directCosts.teacherMinor)}</td><td>Прямой расход группы</td></tr>
            <tr><td>Аренда</td><td>{current.rentMethod === 'perSession' ? 'За занятие' : 'За период'}: {currency.format(current.rentValueRubles)}</td><td>{money(currentResult.directCosts.rentMinor)}</td><td>Прямой расход группы</td></tr>
            <tr><td>Переменные расходы</td><td>На учеников и занятия</td><td>{money(currentResult.directCosts.variablePerStudentMinor + currentResult.directCosts.variablePerSessionMinor)}</td><td>Расходы, зависящие от масштаба группы</td></tr>
            <tr><td>Эквайринг</td><td>{current.acquiringFeePercent}% от выручки</td><td>{money(currentResult.directCosts.acquiringFeeMinor)}</td><td>Комиссия за приём оплат</td></tr>
            <tr className="total-row"><td>Прямой вклад</td><td>Выручка − прямые расходы</td><td>{money(currentResult.directContributionMinor)}</td><td>Экономика решения «оставить / закрыть»</td></tr>
            <tr className="total-row"><td>Полная прибыль</td><td>Прямой вклад − общие расходы</td><td>{money(currentResult.fullProfitMinor)}</td><td>Результат после назначенной доли пула</td></tr>
          </tbody></table></div></details>
          <details className="result-details" open><summary>Общие расходы: база, доля, назначение</summary><div className="table-wrap"><table><thead><tr><th>Статья</th><th>Пул</th><th>База группы</th><th>Общая база</th><th>Доля</th><th>Назначено</th></tr></thead><tbody>
            {currentResult.overheads.map((overhead) => <tr key={overhead.id}><td>{overhead.name}<small>{overhead.allocationBase === 'hours' ? 'По часам' : 'По выручке'}</small></td><td>{money(overhead.poolMinor)}</td><td>{overhead.allocationBase === 'revenue' ? money(overhead.groupBase) : integer.format(overhead.groupBase)}</td><td>{overhead.allocationBase === 'revenue' ? money(overhead.totalBase) : integer.format(overhead.totalBase)}</td><td>{percentage(overhead.share)}</td><td>{money(overhead.allocatedMinor)}<small>{overhead.message}</small></td></tr>)}
          </tbody></table></div></details>
          </>}
        </section>
      </section>

      <section className="analysis-section" aria-label="Сравнение сценариев и чувствительность">
        <div className="section-heading"><div><p className="eyebrow">Шаг 3</p><h2>Сценарии и чувствительность</h2></div><p>Сравнение работает локально, без сохранения данных.</p></div>
        {!hasScenarioInputs ? <div className="empty-state"><strong>Сравнение и чувствительность появятся после первого расчёта.</strong></div> : <><div className="table-wrap"><table><thead><tr><th>Сценарий</th><th>Выручка</th><th>Прямой вклад</th><th>Полная прибыль</th><th>Изменение к текущему</th></tr></thead><tbody>
          {calculations.map(({ scenario, result }, index) => { const difference = result.fullProfitMinor === null || baselineResult.fullProfitMinor === null ? null : result.fullProfitMinor - baselineResult.fullProfitMinor; return <tr key={scenario.id}><td>{scenario.scenarioName}{index === 0 && <small>Базовый вариант</small>}</td><td>{money(result.revenue.totalMinor)}</td><td>{money(result.directContributionMinor)}</td><td>{money(result.fullProfitMinor)}</td><td className={difference !== null && difference < 0 ? 'negative-text' : 'positive-text'}>{difference === null ? '—' : `${difference >= 0 ? '+' : ''}${money(difference)}`}</td></tr> })}
        </tbody></table></div>
        <details className="result-details" open><summary>Матрица: полная прибыль при изменении учеников и цены</summary><div className="table-wrap"><table className="sensitivity-table"><thead><tr><th>Ученики \ Цена</th>{pricePoints.map((price) => <th key={price}>{currency.format(price)}</th>)}</tr></thead><tbody>
          {studentPoints.map((students) => <tr key={students}><th>{students}</th>{pricePoints.map((price) => { const value = sensitivityResult(students, price).fullProfitMinor; return <td className={value !== null && value < 0 ? 'sensitivity-negative' : 'sensitivity-positive'} key={price}>{money(value)}</td> })}</tr>)}
        </tbody></table></div></details></>}
      </section>
    </main>
  )
}

export default App
