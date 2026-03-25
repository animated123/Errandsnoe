import React from 'react';
import { User as UserIcon } from 'lucide-react';

interface UserAvatarProps {
  src?: string | null;
  name?: string;
  className?: string;
  size?: number;
}

const UserAvatar: React.FC<UserAvatarProps> = ({ src, name, className = "w-12 h-12", size = 24 }) => {
  if (src && !src.includes('pravatar.cc') && !src.includes('ui-avatars.com')) {
    return (
      <img 
        src={src} 
        alt={name || 'User'} 
        className={`${className} object-cover rounded-full`}
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className={`${className} bg-slate-100 flex items-center justify-center text-slate-400 rounded-full border border-slate-200 shadow-inner`}>
      <UserIcon size={size} strokeWidth={2.5} />
    </div>
  );
};

export default UserAvatar;
