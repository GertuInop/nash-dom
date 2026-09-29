import { type FormEvent, useMemo, useState } from 'react'
import { Building2, Car, ChevronLeft, Layers, Megaphone, Wrench } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, useUser } from '../store'
import { Field, houseTitle, PrimaryButton, TextArea, TextInput } from '../ui'
import { workLabel, type WorkStatus } from '../types'

function worksForEntrance(all: ReturnType<typeof useAppStore.getState>['works'], entrance: number) {
  return all.filter((w) => w.entrance === entrance || w.entrance === 0)
}

function worst(statuses: WorkStatus[]): WorkStatus | 'clear' {
  if (statuses.includes('todo')) return 'todo'
  if (statuses.includes('in_progress')) return 'in_progress'
  if (statuses.includes('done')) return 'done'
  return 'clear'
}

function floorTileHint(st: WorkStatus | 'clear', hasItems: boolean) {
  if (!hasItems) return ''
  if (st === 'todo') return 'Объявление'
  if (st === 'in_progress') return 'В работе'
  if (st === 'done') return 'Готово'
  return ''
}

export function BuildingScreen() {
  const user = useUser()
  const worksAll = useAppStore((s) => s.works)
  const houses = useAppStore((s) => s.houses)
  const setWorkStatus = useAppStore((s) => s.setWorkStatus)
  const createWork = useAppStore((s) => s.createWork)
  const setToast = useAppStore((s) => s.setToast)
  const house = houses.find((h) => h.id === user?.houseId)
  const floors = house?.floors || 5
  const entrancesCount = house?.entrances || 2
  const works = worksAll.filter((w) => w.houseId === user?.houseId)
  const [picked, setPicked] = useState(1)
  const [pickedFloor, setPickedFloor] = useState<number | null>(null)
  const [floorFilter, setFloorFilter] = useState('')
  const [floorAnnTitle, setFloorAnnTitle] = useState('')
  const [floorAnnDetail, setFloorAnnDetail] = useState('')
  const [floorAnnBusy, setFloorAnnBusy] = useState(false)
  const isUk = user?.role === 'uk'
  const navigate = useNavigate()

  const byEntrance = useMemo(() => worksForEntrance(works, picked), [works, picked])

  const houseWorks = useMemo(() => works.filter((w) => w.entrance === 0), [works])

  const commonWorks = useMemo(
    () => byEntrance.filter((w) => w.floor == null && w.entrance !== 0),
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

  const floorDetailWorks = useMemo(() => {
    if (pickedFloor == null) return []
    return byEntrance.filter((w) => w.floor === pickedFloor)
  }, [byEntrance, pickedFloor])

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
        <button type="button" className="back-btn back-btn-light" onClick={() => navigate('/app')}>
          <ChevronLeft size={18} /> Назад
        </button>
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

        <button type="button" className="parking-jump" onClick={() => navigate('/app/parking')}>
          <Car size={18} /> Парковка у дома
        </button>
      </section>

      <section className="passport-panel">
        <div className="passport-section-head">
          <h3>Подъезды</h3>
          <span className="muted">нажмите, чтобы открыть</span>
        </div>

        <div className="building-silhouette" role="tablist" aria-label="Подъезды">
          {entrances.map((entrance) => {
            const tone = worst(worksForEntrance(works, entrance).map((w) => w.status))
            return (
              <button
                key={entrance}
                type="button"
                role="tab"
                aria-selected={picked === entrance}
                className={`building-wing tone-${tone}${picked === entrance ? ' active' : ''}`}
                onClick={() => {
                  setPicked(entrance)
                  setPickedFloor(null)
                }}
              >
                <div className="building-wing-floors">
                  {Array.from({ length: Math.min(floors, 8) }, (_, i) => (
                    <span key={i} className="building-window" />
                  ))}
                </div>
                <strong>{entrance}</strong>
                <span>подъезд</span>
              </button>
            )
          })}
        </div>

        {houseWorks.length > 0 ? (
          <div className="passport-block">
            <div className="passport-section-head">
              <h3>
                <Megaphone size={16} /> На весь дом
              </h3>
            </div>
            {houseWorks.map((item) => (
              <WorkRow
                key={item.id}
                item={item}
                isUk={isUk}
                onStatus={(s) => setWorkStatus(item.id, s)}
              />
            ))}
          </div>
        ) : null}

        {commonWorks.length > 0 ? (
          <div className="passport-block">
            <div className="passport-section-head">
              <h3>
                <Wrench size={16} /> Объявления подъезда
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

        {!isUk && byEntrance.some((w) => w.floor != null) ? (
          <div className="passport-block">
            <div className="passport-section-head">
              <h3>
                <Megaphone size={16} /> Объявления по этажам · подъезд {picked}
              </h3>
            </div>
            {byEntrance
              .filter((w) => w.floor != null)
              .sort((a, b) => Number(b.floor) - Number(a.floor))
              .map((item) => (
                <WorkRow key={item.id} item={item} isUk={false} onStatus={() => {}} />
              ))}
          </div>
        ) : null}

        {isUk ? (
        <>
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

          <div className={`floor-grid${floors > 16 ? ' floor-list-scroll' : ''}`}>
            {filteredFloors.map((floor) => {
              const floorWorks = byEntrance.filter((w) => w.floor === floor)
              const st = worst(floorWorks.map((w) => w.status))
              const hint = floorTileHint(st, floorWorks.length > 0)
              return (
                <button
                  key={floor}
                  type="button"
                  className={`floor-tile tone-${st}${pickedFloor === floor ? ' active' : ''}${hint ? ' has-note' : ''}`}
                  onClick={() => setPickedFloor(floor)}
                >
                  <b>{floor}</b>
                  {hint ? <span>{hint}</span> : null}
                </button>
              )
            })}
          </div>
        </div>

        {pickedFloor != null ? (
          <div className="passport-block floor-detail">
            <div className="passport-section-head">
              <h3>
                {pickedFloor} этаж · подъезд {picked}
              </h3>
              <button type="button" className="btn btn-ghost" onClick={() => setPickedFloor(null)}>
                Скрыть
              </button>
            </div>

            {floorDetailWorks.map((item) => (
              <WorkRow
                key={item.id}
                item={item}
                isUk={isUk}
                onStatus={(s) => setWorkStatus(item.id, s)}
              />
            ))}

            {(
              <form
                className="floor-announce-form"
                onSubmit={async (e: FormEvent) => {
                  e.preventDefault()
                  setFloorAnnBusy(true)
                  try {
                    await createWork({
                      title: floorAnnTitle,
                      detail: floorAnnDetail,
                      scope: 'floor',
                      entrance: picked,
                      floor: pickedFloor,
                    })
                    setToast({ type: 'success', text: 'Объявление отправлено жителям' })
                    setFloorAnnTitle('')
                    setFloorAnnDetail('')
                  } catch (err) {
                    setToast({ type: 'error', text: err instanceof Error ? err.message : 'Ошибка' })
                  } finally {
                    setFloorAnnBusy(false)
                  }
                }}
              >
                <p className="muted" style={{ marginTop: 0 }}>
                  Объявление для жителей этого этажа (уведомление уйдёт в MAX).
                </p>
                <Field label="Заголовок">
                  <TextInput
                    value={floorAnnTitle}
                    onChange={(e) => setFloorAnnTitle(e.target.value)}
                    placeholder="Например: Отключение воды"
                    required
                  />
                </Field>
                <Field label="Текст">
                  <TextArea
                    value={floorAnnDetail}
                    onChange={(e) => setFloorAnnDetail(e.target.value)}
                    placeholder="Когда и что планируется"
                    required
                    rows={3}
                  />
                </Field>
                <PrimaryButton type="submit" disabled={floorAnnBusy}>
                  {floorAnnBusy ? 'Отправка…' : `Опубликовать на ${pickedFloor} этаже`}
                </PrimaryButton>
                <div className="floor-announce-alt">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={floorAnnBusy}
                    onClick={async () => {
                      if (!floorAnnTitle.trim() || !floorAnnDetail.trim()) {
                        setToast({ type: 'error', text: 'Заполните заголовок и текст' })
                        return
                      }
                      setFloorAnnBusy(true)
                      try {
                        await createWork({
                          title: floorAnnTitle,
                          detail: floorAnnDetail,
                          scope: 'entrance',
                          entrance: picked,
                        })
                        setToast({ type: 'success', text: 'Объявление для подъезда отправлено' })
                        setFloorAnnTitle('')
                        setFloorAnnDetail('')
                      } catch (err) {
                        setToast({ type: 'error', text: err instanceof Error ? err.message : 'Ошибка' })
                      } finally {
                        setFloorAnnBusy(false)
                      }
                    }}
                  >
                    На весь подъезд {picked}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={floorAnnBusy}
                    onClick={async () => {
                      if (!floorAnnTitle.trim() || !floorAnnDetail.trim()) {
                        setToast({ type: 'error', text: 'Заполните заголовок и текст' })
                        return
                      }
                      setFloorAnnBusy(true)
                      try {
                        await createWork({
                          title: floorAnnTitle,
                          detail: floorAnnDetail,
                          scope: 'house',
                        })
                        setToast({ type: 'success', text: 'Объявление для дома отправлено' })
                        setFloorAnnTitle('')
                        setFloorAnnDetail('')
                      } catch (err) {
                        setToast({ type: 'error', text: err instanceof Error ? err.message : 'Ошибка' })
                      } finally {
                        setFloorAnnBusy(false)
                      }
                    }}
                  >
                    На весь дом
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : null}
        </>
        ) : null}
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
    entrance: number
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
      <div className="hint">
        {item.entrance === 0
          ? 'Весь дом'
          : item.floor
            ? `Подъезд ${item.entrance}, ${item.floor} этаж`
            : `Подъезд ${item.entrance}`}
      </div>
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
