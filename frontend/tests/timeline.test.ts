// Road Memory and coverage tests: the client-side reconstruction must agree with the API for "today",
// and must hide records that did not exist yet on past dates. Run: npm test
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { cityAt, timelineEvents, toDay } from '../src/lib/timeline.ts'
import type { CityData } from '../src/api/types.ts'

const data = JSON.parse(readFileSync(new URL('../public/demo-snapshot.json', import.meta.url), 'utf8')) as CityData
const today = toDay(data.meta.as_of)

test('today: client coverage, priority band and repair status match the API for every road section', () => {
  const state = cityAt(data, today)
  for (const s of state.segments) {
    assert.equal(s.coverageAt, s.coverage, `coverage ${s.id}`)
    assert.equal(s.bandAt, s.band, `band ${s.id}`)
    assert.equal(s.repairAt, s.repair_status, `repair ${s.id}`)
    if (s.rps !== null) assert.equal(s.rpsAt, s.rps, `rps ${s.id}`)
  }
})

test('today: unresolved report count matches the dashboard metric', () => {
  const state = cityAt(data, today)
  assert.equal(state.visibleDefects.length, data.metrics.total_defects)
})

test('section priority is the highest unresolved report score in that section', () => {
  for (const s of data.segments) {
    const reports = data.defects.filter((d) => d.segment_id === s.id && d.status !== 'repaired_verified')
    const max = reports.length ? Math.max(...reports.map((d) => d.rps)) : null
    assert.equal(s.rps, max, s.id)
  }
})

test('road memory: a recurrence is invisible before its detection date and visible after', () => {
  const rec = data.defects.find((d) => d.possible_recurrence)
  assert.ok(rec, 'demo data has a possible recurrence')
  const day = toDay(rec.detected_on)
  assert.equal(cityAt(data, day - 1).visibleDefects.some((d) => d.id === rec.id), false)
  assert.equal(cityAt(data, day).visibleDefects.some((d) => d.id === rec.id), true)
})

test('road memory: repair is "submitted" before recurrence and "re-inspection recommended" after', () => {
  const rec = data.defects.find((d) => d.possible_recurrence)!
  const repair = data.repairs.find((r) => rec.recurrence_of.includes(r.defect_id))!
  const before = cityAt(data, toDay(rec.detected_on) - 1).repairs.find((r) => r.id === repair.id)!
  const after = cityAt(data, toDay(rec.detected_on)).repairs.find((r) => r.id === repair.id)!
  assert.notEqual(before.statusAt, 'reinspection_recommended')
  assert.equal(after.statusAt, 'reinspection_recommended')
})

test('road memory: verified repairs drop the defect from the active list only after verification', () => {
  const verified = data.repairs.find((r) => r.verified_on)!
  const mid = toDay(verified.verified_on!) - 1
  const at = (d: number) => cityAt(data, d).defects.find((x) => x.id === verified.defect_id)?.statusAt
  assert.equal(at(mid), 'repair_submitted')
  assert.equal(at(toDay(verified.verified_on!)), 'repaired_verified')
})

test('coverage on a past date: a section inspected only recently counts as never inspected before that', () => {
  const seg = data.segments.find((s) => s.inspection_count === 1 && s.coverage === 'recent')!
  const first = Math.min(...data.inspections.filter((i) => i.segment_id === seg.id).map((i) => toDay(i.inspected_on)))
  assert.equal(cityAt(data, first - 1).segments.find((s) => s.id === seg.id)!.coverageAt, 'never')
})

test('timeline events are chronological and labelled with real record ids', () => {
  const ev = timelineEvents(data, null)
  for (let i = 1; i < ev.length; i++) assert.ok(ev[i].day >= ev[i - 1].day)
  const ids = new Set([...data.defects.map((d) => d.id), ...data.inspections.map((i) => i.id)])
  for (const e of ev) assert.ok(ids.has(e.refId), e.refId)
})
