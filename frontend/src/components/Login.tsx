
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

const API_BASE_URL = 'https://xmpbc16u1f.execute-api.us-west-1.amazonaws.com/default';

export const Login: React.FC = () => {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const normalizedEmail = email.toLowerCase().trim();

            const response = await fetch(`${API_BASE_URL}/auth/customer-login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: normalizedEmail, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            if (data.token) {
                login(data.token);
            } else {
                throw new Error('No access token received');
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred during login');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-lg border border-slate-200">
                <header className="mb-10 text-center flex flex-col items-center">
                    <img src="/input_file_0.png" alt="EmbraceHealth AI" className="h-16 w-auto mb-4" />
                    <p className="text-slate-500 font-medium">Sign in to your health dashboard</p>
                </header>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Email address</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all font-medium"
                            placeholder="you@example.com"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all font-medium"
                            placeholder="••••••••"
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg font-bold">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-slate-900 text-white font-black uppercase tracking-widest py-4 px-6 rounded-xl hover:bg-black transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95"
                    >
                        {isLoading ? 'Authenticating...' : 'Sign in'}
                    </button>
                </form>
            </div>
        </div>
    );
};
