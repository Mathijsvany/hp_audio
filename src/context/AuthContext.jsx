import React, { createContext, useContext, useState, useEffect } from 'react';
import { initGoogleClient, signIn, signOut } from '../services/googleDrive';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        initGoogleClient()
            .then(() => {
                setLoading(false);
            })
            .catch((err) => {
                console.error("Error initializing Google Client", err);
                setError(err?.error || JSON.stringify(err));
                setLoading(false);
            });
    }, []);

    const login = async () => {
        try {
            const userInfo = await signIn();
            setUser(userInfo);
        } catch (err) {
            console.error("Login failed", err);
            setError(err?.error || "Login failed");
        }
    };

    const logout = () => {
        signOut();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading, error }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
