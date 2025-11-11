import React from 'react';

// This is the backend endpoint that will start the Shopify OAuth process.
// You will need to create this in your API Gateway and Lambda function.
const SHOPIFY_AUTH_URL = 'https://xmpbc16u1f.execute-api.us-west-1.amazonaws.com/default/auth/shopify';

export const Login: React.FC = () => {
    const handleLogin = () => {
        // The backend now knows which Shopify store to use via environment variables.
        // We just need to redirect to the auth endpoint.
        window.location.href = SHOPIFY_AUTH_URL;
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="max-w-md w-full text-center p-8 bg-white rounded-xl shadow-lg border border-slate-200">
                <header className="mb-8">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-cyan-500">
                        EmbraceHealth Meals
                    </h1>
                    <p className="text-slate-600 mt-2 text-lg">Your intelligent meal and grocery planner.</p>
                </header>
                <div className="space-y-4">
                    <p className="text-slate-600">
                        Connect your EmbraceHealth account to get started.
                    </p>
                    <button
                        onClick={handleLogin}
                        className="w-full inline-flex items-center justify-center space-x-3 bg-[#588555] text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:bg-[#4a7048] transform hover:-translate-y-0.5 transition-all duration-300 ease-in-out"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M13.25 4.058a9.96 9.96 0 00-6.105 2.373 1.01 1.01 0 00-.324.79v3.085c0 .548.442.99.99.99h3.454c.548 0 .99-.442.99-.99V8.123a1 1 0 00-.31-.724 4.54 4.54 0 012.305-1.065 4.543 4.543 0 014.238 5.72A4.543 4.543 0 0114.25 17.5a4.526 4.526 0 01-3.21-1.332l-.66.66a5.54 5.54 0 004.53 1.95c3.05 0 5.52-2.47 5.52-5.52 0-2.923-2.28-5.32-5.18-5.52zM9.77 12.316a1 1 0 00-1-1H5.686c-.548 0-.99.442-.99.99v3.086c0 .548.442.99.99.99h3.086a1 1 0 001-1v-3.086z" />
                        </svg>
                        <span>Login with EmbraceHealth</span>
                    </button>
                </div>
            </div>
        </div>
    );
};