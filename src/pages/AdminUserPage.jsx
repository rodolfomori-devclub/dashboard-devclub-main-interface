// src/pages/AdminUserPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, auth, firebaseConfig } from '../firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { Navigate } from 'react-router-dom';
import { FaEdit, FaTrash, FaUserPlus, FaTimes, FaSave, FaUserShield, FaInfoCircle, FaExclamationTriangle } from 'react-icons/fa';

// Secondary Firebase app instance — used to create new users without
// signing out the current admin (createUserWithEmailAndPassword auto-signs-in).
const SECONDARY_APP_NAME = 'AdminUserCreation';
const secondaryApp = getApps().find(a => a.name === SECONDARY_APP_NAME)
  || initializeApp(firebaseConfig, SECONDARY_APP_NAME);
const secondaryAuth = getAuth(secondaryApp);

// Apenas as rotas que aparecem no Header — sincronizado com Header.jsx menuItems
const APP_ROUTES = [
  { id: 'today',   name: 'Diário',   description: 'Dashboard de vendas diárias' },
  { id: 'daily',   name: 'Global',   description: 'Dashboard global de vendas' },
  { id: 'monthly', name: 'Mensal',   description: 'Dashboard de vendas mensais' },
  { id: 'yearly',  name: 'Anual',    description: 'Dashboard de vendas anuais' },
  { id: 'ts',      name: 'T$',       description: 'Dashboard T$ (Toca o Sino)' },
  { id: 'traffic', name: 'Tráfego',  description: 'Dashboard de tráfego' },
  { id: 'goals',   name: 'Metas',    description: 'Gestão de metas de faturamento' },
  { id: 'leads',   name: 'Leads',    description: 'Gestão de leads captados' },
];

