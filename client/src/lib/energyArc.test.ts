import { describe, expect, it } from 'vitest'
import { energyLevel } from './energyArc.ts'

describe('energyArc', () => {
  it('maps tempo onto the five-stop ramp', () => {
    expect(energyLevel(60)).toBe(1)
    expect(energyLevel(72)).toBe(2)
    expect(energyLevel(90)).toBe(3)
    expect(energyLevel(110)).toBe(4)
    expect(energyLevel(140)).toBe(5)
    expect(energyLevel(null)).toBe(1)
  })
})
