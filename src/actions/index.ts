import { defineAction, ActionError, type ActionAPIContext } from "astro:actions";
import { z } from "astro:schema";
import { GeneratedPasswords, PasswordPresets, and, db, eq } from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

async function getOwnedPreset(presetId: string, userId: string) {
  const [preset] = await db
    .select()
    .from(PasswordPresets)
    .where(and(eq(PasswordPresets.id, presetId), eq(PasswordPresets.userId, userId)));

  if (!preset) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Password preset not found.",
    });
  }

  return preset;
}

export const server = {
  createPreset: defineAction({
    input: z.object({
      name: z.string().min(1),
      length: z.number().int().min(4),
      includeLowercase: z.boolean().default(true),
      includeUppercase: z.boolean().default(true),
      includeNumbers: z.boolean().default(true),
      includeSymbols: z.boolean().default(true),
      excludeSimilar: z.boolean().default(false),
      customSymbols: z.string().optional(),
      notes: z.string().optional(),
      isDefault: z.boolean().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const [preset] = await db
        .insert(PasswordPresets)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          name: input.name,
          length: input.length,
          includeLowercase: input.includeLowercase,
          includeUppercase: input.includeUppercase,
          includeNumbers: input.includeNumbers,
          includeSymbols: input.includeSymbols,
          excludeSimilar: input.excludeSimilar,
          customSymbols: input.customSymbols,
          notes: input.notes,
          isDefault: input.isDefault ?? false,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return { success: true, data: { preset } };
    },
  }),

  updatePreset: defineAction({
    input: z
      .object({
        id: z.string().min(1),
        name: z.string().optional(),
        length: z.number().int().min(4).optional(),
        includeLowercase: z.boolean().optional(),
        includeUppercase: z.boolean().optional(),
        includeNumbers: z.boolean().optional(),
        includeSymbols: z.boolean().optional(),
        excludeSimilar: z.boolean().optional(),
        customSymbols: z.string().optional(),
        notes: z.string().optional(),
        isDefault: z.boolean().optional(),
      })
      .refine(
        (input) =>
          input.name !== undefined ||
          input.length !== undefined ||
          input.includeLowercase !== undefined ||
          input.includeUppercase !== undefined ||
          input.includeNumbers !== undefined ||
          input.includeSymbols !== undefined ||
          input.excludeSimilar !== undefined ||
          input.customSymbols !== undefined ||
          input.notes !== undefined ||
          input.isDefault !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedPreset(input.id, user.id);

      const [preset] = await db
        .update(PasswordPresets)
        .set({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.length !== undefined ? { length: input.length } : {}),
          ...(input.includeLowercase !== undefined
            ? { includeLowercase: input.includeLowercase }
            : {}),
          ...(input.includeUppercase !== undefined
            ? { includeUppercase: input.includeUppercase }
            : {}),
          ...(input.includeNumbers !== undefined ? { includeNumbers: input.includeNumbers } : {}),
          ...(input.includeSymbols !== undefined ? { includeSymbols: input.includeSymbols } : {}),
          ...(input.excludeSimilar !== undefined ? { excludeSimilar: input.excludeSimilar } : {}),
          ...(input.customSymbols !== undefined ? { customSymbols: input.customSymbols } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
          updatedAt: new Date(),
        })
        .where(eq(PasswordPresets.id, input.id))
        .returning();

      return { success: true, data: { preset } };
    },
  }),

  listPresets: defineAction({
    input: z.object({
      defaultsOnly: z.boolean().default(false),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const filters = [eq(PasswordPresets.userId, user.id)];
      if (input.defaultsOnly) {
        filters.push(eq(PasswordPresets.isDefault, true));
      }

      const presets = await db.select().from(PasswordPresets).where(and(...filters));

      return { success: true, data: { items: presets, total: presets.length } };
    },
  }),

  logGeneratedPassword: defineAction({
    input: z.object({
      presetId: z.string().optional(),
      encryptedValue: z.string().optional(),
      hintLabel: z.string().optional(),
      length: z.number().optional(),
      wasCopied: z.boolean().optional(),
      lastCopiedAt: z.date().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      if (input.presetId) {
        await getOwnedPreset(input.presetId, user.id);
      }

      const [password] = await db
        .insert(GeneratedPasswords)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          presetId: input.presetId ?? null,
          encryptedValue: input.encryptedValue,
          hintLabel: input.hintLabel,
          length: input.length,
          wasCopied: input.wasCopied ?? false,
          lastCopiedAt: input.lastCopiedAt,
          createdAt: new Date(),
        })
        .returning();

      return { success: true, data: { password } };
    },
  }),

  listGeneratedPasswords: defineAction({
    input: z.object({
      presetId: z.string().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const filters = [eq(GeneratedPasswords.userId, user.id)];
      if (input.presetId) {
        await getOwnedPreset(input.presetId, user.id);
        filters.push(eq(GeneratedPasswords.presetId, input.presetId));
      }

      const passwords = await db.select().from(GeneratedPasswords).where(and(...filters));

      return { success: true, data: { items: passwords, total: passwords.length } };
    },
  }),
};
