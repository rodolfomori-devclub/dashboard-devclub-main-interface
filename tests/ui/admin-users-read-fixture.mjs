import { NAVIGATION } from '../../src/lib/navigation.js'

// Side-panel fixture for suites that open Admin to exercise another feature.
// This metadata is public configuration; all account API requests stay mocked.
export const adminUsersCatalogFixture = {
  permissions: NAVIGATION.flatMap(group => group.items.filter(item => item.permission !== 'admin').map(item => ({ id: item.permission, label: item.label, group: group.group }))),
  profiles: [{ id: 'user', label: 'Usuário' }, { id: 'admin', label: 'Administrador do Dashboard' }],
  loginUrl: 'https://auth.example.test',
  teams: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Comercial QA' }],
}
export const emptyAdminUsersFixture = { users: [], total: 0, page: 1, limit: 50, totalPages: 0 }
