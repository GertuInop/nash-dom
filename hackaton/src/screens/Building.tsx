import { useMemo, useState } from 'react'
import { Building2, Layers, Wrench } from 'lucide-react'
import { useAppStore, useUser } from '../store'
import { houseTitle } from '../ui'
import { workLabel, type WorkStatus } from '../types'

function worst(statuses: WorkStatus[]): WorkStatus | 'clear' {
  if (statuses.includes('todo')) return 'todo'
  if (statuses.includes('in_progress')) return 'in_progress'
  if (statuses.includes('done')) return 'done'
  return 'clear'
}

function entranceTone(statuses: WorkStatus[]): WorkStatus | 'clear' {
  return worst(statuses)
}

function toneLabel(st: WorkStatus | 'clear') {
  if (st === 'clear') return 'Без работ'
  return workLabel(st)
}

export function BuildingScreen() {
  const user = useUser()
  const worksAll = useAppStore((s) => s.works)
  const houses = useAppStore((s) => s.houses)
  const setWorkStatus = useAppStore((s) => s.setWorkStatus)
  const house = houses.find((h) => h.id === user?.houseId)
  const floors = house?.floors || 5
  const entrancesCount = house?.entrances || 2
  const works = worksAll.filter((w) => w.houseId === user?.houseId)
  const [picked, setPicked] = useState(1)
  const [floorFilter, setFloorFilter] = useState('')
  const isUk = user?.role === 'uk'

  const byEntrance = useMemo(
    () => works.filter((w) => w.entrance === picked),
    [works, picked],
  )

  const commonWorks = useMemo(
    () => byEntrance.filter((w) => w.floor == null),
    [byEntrance],
  )

  const floorsDesc = useMemo(
    () => Array.from({ length: floors }, (_, i) => floors - i),
    [floors],
  )

  const filteredFloors = useMemo(() => {
    const q = floorFilter.trim()
    if (!q) return floorsDesc
    return floorsDesc.filter((f) => String(f).includes(q))
  }, [floorFilter, floorsDesc])

  const counts = {
    todo: works.filter((w) => w.status === 'todo').length,
    work: works.filter((w) => w.status === 'in_progress').length,
    done: works.filter((w) => w.status === 'done').length,
  }

  const entrances = useMemo(
    () => Array.from({ length: entrancesCount }, (_, i) => i + 1),
    [entrancesCount],
  )

  if (!house) {
    return (
      <div className="pad">
        <p className="muted">Дом не загружен с сервера. Выберите дом заново.</p>
      </div>
    )
  }

  return (
    <div className="passport">
      <section className="passport-hero">
        <div className="passport-hero-top">
          <div>
            <div className="passport-kicker">Паспорт дома</div>
            <h2 className="passport-title">{houseTitle(house.city, house.address)}</h2>
            <p className="passport-uk">{house.uk}</p>
          </div>
          <div className="passport-mark" aria-hidden>
            <Building2 size={28} />
          </div>
        </div>

        <div className="passport-metrics">
          <div className="passport-metric">
            <b>{floors}</b>
            <span>Этажей</span>
          </div>
          <div className="passport-metric">
            <b>{entrancesCount}</b>
            <span>Подъездов</span>
          </div>
          <div className="passport-metric">
            <b>{counts.todo}</b>
            <span>Нужно</span>
          </div>
          <div className="passport-metric">
            <b>{counts.work}</b>
            <span>В работе</span>
          </div>
        </div>
      </section>

      <section className="passport-panel">
        <div className="passport-section-head">
          <h3>Подъезды</h3>
          <span className="muted">выберите подъезд</span>
        </div>

        <div className="entrance-rail" role="tablist" aria-label="Подъезды">
          {entrances.map((entrance) => {
            const tone = entranceTone(
              works.filter((w) => w.entrance === entrance).map((w) => w.status),
            )
            return (
              <button
                key={entrance}
                type="button"
                role="tab"
                aria-selected={picked === entrance}
                className={`entrance-tab tone-${tone}${picked === entrance ? ' active' : ''}`}
                onClick={() => setPicked(entrance)}
              >
                <span className="entrance-tab-num">{entrance}</span>
                <span className="entrance-tab-cap">подъезд</span>
              </button>
            )
          })}
        </div>

        {commonWorks.length > 0 ? (
          <div className="passport-block">
            <div className="passport-section-head">
              <h3>
                <Wrench size={16} /> Общие работы
              </h3>
            </div>
            {commonWorks.map((item) => (
              <WorkRow
                key={item.id}
                item={item}
                isUk={isUk}
                onStatus={(s) => setWorkStatus(item.id, s)}
              />
            ))}
          </div>
        ) : null}

        <div className="passport-block">
          <div className="passport-section-head">
            <h3>
              <Layers size={16} /> Этажи подъезда {picked}
            </h3>
            {floors > 12 ? (
              <input
                className="floor-jump"
                inputMode="numeric"
                placeholder="Этаж…"
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value.replace(/\D/g, '').slice(0, 3))}
                aria-label="Найти этаж"
              />
            ) : null}
          </div>

          <div className={`floor-list${floors > 16 ? ' floor-list-scroll' : ''}`}>
            {filteredFloors.map((floor) => {
              const floorWorks = byEntrance.filter((w) => w.floor === floor)
              const st = worst(floorWorks.map((w) => w.status))
              return (
                <div key={floor} className={`floor-row tone-${st}`}>
                  <div className="floor-num">{floor}</div>
                  <div className="floor-body">
                    <div className="floor-title">
                      {floor} этаж
                      <span className={`floor-pill pill-${st}`}>{toneLabel(st)}</span>
                    </div>
                    {floorWorks.length === 0 ? (
                      <div className="floor-sub muted">Записей нет</div>
                    ) : (
                      <div className="floor-sub">
                        {floorWorks.map((w) => w.title).join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {filteredFloors.length === 0 ? (
              <p className="muted" style={{ padding: '8px 4px' }}>
                Этаж не найден
              </p>
            ) : null}
          </div>
        </div>

        <div className="passport-block">
          <div className="passport-section-head">
            <h3>Работы подъезда {picked}</h3>
            <span className="muted">{byEntrance.length}</span>
          </div>
          {byEntrance.length === 0 ? (
            <p className="muted">По этому подъезду записей нет.</p>
          ) : (
            byEntrance.map((item) => (
              <WorkRow
                key={item.id}
                item={item}
                isUk={isUk}
                onStatus={(s) => setWorkStatus(item.id, s)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function WorkRow({
  item,
  isUk,
  onStatus,
}: {
  item: {
    id: string
    title: string
    detail: string
    status: WorkStatus
    floor: number | null
  }
  isUk: boolean
  onStatus: (s: WorkStatus) => void
}) {
  return (
    <article className={`work-card status-${item.status}`}>
      <div className="work-top">
        <strong>{item.title}</strong>
        <span
          className={`badge badge-${item.status === 'todo' ? 'new' : item.status === 'in_progress' ? 'work' : 'done'}`}
        >
          {workLabel(item.status)}
        </span>
      </div>
      <p className="muted">{item.detail}</p>
      <div className="hint">{item.floor ? `${item.floor} этаж` : 'Весь подъезд'}</div>
      {isUk ? (
        <div className="work-actions">
          {item.status !== 'in_progress' ? (
            <button type="button" className="btn btn-ghost" onClick={() => onStatus('in_progress')}>
              В работу
            </button>
          ) : null}
          {item.status !== 'done' ? (
            <button type="button" className="btn btn-ghost" onClick={() => onStatus('done')}>
              Готово
            </button>
          ) : null}
          {item.status !== 'todo' ? (
            <button type="button" className="btn btn-ghost" onClick={() => onStatus('todo')}>
              Вернуть
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
