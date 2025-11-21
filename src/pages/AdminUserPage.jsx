// src/pages/AdminUserPage.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, auth } from '../firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { Navigate, Link } from 'react-router-dom';
import { FaEdit, FaTrash, FaUserPlus, FaTimes, FaSave, FaUserShield, FaInfoCircle, FaChartPie, FaDatabase } from 'react-icons/fa';

// Define the available app routes for permissions
const APP_ROUTES = [
  { id: 'today', name: 'Diário', icon: null, description: 'Dashboard de vendas diárias' },
  { id: 'daily', name: 'Global', icon: null, description: 'Dashboard global de vendas' },
  { id: 'monthly', name: 'Mensal', icon: null, description: 'Dashboard de vendas mensais' },
  { id: 'yearly', name: 'Anual', icon: null, description: 'Dashboard de vendas anuais' },
  { id: 'commercial', name: 'Comercial', icon: null, description: 'Dashboard comercial e vendedores' },
  { id: 'comparativo', name: 'Comparativo', icon: null, description: 'Comparação de períodos' },
  { id: 'dre', name: 'DRE', icon: <FaChartPie className="mr-1 text-blue-500" />, description: 'Demonstrativo de resultados' },
  { id: 'launch', name: 'LaunchPro', icon: null, description: 'Sistema LaunchPro' },
  { id: 'lead-scoring', name: 'Lead Scoring', icon: null, description: 'Pontuação de leads' },
  { id: 'ts', name: 'T$ (Toca o Sino)', icon: null, description: 'Dashboard de vendas T$ e dados gerais' },
  { id: 'traffic', name: 'Tráfego', icon: null, description: 'Dashboard de tráfego' },
  { id: 'goals', name: 'Metas', icon: null, description: 'Gestão de metas de faturamento' },
  { id: 'data-sources', name: 'Fontes de Dados', icon: null, description: 'Gerenciamento de fontes de dados' }
];