const AdminUserPage = () => {
  const { currentUser, userRoles } = useAuth();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // New user form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [newUserRoles, setNewUserRoles] = useState(
    APP_ROUTES.reduce((acc, route) => ({ ...acc, [route.id]: false }), {})
  );

  // Edit user modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editRoles, setEditRoles] = useState({});
  const [editName, setEditName] = useState('');
  const [editIsAdmin, setEditIsAdmin] = useState(false);

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // Fetch all users from Firestore
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const querySnapshot = await getDocs(collection(db, 'users'));
        const usersList = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setUsers(usersList);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Falha ao carregar usuários');
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  // Guard: redirect if not admin (after hooks)
  if (!userRoles?.isAdmin) {
    return <Navigate to="/login" replace />;
  }

  const refreshUsers = async () => {
    const querySnapshot = await getDocs(collection(db, 'users'));
    setUsers(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  // Handle new user registration — uses secondaryAuth to avoid signing out the admin
  const handleRegister = async (e) => {
    e.preventDefault();

    if (!email || !password || !displayName) {
      setError('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    try {
      setActionLoading(true);
      setError('');

      // Create user via secondary auth instance (doesn't affect current admin session)
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const newUser = userCredential.user;

      // Update display name on secondary instance
      await updateProfile(newUser, { displayName });

      // Sign out from secondary instance so it's clean for next creation
      await secondaryAuth.signOut();

      // Store user data in Firestore
      await setDoc(doc(db, 'users', newUser.uid), {
        email,
        displayName,
        isAdmin,
        roles: newUserRoles,
        createdAt: new Date(),
        createdBy: currentUser.uid,
      });

      // Reset form
      setEmail('');
      setPassword('');
      setDisplayName('');
      setIsAdmin(false);
      setNewUserRoles(APP_ROUTES.reduce((acc, route) => ({ ...acc, [route.id]: false }), {}));

      showSuccess('Usuário criado com sucesso!');
      await refreshUsers();
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'Falha ao criar usuário');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleNewUserRole = (routeId) => {
    setNewUserRoles(prev => ({ ...prev, [routeId]: !prev[routeId] }));
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setEditName(user.displayName || '');
    setEditIsAdmin(user.isAdmin || false);
    // Ensure all APP_ROUTES keys exist in editRoles (merge with defaults)
    const baseRoles = APP_ROUTES.reduce((acc, r) => ({ ...acc, [r.id]: false }), {});
    setEditRoles({ ...baseRoles, ...(user.roles || {}) });
    setShowEditModal(true);
  };

  const toggleEditRole = (routeId) => {
    setEditRoles(prev => ({ ...prev, [routeId]: !prev[routeId] }));
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    try {
      setActionLoading(true);
      await updateDoc(doc(db, 'users', editingUser.id), {
        displayName: editName,
        isAdmin: editIsAdmin,
        roles: editRoles,
        updatedAt: new Date(),
        updatedBy: currentUser.uid,
      });

      setShowEditModal(false);
      showSuccess('Usuário atualizado com sucesso!');
      await refreshUsers();
    } catch (err) {
      console.error('Update error:', err);
      setError(err.message || 'Falha ao atualizar usuário');
    } finally {
      setActionLoading(false);
    }
  };

  const openDeleteModal = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      setActionLoading(true);
      await deleteDoc(doc(db, 'users', userToDelete.id));
      setShowDeleteModal(false);
      setUserToDelete(null);
      showSuccess('Usuário excluído com sucesso!');
      await refreshUsers();
    } catch (err) {
      console.error('Delete error:', err);
      setError(err.message || 'Falha ao excluir usuário');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary-dark dark:text-primary mb-2">
          Gerenciamento de Usuários
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Crie, edite e gerencie usuários e suas permissões de acesso
        </p>
      </div>

      {/* Error alert */}
      {error && (
        <div className="bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg relative mb-6 flex items-start justify-between" role="alert">
          <span>{error}</span>
          <button className="ml-4 shrink-0" onClick={() => setError('')}><FaTimes /></button>
        </div>
      )}

      {/* Success alert */}
      {successMessage && (
        <div className="bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg relative mb-6 flex items-start justify-between" role="alert">
          <span>{successMessage}</span>
          <button className="ml-4 shrink-0" onClick={() => setSuccessMessage('')}><FaTimes /></button>
        </div>
      )}

      {/* Create New User Form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 sm:p-6 mb-8">
        <div className="flex items-center mb-4">
          <FaUserPlus className="text-primary mr-2 text-xl" />
          <h2 className="text-xl font-bold text-primary dark:text-primary">Criar Novo Usuário</h2>
        </div>

        <form onSubmit={handleRegister} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Senha *</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome de Exibição *</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Permissões de Acesso</label>
              <div className="group relative">
                <FaInfoCircle className="text-blue-500 cursor-help" />
                <div className="opacity-0 group-hover:opacity-100 absolute z-10 bg-white dark:bg-gray-800 text-sm p-2 rounded shadow-lg left-0 bottom-full mb-1 border border-gray-200 dark:border-gray-700 w-64 pointer-events-none transition-opacity">
                  Selecione "Admin" para conceder acesso total ou marque páginas específicas para acesso limitado.
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {/* Admin checkbox */}
              <div className="flex items-center bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/30 p-3 rounded-lg">
                <input
                  type="checkbox"
                  id="isAdmin"
                  checked={isAdmin}
                  onChange={() => setIsAdmin(!isAdmin)}
                  className="h-4 w-4 text-primary rounded border-gray-300"
                />
                <label htmlFor="isAdmin" className="ml-2 text-gray-700 dark:text-gray-200 flex items-center text-sm font-medium">
                  <FaUserShield className="mr-1 text-purple-500" /> Admin (Acesso Total)
                </label>
              </div>

              {APP_ROUTES.map(route => (
                <div key={route.id} className="flex items-center bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                  <input
                    type="checkbox"
                    id={`new-${route.id}`}
                    checked={newUserRoles[route.id] || false}
                    onChange={() => toggleNewUserRole(route.id)}
                    disabled={isAdmin}
                    className="h-4 w-4 text-primary rounded border-gray-300 disabled:opacity-40"
                  />
                  <label htmlFor={`new-${route.id}`} className={`ml-2 flex items-center text-sm ${isAdmin ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>
                    {route.icon}{route.name}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={actionLoading}
            className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
          >
            <FaUserPlus />
            {actionLoading ? 'Criando...' : 'Criar Usuário'}
          </button>
        </form>
      </div>

      {/* Users List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-bold text-primary dark:text-primary">
            Usuários ({users.length})
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {users.filter(u => u.isAdmin).length} admin(s) · {users.filter(u => !u.isAdmin).length} usuário(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Nome</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Função</th>
                <th className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">Permissões</th>
                <th className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhum usuário encontrado
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                      {user.displayName || '—'}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                      {user.email}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm">
                      {user.isAdmin ? (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                          Admin
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          Usuário
                        </span>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm hidden md:table-cell">
                      {user.isAdmin ? (
                        <span className="text-gray-500 dark:text-gray-400 italic">Acesso Total</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {APP_ROUTES.filter(route => user.roles?.[route.id]).map(route => (
                            <span
                              key={route.id}
                              className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 flex items-center"
                            >
                              {route.icon}{route.name}
                            </span>
                          ))}
                          {/* Bug fix: correct operator precedence */}
                          {(!user.roles || Object.values(user.roles).every(v => !v)) && (
                            <span className="text-gray-400 dark:text-gray-500 italic text-xs">Sem acesso</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm font-medium text-right whitespace-nowrap">
                      <button
                        onClick={() => openEditModal(user)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mr-4 inline-flex items-center gap-1 transition-colors"
                        title="Editar usuário"
                      >
                        <FaEdit />
                        <span className="hidden sm:inline">Editar</span>
                      </button>
                      <button
                        onClick={() => openDeleteModal(user)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 inline-flex items-center gap-1 transition-colors"
                        title="Excluir usuário"
                      >
                        <FaTrash />
                        <span className="hidden sm:inline">Excluir</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div
            className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5 pb-3 border-b dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FaEdit className="text-primary" />
                Editar: {editingUser?.displayName}
              </h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome de Exibição</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Permissões de Acesso</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {/* Admin checkbox */}
                  <div className="flex items-center bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800/30 p-3 rounded-lg">
                    <input
                      type="checkbox"
                      id="editIsAdmin"
                      checked={editIsAdmin}
                      onChange={() => setEditIsAdmin(!editIsAdmin)}
                      className="h-4 w-4 text-primary rounded border-gray-300"
                    />
                    <label htmlFor="editIsAdmin" className="ml-2 text-gray-700 dark:text-gray-200 flex items-center text-sm font-medium">
                      <FaUserShield className="mr-1 text-purple-500" /> Admin (Acesso Total)
                    </label>
                  </div>

                  {APP_ROUTES.map(route => (
                    <div key={route.id} className="flex items-center bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                      <input
                        type="checkbox"
                        id={`edit-${route.id}`}
                        checked={editRoles[route.id] || false}
                        onChange={() => toggleEditRole(route.id)}
                        disabled={editIsAdmin}
                        className="h-4 w-4 text-primary rounded border-gray-300 disabled:opacity-40"
                      />
                      <label htmlFor={`edit-${route.id}`} className={`ml-2 flex items-center text-sm ${editIsAdmin ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>
                        {route.icon}{route.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateUser}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 font-medium"
                >
                  <FaSave />
                  {actionLoading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteModal(false)}>
          <div
            className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-2xl max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 pb-3 border-b dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FaExclamationTriangle className="text-red-500" />
                Excluir Usuário
              </h2>
              <button onClick={() => setShowDeleteModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-2">
              <p className="text-gray-700 dark:text-gray-300">
                Tem certeza que deseja excluir o usuário <strong className="text-gray-900 dark:text-white">{userToDelete?.displayName || userToDelete?.email}</strong>?
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">
                Esta ação remove apenas o registro de permissões. O acesso ao Firebase Auth deve ser revogado separadamente se necessário.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
              <button
                onClick={() => { setShowDeleteModal(false); setUserToDelete(null); }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={actionLoading}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 font-medium"
              >
                <FaTrash />
                {actionLoading ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserPage;
