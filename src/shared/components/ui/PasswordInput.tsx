import { useState } from "react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { field } from "@/shared/components/ui/styles";

interface PasswordInputProps {
 value: string;
 onChange: (v: string) => void;
 label: string;
 placeholder?: string;
}

export function PasswordInput({ value, onChange, label, placeholder }: PasswordInputProps) {
 const [show, setShow] = useState(false);
 const id = label.toLowerCase().replace(/\s+/g, "-");

 return (
 <div>
 <label htmlFor={id} className="text-[12px] text-muted-text">{label}</label>
 <div className="relative mt-1.5">
 <input
 id={id}
 type={show ? "text" : "password"}
 value={value}
 onChange={e => onChange(e.target.value)}
 className={`${field} h-10 pr-10 font-medium`}
 placeholder={placeholder || "Enter password..."}
 />
 <button
 type="button"
 onClick={() => setShow(!show)}
 aria-label={show ? "Hide password" : "Show password"}
 className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-text transition-colors duration-500 ease-spring hover:text-main-text cursor-pointer"
 >
 {show ? <EyeSlash size={15} weight="light" /> : <Eye size={15} weight="light" />}
 </button>
 </div>
 </div>
 );
}
