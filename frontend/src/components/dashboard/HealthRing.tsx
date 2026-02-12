
import React from 'react';

interface HealthRingProps {
    radius: number;
    stroke: number;
    progress: number;
    color: string;
    icon?: React.ReactNode;
}

export const HealthRing: React.FC<HealthRingProps> = ({ radius, stroke, progress, color, icon }) => {
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center">
            <svg
                height={radius * 2}
                width={radius * 2}
                className="transform -rotate-90 transition-all duration-1000 ease-out"
            >
                {/* Track */}
                <circle
                    stroke="#e2e8f0"
                    strokeWidth={stroke}
                    fill="transparent"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                    className="opacity-30"
                />
                {/* Progress */}
                <circle
                    stroke={color}
                    strokeWidth={stroke}
                    strokeDasharray={circumference + ' ' + circumference}
                    style={{ strokeDashoffset }}
                    strokeLinecap="round"
                    fill="transparent"
                    r={normalizedRadius}
                    cx={radius}
                    cy={radius}
                />
            </svg>
            {icon && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                    {icon}
                </div>
            )}
        </div>
    );
};
