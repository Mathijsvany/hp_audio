import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogIn } from 'lucide-react';

const Login = () => {
    const { login, error } = useAuth();

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
            <div className="text-center max-w-md">
                <h1 className="text-5xl font-bold mb-6 text-yellow-500">Hogwarts Audio</h1>
                <p className="text-gray-400 mb-8">Connect your Google Drive to stream your magical audiobooks anywhere.</p>

                {error && (
                    <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-lg mb-6">
                        <p className="font-bold">Error:</p>
                        <p className="text-sm">{error.toString()}</p>
                    </div>
                )}

                <button
                    onClick={login}
                    className="flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-8 rounded-full transition-all transform hover:scale-105 shadow-lg w-full"
                >
                    <LogIn size={24} />
                    <span>Sign in with Google</span>
                </button>
            </div>
        </div>
    );
};

export default Login;
