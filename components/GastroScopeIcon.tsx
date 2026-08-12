import React from 'react';

export interface GastroScopeIconProps {
  className?: string;
  glow?: boolean;
  colorClass?: string;
}

export const GastroScopeIcon: React.FC<GastroScopeIconProps> = ({ 
  className = "w-5 h-5", 
  glow = false,
  colorClass = ""
}) => (
  <svg 
    className={`${className} ${colorClass} ${glow ? 'filter drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]' : ''} shrink-0 inline-block`} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.8" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    {/* Esophagus top inlet */}
    <path d="M11 2v4" strokeWidth="2" />
    
    {/* Main Stomach Outer Contour */}
    <path 
      d="M11 6c3 0 7.5 2 7.5 7.5C18.5 18 15 20.5 11 20.5c-3.5 0-5.5-1.5-6-4.5V21" 
      strokeWidth="2" 
    />
    
    {/* Stomach Inner Lesser Curvature */}
    <path 
      d="M11 6c1 1.5 2.5 3 2.5 5 0 2.5-2 4.5-4.5 4.5" 
      strokeWidth="1.8" 
    />

    {/* Center Flame / Burning detail */}
    <path 
      d="M11.5 10.5c.8 1.2.2 2.3 0 3-.3.8.3 1.5 1 1.5 1 0 1.5-1 1.5-2 0-1.8-1.5-2.2-2.5-2.5z" 
      fill="currentColor" 
      fillOpacity="0.35" 
      strokeWidth="1.2" 
    />

    {/* Pain / Inflammation sparks on the left */}
    <path d="M2.5 8.5l2.5-2m-3 6.5l3-1" strokeWidth="1.5" />
  </svg>
);

export default GastroScopeIcon;
