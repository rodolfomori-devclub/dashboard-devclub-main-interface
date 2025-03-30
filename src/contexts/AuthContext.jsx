// src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate } from 'react-router-dom';

// Create auth context
const AuthContext = createContext();

// JWT Secret (in a real app, this should be stored in a .env file or server-side)
const TOKEN_EXPIRY_DAYS = 30;

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRoles, setUserRoles] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Function to encode user data
  const encodeToken = (user, roles) => {
    const data = {
      uid: user.uid,
      email: user.email,
      roles,
      name: user.displayName,
      exp: Math.floor(Date.now() / 1000) + (TOKEN_EXPIRY_DAYS * 24 * 60 * 60) // 30 days from now
    };
    
    // Simple base64 encoding (not secure, but suitable for demo purposes)
    return btoa(JSON.stringify(data));
  };

  // Function to decode token
  const decodeToken = (token) => {
    try {
      const decoded = JSON.parse(atob(token));
      
      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < now) {
        return null;
      }
      
      return decoded;
    } catch (error) {
      console.error('Token decode failed:', error);
      return null;
    }
  };

  // Login with email and password
  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Get user roles from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const userData = userDoc.data();
      
      if (!userData) {
        throw new Error('User data not found');
      }
      
      const { roles, isAdmin } = userData;
      
      // Generate token
      const token = encodeToken(user, { ...roles, isAdmin });
      
      // Store token in localStorage
      localStorage.setItem('auth_token', token);
      localStorage.setItem('token_created_at', Date.now().toString());
      
      setUserRoles({ ...roles, isAdmin });
      return user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  // Register a new user (admin only)
  const registerUser = async (email, password, roles, displayName, isAdmin = false) => {
    try {
      // First check if current user is admin
      if (!userRoles?.isAdmin) {
        throw new Error('Only admins can register new users');
      }
      
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Update profile with displayName
      await updateProfile(user, { displayName });
      
      // Store user roles in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        email,
        displayName,
        roles,
        isAdmin,
        createdAt: new Date(),
        createdBy: currentUser.uid
      });
      
      return user;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  // Logout
  const logout = async () => {
    try {
      await signOut(auth);
      // Clear stored token
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token_created_at');
      setUserRoles(null);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  // Check if user has permission to access a specific route
  const hasPermission = (route) => {
    if (!userRoles) return false;
    if (userRoles.isAdmin) return true; // Admins can access everything
    
    return userRoles[route] === true;
  };

  // Check token validity on first load
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const createdAt = localStorage.getItem('token_created_at');
    
    if (token && createdAt) {
      // Check if token is expired (30 days)
      const isTokenExpired = Date.now() - parseInt(createdAt) > TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      
      if (isTokenExpired) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('token_created_at');
      } else {
        // Decode token
        const decodedToken = decodeToken(token);
        if (decodedToken) {
          // Set user roles from token
          setUserRoles(decodedToken.roles);
        }
      }
    }
    
    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // If we have a user but no token, generate one
        if (!localStorage.getItem('auth_token')) {
          try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            const userData = userDoc.data();
            
            if (userData) {
              const { roles, isAdmin } = userData;
              const token = encodeToken(user, { ...roles, isAdmin });
              
              localStorage.setItem('auth_token', token);
              localStorage.setItem('token_created_at', Date.now().toString());
              
              setUserRoles({ ...roles, isAdmin });
            }
          } catch (error) {
            console.error('Error fetching user data:', error);
          }
        }
      }
      
      setCurrentUser(user);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [navigate]);

  const value = {
    currentUser,
    userRoles,
    login,
    logout,
    registerUser,
    hasPermission,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};