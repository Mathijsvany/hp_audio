import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import BookList from './components/BookList';
import Player from './components/Player';

const AppContent = () => {
    const { user, loading, logout } = useAuth();
    const [selectedBook, setSelectedBook] = useState(null);

    if (loading) {
        return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Loading...</div>;
    }

    if (!user) {
        return <Login />;
    }

    if (selectedBook) {
        return <Player book={selectedBook} onBack={() => setSelectedBook(null)} />;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <div className="p-6 border-b border-gray-800 flex justify-between items-center">
                <h1 className="text-2xl font-bold text-yellow-500">Hogwarts Audio</h1>
                <div className="flex items-center gap-3">
                    <img src={user.picture} alt="User" className="w-8 h-8 rounded-full" />
                    <span className="hidden md:inline text-sm text-gray-400">{user.name}</span>
                    <button
                        onClick={logout}
                        className="ml-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </div>
            <BookList onSelectBook={setSelectedBook} />
        </div>
    );
};

function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

export default App;
