/**
 * 6-digit OTP input — one box per digit.
 *
 * - Auto-advances focus on input.
 * - Backspace moves to previous box.
 * - Paste fills all 6 digits.
 * - Auto-submits when last digit is entered.
 */

"use client";

import { useCallback, useRef } from "react";

interface OTPInputProps {
  value: string;
  onChange: (otp: string) => void;
  onComplete: (otp: string) => void;
  disabled?: boolean;
}

const OTP_LENGTH = 6;

export default function OTPInput({ value, onChange, onComplete, disabled = false }: OTPInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = value.padEnd(OTP_LENGTH, "").slice(0, OTP_LENGTH).split("");

  const focusInput = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, OTP_LENGTH - 1));
    inputRefs.current[clamped]?.focus();
  }, []);

  const handleChange = useCallback(
    (index: number, inputValue: string) => {
      // Only accept digits
      const digit = inputValue.replace(/\D/g, "").slice(-1);
      if (!digit) return;

      const newDigits = [...digits];
      newDigits[index] = digit;
      const newOtp = newDigits.join("");
      onChange(newOtp);

      if (index < OTP_LENGTH - 1) {
        focusInput(index + 1);
      }

      // Auto-submit when all 6 digits filled
      if (newOtp.replace(/\s/g, "").length === OTP_LENGTH) {
        onComplete(newOtp);
      }
    },
    [digits, onChange, onComplete, focusInput],
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        const newDigits = [...digits];
        if (digits[index]) {
          // Clear current digit
          newDigits[index] = "";
          onChange(newDigits.join(""));
        } else if (index > 0) {
          // Move to previous and clear it
          newDigits[index - 1] = "";
          onChange(newDigits.join(""));
          focusInput(index - 1);
        }
      } else if (e.key === "ArrowLeft" && index > 0) {
        focusInput(index - 1);
      } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
        focusInput(index + 1);
      }
    },
    [digits, onChange, focusInput],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
      if (!pasted) return;

      onChange(pasted.padEnd(OTP_LENGTH, "").slice(0, OTP_LENGTH));

      // Focus last filled input
      const lastIndex = Math.min(pasted.length, OTP_LENGTH) - 1;
      focusInput(lastIndex);

      if (pasted.length >= OTP_LENGTH) {
        onComplete(pasted.slice(0, OTP_LENGTH));
      }
    },
    [onChange, onComplete, focusInput],
  );

  return (
    <div
      style={{ display: "flex", justifyContent: "center", gap: 10 }}
      data-testid="otp-input"
    >
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={digits[i]?.trim() || ""}
          disabled={disabled}
          data-testid={`otp-digit-${i}`}
          aria-label={`OTP digit ${i + 1}`}
          className="mono"
          style={{
            width: 44,
            height: 52,
            textAlign: "center",
            fontSize: 22,
            fontWeight: 600,
            color: "var(--ink)",
            background: "var(--panel)",
            border: "1px solid var(--line-2)",
            borderRadius: "var(--radius-2)",
            outline: "none",
            transition: "border-color .12s, box-shadow .12s",
            opacity: disabled ? 0.5 : 1,
          }}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => {
            e.target.select();
            e.target.style.borderColor = "var(--signal)";
            e.target.style.boxShadow = "0 0 0 3px rgba(194,90,17,.15)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "var(--line-2)";
            e.target.style.boxShadow = "none";
          }}
        />
      ))}
    </div>
  );
}
