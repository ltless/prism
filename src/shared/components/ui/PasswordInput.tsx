"use client";

import { useState } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";

interface PasswordInputProps {
 value: string;
 onChange: (v: string) => void;
 label: string;
 placeholder?: string;
}

export function PasswordInput({ value, onChange, label, placeholder }: PasswordInputProps) {
 const [show, setShow] = useState(false);

 return (
 <div>
 <label className="text-[11px] text-muted-text">{label}</label>
 <div className="relative mt-1">
 <input
 type={show ? "text" : "password"}
 value={value}
 onChange={e => onChange(e.target.value)}
 className="w-full px-3 py-2 bg-app-bg border border-main-border rounded-xl text-xs font-bold text-main-text placeholder:text-muted-text/50 focus:border-primary outline-none transition-colors ease-out-expo shadow-inner pr-9"
 placeholder={placeholder || "Enter password..."}
 />
 <button
 type="button"
 onClick={() => setShow(!show)}
 className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-text hover:text-main-text transition-colors ease-out-expo cursor-pointer "
 >
 {show ? <EyeSlash size={15} weight="light" /> : <Eye size={15} weight="light" />}
 </button>
 </div>
 </div>
 );
}
