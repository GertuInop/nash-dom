import { useMemo, useState } from 'react'
import { Car, ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAppStore, useUser } from '../store'
import type { ParkingSpot } from '../types'
import { houseTitle } from '../ui'

export function ParkingScreen() {
  const user = useUser()
  const houses = useAppStore((s) => s.houses)
  const parking = useAppStore((s) => s.parking)
  const claimParking = useAppStore((s) => s.claimParking)
  const releaseParking = useAppStore((s) => s.releaseParking)
  const appealParking = useAppStore((s) => s.appealParking)
  const setParkingActive = useAppStore((s) => s.setParkingActive)
  const navigate = useNavigate()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [selected, setSelected] = useState<ParkingSpot | null>(null)
  const house = houses.find((h) => h.id === user?.houseId)
  const isUk = user?.role === 'uk'
  const spots = parking.filter((p) => p.houseId === user?.houseId)

  const rows = useMemo(() => {
    const map = new Map<number, ParkingSpot[]>()
    for (const s of spots) {
      const list = map.get(s.row) || []
      list.push(s)
      map.set(s.row, list)
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([row, list]) => ({ row, list: list.sort((a, b) => a.col - b.col) }))
  }, [spots])

  const free = spots.filter((s) => s.active && !s.occupied).length
  const taken = spots.filter((s) => s.occupied).length
  const off = spots.filter((s) => !s.active).length

  async function run(id: string, fn: (id: string) => Promise<string | null>) {
    setBusyId(id)
    const err = await fn(id)
    setBusyId(null)
    if (err) useAppStore.getState().setToast({ type: 'error', text: err })
    else setSelected(spots.find((s) => s.id === id) || null)
  }

  return (
    <div className="parking-page">
      <div className="pad">
        <button type="button" className="back-btn" onClick={() => navigate('/app/house')}>
          <ChevronLeft size={18} /> К дому
        </button>
        <div className="parking-hero">
          <div>
            <div className="passport-kicker">Двор · парковка</div>
            <h2>{house ? houseTitle(house.city, house.address) : 'Парковка'}</h2>
            <p className="muted">Зелёные — свободно, серые — заняты. Нажмите на место.</p>
          </div>
          <Car size={32} />
        </div>
        <div className="parking-stats">
          <div>
            <b>{free}</b>
            <span>Свободно</span>
          </div>
          <div>
            <b>{taken}</b>
            <span>Занято</span>
          </div>
          <div>
            <b>{off}</b>
            <span>Отключено УК</span>
          </div>
        </div>
      </div>

      <div className="parking-lot">
        <div className="parking-road" />
        {rows.map(({ row, list }) => (
          <div key={row} className="parking-row">
            {list.map((spot) => {
              const mine = spot.occupiedByUserId === user?.id
              const blocked = !spot.active || (spot.occupied && !mine)
              let cls = 'parking-spot'
              if (!spot.active) cls += ' off'
              else if (spot.occupied) cls += mine ? ' mine' : ' busy'
              else cls += ' free'
              return (
                <button
                  key={spot.id}
                  type="button"
                  className={cls}
                  disabled={busyId === spot.id}
                  onClick={() => setSelected(spot)}
                  title={
                    !spot.active
                      ? 'Отключено УК'
                      : spot.occupied
                        ? mine
                          ? 'Ваше место'
                          : 'Занято'
                        : 'Свободно'
                  }
                >
                  <span>{spot.label}</span>
                  {!spot.active ? <em>выкл</em> : spot.occupied ? <em>{mine ? 'вы' : 'занято'}</em> : <em>свободно</em>}
                  {blocked && spot.occupied && !mine ? <i className="parking-lock" /> : null}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {selected ? (
        <div className="modal-back" onClick={() => setSelected(null)} role="presentation">
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog">
            <h3 style={{ marginTop: 0 }}>Место {selected.label}</h3>
            <p className="muted">
              {!selected.active
                ? 'Отключено управляющей компанией'
                : selected.occupied
                  ? selected.occupiedByUserId === user?.id
                    ? 'Занято вами'
                    : 'Занято другим жителем'
                  : 'Свободно — можно занять'}
            </p>
            <div className="parking-actions">
              {selected.active && !selected.occupied && user?.role === 'resident' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busyId === selected.id}
                  onClick={() => run(selected.id, claimParking)}
                >
                  Занять место
                </button>
              ) : null}
              {selected.occupiedByUserId === user?.id ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busyId === selected.id}
                  onClick={() => run(selected.id, releaseParking)}
                >
                  Освободить
                </button>
              ) : null}
              {selected.active && selected.occupied && selected.occupiedByUserId !== user?.id && user?.role === 'resident' ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busyId === selected.id}
                  onClick={() => run(selected.id, appealParking)}
                >
                  Обжаловать (заявка в УК)
                </button>
              ) : null}
              {!selected.active && user?.role === 'resident' ? (
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busyId === selected.id}
                  onClick={() => run(selected.id, appealParking)}
                >
                  Обжаловать отключение
                </button>
              ) : null}
              {isUk ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyId === selected.id}
                    onClick={() =>
                      run(selected.id, (id) => setParkingActive(id, !selected.active))
                    }
                  >
                    {selected.active ? 'Отключить место' : 'Активировать место'}
                  </button>
                  {selected.occupied ? (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={busyId === selected.id}
                      onClick={() => run(selected.id, releaseParking)}
                    >
                      Принудительно освободить
                    </button>
                  ) : null}
                </>
              ) : null}
              <button type="button" className="btn btn-ghost" onClick={() => setSelected(null)}>
                Закрыть
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
