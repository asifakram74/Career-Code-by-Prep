import React, { useState } from 'react';
import careerCodeLogoAsset from '../../assets/career-code-logo.jpg';

interface CareerCodeLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  alt?: string;
}

/**
 * CareerCodeLogo: Centralized, bulletproof Career Code brand logo component.
 * Uses Vite bundled asset with rounded corners and multi-level fallbacks.
 */
export const CareerCodeLogo: React.FC<CareerCodeLogoProps> = ({
  className = '',
  size = 'md',
  alt = 'Career Code by Prep Titans Logo',
}) => {
  const [imgSrc, setImgSrc] = useState<string>(careerCodeLogoAsset);

  const sizeClasses = {
    sm: 'w-8 h-8 rounded-xl',
    md: 'w-8 h-8 sm:w-9 sm:h-9 rounded-xl',
    lg: 'w-10 h-10 sm:w-12 sm:h-12 rounded-2xl',
    xl: 'w-14 h-14 sm:w-16 sm:h-16 rounded-2xl',
  }[size];

  return (
    <img
      src={imgSrc}
      alt={alt}
      onError={() => {
        if (imgSrc === careerCodeLogoAsset) {
          setImgSrc('/career-code-logo.jpg');
        } else if (imgSrc === '/career-code-logo.jpg') {
          setImgSrc('/assets/aistudio/images_87b77b11.jpg');
        }
      }}
      className={`object-cover bg-white border border-pink-100 shadow-xs shadow-pink-200 shrink-0 ${sizeClasses} ${className}`}
      loading="eager"
    />
  );
};
