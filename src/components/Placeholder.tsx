import React from 'react';
export default function Placeholder({ name, ...props }: { name: string; [key: string]: any }) {
  return (
    <div className="p-10 text-center bg-white rounded-[2rem] border border-slate-100 shadow-sm" {...props}>
      <h3 className="text-lg font-black text-slate-900 mb-1">{name}</h3>
      <p className="text-xs font-bold text-slate-400">This component is under reconstruction.</p>
    </div>
  );
}
