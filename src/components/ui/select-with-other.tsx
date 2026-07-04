"use client";

import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const OTRO = "__otro__";

interface SelectWithOtherProps {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  otherPlaceholder?: string;
  disabled?: boolean;
  /** id del <Label> asociado — se pasa al trigger como aria-labelledby */
  ariaLabelledby?: string;
  /** id para el input "Otro" cuando el Label debe apuntar directamente a él */
  otherInputId?: string;
}

/**
 * Select con opción "Otro" al final. Cuando se elige "Otro" aparece
 * un input para ingresar un valor personalizado. El onValueChange
 * siempre recibe el valor final (nunca el sentinel "__otro__").
 */
export function SelectWithOther({
  value,
  onValueChange,
  options,
  placeholder = "Seleccioná",
  otherPlaceholder = "Especificá...",
  disabled,
  ariaLabelledby,
  otherInputId,
}: SelectWithOtherProps) {
  const isCustom = value !== "" && !options.includes(value);
  const selectVal = isCustom ? OTRO : value;

  const handleSelect = (v: string) => {
    if (v === OTRO) {
      onValueChange("");
    } else {
      onValueChange(v);
    }
  };

  return (
    <div className="space-y-2">
      <Select value={selectVal} onValueChange={handleSelect} disabled={disabled}>
        <SelectTrigger aria-labelledby={ariaLabelledby}>
          <SelectValue placeholder={placeholder}>
            {isCustom ? value : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map(o => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
          <SelectItem value={OTRO}>Otro</SelectItem>
        </SelectContent>
      </Select>
      {(selectVal === OTRO || isCustom) && (
        <Input
          id={otherInputId}
          autoFocus={!isCustom}
          placeholder={otherPlaceholder}
          aria-label={!otherInputId ? otherPlaceholder : undefined}
          value={isCustom ? value : ""}
          onChange={e => onValueChange(e.target.value)}
        />
      )}
    </div>
  );
}
