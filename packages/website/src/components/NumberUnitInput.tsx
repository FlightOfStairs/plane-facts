import { MenuItem, Select, Stack, TextField } from "@mui/material";
import type { Unit } from "../model/units";
import { UNIT_LABELS, convert, roundForUnit } from "../model/units";

/**
 * Numeric text entry with a unit selector. Switching the unit re-expresses the
 * number so the physical quantity is unchanged (340 lb becomes 154.2 kg).
 * Empty is a distinct state from zero — the caller decides whether that blocks.
 */
export function NumberUnitInput(props: {
  label: string;
  /** Raw text, so "empty" survives round-tripping through the URL. */
  value: string;
  unit: Unit;
  /** Omit or pass empty to render a plain number field with no selector. */
  units?: readonly Unit[];
  onChange: (value: string, unit: Unit) => void;
  required?: boolean;
  /** Shown when empty; the caller treats empty as this value. */
  placeholder?: string;
  helperText?: string;
}) {
  const { label, value, unit, units = [], onChange, required, placeholder, helperText } = props;
  const missing = required && value.trim() === "";
  const parsed = Number(value);
  const invalid = value.trim() !== "" && (!Number.isFinite(parsed) || parsed < 0);

  const changeUnit = (next: Unit) => {
    if (value.trim() === "" || !Number.isFinite(parsed)) return onChange(value, next);
    onChange(String(roundForUnit(convert(parsed, unit, next), next)), next);
  };

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start" }}>
      {/* An unshrunk label occupies the same space as the placeholder and wins,
          so float it whenever there is placeholder text to show. */}
      <TextField size="small" label={label} value={value} onChange={(e) => onChange(e.target.value, unit)} error={missing || invalid} helperText={missing ? "required" : invalid ? "enter a number" : helperText} placeholder={placeholder} slotProps={{ htmlInput: { inputMode: "decimal", "aria-label": label }, inputLabel: placeholder ? { shrink: true } : undefined }} sx={{ flex: 1, minWidth: 0 }} />
      {units.length > 0 && (
        <Select size="small" value={unit} onChange={(e) => changeUnit(e.target.value)} sx={{ minWidth: 78 }} aria-label={`${label} units`}>
          {units.map((u) => (
            <MenuItem key={u} value={u}>
              {UNIT_LABELS[u]}
            </MenuItem>
          ))}
        </Select>
      )}
    </Stack>
  );
}
