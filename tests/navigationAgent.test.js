import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { FINANCIAL_READ, NAVIGATION, SCREENS, hasAnyPermission, isAssignable } from '../src/lib/navigation.js'

const agent = SCREENS.find(screen => screen.path === '/agente')
const FINANCIAL_SCREENS = ['today', 'daily', 'monthly', 'yearly', 'comparativo', 'goal-pace', 'goals', 'refunds', 'attribution']

test('the agent opens with any of the financial screens, and with nothing else', () => {
  assert.deepEqual(agent.permission, FINANCIAL_SCREENS)
  assert.equal(agent.permission, FINANCIAL_READ)
  for (const id of FINANCIAL_SCREENS) assert.equal(hasAnyPermission({ [id]: true }, agent.permission), true, id)
  assert.equal(hasAnyPermission({ materials: true, 'hub-home': true, commissions: true }, agent.permission), false)
  assert.equal(hasAnyPermission({ monthly: false }, agent.permission), false, 'Only a granted permission counts')
  assert.equal(hasAnyPermission({}, agent.permission), false)
})

test('a single permission still works as before', () => {
  assert.equal(hasAnyPermission({ monthly: true }, 'monthly'), true)
  assert.equal(hasAnyPermission({ monthly: true }, 'yearly'), false)
})

test('the agent never becomes the start page of anyone', () => {
  const group = NAVIGATION.find(item => item.group === 'Visão do negócio').items
  assert.equal(group.at(-1).path, '/agente')
  const before = SCREENS.slice(0, SCREENS.indexOf(agent))
  for (const id of FINANCIAL_SCREENS) assert.ok(before.some(screen => screen.permission === id), `${id} has its own screen first`)
})

test('the admin catalog offers only permissions that can be assigned', () => {
  const assignable = SCREENS.filter(isAssignable)
  assert.equal(assignable.includes(agent), false)
  assert.equal(assignable.length, SCREENS.length - 1)
  assert.ok(assignable.every(screen => typeof screen.permission === 'string'))
  const source = readFileSync(new URL('../src/components/admin/UserManagement.jsx', import.meta.url), 'utf8')
  assert.match(source, /items\.filter\(isAssignable\)\.map\(item => \[item\.permission/)
  assert.match(source, /isAssignable\(screen\) && screen\.permission !== 'admin'/)
})

test('session guards accept a list of permissions', () => {
  const auth = readFileSync(new URL('../src/contexts/AuthContext.jsx', import.meta.url), 'utf8')
  assert.match(auth, /userRoles\.isAdmin \|\| hasAnyPermission\(userRoles, permission\)/)
  const workspace = readFileSync(new URL('../src/PrivateWorkspace.jsx', import.meta.url), 'utf8')
  assert.match(workspace, /\['\/agente', FINANCIAL_READ, Agent\]/)
})
