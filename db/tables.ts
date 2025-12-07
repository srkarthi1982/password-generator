/**
 * Password Generator - create strong passwords and reusable presets.
 *
 * ⚠ Design note:
 * - We DO NOT recommend storing raw passwords in plaintext in the DB.
 * - This schema focuses on reusable presets and optional encrypted storage.
 * - If storing actual secrets, app layer should encrypt before saving.
 */

import { defineTable, column, NOW } from "astro:db";

export const PasswordPresets = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),

    name: column.text(),                                // "Default strong", "Wi-Fi preset"
    length: column.number(),                            // desired length, e.g. 16
    includeLowercase: column.boolean({ default: true }),
    includeUppercase: column.boolean({ default: true }),
    includeNumbers: column.boolean({ default: true }),
    includeSymbols: column.boolean({ default: true }),
    excludeSimilar: column.boolean({ default: false }), // avoid confusable chars
    customSymbols: column.text({ optional: true }),     // optional override, e.g. "!@#$"

    notes: column.text({ optional: true }),
    isDefault: column.boolean({ default: false }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const GeneratedPasswords = defineTable({
  columns: {
    id: column.text({ primaryKey: true }),
    userId: column.text(),

    presetId: column.text({
      references: () => PasswordPresets.columns.id,
      optional: true,
    }),

    // ⚠ This should be encrypted/obfuscated by the app layer
    encryptedValue: column.text({ optional: true }),     // encrypted password blob
    hintLabel: column.text({ optional: true }),          // "Gmail", "Home Wi-Fi" (no URL or username if not needed)

    length: column.number({ optional: true }),
    wasCopied: column.boolean({ default: false }),
    lastCopiedAt: column.date({ optional: true }),

    createdAt: column.date({ default: NOW }),
  },
});

export const tables = {
  PasswordPresets,
  GeneratedPasswords,
} as const;
