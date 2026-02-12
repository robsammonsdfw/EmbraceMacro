
import React from 'react';

type Permission = 'full' | 'read' | 'none';

interface CoachProxyUIProps {
    permission: Permission;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export const CoachProxyUI: React.FC<CoachProxyUIProps> = ({ permission, children, fallback }) => {
    if (permission === 'none') {
        return <>{fallback || null}</>;
    }

    if (permission === 'read') {
        return (
            <div className="relative group/proxy">
                <div className="pointer-events-none opacity-80 filter grayscale-[0.2]">
                    {children}
                </div>
                <div className="absolute inset-0 bg-transparent z-10 cursor-not-allowed" title="Read-only access for Coach"></div>
                <div className="absolute top-2 right-2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover/proxy:opacity-100 transition-opacity pointer-events-none">
                    READ ONLY
                </div>
            </div>
        );
    }

    return <>{children}</>;
};