const AdminUserPage = () => {
  const { currentUser, userRoles } = useAuth();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
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

  // Check if user is admin - redirect if not
  if (!userRoles?.isAdmin) {
    return <Navigate to="/access-denied" />;
  }

  // Fetch all users from Firestore
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const querySnapshot = await getDocs(collection(db, 'users'));
        const usersList = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setUsers(usersList);
      } catch (error) {
        console.error('Error fetching users:', error);
        setError('Falha ao carregar usuários');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Handle new user registration
  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!email || !password || !displayName) {
      setError('Por favor, preencha todos os campos obrigatórios');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update display name
      await updateProfile(user, {
        displayName: displayName
      });
      
      // Store user roles in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email,
        displayName,
        isAdmin,
        roles: newUserRoles,
        createdAt: new Date(),
        createdBy: currentUser.uid
      });
      
      // Reset form
      setEmail('');
      setPassword('');
      setDisplayName('');
      setIsAdmin(false);
      setNewUserRoles(APP_ROUTES.reduce((acc, route) => ({ ...acc, [route.id]: false }), {}));
      
      // Show success message
      setSuccessMessage('Usuário criado com sucesso');
      setTimeout(() => setSuccessMessage(''), 5000);
      
      // Refresh users list
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
    } catch (error) {
      console.error('Registration error:', error);
      setError(error.message || 'Falha ao criar usuário');
    } finally {
      setLoading(false);
    }
  };

  // Handle toggling a role for new user
  const toggleNewUserRole = (routeId) => {
    setNewUserRoles(prev => ({
      ...prev,
      [routeId]: !prev[routeId]
    }));
  };

  // Open edit user modal
  const openEditModal = (user) => {
    setEditingUser(user);
    setEditName(user.displayName || '');
    setEditIsAdmin(user.isAdmin || false);
    setEditRoles(user.roles || {});
    setShowEditModal(true);
  };

  // Handle toggling a role for edited user
  const toggleEditRole = (routeId) => {
    setEditRoles(prev => ({
      ...prev,
      [routeId]: !prev[routeId]
    }));
  };

  // Handle user update
  const handleUpdateUser = async () => {
    if (!editingUser) return;
    
    try {
      setLoading(true);
      
      // Update user in Firestore
      await updateDoc(doc(db, 'users', editingUser.id), {
        displayName: editName,
        isAdmin: editIsAdmin,
        roles: editRoles,
        updatedAt: new Date(),
        updatedBy: currentUser.uid
      });
      
      // Close modal
      setShowEditModal(false);
      
      // Show success message
      setSuccessMessage('Usuário atualizado com sucesso');
      setTimeout(() => setSuccessMessage(''), 5000);
      
      // Refresh users list
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
    } catch (error) {
      console.error('Update error:', error);
      setError(error.message || 'Falha ao atualizar usuário');
    } finally {
      setLoading(false);
    }
  };

  // Open delete confirmation modal
  const openDeleteModal = (user) => {
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  // Handle user deletion
  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      setLoading(true);
      
      // Delete user from Firestore
      await deleteDoc(doc(db, 'users', userToDelete.id));
      
      // Close modal
      setShowDeleteModal(false);
      
      // Show success message
      setSuccessMessage('Usuário excluído com sucesso');
      setTimeout(() => setSuccessMessage(''), 5000);
      
      // Refresh users list
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
    } catch (error) {
      console.error('Delete error:', error);
      setError(error.message || 'Falha ao excluir usuário');
    } finally {
      setLoading(false);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-primary-dark dark:text-primary mb-2">
              Gerenciamento de Usuários
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Crie, edite e gerencie usuários e suas permissões de acesso
            </p>
          </div>
          <Link
            to="/data-sources"
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-md hover:shadow-lg"
          >
            <FaDatabase className="mr-2" />
            Fontes de Dados
          </Link>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded relative mb-6 shadow-sm" role="alert">
          <span className="block sm:inline">{error}</span>
          <button 
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => setError('')}
          >
            <FaTimes />
          </button>
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-300 px-4 py-3 rounded relative mb-6 shadow-sm" role="alert">
          <span className="block sm:inline">{successMessage}</span>
          <button 
            className="absolute top-0 bottom-0 right-0 px-4 py-3"
            onClick={() => setSuccessMessage('')}
          >
            <FaTimes />
          </button>
        </div>
      )}

      {/* Create New User Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 mb-8">
        <div className="flex items-center mb-4">
          <FaUserPlus className="text-primary dark:text-secondary mr-2 text-xl" />
          <h2 className="text-xl font-bold text-primary dark:text-secondary">
            Criar Novo Usuário
          </h2>
        </div>
        
        <form onSubmit={handleRegister} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email *
              </label>
              <input
                type="email"
                id="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:ring-primary dark:focus:ring-secondary focus:border-primary dark:focus:border-secondary"
              />
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Senha *
              </label>
              <input
                type="password"
                id="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:ring-primary dark:focus:ring-secondary focus:border-primary dark:focus:border-secondary"
              />
            </div>
            
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nome de Exibição *
              </label>
              <input
                type="text"
                id="displayName"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:ring-primary dark:focus:ring-secondary focus:border-primary dark:focus:border-secondary"
              />
            </div>
          </div>
          
          <div>
            <div className="flex items-center mb-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Permissões de Acesso
              </label>
              <div className="ml-2 group relative">
                <FaInfoCircle className="text-blue-500 dark:text-blue-400 cursor-help" />
                <div className="opacity-0 group-hover:opacity-100 absolute z-10 bg-white dark:bg-gray-800 text-sm p-2 rounded shadow-lg -left-2 -top-2 transform -translate-y-full border border-gray-200 dark:border-gray-700 w-60 pointer-events-none transition-opacity">
                  Selecione "Admin" para conceder acesso total ou marque páginas específicas para acesso limitado.
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="flex items-center bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                <input
                  type="checkbox"
                  id="isAdmin"
                  checked={isAdmin}
                  onChange={() => setIsAdmin(!isAdmin)}
                  className="h-4 w-4 text-primary focus:ring-primary dark:focus:ring-secondary rounded border-gray-300 dark:border-gray-600"
                />
                <label htmlFor="isAdmin" className="ml-2 text-gray-700 dark:text-gray-200 flex items-center">
                  <FaUserShield className="mr-1" /> Admin (Acesso Total)
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
                    className="h-4 w-4 text-primary focus:ring-primary dark:focus:ring-secondary rounded border-gray-300 dark:border-gray-600 disabled:opacity-50"
                  />
                  <label htmlFor={`new-${route.id}`} className={`ml-2 flex items-center ${isAdmin ? 'text-gray-500 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>
                    {route.icon} {route.name}
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary hover:bg-primary-dark text-white dark:bg-secondary dark:hover:bg-secondary-light dark:text-gray-900 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <FaUserPlus className="mr-2" />
              {loading ? 'Criando...' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </div>

      {/* Users List Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-lg sm:text-xl font-bold text-primary dark:text-secondary">
            Usuários ({users.length})
          </h2>
          
          {users.length > 0 && (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {users.filter(u => u.isAdmin).length} admin(s), {users.filter(u => !u.isAdmin).length} usuário(s)
            </div>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Nome
                </th>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Email
                </th>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Função
                </th>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">
                  Permissões
                </th>
                <th scope="col" className="px-4 sm:px-6 py-3 text-right text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-4 sm:px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nenhum usuário encontrado
                  </td>
                </tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {user.displayName || 'N/A'}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {user.email}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                      {user.isAdmin ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          Admin
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          Usuário
                        </span>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white hidden md:table-cell">
                      {user.isAdmin ? (
                        <span>Acesso Total</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {APP_ROUTES.map(route => (
                            user.roles && user.roles[route.id] ? (
                              <span 
                                key={route.id}
                                className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center"
                              >
                                {route.icon && <span className="mr-1">{route.icon}</span>}
                                {route.name}
                              </span>
                            ) : null
                          ))}
                          {!user.roles || Object.values(user.roles).every(v => !v) && (
                            <span className="text-gray-500 dark:text-gray-400 italic">
                              Sem acesso
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                      <button
                        onClick={() => openEditModal(user)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 mr-4"
                        title="Editar usuário"
                      >
                        <FaEdit className="inline" />
                        <span className="ml-1 hidden sm:inline">Editar</span>
                      </button>
                      <button
                        onClick={() => openDeleteModal(user)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                        title="Excluir usuário"
                      >
                        <FaTrash className="inline" />
                        <span className="ml-1 hidden sm:inline">Excluir</span>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div 
            className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                <FaEdit className="mr-2 text-primary dark:text-secondary" />
                Editar Usuário: {editingUser?.displayName}
              </h2>
              <button 
                onClick={() => setShowEditModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-xl"
              >
                <FaTimes />
              </button>
            </div>
            
            <div className="space-y-6">
              <div>
                <label htmlFor="editName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome de Exibição
                </label>
                <input
                  type="text"
                  id="editName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 focus:ring-primary dark:focus:ring-secondary focus:border-primary dark:focus:border-secondary"
                />
              </div>
              
              <div>
                <div className="flex items-center mb-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Permissões de Acesso
                  </label>
                  <div className="ml-2 group relative">
                    <FaInfoCircle className="text-blue-500 dark:text-blue-400 cursor-help" />
                    <div className="opacity-0 group-hover:opacity-100 absolute z-10 bg-white dark:bg-gray-800 text-sm p-2 rounded shadow-lg -left-2 -top-2 transform -translate-y-full border border-gray-200 dark:border-gray-700 w-60 pointer-events-none transition-opacity">
                      Selecione "Admin" para conceder acesso total ou marque páginas específicas para acesso limitado.
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="flex items-center bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                    <input
                      type="checkbox"
                      id="editIsAdmin"
                      checked={editIsAdmin}
                      onChange={() => setEditIsAdmin(!editIsAdmin)}
                      className="h-4 w-4 text-primary focus:ring-primary dark:focus:ring-secondary rounded border-gray-300 dark:border-gray-600"
                    />
                    <label htmlFor="editIsAdmin" className="ml-2 text-gray-700 dark:text-gray-200 flex items-center">
                      <FaUserShield className="mr-1" /> Admin (Acesso Total)
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
                        className="h-4 w-4 text-primary focus:ring-primary dark:focus:ring-secondary rounded border-gray-300 dark:border-gray-600 disabled:opacity-50"
                      />
                      <label htmlFor={`edit-${route.id}`} className={`ml-2 flex items-center ${editIsAdmin ? 'text-gray-500 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>
                        {route.icon} {route.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateUser}
                  disabled={loading}
                  className="px-4 py-2 bg-primary hover:bg-primary-dark text-white dark:bg-secondary dark:hover:bg-secondary-light dark:text-gray-900 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <FaSave className="mr-2" />
                  {loading ? 'Atualizando...' : 'Atualizar Usuário'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteModal(false)}>
          <div 
            className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 pb-2 border-b dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                <FaTrash className="mr-2 text-red-500" />
                Excluir Usuário
              </h2>
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={loading}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <FaTrash className="mr-2" />
                {loading ? 'Excluindo...' : 'Excluir Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserPage