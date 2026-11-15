// The two inputs the sheets lean on, as slots. Pass your own design system's versions in `slots`: each
// gets plain props and a plain `onChange`, so wrapping a toggle or a text field that emits its own
// events takes a line or two.
import { useId, type ComponentType } from "react";

export interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}
export interface TextFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  onChange: (value: string) => void;
}
export interface Slots {
  Toggle: ComponentType<ToggleProps>;
  TextField: ComponentType<TextFieldProps>;
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  const id = useId();
  return (
    <div className="relay-toggle">
      <label htmlFor={id}>
        <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
      </label>
      {description && <small>{description}</small>}
    </div>
  );
}

function TextField({ label, value, placeholder, maxLength, required, onChange }: TextFieldProps) {
  const id = useId();
  return (
    <label className="relay-field" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="text" value={value} placeholder={placeholder} maxLength={maxLength} required={required} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export const defaultSlots: Slots = { Toggle, TextField };
