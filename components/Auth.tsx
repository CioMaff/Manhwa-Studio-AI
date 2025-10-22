import React from 'react';
import { GoogleIcon } from './icons/GoogleIcon';

interface AuthProps {
    onLogin: (username: string) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {

    const handleGuestLogin = () => {
        onLogin('guest-user');
    };

    const handleGoogleLoginClick = () => {
        // This is a simulated login. For this app, we use the guest login.
        handleGuestLogin();
    };

    return (
        <div className="flex items-center justify-center h-full p-4">
            <div className="bg-gray-800/50 border border-gray-700 p-8 rounded-lg shadow-2xl max-w-sm w-full text-center">
                <h2 className="text-3xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                    Gemini Manhwa Studio
                </h2>
                <p className="text-gray-400 mb-8">
                    Your progress will be saved automatically in your browser.
                </p>
                <button
                    onClick={handleGuestLogin}
                    className="w-full mb-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 px-4 rounded-md hover:opacity-90 transition-opacity"
                >
                    Continue as Guest
                </button>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-gray-600" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-gray-800 px-2 text-sm text-gray-400">or</span>
                  </div>
                </div>
                <button
                    onClick={handleGoogleLoginClick}
                    className="w-full inline-flex justify-center items-center bg-white text-gray-800 font-semibold py-3 px-4 rounded-md shadow-md hover:bg-gray-200 transition-colors"
                >
                    <GoogleIcon className="w-5 h-5 mr-3" />
                    Sign in with Google
                </button>
            </div>
        </div>
    );
};